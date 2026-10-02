import { requireAuthorizedPermission } from "../../../lib/auth/server";
import { createSupabaseServiceClient } from "../../../lib/supabase/server";
import CatalogWorkspace from "../../../components/admin/catalog-workspace";
import { PortalShell } from "../../portal-shell";

export const dynamic = "force-dynamic";

function catalogStatus(value: string): "ACTIVE" | "DRAFT" | "ARCHIVED" {
  return value === "ACTIVE" || value === "ARCHIVED" ? value : "DRAFT";
}

export default async function CatalogPage() {
  const context = await requireAuthorizedPermission("products.update");
  const supabase = createSupabaseServiceClient();

  const [
    { data: departments, error: departmentsError },
    { data: categories, error: categoriesError },
    { data: brands, error: brandsError },
    { data: products, count: productCount, error: productsError },
  ] = await Promise.all([
    supabase.from("departments").select("id,name,slug,icon,sort_order").eq("is_active", true).order("sort_order", { ascending: true }),
    supabase.from("categories").select("id,name,slug,parent_id,department_id").eq("is_active", true).order("sort_order", { ascending: true }),
    supabase.from("brands").select("id,name,slug,logo_url").eq("is_active", true).order("name", { ascending: true }),
    supabase.from("products").select("id,name,sku,barcode,slug,short_description,description,category_id,brand_id,cost_price,retail_price,contractor_price,wholesale_price,dealer_price,promotional_price,promotion_label,vat_rate,status,is_active,featured,weight,length,width,height,warranty_period,seo_title,seo_description,product_type,internal_code,manufacturer_part_number,tags,unit_of_measure,minimum_selling_price,maximum_suggested_price,tax_inclusive,updated_at", { count: "exact" }).order("updated_at", { ascending: false }).range(0, 29),
  ]);
  const catalogError = departmentsError ?? categoriesError ?? brandsError ?? productsError;
  if (catalogError) {
    console.error("Unable to load Dantown catalog workspace:", catalogError.message);
    throw new Error("The product catalog could not be loaded. Refresh the page or contact an administrator.");
  }

  const productIds = (products ?? []).map((product) => product.id);
  const productImages = productIds.length
    ? await supabase
        .from("product_images")
        .select("product_id,image_url")
        .in("product_id", productIds)
        .eq("is_primary", true)
    : { data: [] };
  const imageByProduct = new Map((productImages.data ?? []).map((image) => [image.product_id, image.image_url]));
  const productsWithImages = (products ?? []).map((product) => ({
    ...product,
    status: catalogStatus(product.status),
    image_url: imageByProduct.get(product.id) ?? null,
  }));

  return (
    <PortalShell
      title="Build the catalog."
      description="Create the families, sub-divisions, brands, and products customers see across Dantown."
      roles={context.roles}
      permissions={context.permissions}
      links={[
        { label: "Overview", href: "/admin" },
        { label: "Catalog manager", href: "/admin/catalog" },
        { label: "Products", href: "/admin/products", permission: "products.read" },
        { label: "Categories", href: "/admin/categories", permission: "products.update" },
        { label: "Brands", href: "/brands" },
        { label: "Settings", href: "/admin/settings", permission: "app.manage" },
      ]}
    >
      <CatalogWorkspace
        departments={departments ?? []}
        categories={categories ?? []}
        brands={brands ?? []}
        products={productsWithImages}
        productCount={productCount ?? 0}
      />
    </PortalShell>
  );
}
