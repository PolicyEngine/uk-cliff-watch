"""UK benefit-cliff calculator built on policyengine-uk.

Mirrors the shape of the US cliff-watch calculator: it traces a household's net
income across an earnings curve to surface cliffs and high marginal rates, and
compares a household across UK regions and across household templates.
"""
from __future__ import annotations

import argparse
import json
import math
import os
import sys
import warnings
from dataclasses import dataclass, field, replace
from typing import Any

from uk_cliff_watch.config import (
    BENEFIT_COMPONENTS,
    DEFAULT_CLIFF_DELTA,
    DEFAULT_SERIES_EARNINGS_BUFFER,
    DEFAULT_SERIES_MAX_EARNINGS,
    DEFAULT_SERIES_MIN_EARNINGS_WINDOW,
    DEFAULT_SERIES_STEP,
    DEFAULT_SERIES_STEP_INCREMENT,
    DEFAULT_SERIES_TARGET_POINTS,
    DEFAULT_YEAR,
    HOUSEHOLD_TYPE_BY_ID,
    HOUSEHOLD_TYPES,
    MAX_ADULTS,
    MAX_DEPENDENTS,
    REGION_INFO,
    REGION_NAME_BY_CODE,
    TAX_COMPONENTS,
)


class CalculatorDependencyError(RuntimeError):
    pass


BENEFIT_BY_KEY = {item["key"]: item for item in BENEFIT_COMPONENTS}
TAX_BY_KEY = {item["key"]: item for item in TAX_COMPONENTS}
_MISSING_VARIABLE_WARNINGS_EMITTED: set[str] = set()


@dataclass(frozen=True)
class HouseholdMemberInput:
    age: int
    kind: str  # "adult" | "child"
    is_disabled: bool = False


@dataclass(frozen=True)
class HouseholdInput:
    region: str
    earned_income: float
    year: int = DEFAULT_YEAR
    people: tuple[HouseholdMemberInput, ...] = ()
    household_type: str | None = None
    rent_annual: float = 0.0
    childcare_expenses_annual: float = 0.0
    is_renting: bool = True


# --------------------------------------------------------------------------- #
# PolicyEngine loading                                                         #
# --------------------------------------------------------------------------- #
def _load_simulation():
    repo = os.getenv("POLICYENGINE_UK_REPO")
    if repo and repo not in sys.path:
        sys.path.insert(0, repo)
    try:
        from policyengine_uk import Simulation
    except ModuleNotFoundError as exc:  # pragma: no cover
        raise CalculatorDependencyError(
            "policyengine-uk is not installed. Run `pip install -r requirements.txt`."
        ) from exc
    return Simulation


def _as_float_list(value: Any) -> list[float]:
    if hasattr(value, "tolist"):
        value = value.tolist()
    if isinstance(value, list):
        if value and isinstance(value[0], list):
            value = value[0]
        return [float(item) for item in value]
    return [float(value)]


def _as_scalar(value: Any) -> float:
    values = _as_float_list(value)
    return values[0] if values else 0.0


def _nonnegative(value: Any) -> float:
    return max(0.0, float(value or 0.0))


# --------------------------------------------------------------------------- #
# Household construction                                                       #
# --------------------------------------------------------------------------- #
def _compat_people_from_template(household_type: str) -> tuple[HouseholdMemberInput, ...]:
    template = HOUSEHOLD_TYPE_BY_ID[household_type]
    return tuple(
        HouseholdMemberInput(
            age=int(person["age"]),
            kind="child" if person["role"] == "dependent" else "adult",
        )
        for person in template["people"]
    )


def _input_people(payload: HouseholdInput) -> tuple[HouseholdMemberInput, ...]:
    if payload.people:
        return payload.people
    if payload.household_type:
        return _compat_people_from_template(payload.household_type)
    return ()


def _resolved_people(payload: HouseholdInput) -> list[dict[str, Any]]:
    people: list[dict[str, Any]] = []
    adult_index = 0
    child_index = 0
    for member in _input_people(payload):
        if member.kind == "adult":
            adult_index += 1
            person_id = f"adult_{adult_index}"
            role = "head" if adult_index == 1 else "spouse"
        else:
            child_index += 1
            person_id = f"child_{child_index}"
            role = "dependent"
        people.append(
            {
                "id": person_id,
                "role": role,
                "kind": member.kind,
                "age": int(member.age),
                "is_disabled": bool(member.is_disabled),
            }
        )
    return people


