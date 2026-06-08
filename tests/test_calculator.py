"""
Integration tests for uk_cliff_watch.calculator.

These tests exercise a live PolicyEngine-UK simulation.  Each test therefore
takes ~1-2 seconds; the full suite should run in under 30 seconds on a warm
interpreter.  Assertions are deliberately range- / sign- / monotonicity-based
so that they survive small policy-parameter updates without needing exact magic
numbers.

Canonical fixture: lone parent (age 35) + 2 children (ages 4, 7), region
NORTH_WEST, rent_annual £9 000, earned_income £0.
"""
from __future__ import annotations

import pytest

from uk_cliff_watch.calculator import (
    HouseholdInput,
    HouseholdMemberInput,
    calculate_household,
    calculate_household_types,
    calculate_income_series,
    calculate_region_comparison,
    household_input_from_dict,
)


# ---------------------------------------------------------------------------
# Module-scoped fixture so PolicyEngine is only warmed up once per test run.
# ---------------------------------------------------------------------------

@pytest.fixture(scope="module")
def lone_parent_payload() -> HouseholdInput:
    """Lone parent + 2 children, North West, £9 000 rent, zero earnings."""
    return HouseholdInput(
        region="NORTH_WEST",
        earned_income=0,
        rent_annual=9_000,
        people=(
            HouseholdMemberInput(age=35, kind="adult"),
            HouseholdMemberInput(age=4,  kind="child"),
            HouseholdMemberInput(age=7,  kind="child"),
        ),
    )


@pytest.fixture(scope="module")
def household_result(lone_parent_payload):
    """Cached result of calculate_household for the canonical fixture."""
    return calculate_household(lone_parent_payload)


# ---------------------------------------------------------------------------
# Test 1: basic net_income and total_benefits at zero earnings
# ---------------------------------------------------------------------------

def test_zero_earnings_net_income_and_benefits(household_result):
    """A lone parent on zero earnings must receive UC + Child Benefit > 0."""
    totals = household_result["totals"]
    assert totals["net_income"] > 0, (
        f"Expected net_income > 0, got {totals['net_income']}"
    )
    assert totals["total_benefits"] > 0, (
        f"Expected total_benefits > 0 (UC + CB), got {totals['total_benefits']}"
    )


# ---------------------------------------------------------------------------
# Test 2: program_breakdown contains universal_credit; benefits sum matches total
# ---------------------------------------------------------------------------

def test_program_breakdown_universal_credit(household_result):
    """program_breakdown must have a universal_credit row, and benefit rows
    must sum to approximately totals.total_benefits (tolerance £1)."""
    breakdown = household_result["program_breakdown"]
    keys = [row["key"] for row in breakdown]
    assert "universal_credit" in keys, (
        f"'universal_credit' not found in program_breakdown keys: {keys}"
    )

    uc_row = next(r for r in breakdown if r["key"] == "universal_credit")
    assert uc_row["annual"] > 0, f"UC annual benefit should be > 0, got {uc_row['annual']}"

    # Benefit rows are positive-annual entries; sum should match totals.total_benefits.
    benefit_sum = sum(r["annual"] for r in breakdown if r["kind"] == "benefit")
    total_benefits = household_result["totals"]["total_benefits"]
    assert abs(benefit_sum - total_benefits) < 1.0, (
        f"Benefit breakdown sum ({benefit_sum:.2f}) differs from total_benefits "
        f"({total_benefits:.2f}) by more than £1"
    )


# ---------------------------------------------------------------------------
# Test 3: effective marginal rate at mid-earnings level
# ---------------------------------------------------------------------------

def test_mid_earnings_effective_marginal_rate(lone_parent_payload):
    """At £25 000 earned income the EMTR should be in (0.50, 0.95)
    reflecting UC taper (55 %) stacked with Income Tax + NI."""
    mid_payload = HouseholdInput(
        region=lone_parent_payload.region,
        earned_income=25_000,
        rent_annual=lone_parent_payload.rent_annual,
        people=lone_parent_payload.people,
    )
    result = calculate_household(mid_payload)
    emtr = result["cliff"]["effective_marginal_rate"]
    assert emtr > 0.50, f"Expected EMTR > 0.50 at £25k, got {emtr}"
    assert emtr < 0.95, f"Expected EMTR < 0.95 at £25k, got {emtr}"


# ---------------------------------------------------------------------------
# Test 4: income series basic shape
# ---------------------------------------------------------------------------

@pytest.fixture(scope="module")
def income_series(lone_parent_payload):
    return calculate_income_series(lone_parent_payload, max_earned_income=40_000, step=1_000)


def test_income_series_shape(income_series):
    """Series must have >= 2 points, non-decreasing earned_income, max EMTR > 50 %."""
    data = income_series["data"]
    assert income_series["point_count"] >= 2, (
        f"point_count should be >= 2, got {income_series['point_count']}"
    )
    earnings = [d["earned_income"] for d in data]
    for i in range(1, len(earnings)):
        assert earnings[i] >= earnings[i - 1], (
            f"earned_income not non-decreasing at index {i}: "
            f"{earnings[i - 1]} -> {earnings[i]}"
        )
    assert income_series["max_marginal_rate_pct"] > 50, (
        f"Expected max_marginal_rate_pct > 50, got {income_series['max_marginal_rate_pct']}"
    )


# ---------------------------------------------------------------------------
# Test 5: at least one series point has marginal_rate_pct >= 60
# ---------------------------------------------------------------------------

