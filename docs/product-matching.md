# Product Matching

Matching checks exact SKU, barcode, normalized name plus brand, then partial normalized names. Results are `MATCHED`, `POSSIBLE_MATCH`, or `NEW_PRODUCT` with confidence and reasons.

Exact identifiers are safe for deterministic matching. Partial or ambiguous matches stay reviewable and cannot be merged automatically. Unknown products create `product_drafts` with supplier details, costs, quantities, specifications and image references until an authorized user approves publication.