def _household_descriptor(payload: HouseholdInput) -> dict[str, Any]:
    if payload.household_type and not payload.people:
        template = HOUSEHOLD_TYPE_BY_ID[payload.household_type]
        return {**template, "people": _resolved_people(payload)}

    people = _resolved_people(payload)
    num_adults = sum(1 for p in people if p["kind"] == "adult")
    num_children = sum(1 for p in people if p["kind"] == "child")
    adult_ages = [str(p["age"]) for p in people if p["kind"] == "adult"]
    child_ages = [str(p["age"]) for p in people if p["kind"] == "child"]
    parts = []
    if adult_ages:
        parts.append(f"Adult ages: {', '.join(adult_ages)}")
    if child_ages:
        parts.append(f"Child ages: {', '.join(child_ages)}")
    return {
        "id": "custom_household",
        "label": f"{num_adults} adult{'s' if num_adults != 1 else ''} + "
        f"{num_children} child{'ren' if num_children != 1 else ''}",
        "short_label": f"{num_adults}A/{num_children}C",
        "description": ". ".join(parts) if parts else "Custom household.",
        "summary": "The first adult is the primary earner whose pay varies along the curve.",
        "people": people,
    }


def _validate_input(payload: HouseholdInput) -> None:
    if payload.region not in REGION_NAME_BY_CODE:
        raise ValueError(f"Unsupported region code: {payload.region}")
    if payload.household_type and payload.household_type not in HOUSEHOLD_TYPE_BY_ID:
        raise ValueError(f"Unsupported household_type: {payload.household_type}")
    if payload.earned_income < 0:
        raise ValueError("earned_income must be non-negative")
    people = _input_people(payload)
    if not people:
        raise ValueError("At least one household member is required")
    if not any(p.kind == "adult" for p in people):
        raise ValueError("At least one adult household member is required")
    if sum(1 for p in people if p.kind == "adult") > MAX_ADULTS:
        raise ValueError(f"At most {MAX_ADULTS} adults are supported")
    if sum(1 for p in people if p.kind == "child") > MAX_DEPENDENTS:
        raise ValueError(f"At most {MAX_DEPENDENTS} children are supported")
    for p in people:
        if p.kind not in {"adult", "child"}:
            raise ValueError(f"Unsupported member kind: {p.kind}")
        if p.age < 0 or p.age > 120:
            raise ValueError(f"Invalid age: {p.age}")


def _build_situation(payload: HouseholdInput, *, vary_income: bool, point_count: int,
                     min_earnings: int, max_earnings: int) -> dict[str, Any]:
    _validate_input(payload)
    year = payload.year
    descriptor = _household_descriptor(payload)
    members = descriptor["people"]
    member_ids = [p["id"] for p in members]

    people: dict[str, Any] = {}
    for index, person in enumerate(members):
        person_data: dict[str, Any] = {
            "age": {year: person["age"]},
        }
        if index == 0:
            # Primary earner: either a fixed value or the axis sweep.
            if not vary_income:
                person_data["employment_income"] = {year: float(payload.earned_income)}
        else:
            person_data["employment_income"] = {year: 0.0}
        if person["kind"] == "child" and payload.childcare_expenses_annual > 0:
            person_data["childcare_expenses"] = {
                year: _nonnegative(payload.childcare_expenses_annual)
            }
        people[person["id"]] = person_data

    household: dict[str, Any] = {
        "members": member_ids,
        "region": {year: payload.region},
    }
    if payload.rent_annual > 0:
        household["rent"] = {year: _nonnegative(payload.rent_annual)}
    benunit: dict[str, Any] = {"members": member_ids}
    if payload.rent_annual > 0:
        benunit["benunit_is_renting"] = {year: bool(payload.is_renting)}

    situation: dict[str, Any] = {
        "people": people,
        "benunits": {"benunit": benunit},
        "households": {"household": household},
    }
    if vary_income:
        situation["axes"] = [
            [
                {
                    "name": "employment_income",
                    "period": year,
                    "min": max(0, int(min_earnings)),
                    "max": int(max_earnings),
                    "count": point_count,
                }
            ]
        ]
    return situation


