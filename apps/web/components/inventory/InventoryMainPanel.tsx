"use client";

import {
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import {
  Archive,
  Bike,
  ChevronUp,
  Droplet,
  Dumbbell,
  Edit3,
  Filter,
  Gauge,
  Package,
  Pill,
  Plus,
  ReceiptText,
  RefreshCw,
  ShoppingBag,
  Wrench,
  type LucideIcon,
} from "lucide-react";

import type { IThemeContext } from "@fittrack/types";
import { buildRenderableAssetUrl } from "@fittrack/utils";
import {
  EQUIPMENT_STATUS_COLOR,
  EQUIPMENT_STATUS_FILTER_OPTIONS,
  INVENTORY_ARCHIVE_FILTER_OPTIONS,
  INVENTORY_CATEGORY_FILTER_OPTIONS,
  INVENTORY_REVENUE_WINDOW_OPTIONS,
  RETAIL_STOCK_FILTER_OPTIONS,
  RETAIL_STOCK_STATUS_COLOR,
} from "@/data/inventory/inventory";
import FitButton, { type FitButtonVariant } from "@/components/fit/FitButton";
import { FitSelect } from "@/components/fit/FitCard";
import FitPill from "@/components/fit/FitPill";
import FitPagination from "@/components/fit/FitPagination";
import FitSearch from "@/components/fit/FitSearch";
import type { FitTableColumn } from "@/components/fit/FitTable";
import { FitText } from "@/components/fit/FitText";
import { WEB_API_BASE_URL } from "@/lib/api-client";
import type {
  InventoryEquipmentTableRow,
  InventoryRetailTableRow,
  useInventoryDashboard,
} from "@/hooks/inventory/useInventoryDashboard";

type InventoryMainPanelProps = {
  canManageInventoryCatalog: boolean;
  canPerformInventoryOperations: boolean;
  colors: IThemeContext["colors"];
  inventory: ReturnType<typeof useInventoryDashboard>;
  isCompactDetail: boolean;
  onOpenDetailEditor: (kind: "retail" | "equipment") => void;
};

const INVENTORY_PAGE_SIZE = 10;
const INVENTORY_COMPACT_BREAKPOINT = 1259;
const RETAIL_GRID_TEMPLATE =
  "58px minmax(220px, 2.1fr) minmax(72px, 0.62fr) minmax(76px, 0.68fr) minmax(122px, 0.82fr) minmax(118px, 0.78fr) minmax(124px, 0.82fr)";
const EQUIPMENT_GRID_TEMPLATE =
  "58px minmax(230px, 2.1fr) minmax(78px, 0.62fr) minmax(68px, 0.56fr) minmax(78px, 0.62fr) minmax(76px, 0.58fr) minmax(128px, 0.82fr)";

type InventoryInspectorAction = {
  disabled?: boolean;
  fullWidth?: boolean;
  icon: LucideIcon;
  label: string;
  onClick: () => void;
  variant: FitButtonVariant;
};

function getInventoryImageUrl(assetUrl: string | null | undefined) {
  const imageUrl = buildRenderableAssetUrl({
    apiBaseUrl: WEB_API_BASE_URL,
    assetUrl: assetUrl ?? null,
  });

  return imageUrl?.startsWith("https://fittrack.dev/") ? null : imageUrl;
}

function InventoryImage({
  alt,
  fallback,
  imageUrl,
}: {
  alt: string;
  fallback: ReactNode;
  imageUrl: string | null | undefined;
}) {
  const [failedImageUrl, setFailedImageUrl] = useState<string | null>(null);

  if (!imageUrl || failedImageUrl === imageUrl) {
    return <>{fallback}</>;
  }

  return (
    <img
      src={imageUrl}
      alt={alt}
      onError={() => setFailedImageUrl(imageUrl)}
      style={{ width: "100%", height: "100%", objectFit: "cover" }}
    />
  );
}

function getEquipmentStatusRowBackground(
  status: InventoryEquipmentTableRow["status"],
  colors: IThemeContext["colors"]
) {
  if (status === "Under Maintenance") return `${colors.warning}16`;
  if (status === "Broken" || status === "Missing") return `${colors.danger}16`;
  return "transparent";
}

function getRetailFallbackIcon(category: string) {
  switch (category) {
    case "supplements":
      return Pill;
    case "beverages":
      return Droplet;
    case "merchandise":
    case "accessories":
      return Dumbbell;
    default:
      return Package;
  }
}

function getEquipmentFallbackIcon(name: string) {
  const normalizedName = name.toLowerCase();
  if (normalizedName.includes("bike")) return Bike;
  if (
    normalizedName.includes("rower") ||
    normalizedName.includes("treadmill")
  ) {
    return Gauge;
  }
  if (
    normalizedName.includes("bench") ||
    normalizedName.includes("dumbbell") ||
    normalizedName.includes("rack")
  ) {
    return Dumbbell;
  }

  return Wrench;
}

function formatLabel(value: string) {
  return value
    .split(/[_-]/g)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
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
        const FallbackIcon = getRetailFallbackIcon(product.category);

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
            <InventoryImage
              alt={product.name}
              fallback={<FallbackIcon size={18} color={c.brand} />}
              imageUrl={imageUrl}
            />
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
            className="inventory-directory-panel__primary-text"
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
            className="inventory-directory-panel__secondary-text"
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
      render: (product, c) => (
        <span
          style={{
            display: "inline-grid",
            minWidth: 46,
            justifyItems: "center",
            padding: "4px 8px",
            borderRadius: 6,
            border: `1px solid ${c.warning}55`,
            backgroundColor: `${c.warning}18`,
          }}
        >
          <FitText
            className="inventory-directory-panel__emphasis-text"
            style={{ color: c.warning, display: "block", fontSize: 13.5, fontWeight: 900 }}
          >
            {product.stockQuantity}
          </FitText>
        </span>
      ),
    },
    {
      key: "reorderThreshold",
      heading: "Reorder",
      align: "left",
      headingStyle: { width: 96 },
      render: (product) => (
        <FitText
          className="inventory-directory-panel__detail-text"
          style={{ color: colors.textMuted, display: "block", fontSize: 13 }}
        >
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
        <FitText
          className="inventory-directory-panel__detail-text"
          style={{ color: colors.textMuted, display: "block", fontSize: 13 }}
        >
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
        <FitText
          className="inventory-directory-panel__detail-text"
          style={{ color: colors.textMuted, display: "block", fontSize: 13 }}
        >
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
        const FallbackIcon = getEquipmentFallbackIcon(equipment.name);

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
            <InventoryImage
              alt={equipment.name}
              fallback={<FallbackIcon size={18} color={c.brand} />}
              imageUrl={imageUrl}
            />
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
            className="inventory-directory-panel__primary-text"
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
            className="inventory-directory-panel__secondary-text"
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
      heading: "Status Qty",
      align: "left",
      headingStyle: { width: 96 },
      render: (equipment) => (
        <FitText
          className="inventory-directory-panel__emphasis-text"
          style={{ display: "block", fontSize: 14, fontWeight: 800 }}
        >
          {equipment.statusQuantity}
        </FitText>
      ),
    },
    {
      key: "quantityTotal",
      heading: "Total",
      align: "left",
      headingStyle: { width: 88 },
      render: (equipment) => (
        <FitText
          className="inventory-directory-panel__detail-text"
          style={{ color: colors.textMuted, display: "block", fontSize: 13 }}
        >
          {equipment.quantityTotal}
        </FitText>
      ),
    },
    {
      key: "missingCount",
      heading: "Placeable",
      align: "left",
      headingStyle: { width: 96 },
      render: (equipment) => (
        <FitText
          className="inventory-directory-panel__detail-text"
          style={{ color: colors.textMuted, display: "block", fontSize: 13 }}
        >
          {equipment.remainingPlaceableQuantity}
        </FitText>
      ),
    },
    {
      key: "unit",
      heading: "Unit",
      align: "left",
      headingStyle: { width: 100 },
      render: (equipment) => (
        <FitText
          className="inventory-directory-panel__detail-text"
          style={{ color: colors.textMuted, display: "block", fontSize: 13 }}
        >
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
  canManageInventoryCatalog,
  canPerformInventoryOperations,
  colors,
  inventory,
  isCompactDetail,
  onOpenDetailEditor,
}: InventoryMainPanelProps) {
  const retailColumns = useMemo(() => getRetailColumns(colors), [colors]);
  const equipmentColumns = useMemo(() => getEquipmentColumns(colors), [colors]);
  const isRetail = inventory.tab === "retail";
  const selectedRetail = inventory.selectedRetail;
  const selectedEquipment = inventory.selectedEquipment;
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
    inventory.equipmentArchiveFilter,
    inventory.equipmentStatusFilter,
    inventory.q,
    inventory.retailArchiveFilter,
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
  const inspectorCommandActions: InventoryInspectorAction[] = isRetail
    ? [
        ...(canPerformInventoryOperations
          ? [
              {
                disabled: inventory.retailSaleProductOptions.length === 0,
                icon: ReceiptText,
                label: "Record Sale",
                onClick: () => inventory.openRetailSale(selectedRetail?.id),
                variant: "primary" as const,
              },
              ...(selectedRetail
                ? [
                    {
                      icon: RefreshCw,
                      label: "Restock Item",
                      onClick: () => inventory.openRetailRestock(selectedRetail.id),
                      variant: "ghost" as const,
                    },
                  ]
                : []),
            ]
          : []),
        ...(canManageInventoryCatalog
          ? [
              {
                icon: Plus,
                label: "Add Product",
                onClick: inventory.openCreateRetail,
                variant: "primary" as const,
              },
            ]
          : []),
      ]
    : [
        ...(canPerformInventoryOperations && selectedEquipment
          ? [
              {
                icon: Wrench,
                label: "Move Quantity",
                onClick: () => inventory.openEquipmentWriteOff(selectedEquipment.id),
                variant: "primary" as const,
              },
            ]
          : []),
        ...(canManageInventoryCatalog
          ? [
              {
                icon: Plus,
                label: "Add Equipment",
                onClick: inventory.openCreateEquipment,
                variant: "primary" as const,
              },
            ]
          : []),
      ];

  const directoryToolbar = (
    <div style={{ display: "grid", gap: 10, minWidth: 0 }}>
      <div
        className="inventory-directory-toolbar"
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 10,
          minWidth: 0,
          overflowX: "visible",
          overflowY: "visible",
        }}
      >
        <div
          className="inventory-directory-toolbar-left"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            minWidth: 0,
            flex: "1 1 300px",
          }}
        >
          <div
            className="inventory-directory-search"
            style={{ flex: "1 1 300px", minWidth: 0, maxWidth: 520 }}
          >
            <FitSearch
              value={inventory.q}
              onChangeText={inventory.setQ}
              placeholder={
                isRetail
                  ? "Search retail products, categories, or descriptions..."
                  : "Search equipment, units, or descriptions..."
              }
            />
          </div>
        </div>
        <div
          className="inventory-directory-toolbar-right"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "flex-start",
            gap: 8,
            flex: "1 1 440px",
            minWidth: 0,
            marginLeft: 0,
            flexWrap: "wrap",
          }}
        >
          <InventoryModeToggle
            active={isRetail ? "retail" : "equipment"}
            colors={colors}
            onChange={(value) => inventory.setTab(value)}
          />
          {isRetail ? (
            <>
              <InventoryFilterSelect
                ariaLabel="Filter retail inventory by category"
                colors={colors}
                value={inventory.retailCategoryFilter}
                options={INVENTORY_CATEGORY_FILTER_OPTIONS}
                onChange={(value) =>
                  inventory.setRetailCategoryFilter(
                    value as typeof inventory.retailCategoryFilter,
                  )
                }
              />
              <InventoryFilterSelect
                ariaLabel="Filter retail inventory by stock"
                colors={colors}
                value={inventory.retailStockFilter}
                options={RETAIL_STOCK_FILTER_OPTIONS}
                onChange={(value) =>
                  inventory.setRetailStockFilter(
                    value as typeof inventory.retailStockFilter,
                  )
                }
              />
                  <InventoryFilterSelect
      ariaLabel="Filter retail inventory by archive status"
      colors={colors}
      options={INVENTORY_ARCHIVE_FILTER_OPTIONS}
      value={inventory.retailArchiveFilter}
      onChange={(value) =>
        inventory.setRetailArchiveFilter(value as typeof inventory.retailArchiveFilter)
      }
    />
    <InventoryFilterSelect
                ariaLabel="Filter retail revenue window"
                colors={colors}
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
            <>
              <InventoryFilterSelect
              ariaLabel="Filter equipment inventory by status"
              colors={colors}
              value={inventory.equipmentStatusFilter}
              options={EQUIPMENT_STATUS_FILTER_OPTIONS}
              onChange={(value) =>
                inventory.setEquipmentStatusFilter(
                  value as typeof inventory.equipmentStatusFilter,
                )
              }
            />
    <InventoryFilterSelect
      ariaLabel="Filter equipment by archive status"
      colors={colors}
      options={INVENTORY_ARCHIVE_FILTER_OPTIONS}
      value={inventory.equipmentArchiveFilter}
      onChange={(value) =>
        inventory.setEquipmentArchiveFilter(value as typeof inventory.equipmentArchiveFilter)
      }
    />
            </>
          )}
        </div>
        {!isRetail ? (
          <div
            role="group"
            aria-label="Equipment condition counts"
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 6,
              minWidth: 0
            }}
          >
            {(["Available", "Under Maintenance", "Broken", "Missing"] as const).map(
              (status) => {
                const tone =
                  status === "Available"
                    ? colors.success
                    : status === "Under Maintenance"
                      ? colors.warning
                      : colors.danger;

                return (
                  <div
                    key={status}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 6,
                      minHeight: 28,
                      padding: "5px 8px",
                      borderRadius: 7,
                      border: `1px solid ${tone}44`,
                      backgroundColor: `${tone}12`
                    }}
                  >
                    <FitText style={{ fontSize: 10.5, color: colors.textPrimary }}>
                      {status}
                    </FitText>
                    <FitText style={{ fontSize: 12, fontWeight: 850, color: tone }}>
                      {inventory.equipmentStatusCounts[status]}
                    </FitText>
                  </div>
                );
              }
            )}
          </div>
        ) : null}
      </div>

      {isCompactDetail && inspectorCommandActions.length > 0 ? (
        <InventoryInspectorCommandRow actions={inspectorCommandActions} colors={colors} />
      ) : null}
    </div>
  );

  return (
    <div
      className="inventory-directory-stage"
      style={{
        display: "grid",
        gap: 12,
        gridTemplateColumns: isCompactDetail
          ? "minmax(0, 1fr)"
          : "minmax(0, 1fr) minmax(284px, 0.36fr)",
        alignItems: "stretch",
        height: isCompactDetail ? "auto" : "calc(100vh - 154px)",
        minHeight: isCompactDetail ? 0 : 600,
        minWidth: 0,
        width: "100%",
        borderRadius: 8,
      }}
    >
      {isRetail ? (
        <InventoryDirectoryPanel
          activeRowId={selectedRetail?.id}
          ariaLabel="Retail inventory"
          colors={colors}
          columns={retailColumns}
          currentPage={retailPage}
          emptyMessage="No retail items match this view."
          filteredCount={inventory.filteredRetailProducts.length}
          gridTemplateColumns={RETAIL_GRID_TEMPLATE}
          isLoading={inventory.isRetailLoading}
          loadingMessage="Loading live retail inventory..."
          minWidth={900}
          onPageChange={setRetailPage}
          onRowClick={(product) => inventory.openRetailDetails(product.id)}
          pageSize={INVENTORY_PAGE_SIZE}
          renderMobileCard={(product, isActive) => (
            <RetailInventoryMobileCard
              colors={colors}
              isActive={isActive}
              product={product}
            />
          )}
          rows={retailRows}
          toolbar={directoryToolbar}
          totalPages={retailTotalPages}
        />
      ) : (
        <InventoryDirectoryPanel
          activeRowId={selectedEquipment?.rowId}
          ariaLabel="Equipment inventory"
          colors={colors}
          columns={equipmentColumns}
          currentPage={equipmentPage}
          emptyMessage="No equipment items match this view."
          filteredCount={inventory.filteredEquipmentItems.length}
          gridTemplateColumns={EQUIPMENT_GRID_TEMPLATE}
          isLoading={inventory.isEquipmentLoading}
          loadingMessage="Loading live equipment inventory..."
          minWidth={840}
          onPageChange={setEquipmentPage}
          onRowClick={(equipment) =>
            inventory.openEquipmentDetails(equipment.id, equipment.status)
          }
          pageSize={INVENTORY_PAGE_SIZE}
          getRowBackgroundColor={(equipment) =>
            getEquipmentStatusRowBackground(equipment.status, colors)
          }
          getRowKey={(equipment) => equipment.rowId}
          renderMobileCard={(equipment, isActive) => (
            <EquipmentInventoryMobileCard
              colors={colors}
              equipment={equipment}
              isActive={isActive}
            />
          )}
          rows={equipmentRows}
          toolbar={directoryToolbar}
          totalPages={equipmentTotalPages}
        />
      )}

      {!isCompactDetail ? (
        <div
          className="inventory-directory-inspector"
          style={{
            display: "grid",
            gridTemplateRows: "auto minmax(0, 1fr)",
            gap: 10,
            height: "100%",
            minHeight: 0,
          }}
        >
          {inspectorCommandActions.length > 0 ? (
            <InventoryInspectorCommandRow actions={inspectorCommandActions} colors={colors} />
          ) : null}
          {isRetail ? (
            <InventoryInspectorPanel
              ariaLabel="Retail inventory details"
              colors={colors}
              footer={
                selectedRetail ? (
                  <InventoryInspectorFooter
                    colors={colors}
                    actions={[
                      ...(canPerformInventoryOperations
                        ? [
                            {
                              icon: RefreshCw,
                              label: "Restock Item",
                              onClick: () => inventory.openRetailRestock(selectedRetail.id),
                              variant: "ghost" as const,
                            },
                          ]
                        : []),
                      ...(canManageInventoryCatalog
                        ? [
                            {
                              icon: Edit3,
                              label: "Edit Details",
                              onClick: () => onOpenDetailEditor("retail"),
                              variant: "ghost" as const,
                            },
                            {
                              fullWidth: true,
                              icon: selectedRetail.isActive ? Archive : RefreshCw,
                              label: selectedRetail.isActive ? "Archive Item" : "Restore Item",
                              onClick: () => {
                                if (selectedRetail.isActive) {
                                  inventory.openRetailArchive(selectedRetail.id);
                                } else {
                                  void inventory.handleRestoreRetail();
                                }
                              },
                              variant: selectedRetail.isActive
                                ? ("danger" as const)
                                : ("primary" as const),
                            },
                          ]
                        : []),
                    ]}
                  />
                ) : null
              }
            >
              {selectedRetail ? (
                <RetailDetailCard colors={colors} product={selectedRetail} />
              ) : (
                <EmptyDetailCard
                  colors={colors}
                  copy="Select a retail row to inspect stock, pricing, image, and sale actions here."
                  title="No retail item selected"
                />
              )}
            </InventoryInspectorPanel>
          ) : (
            <InventoryInspectorPanel
              ariaLabel="Equipment inventory details"
              colors={colors}
              footer={
                selectedEquipment ? (
                  <InventoryInspectorFooter
                    colors={colors}
                    actions={[
                      ...(canPerformInventoryOperations
                        ? [
                            {
                              icon: Wrench,
                              label: "Move Quantity",
                              onClick: () => inventory.openEquipmentWriteOff(selectedEquipment.id),
                              variant: "primary" as const,
                            },
                          ]
                        : []),
                      ...(canManageInventoryCatalog
                        ? [
                            {
                              icon: Edit3,
                              label: "Edit Details",
                              onClick: () => onOpenDetailEditor("equipment"),
                              variant: "ghost" as const,
                            },
                            {
                              fullWidth: true,
                              icon: selectedEquipment.isActive ? Archive : RefreshCw,
                              label: selectedEquipment.isActive
                                ? "Archive Equipment"
                                : "Restore Equipment",
                              onClick: () => {
                                if (selectedEquipment.isActive) {
                                  inventory.openEquipmentArchive(selectedEquipment.id, selectedEquipment.status);
                                } else {
                                  void inventory.handleRestoreEquipment();
                                }
                              },
                              variant: selectedEquipment.isActive
                                ? ("danger" as const)
                                : ("primary" as const),
                            },
                          ]
                        : []),
                    ]}
                  />
                ) : null
              }
            >
              {selectedEquipment ? (
                <EquipmentDetailCard colors={colors} equipment={selectedEquipment} />
              ) : (
                <EmptyDetailCard
                  colors={colors}
                  copy="Select an equipment row to inspect status, quantities, images, and write-off actions here."
                  title="No equipment selected"
                />
              )}
            </InventoryInspectorPanel>
          )}
        </div>
      ) : null}

      <style>{`
        @media (max-width: ${INVENTORY_COMPACT_BREAKPOINT}px) {
          .inventory-directory-stage {
            grid-template-columns: 1fr !important;
            height: auto !important;
            min-height: 0 !important;
          }

          .inventory-directory-inspector {
            display: none !important;
          }

          .inventory-directory-toolbar {
            align-items: stretch !important;
            flex-wrap: wrap !important;
            overflow: visible !important;
          }

          .inventory-directory-toolbar-left,
          .inventory-directory-toolbar-right,
          .inventory-directory-search {
            width: 100% !important;
            max-width: none !important;
          }
        }

        @media (max-width: 760px) {
          .inventory-directory-toolbar-left,
          .inventory-directory-toolbar-right {
            display: grid !important;
            grid-template-columns: 1fr !important;
          }

          .inventory-directory-toolbar-right > *,
          .inventory-filter-select {
            width: 100% !important;
          }
        }
      `}</style>
    </div>
  );
}

