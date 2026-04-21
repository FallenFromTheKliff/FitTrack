"use client";

import { Plus, RefreshCw, SlidersHorizontal } from "lucide-react";
import { Bar, BarChart, Tooltip, XAxis, YAxis } from "recharts";

import type { IThemeContext } from "@fittrack/types";
import {
  EQUIPMENT_STATUS_COLOR,
  EQUIPMENT_STATUS_FILTER_OPTIONS,
  INVENTORY_CATEGORY_FILTER_OPTIONS,
  INVENTORY_TABS,
  RETAIL_STOCK_FILTER_OPTIONS,
  RETAIL_STOCK_STATUS_COLOR
} from "@/data/inventory/inventory";
import FitButton from "@/components/fit/FitButton";
import FitChartContainer from "@/components/fit/FitChartContainer";
import { FitInlineFilterChips } from "@/components/fit/FitFilter";
import FitPill from "@/components/fit/FitPill";
import FitSearch from "@/components/fit/FitSearch";
import FitSection from "@/components/fit/FitSection";
import FitTable, {
  type FitTableAction,
  type FitTableColumn
} from "@/components/fit/FitTable";
import { FitText } from "@/components/fit/FitText";
import type {
  InventoryEquipmentTableRow,
  InventoryRetailTableRow,
  useInventoryDashboard
} from "@/hooks/inventory/useInventoryDashboard";

type InventoryMainPanelProps = {
  colors: IThemeContext["colors"];
  inventory: ReturnType<typeof useInventoryDashboard>;
};

function formatLabel(value: string) {
  return value
    .split(/[_-]/g)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function getRetailColumns(
  colors: IThemeContext["colors"]
): FitTableColumn<InventoryRetailTableRow>[] {
  return [
    {
      key: "name",
      heading: "PRODUCT",
      render: (product, c) => (
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <FitText style={{ fontSize: 14, fontWeight: 700, color: c.textPrimary }}>
            {product.name}
          </FitText>
          <FitText style={{ fontSize: 12, color: c.textMuted }}>
            {product.id.slice(0, 8).toUpperCase()}
          </FitText>
        </div>
      )
    },
    {
      key: "category",
      heading: "CATEGORY",
      render: (product) => (
        <FitText style={{ fontSize: 14, color: colors.textMuted }}>
          {formatLabel(product.category)}
        </FitText>
      )
    },
    {
      key: "stockQuantity",
      heading: "STOCK",
      render: (product) => (
        <FitText style={{ fontSize: 14 }}>{product.stockQuantity}</FitText>
      )
    },
    {
      key: "reorderThreshold",
      heading: "REORDER AT",
      render: (product) => (
        <FitText style={{ fontSize: 14, color: colors.textMuted }}>
          {product.reorderThreshold}
        </FitText>
      )
    },
    {
      key: "status",
      heading: "STATUS",
      render: (product) => (
        <FitPill
          mode="status"
          label={product.status}
          color={RETAIL_STOCK_STATUS_COLOR[product.status]}
          fontSize={13}
        />
      )
    },
    {
      key: "price",
      heading: "PRICE",
      render: (product) => (
        <FitText style={{ fontSize: 14, color: colors.textMuted }}>
          PHP{" "}
          {product.price.toLocaleString("en-PH", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
          })}
        </FitText>
      )
    },
    {
      key: "totalValue",
      heading: "VALUE",
      render: (product) => (
        <FitText style={{ fontSize: 14, color: colors.textMuted }}>
          PHP{" "}
          {product.totalValue.toLocaleString("en-PH", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
          })}
        </FitText>
      )
    }
  ];
}

