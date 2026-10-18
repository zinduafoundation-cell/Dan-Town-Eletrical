"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { BusinessDocument, BusinessDocumentEvent, BusinessDocumentType, Json } from "@dantown/database";
import { BusinessReceipt, type BusinessReceiptLine } from "@/components/documents/business-receipt";
import { formatBusinessDocumentDate, type BusinessDocumentSettings } from "@/lib/documents/business-document-settings";
import { businessDocumentGroups, businessDocumentStatuses, businessDocumentTypes, getBusinessDocumentSourceKind, getBusinessDocumentType, sourceOnlyDocumentTypes } from "@/lib/documents/business-document-types";

type EditableLine = { name: string; sku: string; quantity: number; unitPrice: number };
type DocumentLine = { name: string; sku?: string | null; quantity: number; unit_price: number; total: number };
type AttachmentView = { id: string; business_document_id: string; file_name: string; mime_type: string; size_bytes: number; created_at: string; download_url: string };
type SourceRecord = {
  id: string;
  reference: string;
  status: string;
  total: number;
  createdAt: string;
  partyName: string | null;
  partyContact: string | null;
  taxPin: string | null;
  paymentTerms?: string | null;
  subtotal: number;
  discount: number;
  tax: number;
  lines: Array<{ name: string; sku: string | null; quantity: number; unitPrice: number }>;
};
type SearchFilters = { q: string; group: string; type: string; status: string; year: string; page: number };

const allowedNextStatus: Record<BusinessDocument["document_status"], BusinessDocument["document_status"][]> = {
  DRAFT: ["PENDING_APPROVAL", "APPROVED", "SENT", "CONFIRMED", "CANCELLED", "ARCHIVED"],
  PENDING_APPROVAL: ["APPROVED", "CANCELLED", "ARCHIVED"],
  APPROVED: ["SENT", "CONFIRMED", "CANCELLED", "ARCHIVED"],
  SENT: ["CONFIRMED", "PARTIALLY_DELIVERED", "DELIVERED", "CANCELLED", "ARCHIVED"],
  CONFIRMED: ["PARTIALLY_DELIVERED", "DELIVERED", "CANCELLED", "ARCHIVED"],
  PARTIALLY_DELIVERED: ["DELIVERED", "CANCELLED", "ARCHIVED"],
  DELIVERED: ["REVERSED", "ARCHIVED"],
  CANCELLED: ["REVERSED", "ARCHIVED"],
  REVERSED: ["ARCHIVED"],
  ARCHIVED: [],
};

function readLines(value: Json[]): DocumentLine[] {
  return value.flatMap((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return [];
    const line = item as Record<string, Json | undefined>;
    if (typeof line.name !== "string" || typeof line.quantity !== "number" || typeof line.total !== "number") return [];
    return [{
      name: line.name,
      sku: typeof line.sku === "string" ? line.sku : null,
      quantity: line.quantity,
      unit_price: typeof line.unit_price === "number" ? line.unit_price : line.quantity ? line.total / line.quantity : line.total,
      total: line.total,
    }];
  });
}

function receiptLines(document: BusinessDocument): BusinessReceiptLine[] {
  return readLines(document.line_items).map((line) => ({
    name: line.name,
    sku: line.sku,
    quantity: line.quantity,
    total: line.total,
  }));
}

