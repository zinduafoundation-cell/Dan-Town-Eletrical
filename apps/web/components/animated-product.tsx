'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import type { CatalogProduct } from '@dantown/database';
import type { StoreProduct } from '@/lib/store-data';
import { formatCurrency } from '@/lib/store-data';
import { ProductCardActions } from '@/components/product-card-actions';
import {
  staggerItemVariants,
  ANIMATION_DURATIONS,
} from '@/lib/animations/motion-config';

type ProductCardData = StoreProduct | CatalogProduct;

export function AnimatedProductCard({
  product,
}: {
  product: ProductCardData;
}) {
  const isCatalogProduct = 'retail_price' in product;

  const price = isCatalogProduct
    ? product.promotional_price ?? product.retail_price
    : product.price;

  const previousPrice = isCatalogProduct
    ? product.promotional_price
      ? product.retail_price
      : undefined
    : product.previousPrice;

  const categoryName = isCatalogProduct
    ? product.category?.name ?? 'Electrical'
    : product.category;

  const categoryColor =
    categoryName === 'Lighting'
      ? '#e8c56f'
      : categoryName === 'Cables & Wires'
        ? '#b8ced3'
        : categoryName === 'Circuit Protection'
          ? '#d87961'
          : '#d8e0c5';

  const stockStatus = isCatalogProduct ? 'In stock' : product.stockStatus;

  return (
    <motion.article
      className="store-product-card"
      variants={staggerItemVariants}
      initial="hidden"
      animate="visible"
    >
      <motion.div
        className="product-art"
        style={{
          backgroundImage:
            isCatalogProduct && product.primary_image
              ? `url(${product.primary_image})`
              : undefined,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundColor: categoryColor,
        }}
        whileHover={{ scale: 1.03 }}
        transition={{
          duration: ANIMATION_DURATIONS.NORMAL / 1000,
        }}
      >
        {!isCatalogProduct && product.badge && (
          <motion.span
            className="product-tag"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{
              delay: 0.2,
              duration: ANIMATION_DURATIONS.FAST / 1000,
            }}
          >
            {product.badge}
          </motion.span>
        )}

        {isCatalogProduct && product.featured && (
          <motion.span
            className="product-tag"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{
              delay: 0.2,
              duration: ANIMATION_DURATIONS.FAST / 1000,
            }}
          >
            Featured
          </motion.span>
        )}

        {!(isCatalogProduct && product.primary_image) && (
          <div className="product-shape" />
        )}
      </motion.div>

      <div className="product-info">
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{
            delay: 0.1,
            duration: ANIMATION_DURATIONS.NORMAL / 1000,
          }}
        >
          {categoryName}
        </motion.p>

        <motion.h3
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{
            delay: 0.15,
            duration: ANIMATION_DURATIONS.NORMAL / 1000,
          }}
        >
          <Link href={`/products/${product.slug}`}>{product.name}</Link>
        </motion.h3>

        <motion.div
          className="product-price-row"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{
            delay: 0.2,
            duration: ANIMATION_DURATIONS.NORMAL / 1000,
          }}
        >
          <strong>{formatCurrency(price)}</strong>

          {previousPrice && (
            <span>{formatCurrency(previousPrice)}</span>
          )}
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{
            delay: 0.25,
            duration: ANIMATION_DURATIONS.NORMAL / 1000,
          }}
        >
          <ProductCardActions
            product={{
              id: product.id,
              slug: product.slug,
              name: product.name,
              sku: product.sku,
              retail_price: price,
              primary_image: isCatalogProduct
                ? product.primary_image
                : null,
              featured: isCatalogProduct ? Boolean(product.featured) : false,
            }}
            stockStatus={
              stockStatus as
                | 'In stock'
                | 'Low stock'
                | 'Out of stock'
                | 'Available on order'
            }
          />
        </motion.div>
      </div>
    </motion.article>
  );
}

