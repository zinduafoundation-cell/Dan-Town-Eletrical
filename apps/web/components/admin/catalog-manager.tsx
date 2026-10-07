/* eslint-disable @next/next/no-img-element -- Catalog images are administrator-supplied remote URLs and need to remain usable without a restrictive build-time host allowlist. */
"use client";

import { FormEvent, type ReactNode, useState } from "react";
import { ArrowLeftRight, ImagePlus, PackagePlus, Plus, Search, Tags } from "lucide-react";
import { z } from "zod";

type Department = { id: string; name: string; slug: string; icon: string | null; sort_order: number };
type Category = { id: string; name: string; slug: string; parent_id: string | null; department_id: string | null };
type Brand = { id: string; name: string; slug: string; logo_url: string | null };
const nullableNumberSchema = z.preprocess(
  (value) => value === null || value === "" ? null : value,
  z.coerce.number().nullable(),
);

const productSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  sku: z.string(),
  barcode: z.string().nullable(),
  slug: z.string(),
  short_description: z.string().nullable(),
  description: z.string().nullable(),
  category_id: z.string().uuid().nullable(),
  brand_id: z.string().uuid().nullable(),
  cost_price: z.coerce.number(),
  retail_price: z.coerce.number(),
  contractor_price: nullableNumberSchema,
  wholesale_price: nullableNumberSchema,
  dealer_price: nullableNumberSchema,
  promotional_price: nullableNumberSchema,
  promotion_label: z.string().nullable(),
  vat_rate: z.coerce.number(),
  status: z.enum(["DRAFT", "ACTIVE", "ARCHIVED"]),
  is_active: z.boolean(),
  featured: z.boolean(),
  weight: nullableNumberSchema,
  length: nullableNumberSchema,
  width: nullableNumberSchema,
  height: nullableNumberSchema,
  warranty_period: nullableNumberSchema,
  seo_title: z.string().nullable(),
  seo_description: z.string().nullable(),
  product_type: z.string().nullable(),
  internal_code: z.string().nullable(),
  manufacturer_part_number: z.string().nullable(),
  tags: z.array(z.string()),
  unit_of_measure: z.string(),
  minimum_selling_price: nullableNumberSchema,
  maximum_suggested_price: nullableNumberSchema,
  tax_inclusive: z.boolean(),
  updated_at: z.string(),
  image_url: z.string().url().nullable(),
});
type Product = z.infer<typeof productSchema>;

type Props = { departments: Department[]; categories: Category[]; brands: Brand[]; products: Product[]; productCount: number };

function slugify(value: string) { return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, ""); }
function optionalNumber(form: FormData, name: string) {
  const value = String(form.get(name) ?? "").trim();
  return value ? Number(value) : null;
}
function optionalText(form: FormData, name: string) {
  return String(form.get(name) ?? "").trim() || null;
}
function productFormPayload(form: FormData) {
  return {
    name: String(form.get("name") ?? "").trim(),
    sku: String(form.get("sku") ?? "").trim(),
    barcode: optionalText(form, "barcode"),
    slug: slugify(String(form.get("slug") || form.get("name") || "")),
    shortDescription: optionalText(form, "shortDescription"),
    description: optionalText(form, "description"),
    costPrice: Number(form.get("costPrice") ?? 0),
    retailPrice: Number(form.get("retailPrice") ?? 0),
    contractorPrice: optionalNumber(form, "contractorPrice"),
    wholesalePrice: optionalNumber(form, "wholesalePrice"),
    dealerPrice: optionalNumber(form, "dealerPrice"),
    promotionalPrice: optionalNumber(form, "promotionalPrice"),
    promotionLabel: optionalText(form, "promotionLabel"),
    featured: form.get("featured") === "on",
    isActive: form.get("isActive") === "on",
    status: String(form.get("status") || "DRAFT"),
    categoryId: optionalText(form, "categoryId"),
    brandId: optionalText(form, "brandId"),
    productType: optionalText(form, "productType"),
    internalCode: optionalText(form, "internalCode"),
    manufacturerPartNumber: optionalText(form, "manufacturerPartNumber"),
    unitOfMeasure: String(form.get("unitOfMeasure") || "each").trim(),
    vatRate: Number(form.get("vatRate") ?? 16),
    taxInclusive: form.get("taxInclusive") === "on",
    weight: optionalNumber(form, "weight"),
    length: optionalNumber(form, "length"),
    width: optionalNumber(form, "width"),
    height: optionalNumber(form, "height"),
    warrantyPeriod: optionalNumber(form, "warrantyPeriod"),
    minimumSellingPrice: optionalNumber(form, "minimumSellingPrice"),
    maximumSuggestedPrice: optionalNumber(form, "maximumSuggestedPrice"),
    tags: String(form.get("tags") ?? "").split(",").map((tag) => tag.trim()).filter(Boolean),
    seoTitle: optionalText(form, "seoTitle"),
    seoDescription: optionalText(form, "seoDescription"),
  };
}

