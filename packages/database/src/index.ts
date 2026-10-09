export { createSupabaseBrowserClient } from "./client";
export type { BusinessCentreMetrics, Database, DomainEvent, Inventory, InventoryHealth, Json, Order, OrderItem, OrderStatus, OrderStatusHistory, Product } from "./types";

export { adjustInventory, getInventoryHealth } from "./services/inventory";
export { createOrder, getCustomerOrders } from "./services/orders";
export { createPendingPayment } from "./services/payments";
export { createProduct, getActiveProducts } from "./services/products";
export { getCustomerQuotes, markQuoteConverted } from "./services/quotes";
export { getPublishedKnowledge, selectPublishedKnowledge } from "./services/knowledge";
export {
  addToCart,
  removeFromCart,
  updateCartItemQuantity,
  clearCart,
  getCartItems,
  getCartSummary
} from "./services/cart";
export type { CartItemInput, CartItem } from "./services/cart";

export {
  allocateSharedCosts,
  applyApprovedPricingRecommendation,
  buildDeterministicPricingRecommendation,
  createAutomationJob,
  publishPrice,
  saveLandedCost,
  savePricingRecommendation,
  saveProductMatch
} from "./services/product-intelligence";

export {
  getCatalogProducts,
  getCatalogProductCount,
  getCatalogProductBySlug,
  getCatalogCategories,
  getCatalogCategoryBySlug,
  getCatalogBrands,
  getCatalogBrandBySlug
} from "./services/catalog";

export type {
  CatalogProduct,
  CatalogCategory,
  CatalogBrand
} from "./services/catalog";
