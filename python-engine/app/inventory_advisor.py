"""Read-only warehouse fulfillment advice.

Run with JSON on stdin containing ``items`` and ``inventory`` arrays. The
returned transfer suggestions must be reviewed and completed by authorized
staff through Dantown Centre; this module never changes stock.
"""

from __future__ import annotations

import json
import sys
from collections import defaultdict
from collections.abc import Mapping, Sequence


def _required_text(record: Mapping[str, object], key: str) -> str:
    value = record.get(key)
    if not isinstance(value, str) or not value.strip():
        raise ValueError(f"{key} must be a non-empty string")
    return value.strip()


def _quantity(value: object, key: str) -> int:
    if isinstance(value, bool) or not isinstance(value, int) or value < 0:
        raise ValueError(f"{key} must be a non-negative integer")
    return value


def recommend_fulfillment(
    items: Sequence[Mapping[str, object]],
    inventory: Sequence[Mapping[str, object]],
    preferred_warehouse_id: str | None = None,
) -> dict[str, object]:
    """Recommend one source warehouse per product without mutating inventory."""
    if not items:
        raise ValueError("items must contain at least one product")

    required_by_product: dict[str, int] = {}
    product_names: dict[str, str | None] = {}
    for item in items:
        if not isinstance(item, Mapping):
            raise ValueError("each item must be a JSON object")
        product_id = _required_text(item, "product_id")
        quantity = _quantity(item.get("quantity"), "quantity")
        if quantity == 0:
            raise ValueError("quantity must be greater than zero")
        required_by_product[product_id] = required_by_product.get(product_id, 0) + quantity
        product_name = item.get("product_name")
        if product_name is not None and not isinstance(product_name, str):
            raise ValueError("product_name must be a string or null")
        product_names.setdefault(product_id, product_name)

    stock: dict[str, dict[str, dict[str, object]]] = defaultdict(dict)
    for row in inventory:
        if not isinstance(row, Mapping):
            raise ValueError("each inventory row must be a JSON object")
        product_id = _required_text(row, "product_id")
        warehouse_id = _required_text(row, "warehouse_id")
        quantity = _quantity(row.get("quantity"), "quantity")
        reserved = _quantity(row.get("reserved_quantity", 0), "reserved_quantity")
        warehouse_name = row.get("warehouse_name")
        if warehouse_name is not None and not isinstance(warehouse_name, str):
            raise ValueError("warehouse_name must be a string or null")

        warehouse = stock[product_id].setdefault(
            warehouse_id,
            {"id": warehouse_id, "name": warehouse_name, "available": 0},
        )
        warehouse["available"] = int(warehouse["available"]) + max(0, quantity - reserved)
        if warehouse["name"] is None and warehouse_name:
            warehouse["name"] = warehouse_name

    if preferred_warehouse_id is not None:
        if not isinstance(preferred_warehouse_id, str) or not preferred_warehouse_id.strip():
            raise ValueError("preferred_warehouse_id must be a non-empty string")
        preferred_warehouse_id = preferred_warehouse_id.strip()

    recommendations: list[dict[str, object]] = []
    for product_id, required_quantity in required_by_product.items():
        warehouses = stock.get(product_id, {})
        ordered = sorted(
            warehouses.values(),
            key=lambda warehouse: (-int(warehouse["available"]), str(warehouse["id"])),
        )
        total_available = sum(int(warehouse["available"]) for warehouse in ordered)
        if not ordered:
            recommendations.append(
                {
                    "product_id": product_id,
                    "product_name": product_names[product_id],
                    "quantity": required_quantity,
                    "status": "insufficient_stock",
                    "available_quantity": 0,
                    "source_warehouse": None,
                    "transfers": [],
                    "staff_confirmation_required": False,
                }
            )
            continue

        destination = None
        if preferred_warehouse_id is not None:
            destination = warehouses.get(preferred_warehouse_id)
            if destination is None:
                raise ValueError(
                    f"preferred warehouse {preferred_warehouse_id} has no inventory row for {product_id}"
                )
        else:
            destination = ordered[0]

        destination_available = int(destination["available"])
        transfers: list[dict[str, object]] = []
        shortfall = max(0, required_quantity - destination_available)
        for source in ordered:
            if shortfall == 0:
                break
            if source["id"] == destination["id"]:
                continue
            transfer_quantity = min(shortfall, int(source["available"]))
            if transfer_quantity:
                transfers.append(
                    {
                        "source_warehouse": {"id": source["id"], "name": source["name"]},
                        "destination_warehouse": {
                            "id": destination["id"],
                            "name": destination["name"],
                        },
                        "quantity": transfer_quantity,
                    }
                )
                shortfall -= transfer_quantity

        insufficient = total_available < required_quantity
        recommendations.append(
            {
                "product_id": product_id,
                "product_name": product_names[product_id],
                "quantity": required_quantity,
                "status": (
                    "insufficient_stock"
                    if insufficient
                    else "transfer_suggested"
                    if transfers
                    else "ready"
                ),
                "available_quantity": total_available,
                "source_warehouse": (
                    {"id": destination["id"], "name": destination["name"]}
                    if not insufficient
                    else None
                ),
                "transfers": transfers if not insufficient else [],
                "staff_confirmation_required": bool(transfers) and not insufficient,
            }
        )

    return {"recommendations": recommendations, "stock_mutated": False}


def main() -> int:
    try:
        payload = json.load(sys.stdin)
        if not isinstance(payload, dict):
            raise ValueError("input must be a JSON object")
        items = payload.get("items")
        inventory = payload.get("inventory")
        if not isinstance(items, list) or not isinstance(inventory, list):
            raise ValueError("items and inventory must be JSON arrays")
        preferred = payload.get("preferred_warehouse_id")
        if preferred is not None and not isinstance(preferred, str):
            raise ValueError("preferred_warehouse_id must be a string or null")
        result = recommend_fulfillment(items, inventory, preferred)
    except (json.JSONDecodeError, ValueError) as error:
        print(json.dumps({"error": str(error)}), file=sys.stderr)
        return 2

    json.dump(result, sys.stdout)
    sys.stdout.write("\n")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
