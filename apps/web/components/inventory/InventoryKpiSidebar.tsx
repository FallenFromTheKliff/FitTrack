"use client";

import { AlertTriangle, Archive, BarChart2, DollarSign, Package } from "lucide-react";

import type { IThemeContext } from "@fittrack/types";
import { FitKpiCard } from "@/components/fit/FitCard";
import type { useInventoryDashboard } from "@/hooks/inventory/useInventoryDashboard";
import { dashboardStyles } from "@/styles/pageStyles";

type InventoryKpiSidebarProps = {
  colors: IThemeContext["colors"];
  inventory: ReturnType<typeof useInventoryDashboard>;
  styles: ReturnType<typeof dashboardStyles>;
};

export function InventoryKpiSidebar({
  colors,
  inventory,
  styles
}: InventoryKpiSidebarProps) {
  const items = inventory.tab === "equipment"
    ? [
        {
          icon: Package,
          label: "Equipment Items",
          value: String(inventory.equipmentCount),
          color: colors.brand
        },
        {
          icon: AlertTriangle,
          label: "Needs Attention",
          value: String(inventory.equipmentAttentionCount),
          color: colors.warning
        },
        {
          icon: BarChart2,
          label: "Active Units",
          value: String(inventory.equipmentCurrentUnits),
          color: colors.success
        },
        {
          icon: Archive,
          label: "Missing Units",
          value: String(inventory.equipmentMissingUnits),
          color: colors.textMuted
        }
      ]
    : [
        {
          icon: Package,
          label: "Retail Items",
          value: String(inventory.retailProductCount),
          color: colors.brand
        },
        {
          icon: AlertTriangle,
          label: "Low Stock Items",
          value: String(inventory.retailLowStockCount),
          color: colors.warning
        },
        {
          icon: DollarSign,
          label: "Retail Value",
          value: `PHP ${inventory.retailTotalValue.toLocaleString("en-PH", {
            maximumFractionDigits: 0
          })}`,
          color: colors.success
        },
        {
          icon: BarChart2,
          label: "Sales Revenue",
          value: `PHP ${inventory.totalRevenue.toLocaleString("en-PH", {
            maximumFractionDigits: 0
          })}`,
          color: colors.brand
        }
      ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {items.map((item) => (
        <FitKpiCard
          key={item.label}
          icon={item.icon}
          label={item.label}
          value={item.value}
          color={item.color}
          style={styles.kpiCard}
        />
      ))}
    </div>
  );
}
