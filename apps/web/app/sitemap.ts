import type { MetadataRoute } from "next";
import { policies, policyLastUpdated } from "@/lib/policies/config";
import { createSupabaseServiceClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = "https://www.dantownelectrical.co.ke";
  const policyModified = new Date(`${policyLastUpdated}T00:00:00.000Z`);
  const supabase = createSupabaseServiceClient();
  const products: Array<{ slug: string; updated_at: string }> = [];
  const pageSize = 1000;

  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await supabase
      .from("products")
      .select("slug,updated_at")
      .order("slug", { ascending: true })
      .range(offset, offset + pageSize - 1);

    if (error) {
      console.error("Unable to load products for the sitemap:", error.message);
      throw new Error("The product sitemap could not be generated.");
    }

    products.push(...(data ?? []));
    if (!data || data.length < pageSize) break;
  }

  return [
    { url: `${baseUrl}/`, lastModified: new Date(), changeFrequency: "weekly", priority: 1 },
    { url: `${baseUrl}/shop`, lastModified: new Date(), changeFrequency: "weekly", priority: 0.9 },
    { url: `${baseUrl}/solutions`, lastModified: new Date(), changeFrequency: "weekly", priority: 0.8 },
    { url: `${baseUrl}/projects`, lastModified: new Date(), changeFrequency: "weekly", priority: 0.8 },
    { url: `${baseUrl}/about`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.7 },
    { url: `${baseUrl}/contact`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.7 },
    { url: `${baseUrl}/request-quote`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.7 },
    { url: `${baseUrl}/policies`, lastModified: policyModified, changeFrequency: "monthly", priority: 0.5 },
    ...policies.map(({ slug }) => ({
      url: `${baseUrl}/policies/${slug}`,
      lastModified: policyModified,
      changeFrequency: "monthly" as const,
      priority: 0.4
    })),
    ...products.map(({ slug, updated_at }) => ({
      url: `${baseUrl}/products/${slug}`,
      lastModified: new Date(updated_at),
      changeFrequency: "weekly" as const,
      priority: 0.7
    }))
  ];
}