const imageUploadResponseSchema = z.object({ data: z.object({ imageUrl: z.string().url() }) });
const imageUploadErrorSchema = z.object({ error: z.string() });
const productMutationResponseSchema = z.object({ data: productSchema.omit({ image_url: true }) });
const productSearchResponseSchema = z.object({
  data: z.array(productSchema),
  pagination: z.object({ page: z.number().int(), pageSize: z.number().int(), total: z.number().int() }),
});

async function uploadProductImage(productId: string, file: File) {
  const form = new FormData();
  form.set("file", file);
  const response = await fetch(`/api/admin/catalog/${productId}/image`, { method: "POST", body: form });
  const result: unknown = await response.json();
  if (!response.ok) {
    const parsedError = imageUploadErrorSchema.safeParse(result);
    throw new Error(parsedError.success ? parsedError.data.error : "Unable to upload product image.");
  }
  const parsedResponse = imageUploadResponseSchema.safeParse(result);
  if (!parsedResponse.success) throw new Error("The image upload returned an invalid response.");
  return parsedResponse.data.data.imageUrl;
}

function ProductFields({ product, categories, brands }: { product?: Product; categories: Category[]; brands: Brand[] }) {
  return (
    <div className="catalog-product-fields">
      <section className="catalog-product-section">
        <div className="catalog-product-section-heading"><span>01</span><div><h3>Product details</h3><p>Give the item a clear name and identify it for your team.</p></div></div>
        <div className="catalog-fields-grid">
          <label className="catalog-field-wide">Product name<input name="name" defaultValue={product?.name} placeholder="24W LED Panel Light" required /></label>
          <label>SKU<input name="sku" defaultValue={product?.sku} placeholder="LGT-PNL-24W" required /></label>
          <label>Barcode<input name="barcode" defaultValue={product?.barcode ?? ""} /></label>
          <label>Product type<input name="productType" defaultValue={product?.product_type ?? ""} placeholder="Lighting, solar, cable..." /></label>
          <label>Unit of measure<input name="unitOfMeasure" defaultValue={product?.unit_of_measure ?? "each"} required /></label>
          <label>Manufacturer part number<input name="manufacturerPartNumber" defaultValue={product?.manufacturer_part_number ?? ""} /></label>
          <label>Internal code<input name="internalCode" defaultValue={product?.internal_code ?? ""} /></label>
          <label className="catalog-field-wide">Storefront URL slug<input name="slug" defaultValue={product?.slug} placeholder="generated-from-product-name" /></label>
          <label className="catalog-field-wide">Short description<input name="shortDescription" defaultValue={product?.short_description ?? ""} maxLength={500} placeholder="A quick summary customers will see." /></label>
          <label className="catalog-field-wide">Product description<textarea name="description" defaultValue={product?.description ?? ""} maxLength={10000} rows={4} placeholder="Describe the product, key benefits, and intended use." /></label>
        </div>
      </section>
      <section className="catalog-product-section">
        <div className="catalog-product-section-heading"><span>02</span><div><h3>Pricing and tax</h3><p>Set the customer price, costs, and any tax or promotion details.</p></div></div>
        <div className="catalog-fields-grid">
          <label>Buying / cost price<input name="costPrice" type="number" min="0" step="0.01" defaultValue={product?.cost_price ?? 0} required /></label>
          <label>Retail price<input name="retailPrice" type="number" min="0" step="0.01" defaultValue={product?.retail_price} placeholder="1800" required /></label>
          <label>Promotion price<input name="promotionalPrice" type="number" min="0" step="0.01" defaultValue={product?.promotional_price ?? ""} placeholder="Optional" /></label>
          <label>Contractor price<input name="contractorPrice" type="number" min="0" step="0.01" defaultValue={product?.contractor_price ?? ""} /></label>
          <label>Wholesale price<input name="wholesalePrice" type="number" min="0" step="0.01" defaultValue={product?.wholesale_price ?? ""} /></label>
          <label>Dealer price<input name="dealerPrice" type="number" min="0" step="0.01" defaultValue={product?.dealer_price ?? ""} /></label>
          <label>Minimum selling price<input name="minimumSellingPrice" type="number" min="0" step="0.01" defaultValue={product?.minimum_selling_price ?? ""} /></label>
          <label>Maximum suggested price<input name="maximumSuggestedPrice" type="number" min="0" step="0.01" defaultValue={product?.maximum_suggested_price ?? ""} /></label>
          <label>VAT rate (%)<input name="vatRate" type="number" min="0" max="100" step="0.01" defaultValue={product?.vat_rate ?? 16} required /></label>
          <label className="catalog-checkbox"><input name="taxInclusive" type="checkbox" defaultChecked={product?.tax_inclusive ?? false} /><span>Prices include VAT</span></label>
          <label>Promotion label<select name="promotionLabel" defaultValue={product?.promotion_label ?? ""}><option value="">No label</option><option>New</option><option>Best seller</option><option>Discounted</option><option>Hot</option><option>Featured</option></select></label>
        </div>
      </section>
      <section className="catalog-product-section">
        <div className="catalog-product-section-heading"><span>03</span><div><h3>Sales and visibility</h3><p>Organize the product and choose where it can be sold.</p></div></div>
        <div className="catalog-fields-grid">
          <label>Category / family<select name="categoryId" defaultValue={product?.category_id ?? ""}><option value="">No family</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.parent_id ? "↳ " : ""}{category.name}</option>)}</select></label>
          <label>Brand<select name="brandId" defaultValue={product?.brand_id ?? ""}><option value="">No brand</option>{brands.map((brand) => <option key={brand.id} value={brand.id}>{brand.name}</option>)}</select></label>
          <label>Lifecycle status<select name="status" defaultValue={product?.status ?? "DRAFT"}><option value="DRAFT">Draft</option><option value="ACTIVE">Active</option><option value="ARCHIVED">Archived</option></select></label>
          <label className="catalog-checkbox"><input name="isActive" type="checkbox" defaultChecked={product?.is_active ?? false} /><span>Available on website and POS</span></label>
          <label className="catalog-checkbox"><input name="featured" type="checkbox" defaultChecked={product?.featured ?? false} /><span>Show in featured products</span></label>
          <label className="catalog-field-wide">Search tags<input name="tags" defaultValue={product?.tags.join(", ") ?? ""} placeholder="solar, outdoor, 24W" /></label>
        </div>
      </section>
      <section className="catalog-product-section">
        <div className="catalog-product-section-heading"><span>04</span><div><h3>Specifications and discovery</h3><p>Optional product dimensions, warranty, and search-engine details.</p></div></div>
        <div className="catalog-fields-grid">
          <label>Weight (kg)<input name="weight" type="number" min="0" step="0.001" defaultValue={product?.weight ?? ""} /></label>
          <label>Length (cm)<input name="length" type="number" min="0" step="0.001" defaultValue={product?.length ?? ""} /></label>
          <label>Width (cm)<input name="width" type="number" min="0" step="0.001" defaultValue={product?.width ?? ""} /></label>
          <label>Height (cm)<input name="height" type="number" min="0" step="0.001" defaultValue={product?.height ?? ""} /></label>
          <label>Warranty (months)<input name="warrantyPeriod" type="number" min="0" step="1" defaultValue={product?.warranty_period ?? ""} /></label>
          <label>SEO title<input name="seoTitle" defaultValue={product?.seo_title ?? ""} maxLength={180} /></label>
          <label className="catalog-field-wide">SEO description<textarea name="seoDescription" defaultValue={product?.seo_description ?? ""} maxLength={320} rows={2} /></label>
        </div>
      </section>
    </div>
  );
}

