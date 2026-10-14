import type { MetadataRoute } from "next";
import { policies, policyLastUpdated } from "@/lib/policies/config";

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = "https://www.dantownelectrical.co.ke";
  const policyModified = new Date(`${policyLastUpdated}T00:00:00.000Z`);
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
    }))
  ];
}
