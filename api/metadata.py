from __future__ import annotations

import sys
from http.server import BaseHTTPRequestHandler
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from api._shared import handle_options, metadata_response, send_json  # noqa: E402


class handler(BaseHTTPRequestHandler):  # noqa: N801 (Vercel entrypoint contract)
    def do_OPTIONS(self) -> None:  # noqa: N802
        handle_options(self)

    def do_GET(self) -> None:  # noqa: N802
        send_json(self, metadata_response())