/**
 * Animated product grid with staggered children
 */
export function AnimatedProductGrid({
  products,
  children,
}: {
  products: ProductCardData[];
  children?: React.ReactNode;
}) {
  return (
    <motion.div
      className="product-grid catalog-grid"
      initial="hidden"
      animate="visible"
      variants={{
        visible: {
          transition: {
            staggerChildren: 0.08,
            delayChildren: 0.2,
          },
        },
      }}
    >
      {products.map((product) => (
        <AnimatedProductCard key={product.id} product={product} />
      ))}
      {children}
    </motion.div>
  );
}

/**
 * Animated filter panel with staggered children
 */
export function AnimatedFilterPanel({
  categories,
  onCategoryChange,
  onSortChange,
  currentCategory,
  currentSort,
  productCount,
}: {
  categories: Array<{ id: string; name: string; slug: string }>;
  onCategoryChange?: (slug: string) => void;
  onSortChange?: (sort: string) => void;
  currentCategory?: string;
  currentSort?: string;
  productCount?: number;
}) {
  return (
    <motion.aside
      className="filter-panel"
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{
        duration: ANIMATION_DURATIONS.MEDIUM / 1000,
      }}
    >
      <motion.h3
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.1, duration: ANIMATION_DURATIONS.NORMAL / 1000 }}
      >
        Categories
      </motion.h3>

      <motion.div
        className="chip-group"
        variants={{
          visible: {
            transition: {
              staggerChildren: 0.05,
            },
          },
        }}
        initial="hidden"
        animate="visible"
      >
        {categories.map((category) => (
          <motion.div key={category.id} variants={staggerItemVariants}>
            <Link
              href={`/shop?category=${category.slug}`}
              className={`filter-chip ${
                currentCategory === category.slug ? 'active' : ''
              }`}
              onClick={(event) => {
                if (onCategoryChange) {
                  event.preventDefault();
                  onCategoryChange(category.slug);
                }
              }}
            >
              {category.name}
            </Link>
          </motion.div>
        ))}
      </motion.div>

      <motion.h3
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{
          delay: 0.2,
          duration: ANIMATION_DURATIONS.NORMAL / 1000,
        }}
      >
        Sort
      </motion.h3>

      <motion.div
        className="chip-group"
        variants={{
          visible: {
            transition: {
              staggerChildren: 0.05,
            },
          },
        }}
        initial="hidden"
        animate="visible"
      >
        {['Featured', 'Price: Low to High', 'Price: High to Low'].map(
          (label) => (
            <motion.div key={label} variants={staggerItemVariants}>
              <Link
                href={`/shop${
                  label === 'Price: Low to High'
                    ? '?sort=low'
                    : label === 'Price: High to Low'
                      ? '?sort=high'
                      : ''
                }`}
                className={`filter-chip ${
                  (label === 'Featured' && currentSort !== 'low' && currentSort !== 'high') ||
                  (label === 'Price: Low to High' && currentSort === 'low') ||
                  (label === 'Price: High to Low' && currentSort === 'high')
                    ? 'active'
                    : ''
                }`}
                onClick={(event) => {
                  if (onSortChange) {
                    event.preventDefault();
                    onSortChange(label === 'Price: Low to High' ? 'low' : label === 'Price: High to Low' ? 'high' : 'featured');
                  }
                }}
              >
                {label}
              </Link>
            </motion.div>
          )
        )}
      </motion.div>

      {productCount !== undefined && (
        <motion.div
          className="mini-stat"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{
            delay: 0.3,
            duration: ANIMATION_DURATIONS.NORMAL / 1000,
          }}
        >
          <span>Products</span>
          <motion.strong
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{
              delay: 0.35,
              duration: ANIMATION_DURATIONS.NORMAL / 1000,
            }}
          >
            {productCount}
          </motion.strong>
        </motion.div>
      )}
    </motion.aside>
  );
}
