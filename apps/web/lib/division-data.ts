import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@dantown/database";

export type DivisionCategory = { name: string; description: string; slug: string; imageUrl: string | null; productCount: number };

type CategorySeed = { terms: string[]; name: string; description: string };

export async function getDivisionCategories(client: SupabaseClient<Database>, seeds: CategorySeed[]) {
  const [{ data: categories }, { data: products }] = await Promise.all([
    client.from("categories").select("id,name,slug,image_url,is_active").eq("is_active", true),
    client.from("products").select("category_id").eq("is_active", true).eq("status", "ACTIVE")
  ]);
  const productCounts = new Map<string, number>();
  for (const product of products ?? []) if (product.category_id) productCounts.set(product.category_id, (productCounts.get(product.category_id) ?? 0) + 1);
  const normalized = (value: string) => value.toLowerCase().replace(/[&/]/g, " ").replace(/\s+/g, " ").trim();
  const result: DivisionCategory[] = [];
  for (const seed of seeds) {
    const category = (categories ?? []).find((candidate) => seed.terms.some((term) => normalized(candidate.name).includes(normalized(term))));
    if (!category) continue;
    result.push({ name: seed.name, description: seed.description, slug: category.slug, imageUrl: category.image_url, productCount: productCounts.get(category.id) ?? 0 });
  }
  return result;
}

export const solarCategorySeeds: CategorySeed[] = [
  { terms: ["solar panel", "panels"], name: "Solar Panels", description: "Generate clean electricity from sunlight for homes, businesses, and larger energy systems." },
  { terms: ["solar batter", "batteries"], name: "Solar Batteries", description: "Store solar energy for reliable power during the night or when sunlight is unavailable." },
  { terms: ["inverter"], name: "Inverters", description: "Convert stored DC power into usable AC electricity for your home, office, or business." },
  { terms: ["charge controller", "controller"], name: "Charge Controllers", description: "Protect and manage battery charging for improved solar system performance." },
  { terms: ["solar kit", "solar system"], name: "Solar Kits", description: "Complete solar solutions designed for easier selection and installation." },
  { terms: ["mounting", "solar structure"], name: "Mounting Systems", description: "Secure structures for proper solar panel installation." },
  { terms: ["solar cable"], name: "Solar Cables", description: "Durable cables and connectors designed for solar energy systems." },
  { terms: ["solar accessory", "solar accessories"], name: "Solar Accessories", description: "Essential components that complete and protect your solar setup." },
  { terms: ["solar light"], name: "Solar Lights", description: "Efficient lighting options for homes, pathways, security, and projects." }
];

export const electricalCategorySeeds: CategorySeed[] = [
  { terms: ["cables", "wiring", "wire"], name: "Cables & Wiring", description: "Reliable conductors and accessories for safe residential, commercial, and project installations." },
  { terms: ["switch", "socket"], name: "Switches & Sockets", description: "Everyday controls and connection points for considered electrical installations." },
  { terms: ["circuit", "breaker", "isolator"], name: "Circuit Protection", description: "Protect people, equipment, and circuits with dependable switching and protection." },
  { terms: ["distribution", "board"], name: "Distribution Boards", description: "Organize and protect electrical distribution across homes and businesses." },
  { terms: ["lighting", "light"], name: "Lighting", description: "Practical and efficient lighting for homes, workspaces, and projects." },
  { terms: ["conduit", "trunking"], name: "Conduits & Trunking", description: "Route and protect cables with installation-ready containment products." },
  { terms: ["tool"], name: "Electrical Tools", description: "Useful tools for electricians, technicians, and project teams." },
  { terms: ["accessor"], name: "Electrical Accessories", description: "The fittings and finishing components that complete an installation." }
];
