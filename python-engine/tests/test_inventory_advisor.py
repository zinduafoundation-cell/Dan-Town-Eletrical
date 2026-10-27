import unittest

from app.inventory_advisor import recommend_fulfillment


class InventoryAdvisorTests(unittest.TestCase):
    def test_selects_a_location_that_can_fulfill_without_transfer(self):
        result = recommend_fulfillment(
            [{"product_id": "lamp-1", "quantity": 3}],
            [
                {"product_id": "lamp-1", "warehouse_id": "dan-1", "warehouse_name": "Dan 1", "quantity": 2, "reserved_quantity": 0},
                {"product_id": "lamp-1", "warehouse_id": "store-3", "warehouse_name": "Store 3", "quantity": 5, "reserved_quantity": 1},
            ],
        )

        recommendation = result["recommendations"][0]
        self.assertEqual(recommendation["status"], "ready")
        self.assertEqual(recommendation["source_warehouse"]["id"], "store-3")
        self.assertEqual(recommendation["transfers"], [])
        self.assertFalse(result["stock_mutated"])

    def test_suggests_a_confirmed_transfer_into_the_preferred_location(self):
        result = recommend_fulfillment(
            [{"product_id": "cable-1", "quantity": 7}],
            [
                {"product_id": "cable-1", "warehouse_id": "dan-1", "warehouse_name": "Dan 1", "quantity": 3, "reserved_quantity": 1},
                {"product_id": "cable-1", "warehouse_id": "store-3", "warehouse_name": "Store 3", "quantity": 8, "reserved_quantity": 0},
            ],
            preferred_warehouse_id="dan-1",
        )

        recommendation = result["recommendations"][0]
        self.assertEqual(recommendation["status"], "transfer_suggested")
        self.assertEqual(recommendation["source_warehouse"]["id"], "dan-1")
        self.assertEqual(recommendation["transfers"][0]["quantity"], 5)
        self.assertEqual(recommendation["transfers"][0]["source_warehouse"]["id"], "store-3")
        self.assertTrue(recommendation["staff_confirmation_required"])
        self.assertFalse(result["stock_mutated"])

    def test_reports_insufficient_total_available_stock_without_suggesting_a_transfer(self):
        result = recommend_fulfillment(
            [{"product_id": "switch-1", "quantity": 6}],
            [
                {"product_id": "switch-1", "warehouse_id": "dan-1", "quantity": 2, "reserved_quantity": 1},
                {"product_id": "switch-1", "warehouse_id": "store-3", "quantity": 2, "reserved_quantity": 0},
            ],
        )

        recommendation = result["recommendations"][0]
        self.assertEqual(recommendation["status"], "insufficient_stock")
        self.assertEqual(recommendation["available_quantity"], 3)
        self.assertEqual(recommendation["transfers"], [])

    def test_aggregates_repeated_order_lines_for_the_same_product(self):
        result = recommend_fulfillment(
            [
                {"product_id": "bulb-1", "quantity": 2},
                {"product_id": "bulb-1", "quantity": 3},
            ],
            [{"product_id": "bulb-1", "warehouse_id": "dan-1", "quantity": 5}],
        )

        self.assertEqual(len(result["recommendations"]), 1)
        self.assertEqual(result["recommendations"][0]["quantity"], 5)
        self.assertEqual(result["recommendations"][0]["status"], "ready")

    def test_rejects_invalid_quantities(self):
        with self.assertRaisesRegex(ValueError, "quantity must be greater than zero"):
            recommend_fulfillment(
                [{"product_id": "lamp-1", "quantity": 0}],
                [{"product_id": "lamp-1", "warehouse_id": "dan-1", "quantity": 5}],
            )


if __name__ == "__main__":
    unittest.main()