export default function CatalogManager({ departments, categories: initialCategories, brands: initialBrands, products: initialProducts, productCount: initialProductCount }: Props) {
  const [categories, setCategories] = useState(initialCategories);
  const [brands, setBrands] = useState(initialBrands);
  const [products, setProducts] = useState(initialProducts);
  const [productCount, setProductCount] = useState(initialProductCount);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [page, setPage] = useState(1);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [activeComposer, setActiveComposer] = useState<"category" | "brand" | "product">("product");

  async function searchProducts(nextPage = 1, nextQuery = query, nextStatus = statusFilter) {
    setLoadingProducts(true);
    setMessage("");
    try {
      const params = new URLSearchParams({ page: String(nextPage) });
      if (nextQuery.trim()) params.set("q", nextQuery.trim());
      if (nextStatus) params.set("status", nextStatus);
      const response = await fetch(`/api/admin/catalog?${params}`);
      const result: unknown = await response.json();
      if (!response.ok) {
        const error = imageUploadErrorSchema.safeParse(result);
        throw new Error(error.success ? error.data.error : "Unable to search the product catalog.");
      }
      const parsed = productSearchResponseSchema.safeParse(result);
      if (!parsed.success) throw new Error("The catalog search returned an invalid response.");
      setProducts(parsed.data.data);
      setProductCount(parsed.data.pagination.total);
      setPage(parsed.data.pagination.page);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to search the product catalog.");
    } finally {
      setLoadingProducts(false);
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>, type: "category" | "brand" | "product") {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    const form = new FormData(event.currentTarget);
    const imageFile = form.get("productImage");
    const productImage = imageFile instanceof File && imageFile.size > 0 ? imageFile : null;
    const name = String(form.get("name") ?? "");
    const payload = type === "category"
      ? { type, name, slug: slugify(name), description: String(form.get("description") ?? ""), parentId: String(form.get("parentId") ?? "") || null, departmentId: String(form.get("departmentId") ?? "") || null, imageUrl: String(form.get("imageUrl") ?? "") || null }
      : type === "brand"
        ? { type, name, slug: slugify(name), description: String(form.get("description") ?? ""), logoUrl: String(form.get("logoUrl") ?? "") || null }
        : { type, ...productFormPayload(form), imageUrl: productImage ? null : String(form.get("imageUrl") ?? "") || null };

    try {
      const response = await fetch("/api/admin/catalog", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not save catalog item");
      event.currentTarget.reset();
      if (type === "category") setCategories((current) => [...current, result.data]);
      if (type === "brand") setBrands((current) => [...current, result.data]);
      if (type === "product") {
        const parsedProduct = productMutationResponseSchema.safeParse(result);
        if (!parsedProduct.success) throw new Error("The created product response was invalid.");
        const createdProduct = { ...parsedProduct.data.data, image_url: null };
        setProducts((current) => [createdProduct, ...current]);
        setProductCount((current) => current + 1);
        if (productImage) {
          try {
            const imageUrl = await uploadProductImage(createdProduct.id, productImage);
            setProducts((current) => current.map((product) => product.id === createdProduct.id ? { ...product, image_url: imageUrl } : product));
            setMessage("Product created and its image is ready for the storefront and POS.");
          } catch (error) {
            setMessage(`Product created, but its image was not uploaded: ${error instanceof Error ? error.message : "Please retry from Edit product."}`);
          }
          return;
        }
      }
      setMessage(`${type[0].toUpperCase()}${type.slice(1)} created successfully.`);
    } catch (error) { setMessage(error instanceof Error ? error.message : "Could not save catalog item"); }
    finally { setSaving(false); }
  }

  async function updateProduct(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingProduct) return;
    setSaving(true);
    setMessage("");
    const form = new FormData(event.currentTarget);
    const imageFile = form.get("productImage");
    const productImage = imageFile instanceof File && imageFile.size > 0 ? imageFile : null;
    try {
      const response = await fetch("/api/admin/catalog", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ productId: editingProduct.id, ...productFormPayload(form) }) });
      const result: unknown = await response.json();
      if (!response.ok) {
        const parsedError = imageUploadErrorSchema.safeParse(result);
        throw new Error(parsedError.success ? parsedError.data.error : "Unable to update product.");
      }
      const parsedProduct = productMutationResponseSchema.safeParse(result);
      if (!parsedProduct.success) throw new Error("The product update returned an invalid response.");
      setProducts((current) => current.map((product) => product.id === parsedProduct.data.data.id ? { ...product, ...parsedProduct.data.data } : product));
      setEditingProduct(null);
      if (productImage) {
        try {
          const imageUrl = await uploadProductImage(parsedProduct.data.data.id, productImage);
          setProducts((current) => current.map((product) => product.id === parsedProduct.data.data.id ? { ...product, image_url: imageUrl } : product));
          setMessage("Product updated and its image is ready for the storefront and POS.");
        } catch (error) {
          setMessage(`Product details were saved, but its image was not uploaded: ${error instanceof Error ? error.message : "Please retry from Edit product."}`);
        }
      } else {
        setMessage("Product updated successfully.");
      }
    } catch (error) { setMessage(error instanceof Error ? error.message : "Unable to update product."); }
    finally { setSaving(false); }
  }

  const categoryChildren = new Map<string | null, Category[]>();
  categories.forEach((category) => {
    const children = categoryChildren.get(category.parent_id) ?? [];
    children.push(category);
    categoryChildren.set(category.parent_id, children);
  });
  const renderCategoryTree = (parentId: string | null, depth = 0, rootDepartmentId?: string | null): ReactNode => (
    <div className={depth === 0 ? "catalog-tree-level" : "catalog-tree-children"}>
      {(categoryChildren.get(parentId) ?? [])
        .filter((category) => depth > 0 || rootDepartmentId === undefined || category.department_id === rootDepartmentId)
        .map((category) => (
        <div className="catalog-tree-node" key={category.id}>
          <div className="catalog-tree-row"><span className="catalog-tree-marker">{depth === 0 ? "◆" : "└"}</span><span>{category.name}</span><small>{category.slug}</small></div>
          {renderCategoryTree(category.id, depth + 1)}
        </div>
      ))}
    </div>
  );

  const categoryOptions = categories.map((category) => ({ ...category, label: `${category.parent_id ? "↳ " : ""}${category.name}` }));

  return <div className="catalog-manager">
    {message && <div className="catalog-manager-message" role="status">{message}</div>}
    <div className="catalog-composer-switcher" role="tablist" aria-label="Catalog creation tools">
      <button type="button" role="tab" aria-selected={activeComposer === "product"} className={activeComposer === "product" ? "is-active" : undefined} onClick={() => setActiveComposer("product")}>Add product</button>
      <button type="button" role="tab" aria-selected={activeComposer === "category"} className={activeComposer === "category" ? "is-active" : undefined} onClick={() => setActiveComposer("category")}>Add family</button>
      <button type="button" role="tab" aria-selected={activeComposer === "brand"} className={activeComposer === "brand" ? "is-active" : undefined} onClick={() => setActiveComposer("brand")}>Add brand</button>
    </div>
    <div className="catalog-manager-grid">
      {activeComposer === "category" && <form className="catalog-manager-form catalog-simple-form catalog-family-form" onSubmit={(event) => submit(event, "category")}>
        <div className="catalog-simple-form-heading">
          <div className="catalog-form-icon"><Tags size={19} /></div>
          <div><p className="eyebrow">Catalog structure</p><h2>Create a product family</h2><p>Group related products so shoppers and staff can find them quickly.</p></div>
        </div>
        <section className="catalog-simple-form-section">
          <div className="catalog-simple-form-section-heading"><span>01</span><div><h3>Family information</h3><p>Set a clear name and describe what belongs in this range.</p></div></div>
          <div className="catalog-simple-fields">
            <label>Name<input name="name" placeholder="Lighting" required /></label>
            <label>Department<select name="departmentId"><option value="">No department yet</option>{departments.map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}</select></label>
            <label className="catalog-simple-field-wide">Description<textarea name="description" placeholder="Products for bright, efficient spaces." rows={3} /></label>
          </div>
        </section>
        <section className="catalog-simple-form-section">
          <div className="catalog-simple-form-section-heading"><span>02</span><div><h3>Placement and image</h3><p>Choose where this family sits and optionally add its image.</p></div></div>
          <div className="catalog-simple-fields">
            <label>Parent family<select name="parentId"><option value="">Top-level family</option>{categoryOptions.map((category) => <option key={category.id} value={category.id}>{category.label}</option>)}</select></label>
            <label>Image URL<input name="imageUrl" type="url" placeholder="https://example.com/family.jpg" /></label>
          </div>
        </section>
        <div className="catalog-simple-form-footer"><p>Families help organize product browsing across Dantown.</p><button className="button button-primary" disabled={saving}><Plus size={16} /> {saving ? "Adding family..." : "Add family"}</button></div>
      </form>}
      {activeComposer === "brand" && <form className="catalog-manager-form catalog-simple-form catalog-brand-form" onSubmit={(event) => submit(event, "brand")}>
        <div className="catalog-simple-form-heading">
          <div className="catalog-form-icon catalog-form-icon-coral"><ImagePlus size={19} /></div>
          <div><p className="eyebrow">Brand directory</p><h2>Add a brand</h2><p>Help customers recognize makers and compare trusted products.</p></div>
        </div>
        <section className="catalog-simple-form-section">
          <div className="catalog-simple-form-section-heading"><span>01</span><div><h3>Brand profile</h3><p>Add the brand name and a short introduction.</p></div></div>
          <div className="catalog-simple-fields">
            <label>Brand name<input name="name" placeholder="Philips" required /></label>
            <label>Logo URL<input name="logoUrl" type="url" placeholder="https://example.com/brand-logo.png" /></label>
            <label className="catalog-simple-field-wide">Description<textarea name="description" placeholder="Trusted lighting for modern spaces." rows={4} /></label>
          </div>
        </section>
        <div className="catalog-simple-form-footer"><p>Brand details make product discovery clearer for customers.</p><button className="button button-primary" disabled={saving}><Plus size={16} /> {saving ? "Adding brand..." : "Add brand"}</button></div>
      </form>}
      {activeComposer === "product" && <form className="catalog-manager-form catalog-manager-form-wide catalog-product-form" onSubmit={(event) => submit(event, "product")}><div className="catalog-product-form-heading"><div className="catalog-form-icon catalog-form-icon-ochre"><PackagePlus size={18} /></div><div><p className="eyebrow">New inventory item</p><h2>Add a product</h2><p>Complete the essentials first. Optional details can be added as needed.</p></div></div><ProductFields categories={categories} brands={brands} /><section className="catalog-product-section catalog-product-media"><div className="catalog-product-section-heading"><span>05</span><div><h3>Product image</h3><p>Add a photo for the storefront and POS, or paste an image URL.</p></div></div><div className="catalog-product-media-fields"><label className="catalog-product-image-field"><span>Upload product photo</span><input name="productImage" type="file" accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp" /><small>JPG, PNG or WEBP · up to 6 MB. Used across the storefront and POS.</small></label><label>Or use an existing image URL<input name="imageUrl" type="url" placeholder="https://example.com/product.jpg" /></label></div></section><div className="catalog-product-submit"><p>Products marked active and available will appear in sales channels.</p><button className="button button-primary" disabled={saving}><Plus size={16} /> {saving ? "Adding product..." : "Add product"}</button></div></form>}
    </div>
    {editingProduct && <form className="catalog-manager-form catalog-manager-form-wide catalog-edit-form" onSubmit={updateProduct}><div className="catalog-form-icon catalog-form-icon-ochre"><PackagePlus size={18} /></div><p className="eyebrow">Edit any product</p><h2>{editingProduct.name}</h2><ProductFields product={editingProduct} categories={categories} brands={brands} /><label className="catalog-product-image-field"><span>Replace primary product photo</span>{editingProduct.image_url && <img src={editingProduct.image_url} alt={`${editingProduct.name} current product photo`} />}<input name="productImage" type="file" accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp" /><small>Choose a new JPG, PNG or WEBP image, up to 6 MB. It will update storefront and POS.</small></label><div className="catalog-edit-actions"><a className="button button-secondary" href={`/admin/inventory?q=${encodeURIComponent(editingProduct.sku)}`}><ArrowLeftRight size={15} /> Manage stock by store</a><button type="button" className="button button-quiet" onClick={() => setEditingProduct(null)}>Cancel</button><button className="button button-primary" disabled={saving}>{saving ? "Saving..." : "Save product"}</button></div></form>}
    <section className="catalog-manager-list">
      <div className="section-heading"><div><p className="eyebrow">Product master</p><h2>Find and manage every product</h2></div><strong>{productCount.toLocaleString()} total · page {page}</strong></div>
      <form className="catalog-search-toolbar" onSubmit={(event) => { event.preventDefault(); void searchProducts(1); }}>
        <label className="catalog-search-input"><Search size={17} /><span className="sr-only">Search products</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search product name, SKU, or barcode" /></label>
        <select aria-label="Filter by product status" value={statusFilter} onChange={(event) => { const nextStatus = event.target.value; setStatusFilter(nextStatus); void searchProducts(1, query, nextStatus); }}><option value="">All statuses</option><option value="ACTIVE">Active</option><option value="DRAFT">Draft</option><option value="ARCHIVED">Archived</option></select>
        <button className="button button-primary" type="submit" disabled={loadingProducts}>{loadingProducts ? "Searching..." : "Search products"}</button>
      </form>
      <div className="catalog-product-list" aria-live="polite">{products.length ? products.map((product) => <div className="catalog-product-row" key={product.id}>{product.image_url ? <img className="catalog-product-art" src={product.image_url} alt="" /> : <div className="catalog-product-art">{product.name.charAt(0)}</div>}<div><strong>{product.name}</strong><small>{product.sku} · {product.status}{product.is_active ? " · Website and POS" : " · Hidden from sales"}</small></div><span>KSh {Number(product.retail_price).toLocaleString()}</span><button type="button" className="button button-quiet catalog-edit-button" onClick={() => setEditingProduct(product)}>Edit details</button><a className="button button-quiet catalog-edit-button" href={`/admin/inventory?q=${encodeURIComponent(product.sku)}`}>Store stock</a></div>) : <p>{loadingProducts ? "Searching the product master…" : "No products match this search."}</p>}</div>
      <div className="catalog-pagination" aria-label="Product pages"><button type="button" className="button button-quiet" onClick={() => void searchProducts(page - 1)} disabled={loadingProducts || page <= 1}>Previous</button><span>Page {page} of {Math.max(1, Math.ceil(productCount / 30))}</span><button type="button" className="button button-quiet" onClick={() => void searchProducts(page + 1)} disabled={loadingProducts || page * 30 >= productCount}>Next</button></div>
    </section>
    <section className="catalog-manager-list catalog-hierarchy"><div className="section-heading"><div><p className="eyebrow">Master structure</p><h2>Departments and category tree</h2></div><strong>{departments.length} departments · {categories.length} nodes</strong></div><div className="catalog-department-grid">{departments.map((department) => <article className="catalog-department" key={department.id}><div className="catalog-department-heading"><span>{department.icon || "folder"}</span><strong>{department.name}</strong></div>{renderCategoryTree(null, 0, department.id)}</article>)}</div><div className="catalog-tree-root">{renderCategoryTree(null, 0, null)}</div></section>
  </div>;
}
