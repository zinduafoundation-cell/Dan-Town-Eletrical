# Orders

Orders preserve historical commercial facts. `order_items` stores product name, SKU, unit price, discount, VAT, and line-total snapshots, so catalog price changes never rewrite old orders.

The order lifecycle is represented by a PostgreSQL enum. Every status change is written automatically to `order_status_history`. Payment records and inventory movements remain separate authoritative records linked by references.
