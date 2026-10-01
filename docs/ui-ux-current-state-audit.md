# Dantown System UI/UX Current-State Audit

**Date:** 2026-10-01  
**Scope:** Customer storefront and account, Business Centre/admin workspaces, and POS  
**Method:** Source and stylesheet review of representative routes and shared components. This is a code-based baseline, not a live browser walkthrough, accessibility certification, or usability study.

## Executive Summary

Dantown already has distinct customer, operations, and point-of-sale experiences, with real commerce, account, inventory, and staff workflows behind them. The storefront has a recognizable electrical-retail identity, the Business Centre is moving toward a consolidated operations dashboard, and POS has purpose-built checkout and offline-status concepts.

The main design problem is consistency, not a lack of features. The storefront, customer account, admin portal, and POS use different surface colors, navigation patterns, spacing, and component treatments. `apps/web/app/globals.css` has grown into a large shared stylesheet with multiple `:root` theme blocks, repeated component rules, and old green/coral/ochre values alongside newer navy/blue/lime overrides. The result is a system that can feel like several products joined together, with a higher learning cost when a user moves between workspaces.

## How It Looks and Feels Today

| Area | Current look and interaction | Likely user effect |
| --- | --- | --- |
| Storefront | Dark navy and electric-lime branding, blue marketplace header, category imagery, hero carousel, product grids, and promotional sections. Hover states lift cards and the background uses animated blurred light effects. | Strong brand recognition and a clear path toward shopping. Multiple stacked header/navigation bands and visually prominent promotions can compete with product discovery, especially on smaller screens. |
| Customer account | A light dashboard inside the storefront shell, with a profile card, long account navigation, purchase/quote/wishlist metrics, recent orders, and recommendations. | The overview gives customers useful orientation. The account menu has many destinations, while some routes describe future features and show empty “No updates yet” states; this can make the account feel unfinished and make it unclear what customers can do now. |
| Business Centre and admin | A dark operations frame with a dense navigation sidebar and light work surfaces, tables, forms, and metric panels. Business Centre adds command controls, KPI summaries, order lists, and operational status panels. | Appropriate for repeated staff work and information scanning. The dark shell/light content contrast is useful, but generic page structure and differing workspace patterns make hierarchy and location less consistent across admin areas. |
| POS | Dedicated cashier workspace with a green sidebar, white top bar, online/offline and queue status, sales metrics, product search, category filters, and a cart/checkout column. Checkout supports barcode scanning, customer lookup, tender selection, and offline queueing. | Checkout concepts are task-focused and familiar. Small labels and compact controls favor density over quick scanning; at narrower widths the sidebar hides its labels, and checkout becomes a long stacked page with the cart moved above products. |
| Authentication | Centered light form panels against the application background, with direct labels, error/success messages, and registration/verification flows. | Familiar and relatively low-distraction. Its older green-oriented form styling differs from the blue/lime storefront branding, so the transition into and out of authentication can feel like a product change. |

## Cross-System Findings and Effects

### 1. Brand and tokens are not yet a single system

The code defines six `:root` blocks in `globals.css`. Color variables such as `--green`, `--paper`, `--ink`, `--white`, and `--line` are reused across areas with different meanings, then overridden by `.store-shell` and later workspace-specific rules. The CSS also contains both current storefront colors and earlier green/coral/ochre component styles.

**Effect:** A color or surface adjustment can have unintended consequences in another workspace. Users may read shared actions, alerts, or selected states differently depending on which shell they are in. This increases regression risk and slows visual iteration.

### 2. Navigation changes between workspaces

The store relies on marketplace navigation and mobile bottom navigation; customer accounts introduce a large secondary account menu; the portal uses grouped links in a sidebar; POS has its own icon-and-label sidebar. The underlying separation is sensible, but active states, density, and wayfinding are not yet governed by one consistent interaction model.

**Effect:** Returning users need to re-orient when changing roles or tasks. On mobile, staff navigation deserves special attention because labels are hidden at narrower breakpoints; icon-only navigation needs explicit accessible names and a clear selected state.

