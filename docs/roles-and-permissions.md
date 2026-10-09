# Roles and Permissions

Roles and granular permissions are stored in `roles`, `permissions`, `role_permissions`, and `user_roles`. The `has_permission()` database function is used by RLS policies; frontend visibility is not an authorization boundary.

Seed roles include CEO, ADMIN, SALES_MANAGER, STORE_MANAGER, INVENTORY_MANAGER, ACCOUNTANT, PROCUREMENT, SALES_AGENT, CASHIER, WAREHOUSE, DELIVERY, and CUSTOMER. Seed permission assignments are development defaults and must be reviewed before production.

The shared definitions live in `packages/shared/src/index.ts`; server-side checks are exported from `packages/auth/src/authorization.ts`. Use `hasRole`, `hasPermission`, `requireRole`, and `requirePermission`. A logged-in user has no implicit business access.

CEO-only views require the CEO role explicitly. Admin access requires the relevant permission, and CUSTOMER remains isolated from staff data. Role hierarchy is descriptive only; permissions are always explicit. The Stage 3 management migration adds `users.create`, `users.update`, `users.delete`, `roles.read`, and `roles.manage`.

The team invitation endpoint enforces both `users.create` and the CEO assignment guard server-side. A navigation item being hidden is never considered sufficient protection.

Dantown Centre is restricted to `dluxsolars@gmail.com` and individual accounts approved by an administrator. Administrators with `users.manage` can approve or revoke accounts at `/admin/business-center-access`; the server checks access independently of navigation visibility.