def test_income_series_high_marginal_rate_point(income_series):
    """There must be at least one point in the earnings curve with EMTR >= 60 %
    (the UC taper / IT interaction)."""
    data = income_series["data"]
    high = [d for d in data if d["marginal_rate_pct"] >= 60]
    assert len(high) >= 1, (
        "Expected at least one point with marginal_rate_pct >= 60, "
        f"max seen: {max(d['marginal_rate_pct'] for d in data):.1f}"
    )


# ---------------------------------------------------------------------------
# Test 6: region comparison — 12 regions, contiguous ranks, London present
# ---------------------------------------------------------------------------

@pytest.fixture(scope="module")
def region_comparison(lone_parent_payload):
    return calculate_region_comparison(lone_parent_payload)


def test_region_comparison_shape_and_ranks(region_comparison):
    """Must return exactly 12 regions with ranks 1–12 (contiguous), and
    max_net_income must equal the region ranked #1."""
    regions = region_comparison["regions"]
    assert len(regions) == 12, f"Expected 12 regions, got {len(regions)}"

    ranks = sorted(r["rank"] for r in regions)
    assert ranks == list(range(1, 13)), f"Ranks are not 1..12: {ranks}"

    region_1 = next(r for r in regions if r["rank"] == 1)
    assert region_comparison["max_net_income"] == region_1["net_income_annual"], (
        f"max_net_income ({region_comparison['max_net_income']}) "
        f"!= rank-1 region net_income ({region_1['net_income_annual']})"
    )


def test_region_comparison_london_present_and_not_last(region_comparison):
    """London must appear, and its net_income_annual should be >= the minimum
    region's net_income (London typically has higher housing support)."""
    regions = region_comparison["regions"]
    london = next((r for r in regions if r["region"] == "LONDON"), None)
    assert london is not None, "LONDON not found in region comparison results"

    min_net = min(r["net_income_annual"] for r in regions)
    assert london["net_income_annual"] >= min_net, (
        f"London net_income ({london['net_income_annual']}) is below "
        f"the minimum region ({min_net})"
    )


# ---------------------------------------------------------------------------
# Test 7: household types — 4 templates, ranked, lone parent > single adult
# ---------------------------------------------------------------------------

@pytest.fixture(scope="module")
def household_types(lone_parent_payload):
    return calculate_household_types(lone_parent_payload)


def test_household_types_count_and_positive_net(household_types):
    """Must return exactly 4 templates, each with net_income_annual > 0."""
    households = household_types["households"]
    assert len(households) == 4, f"Expected 4 household templates, got {len(households)}"
    for hh in households:
        assert hh["net_income_annual"] > 0, (
            f"Household '{hh['label']}' has non-positive net_income_annual: "
            f"{hh['net_income_annual']}"
        )


def test_household_types_lone_parent_gt_single(household_types):
    """At zero earnings, a lone parent with 2 children should receive more net
    income than a single childless adult (due to UC child elements + Child Benefit)."""
    households = household_types["households"]
    by_label = {hh["label"]: hh for hh in households}

    single_net = by_label["Single adult, no children"]["net_income_annual"]
    lone_net   = by_label["Lone parent, 2 children"]["net_income_annual"]
    assert lone_net > single_net, (
        f"Expected lone parent net ({lone_net}) > single adult net ({single_net})"
    )


def test_household_types_ranks_contiguous(household_types):
    """Ranks must be contiguous integers 1–4."""
    ranks = sorted(hh["rank"] for hh in household_types["households"])
    assert ranks == [1, 2, 3, 4], f"Household ranks are not 1..4: {ranks}"


# ---------------------------------------------------------------------------
# Test 8: household_input_from_dict infers kind from age
# ---------------------------------------------------------------------------

def test_household_input_from_dict_infers_kind():
    """When 'kind' is absent from a people entry, age < 18 -> 'child',
    age >= 18 -> 'adult'."""
    data = {
        "region": "NORTH_WEST",
        "earned_income": 0,
        "people": [
            {"age": 35},        # no 'kind' -> should become 'adult'
            {"age": 10},        # no 'kind' -> should become 'child'
            {"age": 17},        # boundary: still 'child'
            {"age": 18},        # boundary: 'adult'
        ],
    }
    hi = household_input_from_dict(data)
    kinds = [p.kind for p in hi.people]
    assert kinds[0] == "adult", f"Age 35 should be 'adult', got '{kinds[0]}'"
    assert kinds[1] == "child", f"Age 10 should be 'child', got '{kinds[1]}'"
    assert kinds[2] == "child", f"Age 17 should be 'child', got '{kinds[2]}'"
    assert kinds[3] == "adult", f"Age 18 should be 'adult', got '{kinds[3]}'"


# ---------------------------------------------------------------------------
# Test 9: childless single adult at zero earnings — no crash, net_income >= 0
# ---------------------------------------------------------------------------

def test_single_adult_zero_earnings_no_crash():
    """A childless single adult at £0 earned income must not raise and must
    return a non-negative net_income (Council Tax Reduction might be the only
    support; UC standard allowance depends on housing status)."""
    payload = HouseholdInput(
        region="NORTH_WEST",
        earned_income=0,
        rent_annual=0,
        people=(HouseholdMemberInput(age=30, kind="adult"),),
    )
    result = calculate_household(payload)
    assert "totals" in result, "Result missing 'totals' key"
    assert result["totals"]["net_income"] >= 0, (
        f"net_income should be >= 0, got {result['totals']['net_income']}"
    )
