"use client";

import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from "react";
import {
  Archive,
  Edit3,
  Package,
  Plus,
  ReceiptText,
  RefreshCw,
  SlidersHorizontal,
  Wrench,
} from "lucide-react";

import type { IThemeContext } from "@fittrack/types";
import { buildRenderableAssetUrl } from "@fittrack/utils";
import {
  EQUIPMENT_STATUS_COLOR,
  EQUIPMENT_STATUS_FILTER_OPTIONS,
  INVENTORY_CATEGORY_FILTER_OPTIONS,
  INVENTORY_REVENUE_WINDOW_OPTIONS,
  INVENTORY_TABS,
  RETAIL_STOCK_FILTER_OPTIONS,
  RETAIL_STOCK_STATUS_COLOR,
} from "@/data/inventory/inventory";
import FitButton from "@/components/fit/FitButton";
import FitDropdown from "@/components/fit/FitDropdown";
import FitPill from "@/components/fit/FitPill";
import FitPagination from "@/components/fit/FitPagination";
import FitSearch from "@/components/fit/FitSearch";
import FitTable, {
  type FitTableColumn,
} from "@/components/fit/FitTable";
import { FitText } from "@/components/fit/FitText";
import { WEB_API_BASE_URL } from "@/lib/api-client";
import type {
  InventoryEquipmentTableRow,
  InventoryRetailTableRow,
  useInventoryDashboard,
} from "@/hooks/inventory/useInventoryDashboard";

type InventoryMainPanelProps = {
  colors: IThemeContext["colors"];
  inventory: ReturnType<typeof useInventoryDashboard>;
  isCompactDetail: boolean;
  onOpenDetailEditor: (kind: "retail" | "equipment") => void;
};

const INVENTORY_PAGE_SIZE = 6;

function getInventoryImageUrl(assetUrl: string | null | undefined) {
  const imageUrl = buildRenderableAssetUrl({
    apiBaseUrl: WEB_API_BASE_URL,
    assetUrl: assetUrl ?? null,
  });

  return imageUrl?.startsWith("https://fittrack.dev/") ? null : imageUrl;
}

