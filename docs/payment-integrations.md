# Payment integrations

## Configuration

The Payments and Finance settings page stores provider enablement separately for website checkout and POS. Gateway credentials are not stored in the database or returned to browser clients.

Add credentials to the server environment (Vercel project environment variables or the local, ignored `.env.local` file):

- Pesapal API 3.0: `PESAPAL_ENVIRONMENT` (`sandbox` or `live`), `PESAPAL_CONSUMER_KEY`, `PESAPAL_CONSUMER_SECRET`, and `PESAPAL_IPN_ID`. Register `https://<your-domain>/api/payments/pesapal-ipn` with Pesapal.
- Paystack: `PAYSTACK_SECRET_KEY` using a `sk_test_...` key for sandbox validation. Register `https://<your-domain>/api/payments/paystack-webhook` in the Paystack dashboard. Use `sk_live_...` only after verified sandbox testing and merchant approval.

Do not use `NEXT_PUBLIC_` for a payment credential. Restart/redeploy the web application after changing environment variables. An enabled setting is not offered to customers until its server credential set is complete.

Apply the additive migration `20261018165755_payment_provider_settings.sql` before using the provider settings dashboard or customer checkout. It creates one business configuration row, restricts database access to the service role, and audits setting changes. It does not alter orders or payment records.

Apply `20261018172757_verified_pos_cash_collection.sql` and `20261018174106_restrict_paystack_webhook_event_access.sql` before deploying verified POS cash collection or the Paystack webhook. These migrations add the authorized cash-sale workflow and limit webhook event access to the server-side service role.

Apply `20261018175809_persistent_pos_cash_sessions.sql` before deploying the persistent POS cash drawer. It adds session notes and server-side open/close workflows to the existing POS tables and moves those tables behind the server-side service role. Existing orders and session records are not deleted.

Apply `20261018183556_verified_pos_cash_refunds.sql` before enabling POS refunds. It replaces the legacy direct-refund path with an atomic cash-only workflow that validates remaining refundable balance, records the cash movement, and corrects inventory only for a fully refunded order. It does not issue refunds through electronic providers.

Apply `20261018185848_verified_payment_receipt_register.sql` to persist one sequential `REC` business-document record for each successful payment. Receipt creation is idempotent per payment and never runs for pending or failed payments. The customer receipt endpoint can issue a missing historical receipt when requested.

Apply `20261018191812_fix_pesapal_sql_type_errors.sql` to repair two remotely linted SQL errors in the existing Pesapal POS order and payment-completion functions. Until it is deployed, those Pesapal database paths can fail despite successful provider verification.

To apply pending migrations to the linked Supabase project, run `supabase db push --linked` from the repository root. The Supabase CLI needs the project database password in its local environment; do not commit or share that password. A dry run is available with `supabase db push --linked --dry-run`.

The linked project has five migrations pending: `20261018175809_persistent_pos_cash_sessions.sql`, `20261018183556_verified_pos_cash_refunds.sql`, `20261018185848_verified_payment_receipt_register.sql`, `20261018191812_fix_pesapal_sql_type_errors.sql`, and `20261019052839_business_document_draft_content_edits.sql`. A CLI dry run confirms these are the migrations that would be pushed. They have not been applied because this environment does not have authorized direct database credentials. The actual push requires the project database password, and remote database lint still reports the two Pesapal SQL errors fixed by the pending migration. Do not treat these database changes as live; apply them through the Supabase CLI and verify migration history and remote database lint before relying on the corresponding workflows.

## Website checkout behavior

- Website checkout can offer Pesapal and Paystack when enabled and configured.
- The server computes each charge from the saved order, checks the order payment-access token, and records a pending provider transaction before redirecting.
- Paystack is verified server-to-server against the transaction reference, order metadata, KES currency, and exact order amount. The signed webhook and customer return both use provider-side verification; duplicate callbacks are safe through the atomic completion RPC. Payment completion and stock deduction use the existing atomic database RPC. A browser redirect alone never marks an order paid.
- Pesapal continues to use its existing server-side status verification and IPN flow.
- Provider settings do not store keys, and disabling a provider does not invalidate verification of an already-created payment.

## Testing and current limits

Use sandbox merchant accounts and test transactions before enabling a provider. The local checkout environment inspected for this change has no Pesapal or Paystack server credentials, so a real gateway round trip could not be performed here.

POS supports server-verified Pesapal checkout and an online cash sale path. Cash receipts are issued only after an authorized cashier submits the collection; the database checks the tender against the server-calculated total and records the sale, stock movements, and cash/change audit entry atomically. Cash sales also require an open persistent staff session; opening float, each verified cash sale, and the closing count are recorded in the cash movement ledger and audit log. The expected drawer balance is derived from that ledger. The offline cash queue is separate and still awaits synchronization to the server before it becomes an authoritative sale.

Cash refunds require a successful single CASH payment, the staff member’s open cash session, biometric step-up when configured, and an explicit confirmation that cash was physically returned. Each refund is capped against the remaining paid balance and recorded as a negative cash movement. Split-tender and electronic refunds are rejected by this path; process electronic refunds with the provider before making a corresponding audited workflow available. Inventory is returned to the session warehouse only on full cumulative refund because this form does not capture individual returned items. The migration avoids another restock when it finds a legacy return movement for the order, but it does not reverse or reconcile stock movements created by earlier refund requests.

The Paystack POS endpoints remain retired; POS Paystack is therefore not presented as configurable. Online cash-on-pickup/COD collection is not implemented as a verified payment workflow. Do not treat a cash-on-delivery order as paid or issue a payment receipt until a server-side collection and audit workflow exists.

The AI layer is read-only for payments: signed-in customers can check their own recent payment records; POS staff can inspect their own cash-session ledger; and Centre/admin users with `payments.read`, `reports.read`, or `finance.read` can request a recent payment summary. Summaries cover at most the latest 100 payment records and 100 refund records in the last seven days and are labeled when either limit is reached. `SUCCESS` payments and payments marked partially or fully refunded count toward gross verified receipts; completed refunds are reported separately and deducted to show net receipts. Pending or failed payments are never treated as received. AI cannot issue refunds, update financial settings, or confirm an unverified payment.

For reconciliation, use the existing payment and finance views and compare them with provider settlement reports. This integration does not claim automatic bank settlement matching or accounting synchronization.