### 3. Density and hierarchy vary by surface

The POS and admin views display many compact labels, cards, and controls, while the storefront uses large promotional imagery and broad hero sections. Account pages combine dashboard summaries with many destinations and future-facing sections.

**Effect:** Customers can spend attention on promotion before finding the right product or service; staff can spend time interpreting dense screens; and users can mistake placeholder account pages for broken or unavailable features.

### 4. Interaction feedback exists, but patterns are uneven

There are hover transitions, a storefront carousel, network/sync indicators in POS, inline messages, and route-level loading/error states. The global stylesheet includes some focus-visible and reduced-motion support, but these behaviors are not expressed as one documented interaction standard.

**Effect:** Many actions provide feedback, but timing, visual emphasis, and error recovery may differ by route. Motion can add polish, though persistent ambient animation and card movement may distract users who are trying to scan products or complete repetitive work.

### 5. Responsive behavior is implemented, but workflow quality needs device testing

Several areas have mobile breakpoints, including a storefront bottom nav, stacked account layout, collapsed POS sidebar, and a single-column POS sale layout. Source rules alone do not confirm that every real screen fits without overflow or that the most important action remains visible.

**Effect:** The experience is likely usable on common mobile widths, but operational tasks such as scanning, cart review, tables, and navigation need direct checks on actual viewport sizes and touch targets before a redesign is signed off.

## What Is Working Well

- The storefront uses real category/product imagery and has a recognizable local electrical-retail identity.
- Core customer journeys are represented: browse, search, product detail, cart, checkout, account, quotations, and order history.
- POS has a separate shell and supports high-value cashier concepts including search, barcode scanning, cart totals, multiple tenders, receipt output, and offline queue status.
- Business Centre is consolidating operational signals instead of requiring staff to infer everything from separate modules.
- Shared icons, responsive rules, loading/error states, focus styling, and some reduced-motion handling are already present and can be standardized rather than replaced wholesale.

## Recommended Redesign Order

1. **Establish design foundations:** define a small, named token set for color, typography, spacing, borders, focus, status, and elevation; separate storefront, portal, and POS theme scopes; remove duplicate/obsolete rules incrementally.
2. **Standardize shared controls:** buttons, text inputs, search, tabs/filters, status badges, data rows, empty/error/loading states, and keyboard focus behavior.
3. **Prioritize operational flows:** optimize POS search-to-payment for speed, keyboard/scanner use, clear stock/payment feedback, error recovery, and offline/sync review.
4. **Clarify navigation by role and device:** preserve separate customer/admin/POS shells, but make current location and primary actions consistent; validate mobile navigation labels, touch targets, and active states.
5. **Complete or clearly defer account destinations:** distinguish working features from planned features and replace ambiguous placeholders with useful next actions or explicit availability states.
6. **Validate with representative users:** test shopping, checkout, account support, order review, inventory lookup, and cashier sale completion on desktop and mobile before rolling visual changes across every route.

## Expected Effects of the Upgrade

If applied in this order, the redesign should make the brand feel coherent without flattening the needs of customers, administrators, and cashiers into one generic interface. Staff should find high-frequency actions faster; customers should encounter fewer ambiguous or unfinished account states; and developers should be able to change styling with less risk of cross-page regressions. These are expected outcomes, not measured results, and should be confirmed with task-based usability testing.

## Source Areas Reviewed

- `apps/web/app/globals.css`
- `apps/web/app/layout.tsx` and `apps/web/app/page.tsx`
- `apps/web/app/business-center/page.tsx` and `apps/web/app/portal-shell.tsx`
- `apps/web/app/account/page.tsx` and `apps/web/components/account/account-section-page.tsx`
- `apps/web/app/admin/layout.tsx`
- `apps/web/app/pos/layout.tsx`, `apps/web/components/pos/pos-shell.tsx`, `apps/web/components/pos/pos-dashboard.tsx`, and `apps/web/app/pos/new-sale/page.tsx`
- `apps/web/app/auth.css`