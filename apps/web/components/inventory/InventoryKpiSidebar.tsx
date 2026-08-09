"use client";

import { AlertTriangle, BarChart2, DollarSign, Package } from "lucide-react";

import type { IThemeContext } from "@fittrack/types";
import { FitKpiCard, FitSelect } from "@/components/fit/FitCard";
import { FitText } from "@/components/fit/FitText";
import type { useInventoryDashboard } from "@/hooks/inventory/useInventoryDashboard";
import { dashboardStyles } from "@/styles/pageStyles";
import { INVENTORY_REVENUE_WINDOW_OPTIONS } from "@/data/inventory/inventory";

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
          label: "Total Number of Equipments",
          value: String(inventory.equipmentTotalUnits),
          color: colors.brand
        },
        {
          icon: BarChart2,
          label: "Total Types of Equipments",
          value: String(inventory.equipmentCount),
          color: colors.success
        },
        {
          icon: AlertTriangle,
          label: "Equipment Needing Attention",
          value: String(inventory.equipmentAttentionCount),
          color: colors.warning
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
      {items.map((item) =>
        inventory.tab !== "equipment" && item.label === "Sales Revenue" ? (
          <div key={item.label} className="fit-kpi-card" style={styles.kpiCard}>
            <div
              style={{
                display: "flex",
                alignItems: "flex-start",
                justifyContent: "space-between",
                gap: 10,
                marginBottom: 8
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                <item.icon size={15} color={item.color} />
                <FitText style={{ fontSize: 12, color: colors.textMuted }}>
                  {item.label}
                </FitText>
              </div>
              <FitSelect
                compact
                value={inventory.salesRevenueWindowFilter}
                onChange={(event) =>
                  inventory.setSalesRevenueWindowFilter(
                    event.target.value as typeof inventory.salesRevenueWindowFilter
                  )
                }
                options={INVENTORY_REVENUE_WINDOW_OPTIONS}
                style={{ minWidth: 92 }}
              />
            </div>
            <FitText style={{ fontSize: 24, fontWeight: 700 }}>
              {item.value}
            </FitText>
          </div>
        ) : (
          <FitKpiCard
            key={item.label}
            icon={item.icon}
            label={item.label}
            value={item.value}
            color={item.color}
            style={styles.kpiCard}
          />
        )
      )}
    </div>
  );
}