function money(value: number) {
  return `KSh ${Number(value).toLocaleString("en-KE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function titleFor(type: BusinessDocumentType, customTitle?: string | null) {
  return customTitle || businessDocumentTypes.find((entry) => entry.value === type)?.label || "Business document";
}

function statusLabel(status: BusinessDocument["document_status"]) {
  return businessDocumentStatuses.find((item) => item.value === status)?.label ?? status;
}

function documentUrl(filters: SearchFilters, page: number) {
  const params = new URLSearchParams();
  if (filters.q) params.set("q", filters.q);
  if (filters.group) params.set("group", filters.group);
  if (filters.type) params.set("type", filters.type);
  if (filters.status) params.set("status", filters.status);
  if (filters.year) params.set("year", filters.year);
  if (page > 1) params.set("page", String(page));
  return `/admin/documents${params.size ? `?${params.toString()}` : ""}`;
}

export function BusinessDocumentsWorkspace({
  initialDocuments,
  initialEvents,
  settings,
  filters,
  total,
}: {
  initialDocuments: BusinessDocument[];
  initialEvents: BusinessDocumentEvent[];
  settings: BusinessDocumentSettings;
  filters: SearchFilters;
  total: number;
}) {
  const [documents, setDocuments] = useState(initialDocuments);
  const [events, setEvents] = useState(initialEvents);
  const [selectedId, setSelectedId] = useState<string | null>(initialDocuments[0]?.id ?? null);
  const selected = documents.find((document) => document.id === selectedId) ?? null;
  const [documentType, setDocumentType] = useState<BusinessDocumentType>("QUOTATION");
  const [documentTitle, setDocumentTitle] = useState("");
  const [counterpartyType, setCounterpartyType] = useState<"CUSTOMER" | "SUPPLIER" | "INTERNAL">("CUSTOMER");
  const [customerName, setCustomerName] = useState("");
  const [customerContact, setCustomerContact] = useState("");
  const [taxPin, setTaxPin] = useState("");
  const [issueDate, setIssueDate] = useState(new Date().toISOString().slice(0, 10));
  const [dueDate, setDueDate] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("");
  const [paymentTerms, setPaymentTerms] = useState("");
  const [relatedReference, setRelatedReference] = useState("");
  const [relatedDocumentId, setRelatedDocumentId] = useState("");
  const [sourceQuery, setSourceQuery] = useState("");
  const [sourceResults, setSourceResults] = useState<SourceRecord[]>([]);
  const [sourceSearching, setSourceSearching] = useState(false);
  const [preparedBy, setPreparedBy] = useState("");
  const [checkedBy, setCheckedBy] = useState("");
  const [approvedBy, setApprovedBy] = useState("");
  const [termsAndConditions, setTermsAndConditions] = useState("");
  const [discount, setDiscount] = useState(0);
  const [tax, setTax] = useState(0);
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<EditableLine[]>([{ name: "", sku: "", quantity: 1, unitPrice: 0 }]);
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [statusSaving, setStatusSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [attachmentState, setAttachmentState] = useState<{ documentId: string; data: AttachmentView[] }>({ documentId: "", data: [] });
  const attachments = selected && attachmentState.documentId === selected.id ? attachmentState.data : [];
  const [resourceVersion, setResourceVersion] = useState(0);

  const typeConfig = getBusinessDocumentType(documentType);
  const sourceKind = getBusinessDocumentSourceKind(documentType);
  const subtotal = Math.round(lines.reduce((sum, line) => sum + Math.round(Math.max(0, line.quantity) * Math.max(0, line.unitPrice) * 100) / 100, 0) * 100) / 100;
  const totalAmount = Math.max(0, Math.round((subtotal - discount + tax) * 100) / 100);
  const pageCount = Math.max(1, Math.ceil(total / 50));

  useEffect(() => {
    if (!selectedId) {
      return;
    }
    let active = true;
    void Promise.all([
      fetch(`/api/admin/business-documents?eventsFor=${encodeURIComponent(selectedId)}`).then(async (response) => {
        const result = await response.json() as { data?: BusinessDocumentEvent[]; error?: string };
        if (!response.ok || !result.data) throw new Error(result.error ?? "Unable to load audit history.");
        return result.data;
      }),
      fetch(`/api/admin/business-documents/${encodeURIComponent(selectedId)}/attachments`).then(async (response) => {
        const result = await response.json() as { data?: AttachmentView[]; error?: string };
        if (!response.ok || !result.data) throw new Error(result.error ?? "Unable to load attachments.");
        return result.data;
      }),
    ]).then(([documentEvents, documentAttachments]) => {
      if (!active) return;
      setEvents((current) => [...documentEvents, ...current.filter((event) => event.business_document_id !== selectedId)]);
      setAttachmentState({ documentId: selectedId, data: documentAttachments });
    }).catch((error: unknown) => {
      if (active) setMessage(error instanceof Error ? error.message : "Unable to load document history.");
    });
    return () => { active = false; };
  }, [selectedId, resourceVersion]);

  function resetForm() {
    setDocumentType("QUOTATION");
    setDocumentTitle("");
    setCounterpartyType("CUSTOMER");
    setCustomerName("");
    setCustomerContact("");
    setTaxPin("");
    setIssueDate(new Date().toISOString().slice(0, 10));
    setDueDate("");
    setPaymentMethod("");
    setPaymentTerms("");
    setRelatedReference("");
    setRelatedDocumentId("");
    setSourceQuery("");
    setSourceResults([]);
    setPreparedBy("");
    setCheckedBy("");
    setApprovedBy("");
    setTermsAndConditions("");
    setDiscount(0);
    setTax(0);
    setNotes("");
    setLines([{ name: "", sku: "", quantity: 1, unitPrice: 0 }]);
  }

  async function searchSourceRecords() {
    if (!sourceKind || sourceQuery.trim().length < 2) return;
    setSourceSearching(true);
    setMessage("");
    try {
      const params = new URLSearchParams({ type: documentType, q: sourceQuery.trim() });
      const response = await fetch(`/api/admin/business-documents/sources?${params}`);
      const result = await response.json() as { data?: SourceRecord[]; error?: string };
      if (!response.ok || !result.data) throw new Error(result.error ?? "Unable to search source records.");
      setSourceResults(result.data);
      if (result.data.length === 0) setMessage("No matching live source records were found.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to search source records.");
    } finally {
      setSourceSearching(false);
    }
  }

  async function createDocument(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    try {
      const response = await fetch("/api/admin/business-documents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          documentType,
          documentTitle: documentTitle.trim() || null,
          counterpartyType,
          customerName: customerName.trim() || null,
          customerContact: customerContact.trim() || null,
          taxPin: taxPin.trim() || null,
          issueDate,
          dueDate: dueDate || null,
          paymentMethod: paymentMethod.trim() || null,
          paymentTerms: paymentTerms.trim() || null,
          relatedReference: relatedReference.trim() || null,
          relatedDocumentId: relatedDocumentId || null,
          preparedBy: preparedBy.trim() || null,
          checkedBy: checkedBy.trim() || null,
          approvedBy: approvedBy.trim() || null,
          termsAndConditions,
          discount,
          tax,
          notes,
          lineItems: lines.filter((line) => line.name.trim()).map((line) => ({
            ...line,
            name: line.name.trim(),
            sku: line.sku.trim() || null,
          })),
        }),
      });
      const result = await response.json() as { data?: BusinessDocument; error?: string };
      if (!response.ok || !result.data) throw new Error(result.error ?? "Unable to save document.");
      setDocuments((current) => [result.data!, ...current].slice(0, 50));
      setSelectedId(result.data.id);
      setEvents((current) => [{
        id: `new-${result.data!.id}`,
        business_document_id: result.data!.id,
        event_type: "CREATED",
        previous_status: null,
        new_status: result.data!.document_status,
        note: "",
        actor_id: result.data!.created_by,
        created_at: result.data!.created_at,
      }, ...current]);
      resetForm();
      setMessage(`Saved ${result.data.document_number}. This creates a document record only; it does not create a payment, order, stock movement, or tax filing.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to save document.");
    } finally {
      setSaving(false);
    }
  }

  async function selectDocument(document: BusinessDocument) {
    setSelectedId(document.id);
  }

  async function uploadAttachment(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected) return;
    const formElement = event.currentTarget;
    const formData = new FormData(formElement);
    setUploading(true);
    setMessage("");
    try {
      const response = await fetch(`/api/admin/business-documents/${encodeURIComponent(selected.id)}/attachments`, { method: "POST", body: formData });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error ?? "Unable to upload attachment.");
      formElement.reset();
      setMessage("Private document attachment uploaded and recorded in the audit history.");
      setResourceVersion((current) => current + 1);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to upload attachment.");
    } finally {
      setUploading(false);
    }
  }

  async function changeStatus(status: BusinessDocument["document_status"]) {
    if (!selected) return;
    const note = window.prompt(`Add an audit note for ${statusLabel(status)} (optional):`, "");
    if (note === null) return;
    setStatusSaving(true);
    setMessage("");
    try {
      const response = await fetch(`/api/admin/business-documents/${selected.id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, note }),
      });
      const result = await response.json() as { data?: BusinessDocument; error?: string };
      if (!response.ok || !result.data) throw new Error(result.error ?? "Unable to update document status.");
      setDocuments((current) => current.map((document) => document.id === result.data!.id ? result.data! : document));
      setMessage(`Document status changed to ${statusLabel(status)}. No payment or inventory records were changed.`);
      const eventResponse = await fetch(`/api/admin/business-documents?eventsFor=${encodeURIComponent(selected.id)}`);
      const eventResult = await eventResponse.json() as { data?: BusinessDocumentEvent[] };
      if (eventResponse.ok && eventResult.data) setEvents((current) => [...eventResult.data!, ...current.filter((event) => event.business_document_id !== selected.id)]);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to update document status.");
    } finally {
      setStatusSaving(false);
    }
  }

  return (
    <div className="business-documents-workspace">
      <div className="business-documents-toolbar no-print">
        <div><p className="eyebrow">Dantown Centre · Business documents</p><h2>Business document register</h2><p>Manage real saved records by business area. Numbering and status history are recorded by the database.</p></div>
        <Link className="button button-secondary" href="/admin/settings/documents">Business identity & print settings</Link>
      </div>
      <div className="business-document-truth-note no-print">
        This workspace creates document records and printable drafts. It does not record payments, change stock, create orders, file KRA/eTIMS returns, or certify legal compliance. Payment receipts are available only from confirmed transactions.
      </div>
      {message && <p className="catalog-manager-message no-print" role="status">{message}</p>}

      <section className="business-document-groups no-print" aria-label="Business document sections">
        {businessDocumentGroups.map((group) => (
          <Link className={filters.group === group.value ? "is-active" : ""} href={documentUrl({ ...filters, group: filters.group === group.value ? "" : group.value }, 1)} key={group.value}>
            <strong>{group.label}</strong><small>{group.description}</small>
          </Link>
        ))}
      </section>

      <form className="business-document-search no-print" action="/admin/documents" method="get">
        {filters.group && <input type="hidden" name="group" value={filters.group} />}
        <label>Search<input name="q" defaultValue={filters.q} placeholder="Document number, party, title or reference" /></label>
        <label>Document type<select name="type" defaultValue={filters.type}><option value="">All document types</option>{businessDocumentTypes.filter((item) => !filters.group || item.group === filters.group).map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}</select></label>
        <label>Status<select name="status" defaultValue={filters.status}><option value="">All statuses</option>{businessDocumentStatuses.map((status) => <option key={status.value} value={status.value}>{status.label}</option>)}</select></label>
        <label>Year<input name="year" type="number" min="2000" max="2200" defaultValue={filters.year} placeholder="YYYY" /></label>
        <button className="button button-primary" type="submit">Search documents</button>
        {(filters.q || filters.type || filters.status || filters.year) && <Link href={documentUrl({ ...filters, q: "", type: "", status: "", year: "" }, 1)}>Clear filters</Link>}
      </form>

      <div className="business-documents-grid">
        <form className="business-document-form no-print" onSubmit={createDocument}>
          <section>
            <h2>Create a document record</h2>
            <p className="business-document-safety-note">Sequential number is assigned on save. The record starts as a draft; approval does not post a payment or stock transaction.</p>
            <p>To create a real payment receipt, choose a confirmed, paid order from <Link href="/admin/orders">Orders</Link>.</p>
            <label>Business area<select value={typeConfig?.group ?? "SALES"} disabled={sourceSearching} onChange={(event) => {
              const group = event.target.value;
              const first = businessDocumentTypes.find((item) => item.group === group && !sourceOnlyDocumentTypes.has(item.value));
              if (first) {
                setDocumentType(first.value);
                setRelatedReference("");
                setRelatedDocumentId("");
                setSourceResults([]);
              }
            }}>{businessDocumentGroups.map((group) => <option value={group.value} key={group.value}>{group.label}</option>)}</select></label>
            <label>Document type<select value={documentType} disabled={sourceSearching} onChange={(event) => {
              const nextType = event.target.value as BusinessDocumentType;
              setDocumentType(nextType);
              setRelatedReference("");
              setRelatedDocumentId("");
              setSourceResults([]);
              const nextConfig = getBusinessDocumentType(nextType);
              if (nextConfig?.group === "PURCHASES") setCounterpartyType("SUPPLIER");
              else if (nextConfig?.requiresCounterparty) setCounterpartyType("CUSTOMER");
              else setCounterpartyType("INTERNAL");
            }}>{businessDocumentTypes.filter((type) => type.group === typeConfig?.group).map((type) => <option key={type.value} value={type.value} disabled={sourceOnlyDocumentTypes.has(type.value)}>{type.label}{sourceOnlyDocumentTypes.has(type.value) ? " · requires a real payment record" : ""}</option>)}</select></label>
            {documentType === "OTHER" && <label>Document title<input value={documentTitle} maxLength={160} onChange={(event) => setDocumentTitle(event.target.value)} required /></label>}
            {(typeConfig?.sourceRecordRequired || sourceKind) && !sourceOnlyDocumentTypes.has(documentType) && sourceKind && <div className="business-document-source-search">
              <label>Search existing {sourceKind === "order" ? "sales orders" : "purchase orders"}<input value={sourceQuery} maxLength={80} onChange={(event) => setSourceQuery(event.target.value)} placeholder="Enter at least two characters of the order number" /></label>
              <button className="button button-secondary" type="button" disabled={sourceSearching || sourceQuery.trim().length < 2} onClick={() => void searchSourceRecords()}>{sourceSearching ? "Searching..." : "Find source record"}</button>
              <label>Selected source record<input value={relatedReference} readOnly required placeholder="Choose a live source record below" /></label>
              {sourceResults.length > 0 && <ul aria-label="Matching source records">{sourceResults.map((source) => <li key={source.id}>
                <button type="button" onClick={() => {
                  setRelatedReference(source.reference);
                  setSourceResults([]);
                  setCustomerName(source.partyName ?? "");
                  setCustomerContact(source.partyContact ?? "");
                  setTaxPin(source.taxPin ?? "");
                  setPaymentTerms(source.paymentTerms ?? "");
                  setLines(source.lines.map((line) => ({ ...line })));
                  setDiscount(source.discount);
                  setTax(source.tax);
                  setMessage(`Loaded party and ${source.lines.length} item(s) from ${source.reference} (source total ${money(source.total)}). Review the draft details and amounts before saving.`);
                }}>
                  <strong>{source.reference}</strong><span>{source.status} · {money(source.total)} · {new Date(source.createdAt).toLocaleDateString()}</span>
                </button>
              </li>)}</ul>}
            </div>}
            {typeConfig?.sourceRecordRequired && !sourceOnlyDocumentTypes.has(documentType) && !sourceKind && <label>Source record reference<input value={relatedReference} maxLength={160} onChange={(event) => setRelatedReference(event.target.value)} required placeholder="Enter the external or system record reference" /></label>}
          </section>
          <section>
            <h2>Party and dates</h2>
            <label>Party type<select value={counterpartyType} onChange={(event) => setCounterpartyType(event.target.value as typeof counterpartyType)}><option value="CUSTOMER">Customer</option><option value="SUPPLIER">Supplier</option><option value="INTERNAL">Internal / none</option></select></label>
            <label>{counterpartyType === "SUPPLIER" ? "Supplier name" : "Customer / recipient"}{typeConfig?.requiresCounterparty && <span aria-hidden="true"> *</span>}<input value={customerName} maxLength={160} onChange={(event) => setCustomerName(event.target.value)} required={!!typeConfig?.requiresCounterparty} /></label>
            <label>Contact details<input value={customerContact} maxLength={120} onChange={(event) => setCustomerContact(event.target.value)} /></label>
            <label>Party KRA PIN (optional)<input value={taxPin} maxLength={24} onChange={(event) => setTaxPin(event.target.value)} /></label>
            <div className="business-document-date-grid">
              <label>Issue date<input type="date" value={issueDate} onChange={(event) => setIssueDate(event.target.value)} required /></label>
              <label>Due date (optional)<input type="date" min={issueDate} value={dueDate} onChange={(event) => setDueDate(event.target.value)} /></label>
            </div>
            <label>Link to another saved document<select value={relatedDocumentId} onChange={(event) => setRelatedDocumentId(event.target.value)}><option value="">No related document</option>{documents.map((document) => <option value={document.id} key={document.id}>{document.document_number} · {titleFor(document.document_type, document.document_title)}</option>)}</select></label>
            <label>Payment method (information only)<input value={paymentMethod} maxLength={48} onChange={(event) => setPaymentMethod(event.target.value)} placeholder="M-Pesa, cash, bank transfer..." /></label>
            <label>Payment terms / duration<input value={paymentTerms} maxLength={240} onChange={(event) => setPaymentTerms(event.target.value)} placeholder="Payment terms for this document" /></label>
          </section>
          <section>
            <div className="business-document-section-heading"><h2>Items and amounts</h2><button className="button button-secondary" type="button" onClick={() => setLines((current) => [...current, { name: "", sku: "", quantity: 1, unitPrice: 0 }])}>Add line</button></div>
            {lines.map((line, index) => <div className="business-document-line-editor" key={index}>
              <label>Description<input value={line.name} maxLength={160} onChange={(event) => setLines((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, name: event.target.value } : item))} required={!!typeConfig?.requiresLineItems && index === 0} /></label>
              <label>SKU (optional)<input value={line.sku} maxLength={80} onChange={(event) => setLines((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, sku: event.target.value } : item))} /></label>
              <div className="business-document-line-numbers">
                <label>Quantity<input type="number" min="0.01" step="0.01" value={line.quantity} onChange={(event) => setLines((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, quantity: Number(event.target.value) } : item))} required={!!typeConfig?.requiresLineItems && index === 0} /></label>
                <label>Unit price<input type="number" min="0" step="0.01" value={line.unitPrice} onChange={(event) => setLines((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, unitPrice: Number(event.target.value) } : item))} required={!!typeConfig?.requiresLineItems && index === 0} /></label>
                <strong>{money(Math.round(Math.max(0, line.quantity) * Math.max(0, line.unitPrice) * 100) / 100)}</strong>
                {lines.length > 1 && <button type="button" className="business-document-remove-line" onClick={() => setLines((current) => current.filter((_, itemIndex) => itemIndex !== index))} aria-label={`Remove line ${index + 1}`}>Remove</button>}
              </div>
            </div>)}
          </section>
          <section>
            <h2>Review and terms</h2>
            <div className="business-document-date-grid">
              <label>Discount<input type="number" min="0" step="0.01" max={subtotal} value={discount} onChange={(event) => setDiscount(Number(event.target.value))} /></label>
              <label>Tax / VAT amount<input type="number" min="0" step="0.01" value={tax} onChange={(event) => setTax(Number(event.target.value))} /></label>
            </div>
            <p className="business-document-total-preview">Subtotal {money(subtotal)} · Total {money(totalAmount)} (KES)</p>
            <label>Prepared by<input value={preparedBy} maxLength={160} onChange={(event) => setPreparedBy(event.target.value)} /></label>
            <label>Checked by<input value={checkedBy} maxLength={160} onChange={(event) => setCheckedBy(event.target.value)} /></label>
            <label>Approved by<input value={approvedBy} maxLength={160} onChange={(event) => setApprovedBy(event.target.value)} /></label>
            <label>Terms and conditions<textarea rows={3} maxLength={3000} value={termsAndConditions} onChange={(event) => setTermsAndConditions(event.target.value)} /></label>
            <label>Notes<textarea rows={3} maxLength={2000} value={notes} onChange={(event) => setNotes(event.target.value)} /></label>
          </section>
          <button className="button button-primary" type="submit" disabled={saving}>{saving ? "Saving document..." : "Save document record"}</button>
        </form>

        <section className="business-document-library no-print">
          <div className="business-document-section-heading"><div><p className="eyebrow">Saved records</p><h2>{filters.group ? businessDocumentGroups.find((group) => group.value === filters.group)?.label : "Document register"}</h2></div><strong>{total.toLocaleString()} records</strong></div>
          {documents.length ? <div className="business-document-list">{documents.map((document) => (
            <button className={`business-document-list-item${selected?.id === document.id ? " is-selected" : ""}`} type="button" key={document.id} onClick={() => void selectDocument(document)}>
              <strong>{document.document_number} <span className="business-document-status">{statusLabel(document.document_status)}</span></strong>
              <span>{titleFor(document.document_type, document.document_title)}{document.customer_name ? ` · ${document.customer_name}` : ""}</span>
              <small>{new Date(`${document.issue_date}T00:00:00`).toLocaleDateString()} · {money(Number(document.total))}</small>
            </button>
          ))}</div> : <div className="business-document-empty"><h3>No matching saved documents</h3><p>This section is empty until a real document record is saved. No sample or demo records are added.</p></div>}
          {pageCount > 1 && <nav className="business-document-pagination" aria-label="Document pages">
            <span>Page {filters.page} of {pageCount}</span>
            {filters.page > 1 && <Link href={documentUrl(filters, filters.page - 1)}>Previous</Link>}
            {filters.page < pageCount && <Link href={documentUrl(filters, filters.page + 1)}>Next</Link>}
          </nav>}
        </section>

        <section className="business-document-detail no-print">
          {selected ? <>
            <div className="business-document-detail-heading">
              <div><p className="eyebrow">Record detail</p><h2>{selected.document_number}</h2><p>{titleFor(selected.document_type, selected.document_title)} · {statusLabel(selected.document_status)}</p></div>
              <div className="business-document-detail-actions">
                <button className="button button-secondary" type="button" onClick={() => window.print()}>Print / save PDF</button>
                {allowedNextStatus[selected.document_status].length > 0 && <label className="business-document-status-action">Change status<select value="" disabled={statusSaving} onChange={(event) => { if (event.target.value) void changeStatus(event.target.value as BusinessDocument["document_status"]); }}><option value="">Choose status</option>{allowedNextStatus[selected.document_status].map((status) => <option value={status} key={status}>{statusLabel(status)}</option>)}</select></label>}
              </div>
            </div>
            <div className="business-document-activity">
              <h3>Audit history</h3>
              {events.filter((event) => event.business_document_id === selected.id).length ? events.filter((event) => event.business_document_id === selected.id).map((event) => <p key={event.id}><strong>{event.event_type === "CREATED" ? "Created" : event.event_type === "ATTACHMENT_ADDED" ? "Attachment added" : `Status: ${statusLabel(event.new_status)}`}</strong><time>{new Date(event.created_at).toLocaleString()}</time>{event.note && <span>{event.note}</span>}</p>) : <p>Loading record history…</p>}
            </div>
            <div className="business-document-attachments">
              <h3>Private attachments</h3>
              <form onSubmit={uploadAttachment}>
                <label>Attach a source document (PDF, JPG, PNG, WEBP · max 10 MB)<input type="file" name="file" accept="application/pdf,image/jpeg,image/png,image/webp,.pdf,.jpg,.jpeg,.png,.webp" required /></label>
                <button className="button button-secondary" type="submit" disabled={uploading}>{uploading ? "Uploading..." : "Upload attachment"}</button>
              </form>
              {attachments.length ? <ul>{attachments.map((attachment) => <li key={attachment.id}><a href={attachment.download_url} target="_blank" rel="noreferrer">{attachment.file_name}</a><small>{(attachment.size_bytes / 1024).toFixed(0)} KB · {new Date(attachment.created_at).toLocaleString()}</small></li>)}</ul> : <p>No source files are attached to this document.</p>}
            </div>
          </> : <div className="business-document-empty"><h3>Select a saved record</h3><p>The printable document view and its audit history appear here.</p></div>}
        </section>

        {selected && <section className="business-document-print-area">
          <BusinessReceipt
            settings={settings}
            title={titleFor(selected.document_type, selected.document_title)}
            reference={selected.document_number}
            date={formatBusinessDocumentDate(selected.issue_date, settings)}
            customer={selected.customer_name}
            customerContact={selected.customer_contact}
            paymentMethod={selected.payment_method}
            paymentTerms={selected.payment_terms}
            dueDate={selected.due_date ? formatBusinessDocumentDate(selected.due_date, settings) : null}
            notes={[selected.notes, `Document status: ${statusLabel(selected.document_status)}`].filter(Boolean).join("\n")}
            taxPin={selected.tax_pin}
            relatedReference={selected.related_reference ?? documents.find((document) => document.id === selected.related_document_id)?.document_number ?? null}
            preparedBy={selected.prepared_by}
            checkedBy={selected.checked_by}
            approvedBy={selected.approved_by}
            termsAndConditions={selected.terms_and_conditions}
            lines={receiptLines(selected)}
            subtotal={Number(selected.subtotal)}
            discount={Number(selected.discount)}
            tax={Number(selected.tax)}
            total={Number(selected.total)}
            showTotals={selected.line_items.length > 0 || Number(selected.total) > 0}
          />
        </section>}
      </div>
    </div>
  );
}
