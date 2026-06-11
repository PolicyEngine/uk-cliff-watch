from __future__ import annotations

import sys
from http.server import BaseHTTPRequestHandler
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from api._shared import (  # noqa: E402
    DEFAULT_SERIES_MAX_EARNINGS,
    DEFAULT_SERIES_STEP,
    compute_series,
    handle_options,
    parse_household_payload,
    read_json_body,
    send_error_json,
    send_json,
)


class handler(BaseHTTPRequestHandler):  # noqa: N801
    def do_OPTIONS(self) -> None:  # noqa: N802
        handle_options(self)

    def do_POST(self) -> None:  # noqa: N802
        try:
            payload = read_json_body(self)
            result = compute_series(
                parse_household_payload(payload),
                min_earned_income=int(payload.get("min_earned_income", 0)),
                max_earned_income=int(payload.get("max_earned_income", DEFAULT_SERIES_MAX_EARNINGS)),
                step=int(payload.get("step", DEFAULT_SERIES_STEP)),
            )
        except Exception as exc:  # noqa: BLE001
            send_error_json(self, 500, f"Calculation failed: {exc}")
            return
        send_json(self, result, cache_control="no-store")
