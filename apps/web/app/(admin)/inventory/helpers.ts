import { FEEDBACK_DURATION_MS } from "@/constants/feedback";
import type { Product, ProductStatus } from "@/data/inventory/inventory";

export const MIN_ACTION_DELAY_MS = FEEDBACK_DURATION_MS.standard;

export function filterProducts(
  products: Product[],
  query: string,
  stockFilter: "All" | ProductStatus
) {
  return products.filter((product) => {
    const normalizedQuery = query.toLowerCase();
    const matchesSearch =
      product.name.toLowerCase().includes(normalizedQuery) ||
      product.sku.toLowerCase().includes(normalizedQuery);
    const matchesStock = stockFilter === "All" ? true : product.status === stockFilter;
    return matchesSearch && matchesStock;
  });
}

export function getTopProducts(products: Product[]) {
  return products
    .map((product) => ({ name: product.name, value: product.price * product.stock }))
    .sort((a, b) => b.value - a.value);
}

export function getProductStatus(stock: number): ProductStatus {
  if (stock === 0) return "Out of Stock";
  if (stock <= 10) return "Low Stock";
  return "In Stock";
}