function getEquipmentColumns(
  colors: IThemeContext["colors"]
): FitTableColumn<InventoryEquipmentTableRow>[] {
  return [
    {
      key: "name",
      heading: "EQUIPMENT",
      render: (equipment, c) => (
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <FitText style={{ fontSize: 14, fontWeight: 700, color: c.textPrimary }}>
            {equipment.name}
          </FitText>
          <FitText style={{ fontSize: 12, color: c.textMuted }}>
            {equipment.id.slice(0, 8).toUpperCase()}
          </FitText>
        </div>
      )
    },
    {
      key: "quantityCurrent",
      heading: "CURRENT",
      render: (equipment) => (
        <FitText style={{ fontSize: 14 }}>{equipment.quantityCurrent}</FitText>
      )
    },
    {
      key: "quantityTotal",
      heading: "TOTAL",
      render: (equipment) => (
        <FitText style={{ fontSize: 14, color: colors.textMuted }}>
          {equipment.quantityTotal}
        </FitText>
      )
    },
    {
      key: "missingCount",
      heading: "MISSING",
      render: (equipment) => (
        <FitText style={{ fontSize: 14, color: colors.textMuted }}>
          {equipment.missingCount}
        </FitText>
      )
    },
    {
      key: "unit",
      heading: "UNIT",
      render: (equipment) => (
        <FitText style={{ fontSize: 14, color: colors.textMuted }}>
          {equipment.unit}
        </FitText>
      )
    },
    {
      key: "status",
      heading: "STATUS",
      render: (equipment) => (
        <FitPill
          mode="status"
          label={equipment.status}
          color={EQUIPMENT_STATUS_COLOR[equipment.status]}
          fontSize={13}
        />
      )
    }
  ];
}

