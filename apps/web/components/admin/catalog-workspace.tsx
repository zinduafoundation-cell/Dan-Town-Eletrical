"use client";

import dynamic from "next/dynamic";
import { Barcode, Boxes, LayoutDashboard } from "lucide-react";
import { type ComponentProps, useState } from "react";
import CatalogManager from "./catalog-manager";

const BulkProductActions = dynamic(
  () =>
    import("./bulk-product-actions").then(
      (module) => module.BulkProductActions
    ),
  {
    loading: () => <WorkspaceLoading label="Preparing bulk operations" />,
    ssr: false,
  }
);

const ProductBarcodeManager = dynamic(
  () =>
    import("./product-barcode-manager").then(
      (module) => module.ProductBarcodeManager
    ),
  {
    loading: () => <WorkspaceLoading label="Preparing barcode tools" />,
    ssr: false,
  }
);

type CatalogWorkspaceProps = ComponentProps<typeof CatalogManager>;
type WorkspaceView = "catalog" | "bulk" | "barcodes";

function WorkspaceLoading({ label }: { label: string }) {
  return (
    <div className="catalog-workspace-loading" role="status">
      <span aria-hidden="true" />
      {label}
    </div>
  );
}

export default function CatalogWorkspace({
  departments,
  categories,
  brands,
  products,
}: CatalogWorkspaceProps) {
  const [view, setView] = useState<WorkspaceView>("catalog");

  const tabs: Array<{
    id: WorkspaceView;
    label: string;
    detail: string;
    icon: typeof LayoutDashboard;
  }> = [
    {
      id: "catalog",
      label: "Catalog studio",
      detail: "Create and maintain the product structure.",
      icon: LayoutDashboard,
    },
    {
      id: "bulk",
      label: "Bulk actions",
      detail: "Publish, archive, or organise several products together.",
      icon: Boxes,
    },
    {
      id: "barcodes",
      label: "Barcodes",
      detail: "Keep POS scanning data accurate.",
      icon: Barcode,
    },
  ];

  return (
    <section className="catalog-workspace" aria-label="Catalog operations">
      <div className="catalog-workspace-header">
        <div>
          <p className="eyebrow">Operations workspace</p>
          <h2>One calm place to keep the catalog accurate.</h2>
          <p>
            Choose the job at hand. Tools load only when you need them, so the
            admin experience stays responsive as the catalog grows.
          </p>
        </div>
        <div className="catalog-workspace-summary" aria-label="Catalog summary">
          <strong>{products.length}</strong>
          <span>recent products</span>
        </div>
      </div>

      <div className="catalog-workspace-tabs" role="tablist" aria-label="Catalog tools">
        {tabs.map(({ id, label, detail, icon: Icon }) => (
          <button
            aria-controls={`catalog-workspace-${id}`}
            aria-selected={view === id}
            className={view === id ? "is-active" : undefined}
            id={`catalog-workspace-tab-${id}`}
            key={id}
            onClick={() => setView(id)}
            role="tab"
            type="button"
          >
            <Icon aria-hidden="true" size={18} />
            <span>
              <strong>{label}</strong>
              <small>{detail}</small>
            </span>
          </button>
        ))}
      </div>

      <div
        aria-labelledby={`catalog-workspace-tab-${view}`}
        className="catalog-workspace-panel"
        id={`catalog-workspace-${view}`}
        role="tabpanel"
      >
        {view === "catalog" && (
          <CatalogManager
            brands={brands}
            categories={categories}
            departments={departments}
            products={products}
          />
        )}
        {view === "bulk" && (
          <BulkProductActions brands={brands} categories={categories} products={products} />
        )}
        {view === "barcodes" && <ProductBarcodeManager products={products} />}
      </div>
    </section>
  );
}
