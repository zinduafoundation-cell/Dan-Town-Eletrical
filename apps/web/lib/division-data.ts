import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@dantown/database";

export type DivisionCategory = { name: string; description: string; slug: string; imageUrl: string | null; productCount: number };

type CategorySeed = { terms: string[]; name: string; description: string };

export async function getDivisionCategories(client: SupabaseClient<Database>, seeds: CategorySeed[]) {
  const { data: categories, error: categoriesError } = await client
    .from("categories")
    .select("id,name,slug,image_url,is_active,parent_id")
    .eq("is_active", true);
  if (categoriesError) {
    console.error("Unable to load division categories:", categoriesError.message);
    throw new Error("Product categories are temporarily unavailable.");
  }

  const normalized = (value: string) => value.toLowerCase().replace(/[&/]/g, " ").replace(/\s+/g, " ").trim();
  const matched = seeds.flatMap((seed) => {
    const category = (categories ?? []).find((candidate) =>
      seed.terms.some((term) => normalized(candidate.name).includes(normalized(term))),
    );
    return category ? [{ seed, category }] : [];
  });
  const childrenByParent = new Map<string, string[]>();
  for (const category of categories ?? []) {
    if (!category.parent_id) continue;
    const children = childrenByParent.get(category.parent_id) ?? [];
    children.push(category.id);
    childrenByParent.set(category.parent_id, children);
  }
  const productCountResults = await Promise.all(matched.map(({ category }) =>
    {
      const categoryIds = [category.id];
      for (let index = 0; index < categoryIds.length; index += 1) {
        for (const childId of childrenByParent.get(categoryIds[index]) ?? []) {
          if (!categoryIds.includes(childId)) categoryIds.push(childId);
        }
      }
      return client
        .from("products")
        .select("category_id", { count: "exact", head: true })
        .in("category_id", categoryIds)
        .eq("is_active", true)
        .eq("status", "ACTIVE");
    },
  ));
  const failingCount = productCountResults.find((result) => result.error)?.error;
  if (failingCount) {
    console.error("Unable to count live division products:", failingCount.message);
    throw new Error("Live product counts are temporarily unavailable.");
  }

  return matched.map(({ seed, category }, index) => ({
    name: seed.name,
    description: seed.description,
    slug: category.slug,
    imageUrl: category.image_url,
    productCount: productCountResults[index].count ?? 0,
  }));
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
