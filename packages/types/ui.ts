import type { EquipmentStatus, StockStatus } from "./base.js";

export interface Product {
  id: string;
  sku: string;
  name: string;
  category: string;
  stock: number;
  status: StockStatus;
  price: number;
}

export interface EquipmentItem {
  id: string;
  type: string;
  label: string;
  zone: "cardio" | "strength" | "functional";
  status: EquipmentStatus;
  gridX: number;
  gridY: number;
  rotation: number;
}

export interface Notification {
  id: string;
  type: "booking" | "badge" | "membership" | "system";
  title: string;
  body: string;
  read: boolean;
  createdAt: string;
}
