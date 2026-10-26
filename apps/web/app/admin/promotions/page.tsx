import { PromotionManager, type PromotionView } from "@/components/admin/promotion-manager";
import { PortalShell } from "@/app/portal-shell";
import { requireAuthorizedPermission } from "@/lib/auth/server";
import { createSupabaseServiceClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function PromotionsPage() {
  const context = await requireAuthorizedPermission("products.update");
  const { data, error } = await createSupabaseServiceClient()
    .from("storefront_promotions")
    .select("id,title,description,badge,image_url,mobile_image_url,cta_label,show_on_homepage,destination_url,starts_at,ends_at,is_active,sort_order,created_at")
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) {
    console.error("Unable to load Centre promotions:", error.message);
    throw new Error("Promotions could not be loaded. Refresh the page or contact an administrator.");
  }
  const promotions: PromotionView[] = data ?? [];

  return (
    <PortalShell
      title="Storefront promotions"
      description="Create and schedule the deals customers see on the public website."
      roles={context.roles}
      permissions={context.permissions}
      links={[
        { label: "Centre", href: "/centre" },
        { label: "Promotions", href: "/admin/promotions", permission: "products.update" },
        { label: "Catalog", href: "/admin/catalog", permission: "products.update" },
      ]}
    >
      <PromotionManager initialPromotions={promotions} />
    </PortalShell>
  );
}
