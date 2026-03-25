import type { FieldConfig } from "@/components/modals/DetailsModal";

export type ProductStatus = "In Stock" | "Low Stock" | "Out of Stock";

export type Product = {
  sku: string;
  name: string;
  category: string;
  stock: number;
  status: ProductStatus;
  price: number;
};

export const INVENTORY_TABS = [
  { key: "products", label: "Products" },
  { key: "analytics", label: "Analytics" }
] as const;

export type InventoryTab = typeof INVENTORY_TABS[number]["key"];

export const PRODUCTS_LIST: Product[] = [
  { sku: "SUP-001", name: "Whey Protein - Vanilla", category: "Supplements", stock: 45, status: "In Stock", price: 49.99 },
  { sku: "DRK-001", name: "Pre-Workout Berry", category: "Drinks", stock: 8, status: "Low Stock", price: 34.99 },
  { sku: "SUP-002", name: "BCAA Powder", category: "Supplements", stock: 22, status: "In Stock", price: 29.99 },
  { sku: "DRK-002", name: "Energy Drink", category: "Drinks", stock: 60, status: "In Stock", price: 3.99 }
];

export const STOCK_STATUS_COLOR: Record<string, string> = {
  "In Stock": "var(--fit-success)",
  "Low Stock": "var(--fit-warning)",
  "Out of Stock": "var(--fit-danger)"
};

export const MONTHLY_SALES = [
  { month: "Jan", revenue: 11000, cost: 4500 },
  { month: "Feb", revenue: 10500, cost: 4200 },
  { month: "Mar", revenue: 16000, cost: 5200 },
  { month: "Apr", revenue: 14500, cost: 5000 },
  { month: "May", revenue: 15500, cost: 5300 },
  { month: "Jun", revenue: 19000, cost: 5800 }
];

export const STOCK_FILTER_OPTIONS: { label: string; value: string }[] = [
  { label: "All", value: "All" },
  { label: "In Stock", value: "In Stock" },
  { label: "Low Stock", value: "Low Stock" },
  { label: "Out of Stock", value: "Out of Stock" }
];

export const ADD_PRODUCT_FIELDS: FieldConfig[] = [
  { name: "sku", label: "SKU", type: "text", required: true, placeholder: "e.g., SUP-003" },
  { name: "name", label: "Product Name", type: "text", required: true, placeholder: "e.g., Creatine Monohydrate" },
  {
    name: "category", label: "Category", type: "select", required: true,
    options: [
      { label: "Supplements", value: "Supplements" },
      { label: "Drinks", value: "Drinks" },
      { label: "Apparel", value: "Apparel" },
      { label: "Equipment", value: "Equipment" }
    ]
  },
  { name: "stock", label: "Stock", type: "text", required: true, placeholder: "e.g., 50" },
  { name: "price", label: "Price ($)", type: "text", required: true, placeholder: "e.g., 29.99" }
];