# --------------------------------------------------------------------------- #
# Variable extraction                                                          #
# --------------------------------------------------------------------------- #
def _variable_exists(simulation: Any, variable: str) -> bool:
    return variable in getattr(simulation.tax_benefit_system, "variables", {})


def _warn_missing(variable: str) -> None:
    if variable in _MISSING_VARIABLE_WARNINGS_EMITTED:
        return
    warnings.warn(f"Variable {variable!r} missing from installed policyengine-uk", stacklevel=2)
    _MISSING_VARIABLE_WARNINGS_EMITTED.add(variable)


def _calc(simulation: Any, variable: str, year: int, *, map_to: str = "household") -> float:
    if not _variable_exists(simulation, variable):
        _warn_missing(variable)
        return 0.0
    return _as_scalar(simulation.calculate(variable, period=year, map_to=map_to))


def _calc_array(simulation: Any, variable: str, year: int, *, map_to: str = "household") -> list[float]:
    if not _variable_exists(simulation, variable):
        _warn_missing(variable)
        return []
    return _as_float_list(simulation.calculate(variable, period=year, map_to=map_to))


def _normalize(values: list[float], point_count: int) -> list[float]:
    if not values:
        return [0.0] * point_count
    if len(values) == point_count:
        return values
    if len(values) == 1:
        return values * point_count
    if len(values) > point_count:
        return values[:point_count]
    return values + [values[-1]] * (point_count - len(values))


def _components_at(simulation: Any, year: int) -> tuple[dict[str, float], dict[str, float]]:
    benefits = {item["key"]: round(_calc(simulation, item["variable"], year), 2)
                for item in BENEFIT_COMPONENTS}
    taxes = {item["key"]: round(_calc(simulation, item["variable"], year), 2)
             for item in TAX_COMPONENTS}
    return benefits, taxes


# --------------------------------------------------------------------------- #
# Single-household calculation (with cliff + EMTR)                             #
# --------------------------------------------------------------------------- #
def _simulate_point(payload: HouseholdInput) -> dict[str, Any]:
    Simulation = _load_simulation()
    situation = _build_situation(
        payload, vary_income=False, point_count=1, min_earnings=0,
        max_earnings=int(payload.earned_income),
    )
    simulation = Simulation(situation=situation)
    year = payload.year

    market_income = _calc(simulation, "household_market_income", year)
    net_income = _calc(simulation, "household_net_income", year)
    benefits, taxes = _components_at(simulation, year)
    total_benefits = round(sum(benefits.values()), 2)
    total_tax = round(sum(taxes.values()), 2)
    rent = _nonnegative(payload.rent_annual)
    net_after_housing = round(net_income - rent, 2)

    descriptor = _household_descriptor(payload)
    return {
        "market_income": round(market_income, 2),
        "net_income": round(net_income, 2),
        "net_after_housing": net_after_housing,
        "total_benefits": total_benefits,
        "total_tax": total_tax,
        "benefits": benefits,
        "taxes": taxes,
        "rent_annual": rent,
        "descriptor": descriptor,
    }


def _program_breakdown(benefits: dict[str, float], taxes: dict[str, float]) -> list[dict[str, Any]]:
    rows = []
    for item in BENEFIT_COMPONENTS:
        annual = round(benefits.get(item["key"], 0.0), 2)
        if annual <= 0:
            continue
        rows.append({**{k: item[k] for k in ("key", "label", "short_label", "description")},
                     "kind": "benefit", "annual": annual, "monthly": round(annual / 12, 2)})
    for item in TAX_COMPONENTS:
        annual = round(taxes.get(item["key"], 0.0), 2)
        if annual <= 0:
            continue
        rows.append({**{k: item[k] for k in ("key", "label", "short_label", "description")},
                     "kind": "tax", "annual": -annual, "monthly": round(-annual / 12, 2)})
    return rows