function getInventoryColumnJustify<T>(column: FitTableColumn<T>) {
  if (column.align === "center") return "center";
  if (column.align === "right") return "end";
  return "start";
}

function InventoryDirectoryPanel<T extends { id: string }>({
  activeRowId,
  ariaLabel,
  colors,
  columns,
  currentPage,
  emptyMessage,
  filteredCount,
  gridTemplateColumns,
  isLoading,
  loadingMessage,
  minWidth,
  onPageChange,
  onRowClick,
  pageSize,
  getRowBackgroundColor,
  getRowKey,
  renderMobileCard,
  rows,
  toolbar,
  totalPages,
}: {
  activeRowId?: string;
  ariaLabel: string;
  colors: IThemeContext["colors"];
  columns: FitTableColumn<T>[];
  currentPage: number;
  emptyMessage: string;
  filteredCount: number;
  gridTemplateColumns: string;
  isLoading: boolean;
  loadingMessage: string;
  minWidth: number;
  onPageChange: (page: number) => void;
  onRowClick: (row: T) => void;
  pageSize: number;
  getRowBackgroundColor?: (row: T) => string;
  getRowKey?: (row: T) => string;
  renderMobileCard: (row: T, isActive: boolean) => ReactNode;
  rows: T[];
  toolbar: ReactNode;
  totalPages: number;
}) {
  const rowKeyFor = getRowKey ?? ((row: T) => row.id);
  const pageStart = filteredCount === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const pageEnd = filteredCount === 0 ? 0 : Math.min(filteredCount, currentPage * pageSize);
  const handleRowKeyDown = (event: KeyboardEvent<HTMLDivElement>, row: T) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    onRowClick(row);
  };

  return (
    <section
      className="inventory-directory-panel"
      aria-label={ariaLabel}
      style={{
        display: "grid",
        gridTemplateRows: "auto minmax(0, 1fr) auto",
        gap: 0,
        height: "100%",
        minHeight: 0,
        padding: 0,
        borderRadius: 8,
        border: `1px solid ${colors.border}`,
        backgroundColor: `${colors.surface}f2`,
        boxShadow: "none",
        overflow: "hidden",
      }}
    >
      <div
        className="inventory-directory-panel__top"
        style={{
          padding: "14px 12px",
          borderBottom: `1px solid ${colors.border}`,
          backgroundColor: `${colors.surfaceRaised}f5`,
        }}
      >
        {toolbar}
      </div>

      <div
        className="inventory-directory-panel__middle"
        style={{
          display: "grid",
          minHeight: 0,
          padding: 0,
          background: colors.surface,
        }}
      >
        <div
          className="inventory-directory-panel__desktop"
          style={{ display: "grid", minHeight: 0 }}
        >
          {isLoading ? (
            <div
              className="inventory-directory-panel__view-enter"
              style={{ padding: 18, color: colors.textSecondary }}
            >
              <FitText style={{ fontSize: 13, color: colors.textSecondary }}>
                {loadingMessage}
              </FitText>
            </div>
          ) : rows.length > 0 ? (
            <div
              className="inventory-directory-panel__list inventory-directory-panel__view-enter"
              style={{
                display: "grid",
                gridTemplateRows: "auto minmax(0, 1fr)",
                minHeight: 0,
                overflowX: "auto",
              }}
            >
              <div style={{ minWidth, display: "grid", gridTemplateRows: "auto minmax(0, 1fr)", minHeight: 0 }}>
                <div
                  className="inventory-directory-panel__table-head"
                  style={{
                    display: "grid",
                    gap: 12,
                    gridTemplateColumns,
                    padding: "7px 12px 8px",
                    backgroundColor: `${colors.surfaceRaised}bd`,
                    borderBottom: `1px solid ${colors.border}`,
                  }}
                >
                  {columns.map((column) => {
                    const isStockColumn = column.key === "stockQuantity";

                    return (
                      <FitText
                        key={column.key}
                        style={{
                          fontSize: 10.5,
                          fontWeight: 700,
                          color: isStockColumn ? colors.warning : colors.textMuted,
                          letterSpacing: "0.05em",
                          justifySelf: getInventoryColumnJustify(column),
                          textAlign: column.align ?? "left",
                        }}
                      >
                        {column.heading}
                      </FitText>
                    );
                  })}
                </div>
                <div
                  className="inventory-directory-panel__rows"
                  style={{ display: "grid", gap: 0, alignContent: "start", minHeight: 0, overflowY: "auto" }}
                >
                  {rows.map((row, index) => {
                    const isActive = rowKeyFor(row) === activeRowId;

                    return (
                      <div
                        key={rowKeyFor(row)}
                        role="button"
                        tabIndex={0}
                        aria-pressed={isActive}
                        className={
                          isActive
                            ? "inventory-directory-panel__row inventory-directory-panel__row-active"
                            : "inventory-directory-panel__row"
                        }
                        data-row-index={index + 1}
                        onClick={() => onRowClick(row)}
                        onKeyDown={(event) => handleRowKeyDown(event, row)}
                        style={{
                          display: "grid",
                          gap: 12,
                          gridTemplateColumns,
                          alignItems: "center",
                          minHeight: 56,
                          padding: "7px 12px",
                          borderBottom: `1px solid ${colors.border}`,
                          backgroundColor: isActive
                            ? `${colors.brand}12`
                            : getRowBackgroundColor?.(row) ?? "transparent",
                          boxShadow: isActive ? `3px 0 0 ${colors.brand} inset` : "none",
                          cursor: "pointer",
                          outline: "none",
                        }}
                      >
                        {columns.map((column) => (
                          <div
                            key={column.key}
                            className="inventory-directory-panel__cell"
                            style={{
                              justifySelf: getInventoryColumnJustify(column),
                              textAlign: column.align ?? "left",
                              minWidth: 0,
                            }}
                          >
                            {column.render(row, colors)}
                          </div>
                        ))}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          ) : (
            <div
              className="inventory-directory-panel__view-enter"
              style={{
                padding: 18,
                border: `1px dashed ${colors.border}`,
                backgroundColor: `${colors.surface}d8`,
              }}
            >
              <FitText style={{ fontSize: 13, lineHeight: 1.6, color: colors.textSecondary }}>
                {emptyMessage}
              </FitText>
            </div>
          )}
        </div>

        <div className="inventory-directory-panel__mobile" style={{ display: "none", gap: 12 }}>
          {isLoading ? (
            <div style={{ padding: 18, border: `1px solid ${colors.border}`, backgroundColor: `${colors.surface}e2` }}>
              <FitText style={{ fontSize: 13, color: colors.textSecondary }}>
                {loadingMessage}
              </FitText>
            </div>
          ) : rows.length > 0 ? (
            rows.map((row) => {
              const isActive = rowKeyFor(row) === activeRowId;

              return (
                <div
                  key={rowKeyFor(row)}
                  role="button"
                  tabIndex={0}
                  aria-pressed={isActive}
                  className={
                    isActive
                      ? "inventory-directory-panel__mobile-card inventory-directory-panel__mobile-card-active"
                      : "inventory-directory-panel__mobile-card"
                  }
                  onClick={() => onRowClick(row)}
                  onKeyDown={(event) => handleRowKeyDown(event, row)}
                  style={{ cursor: "pointer" }}
                >
                  {renderMobileCard(row, isActive)}
                </div>
              );
            })
          ) : (
            <div style={{ padding: 18, border: `1px dashed ${colors.border}`, backgroundColor: `${colors.surface}d8` }}>
              <FitText style={{ fontSize: 13, lineHeight: 1.6, color: colors.textSecondary }}>
                {emptyMessage}
              </FitText>
            </div>
          )}
        </div>
      </div>

      {!isLoading ? (
        <div
          className="inventory-directory-panel__bottom"
          style={{
            padding: "10px 12px",
            borderTop: `1px solid ${colors.border}`,
            backgroundColor: `${colors.surfaceRaised}f5`,
          }}
        >
          <div
            className="inventory-directory-panel__footer"
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 8,
              flexWrap: "wrap",
            }}
          >
            <FitText style={{ fontSize: 11.5, color: colors.textSecondary }}>
              Showing {pageStart} - {pageEnd} of {filteredCount}
            </FitText>
            <FitPagination
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={onPageChange}
              ariaLabel={`${ariaLabel} pagination`}
              showSinglePage
            />
          </div>
        </div>
      ) : null}

      <style>{`
        @keyframes inventory-directory-view-enter {
          0% {
            opacity: 0;
            transform: translateY(10px);
          }

          100% {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .inventory-directory-panel__view-enter {
          animation: inventory-directory-view-enter 180ms cubic-bezier(0.2, 0.8, 0.2, 1) both;
        }

        .inventory-directory-panel__row {
          transition: background-color 120ms ease, box-shadow 120ms ease;
        }

        .inventory-directory-panel__row:hover {
          background-color: ${colors.brand}0d !important;
          box-shadow: 3px 0 0 ${colors.brand}66 inset;
        }

        .inventory-directory-panel__row:focus-visible {
          outline: 2px solid ${colors.brand}35;
          outline-offset: 2px;
        }

        .inventory-directory-panel__row-active .inventory-directory-panel__primary-text {
          font-weight: 900 !important;
        }

        .inventory-directory-panel__row-active .inventory-directory-panel__secondary-text {
          color: ${colors.textPrimary} !important;
          opacity: 0.94;
        }

        .inventory-directory-panel__cell,
        .inventory-directory-panel__identity-copy {
          min-width: 0;
        }

        .inventory-directory-panel__mobile-card {
          cursor: pointer;
          outline: none;
          transition: filter 140ms ease;
        }

        .inventory-directory-panel__mobile-card:hover {
          filter: brightness(1.02);
        }

        .inventory-directory-panel__mobile-card:hover > .inventory-mobile-card {
          border-color: ${colors.brand}44 !important;
          box-shadow: 0 12px 24px rgba(0, 0, 0, 0.11) !important;
        }

        .inventory-directory-panel__mobile-card-active > .inventory-mobile-card {
          border-color: ${colors.brand}66 !important;
          box-shadow: 0 0 0 1px ${colors.brand}22 inset, 0 16px 30px rgba(0, 0, 0, 0.14) !important;
        }

        @media (max-width: ${INVENTORY_COMPACT_BREAKPOINT}px) {
          .inventory-directory-panel {
            height: auto !important;
            min-height: 0 !important;
          }

          .inventory-directory-panel__desktop {
            display: none !important;
          }

          .inventory-directory-panel__middle {
            padding: 0 !important;
          }

          .inventory-directory-panel__mobile {
            display: grid !important;
            padding: 12px;
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .inventory-directory-panel__view-enter,
          .inventory-directory-panel__row,
          .inventory-directory-panel__mobile-card,
          .inventory-directory-panel__primary-text,
          .inventory-directory-panel__secondary-text,
          .inventory-directory-panel__emphasis-text {
            transition: none !important;
            animation: none !important;
          }
        }

        @media (max-width: 640px) {
          .inventory-directory-panel__footer {
            align-items: flex-start !important;
          }
        }
      `}</style>
    </section>
  );
}

function InventoryMobileStat({
  colors,
  label,
  tone,
  value,
}: {
  colors: IThemeContext["colors"];
  label: string;
  tone?: string;
  value: string;
}) {
  const accent = tone ?? colors.border;

  return (
    <div
      style={{
        display: "grid",
        gap: 4,
        minWidth: 0,
        padding: "9px 10px",
        borderRadius: 8,
        border: `1px solid ${tone ? `${accent}55` : colors.border}`,
        backgroundColor: tone ? `${accent}18` : colors.surfaceRaised,
      }}
    >
      <FitText style={{ fontSize: 9.5, fontWeight: 850, color: colors.textMuted, letterSpacing: "0.04em" }}>
        {label}
      </FitText>
      <FitText style={{ fontSize: 12, fontWeight: tone ? 900 : 750, color: tone ?? colors.textSecondary, overflowWrap: "anywhere" }}>
        {value}
      </FitText>
    </div>
  );
}

function RetailInventoryMobileCard({
  colors,
  isActive,
  product,
}: {
  colors: IThemeContext["colors"];
  isActive: boolean;
  product: InventoryRetailTableRow;
}) {
  const imageUrl = getInventoryImageUrl(product.imageUrl);
  const FallbackIcon = getRetailFallbackIcon(product.category);

  return (
    <div
      className="inventory-mobile-card"
      style={{
        display: "grid",
        gap: 12,
        padding: 12,
        borderRadius: 8,
        border: `1px solid ${isActive ? `${colors.brand}66` : colors.border}`,
        backgroundColor: isActive ? `${colors.brand}10` : colors.surface,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
        <InventoryThumb
          alt={product.name}
          colors={colors}
          fallbackIcon={FallbackIcon}
          imageUrl={imageUrl}
        />
        <div style={{ display: "grid", gap: 4, minWidth: 0, flex: 1 }}>
          <FitText className="inventory-directory-panel__primary-text" style={{ fontSize: 13, fontWeight: 850, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {product.name}
          </FitText>
          <FitText className="inventory-directory-panel__secondary-text" style={{ fontSize: 11, color: colors.textSecondary, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {formatLabel(product.category)} / {product.id.slice(0, 8).toUpperCase()}
          </FitText>
        </div>
        <FitPill mode="status" label={product.status} color={RETAIL_STOCK_STATUS_COLOR[product.status]} fontSize={11} />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 8 }}>
        <InventoryMobileStat colors={colors} label="Stock" tone={colors.warning} value={String(product.stockQuantity)} />
        <InventoryMobileStat colors={colors} label="Reorder" value={String(product.reorderThreshold)} />
        <InventoryMobileStat colors={colors} label="Price" value={`PHP ${product.price.toLocaleString("en-PH", { minimumFractionDigits: 2 })}`} />
        <InventoryMobileStat colors={colors} label="Value" value={`PHP ${product.totalValue.toLocaleString("en-PH", { minimumFractionDigits: 2 })}`} />
      </div>
    </div>
  );
}

function EquipmentInventoryMobileCard({
  colors,
  equipment,
  isActive,
}: {
  colors: IThemeContext["colors"];
  equipment: InventoryEquipmentTableRow;
  isActive: boolean;
}) {
  const imageUrl = getInventoryImageUrl(equipment.imageUrl);
  const FallbackIcon = getEquipmentFallbackIcon(equipment.name);

  return (
    <div
      className="inventory-mobile-card"
      style={{
        display: "grid",
        gap: 12,
        padding: 12,
        borderRadius: 8,
        border: `1px solid ${isActive ? `${colors.brand}66` : colors.border}`,
        backgroundColor: isActive
          ? `${colors.brand}10`
          : getEquipmentStatusRowBackground(equipment.status, colors),
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
        <InventoryThumb
          alt={equipment.name}
          colors={colors}
          fallbackIcon={FallbackIcon}
          imageUrl={imageUrl}
        />
        <div style={{ display: "grid", gap: 4, minWidth: 0, flex: 1 }}>
          <FitText className="inventory-directory-panel__primary-text" style={{ fontSize: 13, fontWeight: 850, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {equipment.name}
          </FitText>
          <FitText className="inventory-directory-panel__secondary-text" style={{ fontSize: 11, color: colors.textSecondary }}>
            {equipment.id.slice(0, 8).toUpperCase()}
          </FitText>
        </div>
        <FitPill mode="status" label={equipment.status} color={EQUIPMENT_STATUS_COLOR[equipment.status]} fontSize={11} />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 8 }}>
        <InventoryMobileStat
          colors={colors}
          label="Status Qty"
          tone={EQUIPMENT_STATUS_COLOR[equipment.status]}
          value={String(equipment.statusQuantity)}
        />
        <InventoryMobileStat colors={colors} label="Total" value={String(equipment.quantityTotal)} />
        <InventoryMobileStat
          colors={colors}
          label="Placeable"
          value={String(equipment.remainingPlaceableQuantity)}
        />
        <InventoryMobileStat colors={colors} label="Unit" value={equipment.unit} />
      </div>
    </div>
  );
}

function InventoryThumb({
  alt,
  colors,
  fallbackIcon: FallbackIcon,
  imageUrl,
}: {
  alt: string;
  colors: IThemeContext["colors"];
  fallbackIcon: LucideIcon;
  imageUrl: string | null | undefined;
}) {
  return (
    <div
      style={{
        width: 38,
        height: 38,
        borderRadius: 8,
        border: `1px solid ${colors.border}`,
        backgroundColor: colors.surfaceRaised,
        display: "grid",
        placeItems: "center",
        overflow: "hidden",
        flexShrink: 0,
      }}
    >
      <InventoryImage
        alt={alt}
        fallback={<FallbackIcon size={17} color={colors.brand} />}
        imageUrl={imageUrl}
      />
    </div>
  );
}

function InventoryInspectorCommandRow({
  actions,
  colors,
}: {
  actions: InventoryInspectorAction[];
  colors: IThemeContext["colors"];
}) {
  return (
    <div
      className="inventory-inspector-command-row"
      style={{
        display: "grid",
        gridTemplateColumns: actions.length > 1 ? "repeat(2, minmax(0, 1fr))" : "minmax(0, 1fr)",
        gap: 8,
        padding: 10,
        borderRadius: 8,
        border: `1px solid ${colors.border}`,
        backgroundColor: `${colors.surfaceRaised}f5`,
      }}
    >
      {actions.map((action) => (
        <FitButton
          key={action.label}
          variant={action.variant}
          label={action.label.toUpperCase()}
          icon={action.icon}
          iconSize={14}
          fullWidth
          disabled={action.disabled}
          onClick={action.onClick}
          style={{
            minHeight: 38,
            borderRadius: 8,
            paddingInline: 10,
            gridColumn: action.fullWidth ? "1 / -1" : undefined,
          }}
          textStyle={{ fontSize: 10.75, fontWeight: 850, whiteSpace: "nowrap" }}
        />
      ))}
    </div>
  );
}

function InventoryInspectorPanel({
  ariaLabel,
  children,
  colors,
  footer,
}: {
  ariaLabel: string;
  children?: ReactNode;
  colors: IThemeContext["colors"];
  footer?: ReactNode;
}) {
  return (
    <aside
      className="inventory-inspector-panel"
      aria-label={ariaLabel}
      style={{
        display: "grid",
        gridTemplateRows: "minmax(0, 1fr) auto",
        gap: 0,
        height: "100%",
        minHeight: 0,
        padding: 0,
        borderRadius: 8,
        border: `1px solid ${colors.border}`,
        backgroundColor: colors.surface,
        boxShadow: "none",
        overflow: "hidden",
      }}
    >
      {children ? <div className="inventory-inspector-panel__body">{children}</div> : null}
      {footer ? <div className="inventory-inspector-panel__footer">{footer}</div> : null}

      <style>{`
        .inventory-inspector-panel__body {
          display: grid;
          align-content: start;
          gap: 12px;
          min-height: 0;
          overflow: hidden;
          padding: 18px;
          background: ${colors.surface};
        }

        .inventory-inspector-panel__footer {
          display: grid;
          gap: 10px;
          padding: 16px 18px 18px;
          border-top: 1px solid ${colors.border};
          background-color: ${colors.surfaceRaised};
        }
      `}</style>
    </aside>
  );
}

function InventoryInspectorFooter({
  actions,
  colors,
}: {
  actions: InventoryInspectorAction[];
  colors: IThemeContext["colors"];
}) {
  const [actionsOpen, setActionsOpen] = useState(false);
  const actionButtonTextStyle: CSSProperties = {
    fontSize: 10.5,
    fontWeight: 800,
    lineHeight: 1.1,
    whiteSpace: "normal",
    textAlign: "center",
  };

  return (
    <div style={{ display: "grid", gap: 8 }}>
      <div
        style={{
          display: "grid",
          gap: 8,
          maxHeight: actionsOpen ? 320 : 0,
          opacity: actionsOpen ? 1 : 0,
          overflowX: "hidden",
          overflowY: actionsOpen ? "auto" : "hidden",
          pointerEvents: actionsOpen ? "auto" : "none",
          transform: actionsOpen ? "translateY(0)" : "translateY(12px)",
          transformOrigin: "bottom center",
          transition: `max-height 240ms ease, opacity 180ms ease, transform 240ms ease, visibility 0ms linear ${
            actionsOpen ? "0ms" : "240ms"
          }`,
          visibility: actionsOpen ? "visible" : "hidden",
        }}
      >
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 8 }}>
          {actions.map((action) => (
            <FitButton
              key={action.label}
              variant={action.variant}
              label={action.label}
              icon={action.icon}
              iconSize={13}
              fullWidth
              disabled={action.disabled}
              onClick={action.onClick}
              style={{
                minHeight: 36,
                borderRadius: 8,
                paddingInline: 8,
                gridColumn: action.fullWidth ? "1 / -1" : undefined,
              }}
              textStyle={actionButtonTextStyle}
            />
          ))}
        </div>
      </div>
      <FitButton
        variant="ghost"
        aria-expanded={actionsOpen}
        onClick={() => setActionsOpen((current) => !current)}
        style={{
          border: `1px solid ${actionsOpen ? colors.brand : colors.border}`,
          backgroundColor: actionsOpen ? `${colors.brand}12` : colors.surface,
          color: colors.brand,
          minHeight: 44,
          borderRadius: 8,
        }}
        textStyle={{ color: colors.brand, fontWeight: 850, letterSpacing: "0.04em" }}
      >
        <span style={{ alignItems: "center", display: "inline-flex", gap: 8, justifyContent: "center", lineHeight: 1 }}>
          <span>{actionsOpen ? "CLOSE ACTIONS" : "OPEN ACTIONS"}</span>
          <ChevronUp
            size={15}
            strokeWidth={2.4}
            style={{
              transform: actionsOpen ? "rotate(180deg)" : "rotate(0deg)",
              transition: "transform 180ms ease",
            }}
          />
        </span>
      </FitButton>
    </div>
  );
}

function InventoryFilterSelect({
  ariaLabel,
  colors,
  onChange,
  options,
  value,
}: {
  ariaLabel: string;
  colors: IThemeContext["colors"];
  onChange: (value: string) => void;
  options: Array<{ label: string; value: string }>;
  value: string;
}) {
  const selectedLabel = options.find((option) => option.value === value)?.label ?? value;
  const combinedAriaLabel = ariaLabel
    .toLowerCase()
    .includes(selectedLabel.toLowerCase())
    ? ariaLabel
    : `${ariaLabel}: ${selectedLabel}`;

  return (
    <div
      className="inventory-filter-select"
      style={{
        display: "grid",
        gridTemplateColumns: "14px minmax(150px, 190px)",
        alignItems: "center",
        gap: 6,
        minWidth: 0,
      }}
    >
      <Filter size={14} color={colors.textMuted} strokeWidth={2} />
      <FitSelect
        aria-label={combinedAriaLabel}
        fullWidth
        compact
        value={value}
        options={options}
        onChange={(event) => onChange(event.currentTarget.value)}
        style={{
          width: "100%",
          minWidth: 0,
          height: 38,
          borderRadius: 8,
          paddingLeft: 8,
          paddingRight: 22,
          fontSize: 12,
        }}
      />
    </div>
  );
}

function InventoryModeToggle({
  active,
  colors,
  onChange,
}: {
  active: "retail" | "equipment";
  colors: IThemeContext["colors"];
  onChange: (value: "retail" | "equipment") => void;
}) {
  const options: Array<{
    icon: LucideIcon;
    label: string;
    value: "retail" | "equipment";
  }> = [
    { icon: ShoppingBag, label: "Retail inventory", value: "retail" },
    { icon: Dumbbell, label: "Equipment inventory", value: "equipment" },
  ];

  return (
    <div
      className="inventory-mode-toggle"
      style={{
        display: "inline-flex",
        gap: 4,
        padding: 4,
        borderRadius: 10,
        backgroundColor: colors.surfaceRaised,
        border: `1px solid ${colors.border}`,
        flex: "0 0 auto",
      }}
    >
      {options.map((option) => {
        const isActive = active === option.value;
        return (
          <FitButton
            key={option.value}
            aria-label={option.label}
            title={option.label}
            variant={isActive ? "primary" : "ghost"}
            icon={option.icon}
            iconOnly
            iconSize={15}
            onClick={() => onChange(option.value)}
            style={{
              minHeight: 32,
              width: 34,
              padding: 0,
              borderRadius: 7,
              border: `1px solid ${isActive ? `${colors.brand}55` : "transparent"}`,
              backgroundColor: isActive ? `${colors.brand}18` : "transparent",
              color: isActive ? colors.brand : colors.textSecondary,
              flex: "0 0 auto",
            }}
          />
        );
      })}
    </div>
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
    <div style={{ display: "grid", gap: 12, alignContent: "start", textAlign: "center" }}>
      <FitText style={{ fontSize: 16, fontWeight: 850 }}>{title}</FitText>
      <FitText style={{ color: colors.textMuted, fontSize: 13, lineHeight: 1.55 }}>
        {copy}
      </FitText>
    </div>
  );
}

function RetailDetailCard({
  colors,
  product,
}: {
  colors: IThemeContext["colors"];
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
    </DetailCardShell>
  );
}

function EquipmentDetailCard({
  colors,
  equipment,
}: {
  colors: IThemeContext["colors"];
  equipment: InventoryEquipmentTableRow;
}) {
  const imageUrl = getInventoryImageUrl(equipment.imageUrl);
  const formatKnownCount = (value: number | null | undefined) =>
    typeof value === "number" ? String(value) : "—";

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
          ["Status Qty", String(equipment.statusQuantity)],
          ["Available", String(equipment.statusCounts.available ?? equipment.quantityCurrent)],
          ["Under Maintenance", formatKnownCount(equipment.statusCounts.maintenance)],
          ["Broken", formatKnownCount(equipment.statusCounts.broken)],
          ["Missing", formatKnownCount(equipment.statusCounts.missing)],
          ["Total", String(equipment.quantityTotal)],
          ["Unit", equipment.unit],
          ["Status", equipment.status],
        ]}
      />
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
          width: 74,
          height: 74,
          borderRadius: 8,
          border: `1px solid ${colors.border}`,
          backgroundColor: colors.surfaceRaised,
          display: "grid",
          placeItems: "center",
          justifySelf: "center",
          overflow: "hidden",
        }}
      >
        <InventoryImage
          alt={imageAlt}
          fallback={<Package size={26} color={colors.textMuted} />}
          imageUrl={imageUrl}
        />
      </div>
      <div style={{ display: "grid", gap: 8, justifyItems: "center", textAlign: "center" }}>
        <div style={{ display: "grid", justifyItems: "center", gap: 7, minWidth: 0 }}>
          <FitText style={{ fontSize: 16, fontWeight: 850, lineHeight: 1.22, overflowWrap: "anywhere" }}>
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
        gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 150px), 1fr))",
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
              overflowWrap: "break-word",
            }}
          >
            {value}
          </FitText>
        </div>
      ))}
    </div>
  );
}
