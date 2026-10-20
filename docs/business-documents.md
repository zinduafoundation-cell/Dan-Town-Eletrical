# Business Documents in Dantown Centre

The business-document register is available at `/admin/documents` to users allowed to manage business settings. It stores real records in Supabase and does not seed sample documents.

## Create and manage a document

1. Open **Dantown Centre → Business documents**.
2. Choose a business area and document type.
3. Enter the counterparty, dates, payment terms, line items, amounts, and any notes or conditions.
4. For supported sales and purchase documents, search and select an existing order or purchase order. The form loads the saved party, contact, tax PIN (when present), payment terms (when present), line items, discounts, and tax from that live record. The API verifies the selected reference before saving.
5. Save the record as a draft. The database assigns the sequential number.
6. Select a saved record to review its audit history, attach a private source file, change its allowed status, or use **Print / save PDF**. The shared document settings select A4, A5, or US Letter portrait paper; the browser's print dialog can still override printer-specific options.
7. A draft that has not been approved or sent can be edited from the selected record. Its assigned number, document type, issue date, and source links are locked; saved revisions create an audit event. Payment documents and non-draft records cannot be edited through this workflow.

Supported source lookups cover sales orders, invoices, credit/debit notes, sales returns, delivery/dispatch notes, purchase orders, supplier invoices, goods received notes, and purchase returns. Other document types can retain a manually entered source reference when the source is external to the application.

## Payments and receipts

Payment receipts and payment vouchers cannot be created as standalone documents. After a payment is verified as successful, the system creates one idempotent receipt record per payment in the register and assigns the configured `REC` sequence. To view or print it, open the related order and use its receipt action. Customers with multiple successful payments can select which payment receipt to view. Each receipt records the verified payment amount and method, its related order, customer details when available, and the saved business identity/print settings. An unverified or pending payment does not produce a receipt.

## What document actions do not do

Creating or approving a document does not post a payment, change inventory, create a sales or purchase transaction, submit a KRA/eTIMS filing, or certify legal compliance. The register is an auditable document workflow; it is not a substitute for the existing order, payment, inventory, or procurement workflows. Verify draft line items and totals against their source records before issuing documents.

The form keeps the source transaction unchanged: review the populated draft and its displayed source total before saving. The register currently uses KES to match the transaction schema. Document attachments are private and available only through short-lived signed links to authorized users.

## AI-assisted business profile changes

From an authorized Centre or admin AI surface, a clear request such as “change the business phone to …” produces a confirmation prompt. Only the supported non-secret profile fields are eligible. Confirming calls a server-side handler that checks the BSK-protected `settings.manage` permission, validates the complete saved settings object, persists it, and records the settings audit event. Without confirmation, no setting is changed. Payment credentials, KRA PINs, tax controls, user permissions, and financial records are not writable through this AI flow.

AI-assisted backups and restore are not enabled: the application has no configured backup provider or restore service. Use the Supabase platform’s configured backup process; the AI does not claim to create backups.

In the authorized Centre/admin assistant, staff with `settings.manage` can search recent business documents or retrieve a document by its assigned number, and find invoices past their due date. For overdue documents, payment status is included only when the document's reference matches a live order; a due date alone is not treated as proof that an invoice is unpaid. Staff with `orders.read` can search recent or unpaid orders, or retrieve a specific order and its line items by order number. Staff with `quotes.read` can search recent or pending quotations, or retrieve one by its explicit quotation number. Staff with `customers.read` can search customers by name; staff with `products.read` can search suppliers by company name. Those searches return only basic names, types, and statuses, not contact details, addresses, tax identifiers, or payment terms. Signed-in customers can search only receipts linked to their own verified payments. The assistant can also prepare a seven-day sales report and summarize low-stock products from live records. These tools do not modify operational records.

## Database

The register requires the `20261018140400_business_document_register_workflow.sql` migration. It is recorded as applied on the linked Supabase project. The migration creates sequence, audit, attachment, numbering, and status-transition support; no example business documents were inserted. Draft editing requires `20261019052839_business_document_draft_content_edits.sql`, and automatic verified receipt registration requires `20261018185848_verified_payment_receipt_register.sql`. Both migrations are recorded as applied on the linked project as of 2026-10-20. The linked migration list and a `supabase db push --linked --dry-run` check confirmed there are no pending migrations.
