# Inventory

Inventory is shared by storefront, POS, administration, and future mobile clients. Each record belongs to a product and warehouse and derives available quantity as `quantity - reserved_quantity`.

Use `adjust_inventory()` for stock changes. It locks the inventory row, rejects changes that would consume reserved stock, updates the quantity, and writes an `inventory_movements` record with previous and new quantities.

The authorized Centre/admin AI can summarize low-stock inventory from the `inventory_health` view. It requires `inventory.read`, returns at most 50 low-stock location rows grouped by product, and reports quantities and reorder thresholds only for locations currently below their threshold. The AI is read-only and does not adjust or reserve stock.
