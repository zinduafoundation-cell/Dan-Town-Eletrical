import type { BusinessDocument, BusinessDocumentEvent } from "@dantown/database";
import { PortalShell } from "@/app/portal-shell";
import { BusinessDocumentsWorkspace } from "@/components/admin/business-documents-workspace";
import { requireAuthorizedPermission } from "@/lib/auth/server";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { businessDocumentGroups, businessDocumentStatuses, businessDocumentTypes } from "@/lib/documents/business-document-types";
import { loadBusinessConfiguration } from "@/lib/settings/business-configuration";

export const dynamic = "force-dynamic";

export default async function BusinessDocumentsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string | string[]; group?: string | string[]; type?: string | string[]; status?: string | string[]; year?: string | string[]; page?: string | string[] }>;
}) {
  const context = await requireAuthorizedPermission("settings.manage");
  const params = await searchParams;
  const first = (value: string | string[] | undefined) => Array.isArray(value) ? value[0] ?? "" : value ?? "";
  const rawGroup = first(params.group);
  const rawType = first(params.type);
  const rawStatus = first(params.status);
  const group = businessDocumentGroups.find((entry) => entry.value === rawGroup)?.value ?? "";
  const type = businessDocumentTypes.find((entry) => entry.value === rawType && (!group || entry.group === group))?.value ?? "";
  const status = businessDocumentStatuses.find((entry) => entry.value === rawStatus)?.value ?? "";
  const yearValue = first(params.year);
  const yearNumber = Number.parseInt(yearValue, 10);
  const year = yearValue && Number.isInteger(yearNumber) && yearNumber >= 2000 && yearNumber <= 2200 ? String(yearNumber) : "";
  const pageValue = Number.parseInt(first(params.page) || "1", 10);
  const page = Number.isInteger(pageValue) && pageValue > 0 ? Math.min(pageValue, 100000) : 1;
  const queryText = first(params.q).trim().replace(/[^a-z\d ._/-]/gi, "").slice(0, 80);
  const pageSize = 50;
  const supabase = createSupabaseServiceClient();
  let query = supabase.from("business_documents")
    .select("id,document_number,document_type,document_group,document_title,document_status,counterparty_type,customer_name,customer_contact,issue_date,due_date,payment_method,payment_terms,currency,line_items,subtotal,discount,tax,total,notes,terms_and_conditions,tax_pin,related_reference,related_document_id,prepared_by,checked_by,approved_by,financial_year,created_by,updated_by,created_at", { count: "exact" })
    .order("issue_date", { ascending: false })
    .order("created_at", { ascending: false })
    .range((page - 1) * pageSize, page * pageSize - 1);
  if (queryText) query = query.or(`document_number.ilike.%${queryText}%,document_title.ilike.%${queryText}%,customer_name.ilike.%${queryText}%,related_reference.ilike.%${queryText}%`);
  if (group) query = query.eq("document_group", group);
  if (type) query = query.eq("document_type", type);
  if (status) query = query.eq("document_status", status);
  if (year) query = query.eq("financial_year", Number(year));

  const [{ data: documents, count, error: documentsError }, configuration] = await Promise.all([
    query,
    loadBusinessConfiguration(),
  ]);
  if (documentsError) {
    console.error("Unable to load business documents in Centre:", documentsError.message);
    throw new Error("Business documents could not be loaded. Confirm the database migration is applied.");
  }
  const documentRows = (documents ?? []) as BusinessDocument[];
  const documentIds = documentRows.map((document) => document.id);
  const { data: events, error: eventsError } = documentIds.length
    ? await supabase.from("business_document_events")
        .select("id,business_document_id,event_type,previous_status,new_status,note,actor_id,created_at")
        .in("business_document_id", documentIds)
        .order("created_at", { ascending: false })
    : { data: [], error: null };
  if (eventsError) {
    console.error("Unable to load business document audit history:", eventsError.message);
    throw new Error("Document audit history could not be loaded.");
  }
  const settings = configuration.documentSettings;

  return (
    <PortalShell
      title="Business documents."
      description="Create, organize, search, and print real business records under the relevant operating sections."
      roles={context.roles}
      permissions={context.permissions}
      links={[
        { label: "Dantown Centre", href: "/centre" },
        { label: "Business documents", href: "/admin/documents", permission: "settings.manage" },
        { label: "Business identity & print settings", href: "/admin/settings/documents", permission: "settings.manage" },
        { label: "Orders", href: "/admin/orders", permission: "orders.read" },
        { label: "Purchases", href: "/admin/purchases", permission: "inventory.read" },
      ]}
    >
      <BusinessDocumentsWorkspace
        initialDocuments={documentRows}
        initialEvents={(events ?? []) as BusinessDocumentEvent[]}
        settings={settings}
        filters={{ q: queryText, group, type, status, year, page }}
        total={count ?? 0}
      />
    </PortalShell>
  );
}