def calculate_household(payload: HouseholdInput, *, delta: int = DEFAULT_CLIFF_DELTA) -> dict[str, Any]:
    base = _simulate_point(payload)
    bumped = _simulate_point(replace(payload, earned_income=payload.earned_income + delta))
    change = bumped["net_income"] - base["net_income"]
    gap = max(0.0, -change)
    emtr = round(1 - (change / delta), 4) if delta else 0.0
    descriptor = base.pop("descriptor")

    return {
        "input": {
            "region": payload.region,
            "earned_income": payload.earned_income,
            "year": payload.year,
            "rent_annual": payload.rent_annual,
            "childcare_expenses_annual": payload.childcare_expenses_annual,
            "people": [
                {"kind": p["kind"], "age": p["age"], "is_disabled": p["is_disabled"]}
                for p in descriptor["people"]
            ],
        },
        "template": {k: descriptor[k] for k in ("id", "label", "short_label", "description", "summary")},
        "counts": {
            "num_adults": sum(1 for p in descriptor["people"] if p["kind"] == "adult"),
            "num_children": sum(1 for p in descriptor["people"] if p["kind"] == "child"),
        },
        "region_name": REGION_NAME_BY_CODE[payload.region],
        "state_name": REGION_NAME_BY_CODE[payload.region],
        "totals": {
            "market_income": base["market_income"],
            "net_income": base["net_income"],
            "net_resources": base["net_income"],
            "core_support": base["total_benefits"],
            "taxes": base["total_tax"],
            "net_after_housing": base["net_after_housing"],
            "total_benefits": base["total_benefits"],
            "total_tax": base["total_tax"],
        },
        "monthly": {
            "market_income": round(base["market_income"] / 12, 2),
            "net_income": round(base["net_income"] / 12, 2),
            "total_benefits": round(base["total_benefits"] / 12, 2),
            "total_tax": round(base["total_tax"] / 12, 2),
        },
        "benefits": base["benefits"],
        "taxes": base["taxes"],
        "program_breakdown": _program_breakdown(base["benefits"], base["taxes"]),
        "eligible": base["total_benefits"] > 0,
        "cliff": {
            "delta_annual": delta,
            "resource_change_annual": round(change, 2),
            "resource_change_monthly": round(change / 12, 2),
            "gap_annual": round(gap, 2),
            "gap_monthly": round(gap / 12, 2),
            "effective_marginal_rate": emtr,
            "is_on_cliff": gap > 0,
        },
    }


# --------------------------------------------------------------------------- #
# Earnings series (the cliff curve)                                           #
# --------------------------------------------------------------------------- #
def _round_up(value: int, increment: int) -> int:
    if increment <= 0:
        return max(1, value)
    return max(increment, math.ceil(value / increment) * increment)


def _resolve_max_earnings(payload: HouseholdInput, requested_max: int) -> int:
    floor = max(DEFAULT_SERIES_MIN_EARNINGS_WINDOW,
                int(payload.earned_income) + DEFAULT_SERIES_EARNINGS_BUFFER)
    return max(floor, requested_max)


