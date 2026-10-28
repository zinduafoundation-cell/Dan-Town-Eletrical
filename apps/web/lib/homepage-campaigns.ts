import type { createSupabaseServiceClient } from "@/lib/supabase/server";

type HomeCampaign = {
  id: string;
  title: string;
  description: string;
  badge: string;
  image_url: string | null;
  mobile_image_url: string | null;
  cta_label: string;
  destination_url: string;
};

type HomeCampaignRecord = Omit<HomeCampaign, "mobile_image_url"> & {
  mobile_image_url?: string | null;
};

type ServiceClient = ReturnType<typeof createSupabaseServiceClient>;

function mapCampaigns(data: HomeCampaignRecord[]): HomeCampaign[] {
  return data.map((item) => ({
    id: item.id,
    title: item.title,
    description: item.description,
    badge: item.badge,
    image_url: item.image_url ?? null,
    mobile_image_url: item.mobile_image_url ?? item.image_url ?? null,
    cta_label: item.cta_label || "Shop now",
    destination_url: item.destination_url,
  }));
}

export async function getHomepageCampaigns(supabase: ServiceClient): Promise<HomeCampaign[]> {
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("storefront_promotions")
    .select("id,title,description,badge,image_url,mobile_image_url,cta_label,destination_url")
    .eq("is_active", true)
    .eq("show_on_homepage", true)
    .or(`starts_at.is.null,starts_at.lte.${now}`)
    .or(`ends_at.is.null,ends_at.gte.${now}`)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: false })
    .limit(6);

  if (error?.code === "42703" && error.message.includes("mobile_image_url")) {
    console.warn("Homepage campaign schema is missing mobile_image_url; using campaign desktop images instead.");
    const fallback = await supabase
      .from("storefront_promotions")
      .select("id,title,description,badge,image_url,cta_label,destination_url")
      .eq("is_active", true)
      .eq("show_on_homepage", true)
      .or(`starts_at.is.null,starts_at.lte.${now}`)
      .or(`ends_at.is.null,ends_at.gte.${now}`)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: false })
      .limit(6);
    if (fallback.error) {
      console.error("Unable to load homepage campaigns:", fallback.error.code ?? "unknown");
      return [];
    }
    return mapCampaigns(fallback.data ?? []);
  }

  if (error) {
    console.error("Unable to load homepage campaigns:", error.code ?? "unknown");
    return [];
  }

  return mapCampaigns(data ?? []);
}