function formatLabel(value: string) {
  return value
    .split(/[_-]/g)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function panelStyle(colors: IThemeContext["colors"]): CSSProperties {
  return {
    backgroundColor: colors.surface,
    border: `1px solid ${colors.border}`,
    borderRadius: 8,
  };
}

function getRetailColumns(
  colors: IThemeContext["colors"],
): FitTableColumn<InventoryRetailTableRow>[] {
  return [
    {
      key: "image",
      heading: "Image",
      align: "center",
      headingStyle: { width: 76 },
      render: (product, c) => {
        const imageUrl = getInventoryImageUrl(product.imageUrl);

        return (
          <div
            style={{
              width: 42,
              height: 42,
              borderRadius: 8,
              overflow: "hidden",
              border: `1px solid ${c.border}`,
              backgroundColor: c.surfaceRaised,
              display: "grid",
              margin: "0 auto",
              placeItems: "center",
            }}
          >
            {imageUrl ? (
              <img
                src={imageUrl}
                alt={product.name}
                style={{ width: "100%", height: "100%", objectFit: "cover" }}
              />
            ) : (
              <Package size={17} color={c.textMuted} />
            )}
          </div>
        );
      },
    },
    {
      key: "name",
      heading: "Product",
      headingStyle: { width: 260 },
      render: (product, c) => (
        <div style={{ display: "grid", gap: 2, minWidth: 0 }}>
          <FitText
            style={{
              color: c.textPrimary,
              display: "block",
              fontSize: 14,
              fontWeight: 850,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {product.name}
          </FitText>
          <FitText
            style={{
              color: c.textMuted,
              display: "block",
              fontSize: 12,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {formatLabel(product.category)} / {product.id.slice(0, 8).toUpperCase()}
          </FitText>
        </div>
      ),
    },
    {
      key: "stockQuantity",
      heading: "Stock",
      align: "left",
      headingStyle: { width: 92 },
      render: (product) => (
        <FitText style={{ display: "block", fontSize: 14, fontWeight: 800 }}>
          {product.stockQuantity}
        </FitText>
      ),
    },
    {
      key: "reorderThreshold",
      heading: "Reorder",
      align: "left",
      headingStyle: { width: 96 },
      render: (product) => (
        <FitText style={{ color: colors.textMuted, display: "block", fontSize: 13 }}>
          {product.reorderThreshold}
        </FitText>
      ),
    },
    {
      key: "status",
      heading: "Status",
      align: "left",
      headingStyle: { width: 150 },
      render: (product) => (
        <div style={{ display: "flex", justifyContent: "flex-start" }}>
          <FitPill
            mode="status"
            label={product.status}
            color={RETAIL_STOCK_STATUS_COLOR[product.status]}
            fontSize={13}
          />
        </div>
      ),
    },
    {
      key: "price",
      heading: "Price",
      align: "left",
      headingStyle: { width: 138 },
      render: (product) => (
        <FitText style={{ color: colors.textMuted, display: "block", fontSize: 13 }}>
          PHP{" "}
          {product.price.toLocaleString("en-PH", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })}
        </FitText>
      ),
    },
    {
      key: "totalValue",
      heading: "Value",
      align: "left",
      headingStyle: { width: 148 },
      render: (product) => (
        <FitText style={{ color: colors.textMuted, display: "block", fontSize: 13 }}>
          PHP{" "}
          {product.totalValue.toLocaleString("en-PH", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })}
        </FitText>
      ),
    },
  ];
}

function getEquipmentColumns(
  colors: IThemeContext["colors"],
): FitTableColumn<InventoryEquipmentTableRow>[] {
  return [
    {
      key: "image",
      heading: "Image",
      align: "center",
      headingStyle: { width: 76 },
      render: (equipment, c) => {
        const imageUrl = getInventoryImageUrl(equipment.imageUrl);

        return (
          <div
            style={{
              width: 42,
              height: 42,
              borderRadius: 8,
              overflow: "hidden",
              border: `1px solid ${c.border}`,
              backgroundColor: c.surfaceRaised,
              display: "grid",
              margin: "0 auto",
              placeItems: "center",
            }}
          >
            {imageUrl ? (
              <img
                src={imageUrl}
                alt={equipment.name}
                style={{ width: "100%", height: "100%", objectFit: "cover" }}
              />
            ) : (
              <Wrench size={17} color={c.textMuted} />
            )}
          </div>
        );
      },
    },
    {
      key: "name",
      heading: "Equipment",
      headingStyle: { width: 280 },
      render: (equipment, c) => (
        <div style={{ display: "grid", gap: 2, minWidth: 0 }}>
          <FitText
            style={{
              color: c.textPrimary,
              display: "block",
              fontSize: 14,
              fontWeight: 850,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {equipment.name}
          </FitText>
          <FitText
            style={{
              color: c.textMuted,
              display: "block",
              fontSize: 12,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {equipment.id.slice(0, 8).toUpperCase()}
          </FitText>
        </div>
      ),
    },
    {
      key: "quantityCurrent",
      heading: "Current",
      align: "left",
      headingStyle: { width: 96 },
      render: (equipment) => (
        <FitText style={{ display: "block", fontSize: 14, fontWeight: 800 }}>
          {equipment.quantityCurrent}
        </FitText>
      ),
    },
    {
      key: "quantityTotal",
      heading: "Total",
      align: "left",
      headingStyle: { width: 88 },
      render: (equipment) => (
        <FitText style={{ color: colors.textMuted, display: "block", fontSize: 13 }}>
          {equipment.quantityTotal}
        </FitText>
      ),
    },
    {
      key: "missingCount",
      heading: "Missing",
      align: "left",
      headingStyle: { width: 96 },
      render: (equipment) => (
        <FitText style={{ color: colors.textMuted, display: "block", fontSize: 13 }}>
          {equipment.missingCount}
        </FitText>
      ),
    },
    {
      key: "unit",
      heading: "Unit",
      align: "left",
      headingStyle: { width: 100 },
      render: (equipment) => (
        <FitText style={{ color: colors.textMuted, display: "block", fontSize: 13 }}>
          {equipment.unit}
        </FitText>
      ),
    },
    {
      key: "status",
      heading: "Status",
      align: "left",
      headingStyle: { width: 150 },
      render: (equipment) => (
        <div style={{ display: "flex", justifyContent: "flex-start" }}>
          <FitPill
            mode="status"
            label={equipment.status}
            color={EQUIPMENT_STATUS_COLOR[equipment.status]}
            fontSize={13}
          />
        </div>
      ),
    },
  ];
}

export function InventoryMainPanel({
  colors,
  inventory,
  isCompactDetail,
  onOpenDetailEditor,
}: InventoryMainPanelProps) {
  const retailColumns = useMemo(() => getRetailColumns(colors), [colors]);
  const equipmentColumns = useMemo(() => getEquipmentColumns(colors), [colors]);
  const visibleInventoryTabs = INVENTORY_TABS.filter(
    (option) => option.key !== "analytics",
  );
  const isRetail = inventory.tab === "retail";
  const selectedRetail = inventory.selectedRetail;
  const selectedEquipment = inventory.selectedEquipment;
  const selectedRows = isRetail
    ? inventory.filteredRetailProducts
    : inventory.filteredEquipmentItems;
  const [retailPage, setRetailPage] = useState(1);
  const [equipmentPage, setEquipmentPage] = useState(1);
  const retailTotalPages = Math.max(
    1,
    Math.ceil(inventory.filteredRetailProducts.length / INVENTORY_PAGE_SIZE),
  );
  const equipmentTotalPages = Math.max(
    1,
    Math.ceil(inventory.filteredEquipmentItems.length / INVENTORY_PAGE_SIZE),
  );

  useEffect(() => {
    setRetailPage((page) => Math.min(page, retailTotalPages));
  }, [retailTotalPages]);

  useEffect(() => {
    setEquipmentPage((page) => Math.min(page, equipmentTotalPages));
  }, [equipmentTotalPages]);

  useEffect(() => {
    setRetailPage(1);
    setEquipmentPage(1);
  }, [
    inventory.equipmentStatusFilter,
    inventory.q,
    inventory.retailCategoryFilter,
    inventory.retailStockFilter,
    inventory.tab,
  ]);

  const retailRows = useMemo(
    () =>
      inventory.filteredRetailProducts.slice(
        (retailPage - 1) * INVENTORY_PAGE_SIZE,
        retailPage * INVENTORY_PAGE_SIZE,
      ),
    [inventory.filteredRetailProducts, retailPage],
  );
  const equipmentRows = useMemo(
    () =>
      inventory.filteredEquipmentItems.slice(
        (equipmentPage - 1) * INVENTORY_PAGE_SIZE,
        equipmentPage * INVENTORY_PAGE_SIZE,
      ),
    [equipmentPage, inventory.filteredEquipmentItems],
  );

  return (
    <div style={{ display: "grid", gap: 14, minWidth: 0 }}>
      <section
        style={{
          ...panelStyle(colors),
          padding: 14,
          display: "grid",
          gap: 12,
        }}
      >
        <div
          style={{
            display: "grid",
            gap: 12,
            gridTemplateColumns: "auto minmax(240px, 1fr) auto",
            alignItems: "center",
          }}
        >
          <FitPill
            options={visibleInventoryTabs}
            active={inventory.tab}
            onChange={(value) => inventory.setTab(value as typeof inventory.tab)}
          />
          <FitSearch
            value={inventory.q}
            onChangeText={inventory.setQ}
            placeholder={
              isRetail
                ? "Search retail products, categories, or descriptions..."
                : "Search equipment, units, or descriptions..."
            }
          />
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
            <FitButton
              variant="ghost"
              label="FILTERS"
              icon={SlidersHorizontal}
              iconSize={15}
              onClick={() => inventory.setShowFilters((value) => !value)}
            />
            {isRetail ? (
              <FitButton
                variant="primary"
                label="RECORD SALE"
                icon={ReceiptText}
                iconSize={15}
                onClick={() => inventory.openRetailSale()}
                disabled={inventory.retailSaleProductOptions.length === 0}
              />
            ) : null}
            <FitButton
              variant="primary"
              label={isRetail ? "ADD PRODUCT" : "ADD EQUIPMENT"}
              icon={Plus}
              iconSize={15}
              onClick={isRetail ? inventory.openCreateRetail : inventory.openCreateEquipment}
            />
          </div>
        </div>

        {inventory.showFilters ? (
          <div
            className="inventory-filter-grid"
            style={{
              display: "grid",
              gap: 10,
              gridTemplateColumns: isRetail
                ? "repeat(2, minmax(180px, 1fr))"
                : "minmax(180px, 320px)",
            }}
          >
            {isRetail ? (
              <>
                <LabeledSelect
                  colors={colors}
                  label="Category"
                  value={inventory.retailCategoryFilter}
                  options={INVENTORY_CATEGORY_FILTER_OPTIONS}
                  onChange={(value) =>
                    inventory.setRetailCategoryFilter(
                      value as typeof inventory.retailCategoryFilter,
                    )
                  }
                />
                <LabeledSelect
                  colors={colors}
                  label="Stock"
                  value={inventory.retailStockFilter}
                  options={RETAIL_STOCK_FILTER_OPTIONS}
                  onChange={(value) =>
                    inventory.setRetailStockFilter(
                      value as typeof inventory.retailStockFilter,
                    )
                  }
                />
                <LabeledSelect
                  colors={colors}
                  label="Revenue Window"
                  value={inventory.salesRevenueWindowFilter}
                  options={INVENTORY_REVENUE_WINDOW_OPTIONS}
                  onChange={(value) =>
                    inventory.setSalesRevenueWindowFilter(
                      value as typeof inventory.salesRevenueWindowFilter,
                    )
                  }
                />
              </>
            ) : (
              <LabeledSelect
                colors={colors}
                label="Equipment Status"
                value={inventory.equipmentStatusFilter}
                options={EQUIPMENT_STATUS_FILTER_OPTIONS}
                onChange={(value) =>
                  inventory.setEquipmentStatusFilter(
                    value as typeof inventory.equipmentStatusFilter,
                  )
                }
              />
            )}
          </div>
        ) : null}
      </section>

      <div
        className="inventory-workbench"
        style={{
          display: "grid",
          gap: 14,
          gridTemplateColumns: isCompactDetail
            ? "minmax(0, 1fr)"
            : "minmax(0, 1fr) minmax(280px, 340px)",
          alignItems: "stretch",
          height: isCompactDetail ? "auto" : "calc(100vh - 238px)",
          minHeight: isCompactDetail ? 0 : 560,
        }}
      >
        <section
          style={{
            ...panelStyle(colors),
            minWidth: 0,
            overflow: "hidden",
            display: "grid",
            gridTemplateRows: "auto minmax(0, 1fr) auto",
            minHeight: 0,
          }}
        >
          <div
            style={{
              alignItems: "center",
              backgroundColor: colors.surfaceRaised,
              borderBottom: `1px solid ${colors.border}`,
              display: "flex",
              gap: 12,
              justifyContent: "space-between",
              padding: "14px 16px",
            }}
          >
            <div>
              <FitText style={{ fontSize: 18, fontWeight: 900 }}>
                {isRetail ? "Retail Inventory Table" : "Equipment Inventory Table"}
              </FitText>
              <FitText style={{ color: colors.textMuted, fontSize: 12.5, marginTop: 3 }}>
                {selectedRows.length} row{selectedRows.length === 1 ? "" : "s"} in the current view
              </FitText>
            </div>
            <FitButton
              variant="ghost"
              label={inventory.isRefreshing ? "REFRESHING" : "REFRESH"}
              icon={RefreshCw}
              iconSize={15}
              onClick={() => {
                void inventory.handleRefresh();
              }}
              disabled={inventory.isRefreshing}
            />
          </div>
          {isRetail ? (
            <FitTable
              columns={retailColumns}
              rows={retailRows}
              getRowKey={(product) => product.id}
              isLoading={inventory.isRetailLoading}
              loadingMessage="Loading live retail inventory..."
              emptyMessage="No retail items match this view."
              onRowClick={(product) => inventory.openRetailDetails(product.id)}
              getRowClassName={(product) =>
                product.id === selectedRetail?.id
                  ? "inventory-table-row--selected"
                  : undefined
              }
              style={{ border: 0, borderRadius: 0 }}
              tableStyle={{ minWidth: 960, tableLayout: "fixed" }}
            />
          ) : (
            <FitTable
              columns={equipmentColumns}
              rows={equipmentRows}
              getRowKey={(equipment) => equipment.id}
              isLoading={inventory.isEquipmentLoading}
              loadingMessage="Loading live equipment inventory..."
              emptyMessage="No equipment items match this view."
              onRowClick={(equipment) => inventory.openEquipmentDetails(equipment.id)}
              getRowClassName={(equipment) =>
                equipment.id === selectedEquipment?.id
                  ? "inventory-table-row--selected"
                  : undefined
              }
              style={{ border: 0, borderRadius: 0 }}
              tableStyle={{ minWidth: 900, tableLayout: "fixed" }}
            />
          )}
          <div
            style={{
              borderTop: `1px solid ${colors.border}`,
              display: "flex",
              justifyContent: "space-between",
              gap: 12,
              alignItems: "center",
              padding: "12px 16px",
              backgroundColor: colors.surface,
            }}
          >
            <FitText style={{ color: colors.textMuted, fontSize: 12 }}>
              Page {isRetail ? retailPage : equipmentPage} of{" "}
              {isRetail ? retailTotalPages : equipmentTotalPages}
            </FitText>
            <FitPagination
              currentPage={isRetail ? retailPage : equipmentPage}
              totalPages={isRetail ? retailTotalPages : equipmentTotalPages}
              onPageChange={isRetail ? setRetailPage : setEquipmentPage}
              showSinglePage
              ariaLabel={`${isRetail ? "Retail" : "Equipment"} inventory pagination`}
            />
          </div>
        </section>

        {!isCompactDetail ? (
          <aside
            style={{
              ...panelStyle(colors),
              minHeight: 0,
              height: "100%",
              padding: 16,
              overflow: "hidden",
            }}
          >
            {isRetail ? (
              selectedRetail ? (
                <RetailDetailCard
                  colors={colors}
                  product={selectedRetail}
                  onArchive={() => inventory.openRetailArchive(selectedRetail.id)}
                  onEdit={() => onOpenDetailEditor("retail")}
                  onRecordSale={() => inventory.openRetailSale(selectedRetail.id)}
                  onRestock={() => inventory.openRetailRestock(selectedRetail.id)}
                />
              ) : (
                <EmptyDetailCard
                  colors={colors}
                  copy="Select a retail row to inspect stock, pricing, image, and sale actions here."
                  title="No retail item selected"
                />
              )
            ) : selectedEquipment ? (
              <EquipmentDetailCard
                colors={colors}
                equipment={selectedEquipment}
                onArchive={() => inventory.openEquipmentArchive(selectedEquipment.id)}
                onEdit={() => onOpenDetailEditor("equipment")}
                onWriteOff={() => inventory.openEquipmentWriteOff(selectedEquipment.id)}
              />
            ) : (
              <EmptyDetailCard
                colors={colors}
                copy="Select an equipment row to inspect status, quantities, images, and write-off actions here."
                title="No equipment selected"
              />
            )}
          </aside>
        ) : null}
      </div>

      <style>{`
        .inventory-table-row--selected {
          box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--fit-brand) 56%, transparent),
            0 0 18px color-mix(in srgb, var(--fit-brand) 24%, transparent);
        }

        .inventory-table-row--selected > td {
          background-color: color-mix(in srgb, var(--fit-brand) 14%, transparent);
        }

        .inventory-table-row--selected > td:first-child {
          box-shadow: inset 3px 0 0 var(--fit-brand);
        }

        @media (max-width: 760px) {
          .inventory-workbench,
          .inventory-filter-grid {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </div>
  );
}

function LabeledSelect({
  colors,
  label,
  onChange,
  options,
  value,
}: {
  colors: IThemeContext["colors"];
  label: string;
  onChange: (value: string) => void;
  options: Array<{ label: string; value: string }>;
  value: string;
}) {
  return (
    <label style={{ display: "grid", gap: 6 }}>
      <FitText style={{ color: colors.textMuted, fontSize: 11, fontWeight: 850 }}>
        {label}
      </FitText>
      <FitDropdown
        fullWidth
        compact
        value={value}
        options={options}
        onChange={onChange}
      />
    </label>
  );
}

function EmptyDetailCard({
  colors,
  copy,
  title,
}: {
  colors: IThemeContext["colors"];
  copy: string;
  title: string;
}) {
  return (
    <div style={{ display: "grid", gap: 12, alignContent: "start" }}>
      <FitText style={{ fontSize: 18, fontWeight: 900 }}>{title}</FitText>
      <FitText style={{ color: colors.textMuted, fontSize: 13, lineHeight: 1.55 }}>
        {copy}
      </FitText>
    </div>
  );
}

function RetailDetailCard({
  colors,
  onArchive,
  onEdit,
  onRecordSale,
  onRestock,
  product,
}: {
  colors: IThemeContext["colors"];
  onArchive: () => void;
  onEdit: () => void;
  onRecordSale: () => void;
  onRestock: () => void;
  product: InventoryRetailTableRow;
}) {
  const imageUrl = getInventoryImageUrl(product.imageUrl);

  return (
    <DetailCardShell
      colors={colors}
      imageAlt={product.name}
      imageUrl={imageUrl}
      status={
        <FitPill
          mode="status"
          label={product.status}
          color={RETAIL_STOCK_STATUS_COLOR[product.status]}
        />
      }
      title={product.name}
    >
      <DetailMetricGrid
        colors={colors}
        items={[
          ["Category", formatLabel(product.category)],
          ["Stock", String(product.stockQuantity)],
          ["Reorder At", String(product.reorderThreshold)],
          ["Price", `PHP ${product.price.toLocaleString("en-PH", { minimumFractionDigits: 2 })}`],
          ["Cost", `PHP ${product.cost.toLocaleString("en-PH", { minimumFractionDigits: 2 })}`],
          ["Value", `PHP ${product.totalValue.toLocaleString("en-PH", { minimumFractionDigits: 2 })}`],
        ]}
      />
      <div style={{ display: "grid", gap: 8 }}>
        <FitButton variant="primary" label="RECORD SALE" icon={ReceiptText} onClick={onRecordSale} />
        <FitButton variant="ghost" label="RESTOCK ITEM" icon={RefreshCw} onClick={onRestock} />
        <FitButton variant="ghost" label="EDIT DETAILS" icon={Edit3} onClick={onEdit} />
        <FitButton variant="danger" label="ARCHIVE ITEM" icon={Archive} onClick={onArchive} />
      </div>
    </DetailCardShell>
  );
}

function EquipmentDetailCard({
  colors,
  equipment,
  onArchive,
  onEdit,
  onWriteOff,
}: {
  colors: IThemeContext["colors"];
  equipment: InventoryEquipmentTableRow;
  onArchive: () => void;
  onEdit: () => void;
  onWriteOff: () => void;
}) {
  const imageUrl = getInventoryImageUrl(equipment.imageUrl);

  return (
    <DetailCardShell
      colors={colors}
      imageAlt={equipment.name}
      imageUrl={imageUrl}
      status={
        <FitPill
          mode="status"
          label={equipment.status}
          color={EQUIPMENT_STATUS_COLOR[equipment.status]}
        />
      }
      title={equipment.name}
    >
      <DetailMetricGrid
        colors={colors}
        items={[
          ["Current", String(equipment.quantityCurrent)],
          ["Total", String(equipment.quantityTotal)],
          ["Missing", String(equipment.missingCount)],
          ["Unit", equipment.unit],
          ["Status", equipment.status],
        ]}
      />
      <div style={{ display: "grid", gap: 8 }}>
        <FitButton variant="primary" label="RECORD WRITEOFF" icon={Wrench} onClick={onWriteOff} />
        <FitButton variant="ghost" label="EDIT DETAILS" icon={Edit3} onClick={onEdit} />
        <FitButton variant="danger" label="ARCHIVE EQUIPMENT" icon={Archive} onClick={onArchive} />
      </div>
    </DetailCardShell>
  );
}

function DetailCardShell({
  children,
  colors,
  imageAlt,
  imageUrl,
  status,
  title,
}: {
  children: ReactNode;
  colors: IThemeContext["colors"];
  imageAlt: string;
  imageUrl: string | null | undefined;
  status: ReactNode;
  title: string;
}) {
  return (
    <div style={{ display: "grid", gap: 14 }}>
      <div
        style={{
          border: `1px solid ${colors.border}`,
          borderRadius: 8,
          backgroundColor: colors.surfaceRaised,
          minHeight: 170,
          overflow: "hidden",
          display: "grid",
          placeItems: "center",
        }}
      >
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={imageAlt}
            style={{ width: "100%", height: 190, objectFit: "cover" }}
          />
        ) : (
          <Package size={32} color={colors.textMuted} />
        )}
      </div>
      <div style={{ display: "grid", gap: 8 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
          <FitText style={{ fontSize: 18, fontWeight: 900, lineHeight: 1.12 }}>
            {title}
          </FitText>
          {status}
        </div>
      </div>
      {children}
    </div>
  );
}

function DetailMetricGrid({
  colors,
  items,
}: {
  colors: IThemeContext["colors"];
  items: Array<[string, string]>;
}) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
        gap: 8,
      }}
    >
      {items.map(([label, value]) => (
        <div
          key={label}
          style={{
            border: `1px solid ${colors.border}`,
            borderRadius: 8,
            padding: 8,
            backgroundColor: colors.surfaceRaised,
            minWidth: 0,
          }}
        >
          <FitText style={{ color: colors.textMuted, fontSize: 10.5 }}>
            {label}
          </FitText>
          <FitText
            style={{
              fontSize: 12.5,
              fontWeight: 800,
              marginTop: 3,
              overflowWrap: "anywhere",
            }}
          >
            {value}
          </FitText>
        </div>
      ))}
    </div>
  );
}