def _resolve_step(max_earnings: int, requested_step: int) -> int:
    step = max(1, requested_step)
    if (max_earnings // step) + 1 <= DEFAULT_SERIES_TARGET_POINTS:
        return step
    minimum = math.ceil(max_earnings / max(1, DEFAULT_SERIES_TARGET_POINTS - 1))
    return _round_up(max(step, minimum), DEFAULT_SERIES_STEP_INCREMENT)


def _build_cliff_drivers(prev: dict[str, Any], cur: dict[str, Any]) -> list[dict[str, Any]]:
    drivers = []
    for item in BENEFIT_COMPONENTS:
        change = round(cur["benefits"].get(item["key"], 0.0) - prev["benefits"].get(item["key"], 0.0), 2)
        if change < 0:
            drivers.append({"key": item["key"], "label": item["label"], "kind": "benefit_loss",
                            "resource_effect_annual": change,
                            "resource_effect_monthly": round(change / 12, 2)})
    for item in TAX_COMPONENTS:
        change = round(cur["taxes"].get(item["key"], 0.0) - prev["taxes"].get(item["key"], 0.0), 2)
        if change > 0:
            drivers.append({"key": item["key"], "label": f"Higher {item['label']}", "kind": "tax_increase",
                            "resource_effect_annual": round(-change, 2),
                            "resource_effect_monthly": round(-change / 12, 2)})
    return sorted(drivers, key=lambda d: (d["resource_effect_annual"], d["label"]))


def calculate_income_series(payload: HouseholdInput, *,
                            max_earned_income: int = DEFAULT_SERIES_MAX_EARNINGS,
                            step: int = DEFAULT_SERIES_STEP) -> dict[str, Any]:
    eff_max = _resolve_max_earnings(payload, max_earned_income)
    eff_step = _resolve_step(eff_max, step)
    aligned_max = _round_up(eff_max, eff_step)
    point_count = max(2, (aligned_max // eff_step) + 1)

    Simulation = _load_simulation()
    situation = _build_situation(payload, vary_income=True, point_count=point_count,
                                 min_earnings=0, max_earnings=aligned_max)
    simulation = Simulation(situation=situation)
    year = payload.year

    earnings = _normalize(_calc_array(simulation, "employment_income", year), point_count)
    market = _normalize(_calc_array(simulation, "household_market_income", year), point_count)
    net = _normalize(_calc_array(simulation, "household_net_income", year), point_count)
    benefit_series = {item["key"]: _normalize(_calc_array(simulation, item["variable"], year), point_count)
                      for item in BENEFIT_COMPONENTS}
    tax_series = {item["key"]: _normalize(_calc_array(simulation, item["variable"], year), point_count)
                  for item in TAX_COMPONENTS}
    rent = _nonnegative(payload.rent_annual)

    points = []
    for i in range(point_count):
        benefits = {k: round(v[i], 2) for k, v in benefit_series.items()}
        taxes = {k: round(v[i], 2) for k, v in tax_series.items()}
        points.append({
            "earned_income": round(earnings[i], 2),
            "market_income": round(market[i], 2),
            "net_income": round(net[i], 2),
            "net_after_housing": round(net[i] - rent, 2),
            "total_benefits": round(sum(benefits.values()), 2),
            "total_tax": round(sum(taxes.values()), 2),
            "benefits": benefits,
            "taxes": taxes,
        })

    data = []
    prev = None
    for point in points:
        net_change = 0.0
        emtr = 0.0
        cliff_drop = 0.0
        drivers: list[dict[str, Any]] = []
        if prev is not None:
            d_earn = point["earned_income"] - prev["earned_income"]
            net_change = round(point["net_income"] - prev["net_income"], 2)
            if d_earn > 0:
                emtr = round(1 - (net_change / d_earn), 4)
            cliff_drop = round(max(0.0, -net_change), 2)
            if net_change < 0:
                drivers = _build_cliff_drivers(prev, point)
        data.append({
            "earned_income": point["earned_income"],
            # US-compatible field names (consumed by the ported frontend / cliffReport):
            "net_resources": point["net_income"],
            "core_support": point["total_benefits"],
            "taxes": point["total_tax"],
            "step_annual": eff_step,
            # each benefit program as a top-level key for the stacked area chart
            **point["benefits"],
            # UK-native extras (kept for our own API consumers):
            "net_income": point["net_income"],
            "net_after_housing": point["net_after_housing"],
            "market_income": point["market_income"],
            "total_benefits": point["total_benefits"],
            "total_tax": point["total_tax"],
            "benefit_components": point["benefits"],
            "tax_components": point["taxes"],
            "net_change_annual": net_change,
            "effective_marginal_rate": emtr,
            "marginal_rate_pct": round(emtr * 100, 1),
            "is_cliff": cliff_drop > 0,
            "cliff_drop_annual": cliff_drop,
            "cliff_drivers": drivers,
            "has_previous_point": prev is not None,
        })
        prev = point

    return {
        "data": data,
        "step_annual": eff_step,
        "requested_step_annual": step,
        "max_earned_income": data[-1]["earned_income"] if data else 0,
        "requested_max_earned_income": max_earned_income,
        "point_count": len(data),
        "max_net_income": max((d["net_income"] for d in data), default=0),
        "max_net_resources": max((d["net_resources"] for d in data), default=0),
        "max_marginal_rate_pct": max((d["marginal_rate_pct"] for d in data), default=0),
        "truncated": False,
        "truncation_reason": None,
    }


# --------------------------------------------------------------------------- #
# Comparisons: across regions and across household templates                  #
# --------------------------------------------------------------------------- #
def calculate_region_comparison(payload: HouseholdInput) -> dict[str, Any]:
    results = []
    for region in REGION_INFO:
        scenario = replace(payload, region=region["code"])
        point = _simulate_point(scenario)
        results.append({
            "region": region["code"],
            "region_name": region["name"],
            "net_income_annual": point["net_income"],
            "net_resources_annual": point["net_income"],
            "net_income_monthly": round(point["net_income"] / 12, 2),
            "net_after_housing_annual": point["net_after_housing"],
            "total_benefits_annual": point["total_benefits"],
            "total_tax_annual": point["total_tax"],
        })
    ranked = sorted(results, key=lambda r: (-r["net_income_annual"], r["region_name"]))
    for index, item in enumerate(ranked, start=1):
        item["rank"] = index
    return {"regions": ranked,
            "max_net_income": max((r["net_income_annual"] for r in ranked), default=0)}


def calculate_household_types(payload: HouseholdInput) -> dict[str, Any]:
    results = []
    for template in HOUSEHOLD_TYPES:
        scenario = replace(payload, household_type=template["id"], people=())
        point = _simulate_point(scenario)
        people = _resolved_people(scenario)
        results.append({
            "household_type": template["id"],
            "label": template["label"],
            "short_label": template["short_label"],
            "description": template["description"],
            "net_income_annual": point["net_income"],
            "net_resources_annual": point["net_income"],
            "net_resources_monthly": round(point["net_income"] / 12, 2),
            "net_income_monthly": round(point["net_income"] / 12, 2),
            "total_benefits_annual": point["total_benefits"],
            "core_support_annual": point["total_benefits"],
            "total_tax_annual": point["total_tax"],
            "counts": {
                "num_adults": sum(1 for p in people if p["kind"] == "adult"),
                "num_children": sum(1 for p in people if p["kind"] == "child"),
            },
        })
    ranked = sorted(results, key=lambda r: (-r["net_income_annual"], r["label"]))
    for index, item in enumerate(ranked, start=1):
        item["rank"] = index
    return {"households": ranked,
            "max_net_resources": max((r["net_income_annual"] for r in ranked), default=0),
            "max_net_income": max((r["net_income_annual"] for r in ranked), default=0)}


# --------------------------------------------------------------------------- #
# Payload parsing + CLI                                                        #
# --------------------------------------------------------------------------- #
def household_input_from_dict(data: dict[str, Any]) -> HouseholdInput:
    def numeric(field_name: str) -> float:
        return float(data.get(field_name, 0) or 0)

    people = tuple(
        HouseholdMemberInput(
            age=int(person["age"]),
            kind=str(person.get("kind") or ("child" if int(person["age"]) < 18 else "adult")),
            is_disabled=bool(person.get("is_disabled", False)),
        )
        for person in data.get("people", [])
    )
    return HouseholdInput(
        region=data["region"],
        earned_income=numeric("earned_income"),
        year=int(data.get("year", DEFAULT_YEAR)),
        people=people,
        household_type=data.get("household_type"),
        rent_annual=numeric("rent_annual"),
        childcare_expenses_annual=numeric("childcare_expenses_annual"),
        is_renting=bool(data.get("is_renting", numeric("rent_annual") > 0)),
    )


def _parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="UK cliff-watch calculator")
    parser.add_argument("input", nargs="?", default="examples/sample_household.json",
                        help="Path to input JSON, or '-' for stdin.")
    parser.add_argument("--mode", choices=["household", "series", "regions", "households"],
                        default="household")
    parser.add_argument("--max-earned-income", type=int, default=DEFAULT_SERIES_MAX_EARNINGS)
    parser.add_argument("--step", type=int, default=DEFAULT_SERIES_STEP)
    parser.add_argument("--delta", type=int, default=DEFAULT_CLIFF_DELTA)
    return parser.parse_args()


def main() -> None:
    args = _parse_args()
    if args.input == "-":
        raw = json.load(sys.stdin)
    else:
        with open(args.input) as handle:
            raw = json.load(handle)
    payload = household_input_from_dict(raw)

    if args.mode == "household":
        output: Any = calculate_household(payload, delta=args.delta)
    elif args.mode == "series":
        output = calculate_income_series(payload, max_earned_income=args.max_earned_income, step=args.step)
    elif args.mode == "regions":
        output = calculate_region_comparison(payload)
    else:
        output = calculate_household_types(payload)
    print(json.dumps(output, indent=2))


if __name__ == "__main__":
    main()
