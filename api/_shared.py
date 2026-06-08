from __future__ import annotations

import json
from dataclasses import asdict
from functools import lru_cache
from http.server import BaseHTTPRequestHandler
from typing import Any

from uk_cliff_watch.calculator import (
    DEFAULT_SERIES_MAX_EARNINGS,
    DEFAULT_SERIES_STEP,
    HouseholdInput,
    calculate_household,
    calculate_household_types,
    calculate_income_series,
    calculate_region_comparison,
    household_input_from_dict,
)
from uk_cliff_watch.config import (
    BENEFIT_COMPONENTS,
    DEFAULT_CLIFF_DELTA,
    DEFAULT_SERIES_EARNINGS_BUFFER,
    DEFAULT_SERIES_MIN_EARNINGS_WINDOW,
    DEFAULT_YEAR,
    HOUSEHOLD_TYPES,
    MAX_ADULTS,
    MAX_DEPENDENTS,
    PROGRAM_DEFINITIONS,
    REGION_INFO,
    TAX_COMPONENTS,
)


def _serialize(payload: HouseholdInput) -> str:
    return json.dumps(asdict(payload), sort_keys=True)


def parse_household_payload(raw: dict[str, Any]) -> HouseholdInput:
    return household_input_from_dict(raw)


def metadata_response() -> dict[str, Any]:
    return {
        "country": "uk",
        "currency": "GBP",
        "year": DEFAULT_YEAR,
        "regions": REGION_INFO,
        "household_types": HOUSEHOLD_TYPES,
        "programs": PROGRAM_DEFINITIONS,
        "benefits": BENEFIT_COMPONENTS,
        "taxes": TAX_COMPONENTS,
        "defaults": {
            "region": "NORTH_WEST",
            "people": [
                {"kind": "adult", "age": 35},
                {"kind": "child", "age": 4},
                {"kind": "child", "age": 7},
            ],
            "earned_income": 0,
            "rent_annual": 9000,
            "series_max_earned_income": DEFAULT_SERIES_MAX_EARNINGS,
            "series_step": DEFAULT_SERIES_STEP,
            "series_earnings_buffer": DEFAULT_SERIES_EARNINGS_BUFFER,
            "series_min_earnings_window": DEFAULT_SERIES_MIN_EARNINGS_WINDOW,
            "cliff_delta": DEFAULT_CLIFF_DELTA,
            "max_adults": MAX_ADULTS,
            "max_dependents": MAX_DEPENDENTS,
        },
    }


@lru_cache(maxsize=256)
def _household_cached(serialized: str) -> dict[str, Any]:
    return calculate_household(parse_household_payload(json.loads(serialized)))


@lru_cache(maxsize=256)
def _series_cached(serialized: str, max_earned_income: int, step: int) -> dict[str, Any]:
    return calculate_income_series(
        parse_household_payload(json.loads(serialized)),
        max_earned_income=max_earned_income,
        step=step,
    )


@lru_cache(maxsize=256)
def _regions_cached(serialized: str) -> dict[str, Any]:
    return calculate_region_comparison(parse_household_payload(json.loads(serialized)))


@lru_cache(maxsize=256)
def _household_types_cached(serialized: str) -> dict[str, Any]:
    return calculate_household_types(parse_household_payload(json.loads(serialized)))


def compute_household(payload: HouseholdInput) -> dict[str, Any]:
    return _household_cached(_serialize(payload))


def compute_series(payload: HouseholdInput, *, max_earned_income: int = DEFAULT_SERIES_MAX_EARNINGS,
                   step: int = DEFAULT_SERIES_STEP) -> dict[str, Any]:
    return _series_cached(_serialize(payload), max_earned_income, step)


def compute_regions(payload: HouseholdInput) -> dict[str, Any]:
    return _regions_cached(_serialize(payload))


def compute_household_types(payload: HouseholdInput) -> dict[str, Any]:
    return _household_types_cached(_serialize(payload))


def read_json_body(handler: BaseHTTPRequestHandler) -> dict[str, Any]:
    content_length = int(handler.headers.get("content-length", "0"))
    if content_length <= 0:
        raise ValueError("Request body is required")
    body = handler.rfile.read(content_length)
    try:
        return json.loads(body)
    except json.JSONDecodeError as exc:
        raise ValueError("Request body must be valid JSON") from exc


def send_json(handler: BaseHTTPRequestHandler, payload: Any, status_code: int = 200,
              cache_control: str = "s-maxage=60, stale-while-revalidate=600") -> None:
    encoded = json.dumps(payload).encode("utf-8")
    handler.send_response(status_code)
    handler.send_header("Content-Type", "application/json")
    handler.send_header("Content-Length", str(len(encoded)))
    handler.send_header("Cache-Control", cache_control)
    handler.send_header("Access-Control-Allow-Origin", "*")
    handler.send_header("Access-Control-Allow-Headers", "Content-Type")
    handler.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
    handler.end_headers()
    handler.wfile.write(encoded)


def send_error_json(handler: BaseHTTPRequestHandler, status_code: int, message: str) -> None:
    send_json(handler, {"error": message}, status_code=status_code, cache_control="no-store")


def handle_options(handler: BaseHTTPRequestHandler) -> None:
    handler.send_response(204)
    handler.send_header("Access-Control-Allow-Origin", "*")
    handler.send_header("Access-Control-Allow-Headers", "Content-Type")
    handler.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
    handler.end_headers()
