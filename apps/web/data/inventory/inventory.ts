import type { InventoryProductCategory } from "@fittrack/types";
import type { FieldConfig } from "@/components/modals/DetailsModal";

export type RetailStockStatus = "In Stock" | "Low Stock" | "Out of Stock";
export type EquipmentAvailabilityStatus = "Ready" | "Attention" | "Unavailable";

export const INVENTORY_TABS = [
  { key: "retail", label: "Retail" },
  { key: "equipment", label: "Equipment" },
  { key: "analytics", label: "Analytics" }
] as const;

export type InventoryTab = typeof INVENTORY_TABS[number]["key"];

export const INVENTORY_PRODUCT_CATEGORY_OPTIONS: Array<{
  label: string;
  value: InventoryProductCategory;
}> = [
  { label: "Supplements", value: "supplements" },
  { label: "Beverages", value: "beverages" },
  { label: "Snacks", value: "snacks" },
  { label: "Accessories", value: "accessories" },
  { label: "Recovery", value: "recovery" },
  { label: "Merchandise", value: "merchandise" },
  { label: "Other", value: "other" }
];

export const INVENTORY_CATEGORY_FILTER_OPTIONS: Array<{
  label: string;
  value: InventoryProductCategory | "all";
}> = [
  { label: "All Categories", value: "all" },
  ...INVENTORY_PRODUCT_CATEGORY_OPTIONS
];

export const RETAIL_STOCK_STATUS_COLOR: Record<RetailStockStatus, string> = {
  "In Stock": "var(--fit-success)",
  "Low Stock": "var(--fit-warning)",
  "Out of Stock": "var(--fit-danger)"
};

export const EQUIPMENT_STATUS_COLOR: Record<EquipmentAvailabilityStatus, string> = {
  Ready: "var(--fit-success)",
  Attention: "var(--fit-warning)",
  Unavailable: "var(--fit-danger)"
};

export const RETAIL_STOCK_FILTER_OPTIONS: Array<{
  label: string;
  value: "All" | RetailStockStatus;
}> = [
  { label: "All", value: "All" },
  { label: "In Stock", value: "In Stock" },
  { label: "Low Stock", value: "Low Stock" },
  { label: "Out of Stock", value: "Out of Stock" }
];

export const EQUIPMENT_STATUS_FILTER_OPTIONS: Array<{
  label: string;
  value: "All" | EquipmentAvailabilityStatus;
}> = [
  { label: "All", value: "All" },
  { label: "Ready", value: "Ready" },
  { label: "Attention", value: "Attention" },
  { label: "Unavailable", value: "Unavailable" }
];

export const INVENTORY_RETAIL_PRODUCT_FIELDS: FieldConfig[] = [
  {
    name: "name",
    label: "Product Name",
    type: "text",
    required: true,
    placeholder: "e.g., Creatine Monohydrate"
  },
  {
    name: "category",
    label: "Category",
    type: "select",
    required: true,
    options: INVENTORY_PRODUCT_CATEGORY_OPTIONS
  },
  {
    name: "description",
    label: "Description",
    type: "textarea",
    placeholder: "What should staff know about this product?",
    maxLength: 240
  },
  {
    name: "price",
    label: "Price (PHP)",
    type: "text",
    required: true,
    placeholder: "e.g., 1499"
  },
  {
    name: "stockQuantity",
    label: "Stock Quantity",
    type: "text",
    required: true,
    placeholder: "e.g., 24",
    hint: "Only retail items participate in low-stock notifications."
  },
  {
    name: "reorderThreshold",
    label: "Reorder Threshold",
    type: "text",
    required: true,
    placeholder: "e.g., 10",
    hint: "Use this to flag low-stock retail inventory before it runs out."
  },
  {
    name: "imageUrl",
    label: "Image URL",
    type: "text",
    placeholder: "https://..."
  }
];

export const INVENTORY_RETAIL_RESTOCK_FIELDS: FieldConfig[] = [
  {
    name: "quantity",
    label: "Quantity Added",
    type: "text",
    required: true,
    placeholder: "e.g., 12"
  },
  {
    name: "notes",
    label: "Notes",
    type: "textarea",
    placeholder: "Optional supplier or receiving notes",
    maxLength: 240
  }
];

export const INVENTORY_EQUIPMENT_CREATE_FIELDS: FieldConfig[] = [
  {
    name: "name",
    label: "Equipment Name",
    type: "text",
    required: true,
    placeholder: "e.g., Adjustable Bench"
  },
  {
    name: "description",
    label: "Description",
    type: "textarea",
    placeholder: "What should staff know about this equipment?",
    maxLength: 240
  },
  {
    name: "unit",
    label: "Unit",
    type: "text",
    required: true,
    placeholder: "e.g., units"
  },
  {
    name: "quantityTotal",
    label: "Total Quantity",
    type: "text",
    required: true,
    placeholder: "e.g., 8"
  },
  {
    name: "quantityCurrent",
    label: "Current Quantity",
    type: "text",
    required: true,
    placeholder: "e.g., 6",
    hint: "Track what is currently available on the floor."
  }
];

export const INVENTORY_EQUIPMENT_EDIT_FIELDS: FieldConfig[] = [
  {
    name: "name",
    label: "Equipment Name",
    type: "text",
    required: true,
    placeholder: "e.g., Adjustable Bench"
  },
  {
    name: "description",
    label: "Description",
    type: "textarea",
    placeholder: "What should staff know about this equipment?",
    maxLength: 240
  },
  {
    name: "unit",
    label: "Unit",
    type: "text",
    required: true,
    placeholder: "e.g., units"
  }
];

export const INVENTORY_EQUIPMENT_WRITEOFF_FIELDS: FieldConfig[] = [
  {
    name: "quantitySetTo",
    label: "New Current Quantity",
    type: "text",
    required: true,
    placeholder: "e.g., 4",
    hint: "Set the new on-floor quantity after damage, loss, or removal."
  },
  {
    name: "reason",
    label: "Reason",
    type: "textarea",
    required: true,
    placeholder: "Explain why this equipment count changed.",
    maxLength: 400
  }
];
