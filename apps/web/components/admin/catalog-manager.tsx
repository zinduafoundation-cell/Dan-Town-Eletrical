"use client";

import { FormEvent, type ReactNode, useState } from "react";
import { ImagePlus, PackagePlus, Plus, Tags } from "lucide-react";
import { z } from "zod";

type Department = { id: string; name: string; slug: string; icon: string | null; sort_order: number };
type Category = { id: string; name: string; slug: string; parent_id: string | null; department_id: string | null };
type Brand = { id: string; name: string; slug: string; logo_url: string | null };
type Product = { id: string; name: string; sku: string; barcode: string | null; slug: string; retail_price: number; promotional_price?: number | null; promotion_label?: string | null; featured?: boolean; status: string; is_active: boolean; category_id: string | null; brand_id: string | null; image_url?: string | null };

type Props = { departments: Department[]; categories: Category[]; brands: Brand[]; products: Product[] };

function slugify(value: string) { return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, ""); }

const imageUploadResponseSchema = z.object({ data: z.object({ imageUrl: z.string().url() }) });
const imageUploadErrorSchema = z.object({ error: z.string() });

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

export default function CatalogManager({ departments, categories: initialCategories, brands: initialBrands, products: initialProducts }: Props) {
  const [categories, setCategories] = useState(initialCategories);
  const [brands, setBrands] = useState(initialBrands);
  const [products, setProducts] = useState(initialProducts);
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [activeComposer, setActiveComposer] = useState<"category" | "brand" | "product">("product");

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
        : { type, name, sku: String(form.get("sku") ?? ""), slug: slugify(String(form.get("slug") || name)), retailPrice: Number(form.get("retailPrice") ?? 0), promotionalPrice: String(form.get("promotionalPrice") || "") ? Number(form.get("promotionalPrice")) : null, promotionLabel: String(form.get("promotionLabel") || "") || null, featured: form.get("featured") === "on", categoryId: String(form.get("categoryId") ?? "") || null, brandId: String(form.get("brandId") ?? "") || null, imageUrl: productImage ? null : String(form.get("imageUrl") ?? "") || null };

    try {
      const response = await fetch("/api/admin/catalog", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not save catalog item");
      event.currentTarget.reset();
      if (type === "category") setCategories((current) => [...current, result.data]);
      if (type === "brand") setBrands((current) => [...current, result.data]);
      if (type === "product") {
        const createdProduct = { ...result.data, image_url: result.data.image_url ?? null } as Product;
        setProducts((current) => [createdProduct, ...current]);
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
      const response = await fetch("/api/admin/catalog", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ productId: editingProduct.id, name: form.get("name"), sku: form.get("sku"), barcode: String(form.get("barcode") || "") || null, retailPrice: Number(form.get("retailPrice")), promotionalPrice: String(form.get("promotionalPrice") || "") ? Number(form.get("promotionalPrice")) : null, promotionLabel: String(form.get("promotionLabel") || "") || null, featured: form.get("featured") === "on", categoryId: String(form.get("categoryId") || "") || null, brandId: String(form.get("brandId") || "") || null }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Unable to update product.");
      setProducts((current) => current.map((product) => product.id === result.data.id ? { ...product, ...result.data, image_url: product.image_url ?? null } : product));
      setEditingProduct(null);
      if (productImage) {
        try {
          const imageUrl = await uploadProductImage(result.data.id, productImage);
          setProducts((current) => current.map((product) => product.id === result.data.id ? { ...product, image_url: imageUrl } : product));
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
      {activeComposer === "category" && <form className="catalog-manager-form" onSubmit={(event) => submit(event, "category")}><div className="catalog-form-icon"><Tags size={18} /></div><p className="eyebrow">01 / Structure</p><h2>Create a product family</h2><p>Start with Lighting, Cables, Power, or another major Dantown range.</p><label>Name<input name="name" placeholder="Lighting" required /></label><label>Description<textarea name="description" placeholder="Products for bright, efficient spaces." rows={3} /></label><label>Department<select name="departmentId"><option value="">No department yet</option>{departments.map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}</select></label><label>Image URL<input name="imageUrl" type="url" placeholder="https://..." /></label><label>Parent family<select name="parentId"><option value="">Top-level family</option>{categoryOptions.map((category) => <option key={category.id} value={category.id}>{category.label}</option>)}</select></label><button className="button button-primary" disabled={saving}><Plus size={16} /> Add family</button></form>}
      {activeComposer === "brand" && <form className="catalog-manager-form" onSubmit={(event) => submit(event, "brand")}><div className="catalog-form-icon catalog-form-icon-coral"><ImagePlus size={18} /></div><p className="eyebrow">02 / Trust</p><h2>Add a brand</h2><p>Make the makers behind your products easy to discover and compare.</p><label>Brand name<input name="name" placeholder="Philips" required /></label><label>Description<textarea name="description" placeholder="Trusted lighting for modern spaces." rows={3} /></label><label>Logo URL<input name="logoUrl" type="url" placeholder="https://..." /></label><button className="button button-primary" disabled={saving}><Plus size={16} /> Add brand</button></form>}
      {activeComposer === "product" && <form className="catalog-manager-form catalog-manager-form-wide" onSubmit={(event) => submit(event, "product")}><div className="catalog-form-icon catalog-form-icon-ochre"><PackagePlus size={18} /></div><p className="eyebrow">03 / Sellable item</p><h2>Add a product</h2><p>Connect the product to its family and brand so it appears correctly across storefront, POS, and reports.</p><div className="catalog-fields-grid"><label>Product name<input name="name" placeholder="24W LED Panel Light" required /></label><label>SKU<input name="sku" placeholder="LGT-PNL-24W" required /></label><label>Retail price<input name="retailPrice" type="number" min="0" step="0.01" placeholder="1800" required /></label><label>Promotion price<input name="promotionalPrice" type="number" min="0" step="0.01" placeholder="Optional sale price" /></label><label>Feature label<select name="promotionLabel"><option value="">No label</option><option>New</option><option>Best seller</option><option>Discounted</option><option>Hot</option><option>Featured</option></select></label><label className="catalog-checkbox"><input name="featured" type="checkbox" /> Show in featured products</label><label className="catalog-product-image-field"><span>Upload product photo</span><input name="productImage" type="file" accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp" /><small>JPG, PNG or WEBP · up to 6 MB. This image is shown in the storefront and POS.</small></label><label>Or use an existing image URL<input name="imageUrl" type="url" placeholder="https://..." /></label><label>Family<select name="categoryId"><option value="">Select family</option>{categoryOptions.map((category) => <option key={category.id} value={category.id}>{category.label}</option>)}</select></label><label>Brand<select name="brandId"><option value="">No brand yet</option>{brands.map((brand) => <option key={brand.id} value={brand.id}>{brand.name}</option>)}</select></label></div><button className="button button-primary" disabled={saving}><Plus size={16} /> Add product</button></form>}
    </div>
    {editingProduct && <form className="catalog-manager-form catalog-manager-form-wide catalog-edit-form" onSubmit={updateProduct}><div className="catalog-form-icon catalog-form-icon-ochre"><PackagePlus size={18} /></div><p className="eyebrow">Edit product</p><h2>{editingProduct.name}</h2><div className="catalog-fields-grid"><label>Product name<input name="name" defaultValue={editingProduct.name} required /></label><label>SKU<input name="sku" defaultValue={editingProduct.sku} required /></label><label>Retail price<input name="retailPrice" type="number" min="0" step="0.01" defaultValue={editingProduct.retail_price} required /></label><label>Promotion price<input name="promotionalPrice" type="number" min="0" step="0.01" defaultValue={editingProduct.promotional_price ?? ""} /></label><label>Feature label<select name="promotionLabel" defaultValue={editingProduct.promotion_label ?? ""}><option value="">No label</option><option>New</option><option>Best seller</option><option>Discounted</option><option>Hot</option><option>Featured</option></select></label><label className="catalog-checkbox"><input name="featured" type="checkbox" defaultChecked={editingProduct.featured} /> Show in featured products</label><label className="catalog-product-image-field"><span>Replace product photo</span>{editingProduct.image_url && <img src={editingProduct.image_url} alt={`${editingProduct.name} current product photo`} />}<input name="productImage" type="file" accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp" /><small>Choose a new JPG, PNG or WEBP image, up to 6 MB.</small></label><label>Family<select name="categoryId" defaultValue={editingProduct.category_id ?? ""}><option value="">No family</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.parent_id ? `↳ ${category.name}` : category.name}</option>)}</select></label><label>Brand<select name="brandId" defaultValue={editingProduct.brand_id ?? ""}><option value="">No brand</option>{brands.map((brand) => <option key={brand.id} value={brand.id}>{brand.name}</option>)}</select></label></div><div className="catalog-edit-actions"><button type="button" className="button button-quiet" onClick={() => setEditingProduct(null)}>Cancel</button><button className="button button-primary" disabled={saving}>{saving ? "Saving..." : "Save product"}</button></div></form>}
    <section className="catalog-manager-list"><div className="section-heading"><div><p className="eyebrow">Live catalog</p><h2>Recent products</h2></div><strong>{products.length} shown</strong></div><div className="catalog-product-list">{products.length ? products.map((product) => <div className="catalog-product-row" key={product.id}>{product.image_url ? <img className="catalog-product-art" src={product.image_url} alt="" /> : <div className="catalog-product-art">{product.name.charAt(0)}</div>}<div><strong>{product.name}</strong><small>{product.sku} · {product.status}</small></div><span>Ksh {Number(product.retail_price).toLocaleString()}</span><button type="button" className="button button-quiet catalog-edit-button" onClick={() => setEditingProduct(product)}>Edit</button></div>) : <p>No products yet. Add the first one above.</p>}</div></section>
    <section className="catalog-manager-list catalog-hierarchy"><div className="section-heading"><div><p className="eyebrow">Master structure</p><h2>Departments and category tree</h2></div><strong>{departments.length} departments · {categories.length} nodes</strong></div><div className="catalog-department-grid">{departments.map((department) => <article className="catalog-department" key={department.id}><div className="catalog-department-heading"><span>{department.icon || "folder"}</span><strong>{department.name}</strong></div>{renderCategoryTree(null, 0, department.id)}</article>)}</div><div className="catalog-tree-root">{renderCategoryTree(null, 0, null)}</div></section>
  </div>;
}
