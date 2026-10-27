"""Small HMAC-protected HTTP service for read-only inventory advice.

Run behind a TLS-terminating reverse proxy with
``PYTHON_AUTOMATION_SECRET`` configured. The service has no database access.
"""

from __future__ import annotations

import hashlib
import hmac
import json
import os
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from typing import Type

from app.inventory_advisor import recommend_fulfillment

MAX_BODY_BYTES = 64 * 1024
MAX_CLOCK_SKEW_SECONDS = 300


def _signature(secret: str, timestamp: str, body: bytes) -> str:
    signed_content = timestamp.encode("ascii") + b"." + body
    return hmac.new(secret.encode("utf-8"), signed_content, hashlib.sha256).hexdigest()


def create_handler(secret: str) -> Type[BaseHTTPRequestHandler]:
    if len(secret) < 32:
        raise ValueError("PYTHON_AUTOMATION_SECRET must be at least 32 characters")

    class InventoryAdvisorHandler(BaseHTTPRequestHandler):
        server_version = "DantownInventoryAdvisor/1.0"
        sys_version = ""

        def _respond(self, status: int, payload: dict[str, object]) -> None:
            response_body = json.dumps(payload, separators=(",", ":")).encode("utf-8")
            self.send_response(status)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Content-Length", str(len(response_body)))
            self.send_header("Cache-Control", "no-store")
            self.send_header("X-Content-Type-Options", "nosniff")
            self.end_headers()
            self.wfile.write(response_body)

        def do_POST(self) -> None:
            if self.path != "/inventory/recommendations":
                self._respond(404, {"error": "Not found"})
                return

            try:
                body_length = int(self.headers.get("Content-Length", "0"))
            except ValueError:
                self._respond(400, {"error": "Invalid content length"})
                return
            if body_length < 1 or body_length > MAX_BODY_BYTES:
                self._respond(413, {"error": "Request body size is invalid"})
                return

            body = self.rfile.read(body_length)
            timestamp = self.headers.get("X-Dantown-Timestamp", "")
            supplied_signature = self.headers.get("X-Dantown-Signature", "")
            try:
                request_time = int(timestamp)
            except ValueError:
                self._respond(401, {"error": "Invalid request signature"})
                return

            expected_signature = _signature(secret, timestamp, body)
            if (
                abs(int(time.time()) - request_time) > MAX_CLOCK_SKEW_SECONDS
                or not hmac.compare_digest(supplied_signature, expected_signature)
            ):
                self._respond(401, {"error": "Invalid request signature"})
                return

            try:
                payload = json.loads(body)
                if not isinstance(payload, dict):
                    raise ValueError("Request must be a JSON object")
                items = payload.get("items")
                inventory = payload.get("inventory")
                preferred = payload.get("preferred_warehouse_id")
                if not isinstance(items, list) or not isinstance(inventory, list):
                    raise ValueError("items and inventory must be arrays")
                if preferred is not None and not isinstance(preferred, str):
                    raise ValueError("preferred_warehouse_id must be a string or null")
                advice = recommend_fulfillment(items, inventory, preferred)
            except (json.JSONDecodeError, ValueError) as error:
                self._respond(400, {"error": str(error)})
                return

            self._respond(200, advice)

        def log_message(self, format: str, *args: object) -> None:
            # Keep request bodies, order identifiers, and customer data out of logs.
            super().log_message(format, *args)

    return InventoryAdvisorHandler


def main() -> None:
    secret = os.environ.get("PYTHON_AUTOMATION_SECRET", "")
    handler = create_handler(secret)
    host = os.environ.get("PYTHON_AUTOMATION_HOST", "127.0.0.1")
    port = int(os.environ.get("PORT", "8010"))
    server = ThreadingHTTPServer((host, port), handler)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
