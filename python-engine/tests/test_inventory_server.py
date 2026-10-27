import json
import threading
import time
import unittest
import urllib.error
import urllib.request
from http.server import ThreadingHTTPServer

from app.inventory_server import _signature, create_handler


class InventoryAdvisorServerTests(unittest.TestCase):
    def setUp(self):
        self.secret = "dantown-test-secret-value-at-least-32"
        self.server = ThreadingHTTPServer(("127.0.0.1", 0), create_handler(self.secret))
        self.thread = threading.Thread(target=self.server.serve_forever, daemon=True)
        self.thread.start()

    def tearDown(self):
        self.server.shutdown()
        self.server.server_close()
        self.thread.join(timeout=2)

    def request(self, payload, timestamp=None, signature=None):
        body = json.dumps(payload, separators=(",", ":")).encode("utf-8")
        request_timestamp = str(int(time.time())) if timestamp is None else timestamp
        request_signature = (
            _signature(self.secret, request_timestamp, body)
            if signature is None
            else signature
        )
        request = urllib.request.Request(
            f"http://127.0.0.1:{self.server.server_port}/inventory/recommendations",
            data=body,
            method="POST",
            headers={
                "Content-Type": "application/json",
                "X-Dantown-Timestamp": request_timestamp,
                "X-Dantown-Signature": request_signature,
            },
        )
        try:
            with urllib.request.urlopen(request, timeout=2) as response:
                return response.status, json.loads(response.read())
        except urllib.error.HTTPError as error:
            return error.code, json.loads(error.read())

    def test_signed_request_returns_advice_without_mutating_stock(self):
        status, result = self.request(
            {
                "items": [{"product_id": "lamp-1", "product_name": "LED lamp", "quantity": 3}],
                "inventory": [
                    {"product_id": "lamp-1", "warehouse_id": "store-3", "warehouse_name": "Store 3", "quantity": 5, "reserved_quantity": 0}
                ],
                "preferred_warehouse_id": None,
            }
        )

        self.assertEqual(status, 200)
        self.assertFalse(result["stock_mutated"])
        self.assertEqual(result["recommendations"][0]["source_warehouse"]["name"], "Store 3")

    def test_rejects_invalid_and_expired_signatures(self):
        payload = {"items": [{"product_id": "lamp-1", "quantity": 1}], "inventory": []}
        invalid_status, _ = self.request(payload, signature="0" * 64)
        expired_timestamp = str(int(time.time()) - 301)
        expired_status, _ = self.request(payload, timestamp=expired_timestamp)

        self.assertEqual(invalid_status, 401)
        self.assertEqual(expired_status, 401)

    def test_rejects_invalid_payloads_after_authentication(self):
        status, response = self.request({"items": "invalid", "inventory": []})

        self.assertEqual(status, 400)
        self.assertIn("error", response)


if __name__ == "__main__":
    unittest.main()
