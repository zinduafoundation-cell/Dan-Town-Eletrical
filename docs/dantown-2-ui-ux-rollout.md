# Dantown 2.0 UI/UX Rollout

**Status:** In progress  
**Guardrail:** Keep existing authentication, commerce, payment, inventory, POS, permission, and database behavior. Change presentation and interaction only unless a separately approved functional requirement needs more.

## Experience Model

- **Customer:** visual, trustworthy, product-first; current routes include `/`, `/shop`, `/products/[slug]`, `/cart`, `/checkout`, and `/account/*`.
- **Business Centre:** operational, role-aware, information-rich; current routes include `/business-center`, `/admin/orders`, `/admin/inventory`, `/admin/catalog`, `/admin/team`, `/admin/automation/*`, and `/admin/knowledge`.
- **POS:** transaction-first, touch-friendly, resilient offline; current routes include `/pos`, `/pos/new-sale`, `/pos/[section]`, and existing `/api/pos/*` endpoints.

These experiences share semantic tokens, typography, iconography, status meaning, accessibility rules, and interaction patterns. They retain separate shells and task-specific density.

## Safe Delivery Phases

### 1. Foundations and Responsive POS — started

- Added semantic color, type, spacing, radius, shadow, and layering tokens in `apps/web/app/styles/tokens.css`.
- Added scoped themes for storefront/auth, operations, and POS in `apps/web/app/styles/themes.css`.
- Added POS mobile bottom navigation with labels, route-aware active state, safe-area spacing, and a cart summary that appears when the sale has items.
- Added per-surface DAN T AI offsets to avoid fixed navigation/cart collisions.
- Preserve legacy CSS until each component is mapped and verified; no mass deletion.

**Acceptance:** production build succeeds; at 390px the storefront AI launcher clears the bottom navigation without horizontal overflow. POS requires an authenticated browser session for direct visual QA.

### 2. Account Clarity and Shared States — started

- Mark Projects, Installation Tracking, and Warranty as “Coming soon” in account navigation and destination pages.
- Provide existing support/contact actions instead of implying unavailable tracking data exists.
- Continue auditing other account, checkout, and order states before changing their labels or flows.

**Acceptance:** each account destination is clearly functional, coming soon, or unavailable; existing customer data queries and route permissions remain unchanged.

### 3. Information Architecture and Operations

- Group existing Business Centre links under task-oriented headings only where the current route and permission exist.
- Keep role-based visibility tied to existing permissions; do not create duplicate routes.
- Improve the Centre briefing, operations queue, activity timeline, and order detail using actual available data.
- For orders, improve search/filter/status/payment/source/delivery/date presentation and card/table choice without changing order transitions or RPCs.

**Acceptance:** no unauthorized navigation or data is exposed; no placeholder delivery, map, ETA, or AI content is presented as live data.

### 4. Customer, Product, and Inventory Journeys

- Improve product discovery, product detail, cart, and checkout clarity while preserving current commerce/payment contracts.
- Make checkout progress and payment outcomes explain what happened, whether an order exists, and what the customer can do next based on confirmed API responses.
- Present product and inventory details using existing records; expose available/reserved/incoming/stock-risk distinctions only where the source data supports them.

**Acceptance:** existing browse-to-order and inventory workflows continue to work; no fabricated availability, payment, or shipment details.

### 5. DAN T AI and Reusable UI

- Keep DAN T AI permission-aware and grounded in the current screen and actual data.
- Add contextual insights/actions only when the underlying tool and authorization already exist.
- Require confirmation for high-impact writes; never silently refund, delete, alter pricing, permissions, financial values, or send important communications.
- Standardize shared Button, Input, Search, Select, Tabs, Badge, Card, Modal/Sheet, Toast, Table, Timeline, KPI, Empty/Loading/Error, and AI states where repeated implementations exist.

**Acceptance:** action visibility and execution are both permission checked; high-impact actions have explicit confirmation; unknown or unsupported requests produce an honest limitation.

### 6. Accessibility, Performance, and QA

- Validate focus order, visible focus, labels, touch target size, status text/icons, contrast, and reduced-motion behavior.
- Audit animation and image loading; avoid preloading every carousel slide or adding heavy opening animations.
- Run authenticated and public journeys at phone, tablet, and desktop sizes, including offline POS and payment-error states.
- Run `npm run verify` after each coherent implementation slice.

**Acceptance:** no horizontal overflow or overlapping fixed controls at supported viewports; reduced-motion users can complete all workflows; lint, tests, and production build pass.

## Current Constraints

- The POS route redirects to login in the available browser session, so direct authenticated POS visual QA needs an authorized session.
- Delivery maps/live GPS, driver ETA, technician assignments, and several project/warranty account records are not assumed to exist. Their UI must remain absent or clearly unavailable until real integrations/data are verified.
- Existing global CSS remains active during migration. Token adoption is incremental to avoid changing unrelated routes unexpectedly.
