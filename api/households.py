from __future__ import annotations

import sys
from http.server import BaseHTTPRequestHandler
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from api._shared import (  # noqa: E402
    compute_household_types,
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
            result = compute_household_types(parse_household_payload(payload))
        except Exception as exc:  # noqa: BLE001
            send_error_json(self, 500, f"Calculation failed: {exc}")
            return
        send_json(self, result, cache_control="no-store")
