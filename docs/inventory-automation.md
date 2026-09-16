# Inventory Automation

Receiving workflows must call the existing authoritative inventory RPC/service with a purchase reference. n8n and UI code must never manipulate quantity directly. The database locks inventory rows, rejects consumption of reserved stock, updates quantity, and records an inventory movement.

Low-stock automation reads `inventory_health`, deduplicates notifications, and routes failures to the automation job review path. Website, POS, admin and future mobile clients read the same Supabase inventory; targeted Realtime and cache revalidation propagate changes.
