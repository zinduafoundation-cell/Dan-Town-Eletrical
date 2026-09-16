import { requireAuthorizedPermission } from "../../../lib/auth/server";
import { createSupabaseServiceClient } from "../../../lib/supabase/server";
import CatalogManager from "../../../components/admin/catalog-manager";
import { BulkProductActions } from "@/components/admin/bulk-product-actions";
import { ProductBarcodeManager } from "@/components/admin/product-barcode-manager";
import { PortalShell } from "../../portal-shell";

export const dynamic = "force-dynamic";

export default async function CatalogPage() {
  const context = await requireAuthorizedPermission("products.update");
  const supabase = createSupabaseServiceClient();

  const [{ data: departments }, { data: categories }, { data: brands }, { data: products }, { data: productImages }] = await Promise.all([
    supabase.from("departments").select("id,name,slug,icon,sort_order").eq("is_active", true).order("sort_order", { ascending: true }),
    supabase.from("categories").select("id,name,slug,parent_id,department_id").eq("is_active", true).order("sort_order", { ascending: true }),
    supabase.from("brands").select("id,name,slug,logo_url").eq("is_active", true).order("name", { ascending: true }),
    supabase.from("products").select("id,name,sku,barcode,slug,retail_price,promotional_price,promotion_label,featured,status,is_active,category_id,brand_id").order("created_at", { ascending: false }).limit(30),
    supabase.from("product_images").select("product_id,image_url,is_primary").eq("is_primary", true),
  ]);

  const imageByProduct = new Map((productImages ?? []).map((image) => [image.product_id, image.image_url]));
  const productsWithImages = (products ?? []).map((product) => ({
    ...product,
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
      <BulkProductActions products={productsWithImages} categories={categories ?? []} brands={brands ?? []} />
      <ProductBarcodeManager products={productsWithImages} />
      <CatalogManager
        departments={departments ?? []}
        categories={categories ?? []}
        brands={brands ?? []}
        products={productsWithImages}
      />
    </PortalShell>
  );
}
