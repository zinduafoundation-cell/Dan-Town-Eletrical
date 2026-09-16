# Inventory

Inventory is shared by storefront, POS, administration, and future mobile clients. Each record belongs to a product and warehouse and derives available quantity as `quantity - reserved_quantity`.

Use `adjust_inventory()` for stock changes. It locks the inventory row, rejects changes that would consume reserved stock, updates the quantity, and writes an `inventory_movements` record with previous and new quantities.