export function InventoryMainPanel({
  colors,
  inventory
}: InventoryMainPanelProps) {
  const retailColumns = getRetailColumns(colors);
  const equipmentColumns = getEquipmentColumns(colors);
  const actionLabel =
    inventory.tab === "retail"
      ? "ADD PRODUCT"
      : inventory.tab === "equipment"
        ? "ADD EQUIPMENT"
        : null;

  const retailActions: FitTableAction<InventoryRetailTableRow>[] = [
    {
      label: "Details",
      variant: "ghost",
      onClick: (product) => inventory.openRetailDetails(product.id)
    },
    {
      label: "Restock",
      variant: "primary",
      onClick: (product) => inventory.openRetailRestock(product.id)
    }
  ];

  const equipmentActions: FitTableAction<InventoryEquipmentTableRow>[] = [
    {
      label: "Details",
      variant: "ghost",
      onClick: (equipment) => inventory.openEquipmentDetails(equipment.id)
    },
    {
      label: "Write-Off",
      variant: "primary",
      onClick: (equipment) => inventory.openEquipmentWriteOff(equipment.id)
    }
  ];

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
        <div style={{ flex: "1 1 360px", minWidth: 240 }}>
          <FitSearch
            value={inventory.q}
            onChangeText={inventory.setQ}
            placeholder={
              inventory.tab === "equipment"
                ? "Search by equipment name, unit, or description..."
                : "Search by name, category, or description..."
            }
          />
        </div>
        <FitButton
          variant="primary"
          label={inventory.isRefreshing ? "REFRESHING" : "REFRESH"}
          icon={RefreshCw}
          iconSize={14}
          onClick={() => {
            void inventory.handleRefresh();
          }}
          disabled={inventory.isRefreshing}
        />
        {actionLabel ? (
          <FitButton
            variant="primary"
            label={actionLabel}
            icon={Plus}
            iconSize={14}
            onClick={
              inventory.tab === "retail"
                ? inventory.openCreateRetail
                : inventory.openCreateEquipment
            }
          />
        ) : null}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14, flexWrap: "wrap" }}>
        <FitPill
          options={[...INVENTORY_TABS]}
          active={inventory.tab}
          onChange={(value) => inventory.setTab(value as typeof inventory.tab)}
        />
      </div>
      {inventory.tab !== "analytics" ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 14 }}>
          <FitButton
            variant="ghost"
            label="Filters"
            icon={SlidersHorizontal}
            iconSize={16}
            onClick={() => inventory.setShowFilters((value) => !value)}
            style={{ alignSelf: "flex-start" }}
          />
          {inventory.tab === "retail" ? (
            <div style={{ display: "grid", gap: 8 }}>
              <FitInlineFilterChips
                isOpen={inventory.showFilters}
                options={INVENTORY_CATEGORY_FILTER_OPTIONS}
                activeValue={inventory.retailCategoryFilter}
                onChange={(value) =>
                  inventory.setRetailCategoryFilter(
                    value as typeof inventory.retailCategoryFilter
                  )
                }
                maxWidth={520}
              />
              <FitInlineFilterChips
                isOpen={inventory.showFilters}
                options={RETAIL_STOCK_FILTER_OPTIONS}
                activeValue={inventory.retailStockFilter}
                onChange={(value) =>
                  inventory.setRetailStockFilter(
                    value as typeof inventory.retailStockFilter
                  )
                }
                maxWidth={520}
              />
            </div>
          ) : (
            <FitInlineFilterChips
              isOpen={inventory.showFilters}
              options={EQUIPMENT_STATUS_FILTER_OPTIONS}
              activeValue={inventory.equipmentStatusFilter}
              onChange={(value) =>
                inventory.setEquipmentStatusFilter(
                  value as typeof inventory.equipmentStatusFilter
                )
              }
              maxWidth={520}
            />
          )}
        </div>
      ) : null}
      {inventory.tab === "retail" ? (
        <FitSection heading="Retail Inventory">
          <FitText style={{ fontSize: 13, color: colors.textMuted, marginBottom: 10 }}>
            Retail items carry category-aware stock thresholds and are the only inventory
            records that trigger low-stock notifications.
          </FitText>
          <FitTable
            columns={retailColumns}
            rows={inventory.filteredRetailProducts}
            getRowKey={(product) => product.id}
            isLoading={inventory.isRetailLoading}
            loadingMessage="Loading live retail inventory..."
            emptyMessage="No retail items match this view."
            actions={retailActions}
            onRowClick={(product) => inventory.openRetailDetails(product.id)}
          />
        </FitSection>
      ) : null}
      {inventory.tab === "equipment" ? (
        <FitSection heading="Equipment Inventory">
          <FitText style={{ fontSize: 13, color: colors.textMuted, marginBottom: 10 }}>
            Equipment tracks operational availability so staff can surface write-offs,
            maintenance, and missing-item follow-up without turning dumbbells into low-stock
            retail alerts.
          </FitText>
          <FitTable
            columns={equipmentColumns}
            rows={inventory.filteredEquipmentItems}
            getRowKey={(equipment) => equipment.id}
            isLoading={inventory.isEquipmentLoading}
            loadingMessage="Loading live equipment inventory..."
            emptyMessage="No equipment items match this view."
            actions={equipmentActions}
            onRowClick={(equipment) => inventory.openEquipmentDetails(equipment.id)}
          />
        </FitSection>
      ) : null}
      {inventory.tab === "analytics" ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <FitText style={{ fontSize: 13, color: colors.textMuted, marginBottom: 4 }}>
            Analytics stay retail-centric because sales and low-stock thresholds currently belong
            to the retail side of inventory.
          </FitText>
          <FitChartContainer heading="Monthly Sales Revenue" chartStyle={{ height: 260 }}>
            <BarChart data={inventory.monthlySales}>
              <XAxis dataKey="month" stroke={colors.textMuted} tick={{ fontSize: 12 }} />
              <YAxis stroke={colors.textMuted} tick={{ fontSize: 12 }} />
              <Tooltip
                contentStyle={{
                  backgroundColor: colors.surface,
                  border: `1px solid ${colors.border}`,
                  borderRadius: 8
                }}
              />
              <Bar dataKey="revenue" fill={colors.brand} radius={[4, 4, 0, 0]} />
            </BarChart>
          </FitChartContainer>
          <FitChartContainer
            heading="Top Retail Items By Inventory Value"
            chartStyle={{ height: 240 }}
          >
            <BarChart data={inventory.topProducts} margin={{ bottom: 40 }}>
              <XAxis
                dataKey="name"
                stroke={colors.textMuted}
                tick={{ fontSize: 11, angle: -15, textAnchor: "end" }}
              />
              <YAxis stroke={colors.textMuted} tick={{ fontSize: 12 }} />
              <Tooltip
                contentStyle={{
                  backgroundColor: colors.surface,
                  border: `1px solid ${colors.border}`,
                  borderRadius: 8
                }}
              />
              <Bar dataKey="value" fill={colors.brand} radius={[4, 4, 0, 0]} />
            </BarChart>
          </FitChartContainer>
        </div>
      ) : null}
    </div>
  );
}
