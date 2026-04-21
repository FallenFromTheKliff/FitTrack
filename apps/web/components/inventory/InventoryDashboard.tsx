"use client";

import { Archive, RefreshCw } from "lucide-react";

import { useTheme } from "@/contexts/ThemeContext";
import { useFadeIn } from "@/hooks/animations/useFadeIn";
import { useThemeTransition } from "@/hooks/animations/useThemeTransition";
import { dashboardStyles } from "@/styles/pageStyles";
import {
  EQUIPMENT_STATUS_COLOR,
  INVENTORY_EQUIPMENT_CREATE_FIELDS,
  INVENTORY_EQUIPMENT_EDIT_FIELDS,
  INVENTORY_EQUIPMENT_WRITEOFF_FIELDS,
  INVENTORY_RETAIL_PRODUCT_FIELDS,
  INVENTORY_RETAIL_RESTOCK_FIELDS,
  RETAIL_STOCK_STATUS_COLOR
} from "@/data/inventory/inventory";
import FitButton from "@/components/fit/FitButton";
import FitPill from "@/components/fit/FitPill";
import FitSection from "@/components/fit/FitSection";
import { FitText } from "@/components/fit/FitText";
import { ConfirmModal, DetailsModal } from "@/components/modals";
import { InventoryKpiSidebar } from "@/components/inventory/InventoryKpiSidebar";
import { InventoryMainPanel } from "@/components/inventory/InventoryMainPanel";
import { useInventoryDashboard } from "@/hooks/inventory/useInventoryDashboard";

function formatLabel(value: string) {
  return value
    .split(/[_-]/g)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function formatActorName(
  actor:
    | {
        firstName: string | null;
        lastName: string | null;
      }
    | null
) {
  if (!actor) return "Staff";

  return `${actor.firstName ?? ""} ${actor.lastName ?? ""}`.trim() || "Staff";
}

export function InventoryDashboard() {
  const { colors } = useTheme();
  const styles = dashboardStyles(colors);
  const fadeIn = useFadeIn();
  const themeTransition = useThemeTransition();
  const inventory = useInventoryDashboard();

  const retailDetailValues = inventory.selectedRetail
    ? {
        name: inventory.selectedRetail.name,
        category: inventory.selectedRetail.category,
        description: inventory.selectedRetail.description ?? "",
        price: String(inventory.selectedRetail.price),
        stockQuantity: String(inventory.selectedRetail.stockQuantity),
        reorderThreshold: String(inventory.selectedRetail.reorderThreshold),
        imageUrl: inventory.selectedRetail.imageUrl ?? ""
      }
    : undefined;

  const equipmentDetailValues = inventory.selectedEquipment
    ? {
        name: inventory.selectedEquipment.name,
        description: inventory.selectedEquipment.description ?? "",
        unit: inventory.selectedEquipment.unit
      }
    : undefined;

  return (
    <FitSection
      as="section"
      heading=""
      hideHeading
      bare
      noPadding
      className={themeTransition}
      style={fadeIn}
    >
      {inventory.message ? (
        <div style={{ marginBottom: 12, display: "flex", justifyContent: "flex-end" }}>
          <FitText style={{ fontSize: 13, color: colors.success, fontWeight: 500 }}>
            {inventory.message}
          </FitText>
        </div>
      ) : null}

      <div
        className="inventory-grid"
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(220px, 260px) 1fr",
          gap: 20,
          alignItems: "start"
        }}
      >
        <InventoryKpiSidebar colors={colors} inventory={inventory} styles={styles} />
        <InventoryMainPanel colors={colors} inventory={inventory} />
      </div>

      <DetailsModal
        isOpen={inventory.createRetailOpen}
        title="Add Retail Product"
        subtitle="Create a retail item with category and stock thresholds."
        fields={INVENTORY_RETAIL_PRODUCT_FIELDS}
        initialValues={{
          category: "other",
          description: "",
          imageUrl: "",
          name: "",
          price: "",
          reorderThreshold: "10",
          stockQuantity: "0"
        }}
        submitLabel={inventory.createRetailPending ? "ADDING PRODUCT..." : "ADD PRODUCT"}
        isLoading={inventory.createRetailPending}
        onSubmit={inventory.handleCreateRetail}
        onCancel={() => inventory.setCreateRetailOpen(false)}
      />

      <DetailsModal
        isOpen={inventory.retailDetailOpen}
        title="Retail Item Details"
        subtitle={inventory.selectedRetail?.name ?? "Retail item"}
        fields={INVENTORY_RETAIL_PRODUCT_FIELDS}
        initialValues={retailDetailValues}
        submitLabel={inventory.updateRetailPending ? "SAVING..." : "SAVE CHANGES"}
        isLoading={inventory.updateRetailPending}
        dangerLabel="ARCHIVE ITEM"
        dangerIcon={Archive}
        dangerDisabled={!inventory.selectedRetail}
        onDanger={() => {
          if (!inventory.selectedRetail) return;
          inventory.closeRetailDetails();
          inventory.openRetailArchive(inventory.selectedRetail.id);
        }}
        onSubmit={inventory.handleUpdateRetail}
        onCancel={inventory.closeRetailDetails}
      >
        {inventory.selectedRetail ? (
          <div
            style={{
              marginTop: 12,
              padding: 14,
              borderRadius: 16,
              border: `1px solid ${colors.border}`,
              backgroundColor: colors.surface
            }}
          >
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <FitPill
                mode="status"
                label={inventory.selectedRetail.status}
                color={RETAIL_STOCK_STATUS_COLOR[inventory.selectedRetail.status]}
                fontSize={12}
              />
              <FitPill
                mode="status"
                label={formatLabel(inventory.selectedRetail.category)}
                color={colors.brand}
                fontSize={12}
              />
            </div>
            <FitText style={{ fontSize: 13, color: colors.textMuted, marginTop: 10 }}>
              Only retail items trigger low-stock notifications. Use this flow to manage
              pricing, stock thresholds, and catalog visibility.
            </FitText>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
                gap: 10,
                marginTop: 12
              }}
            >
              <div style={{ padding: 10, borderRadius: 12, backgroundColor: colors.surfaceRaised }}>
                <FitText style={{ fontSize: 12, color: colors.textMuted }}>Current Stock</FitText>
                <FitText style={{ fontSize: 18, fontWeight: 700 }}>
                  {inventory.selectedRetail.stockQuantity}
                </FitText>
              </div>
              <div style={{ padding: 10, borderRadius: 12, backgroundColor: colors.surfaceRaised }}>
                <FitText style={{ fontSize: 12, color: colors.textMuted }}>Reorder At</FitText>
                <FitText style={{ fontSize: 18, fontWeight: 700 }}>
                  {inventory.selectedRetail.reorderThreshold}
                </FitText>
              </div>
              <div style={{ padding: 10, borderRadius: 12, backgroundColor: colors.surfaceRaised }}>
                <FitText style={{ fontSize: 12, color: colors.textMuted }}>Inventory Value</FitText>
                <FitText style={{ fontSize: 18, fontWeight: 700 }}>
                  PHP{" "}
                  {inventory.selectedRetail.totalValue.toLocaleString("en-PH", {
                    maximumFractionDigits: 0
                  })}
                </FitText>
              </div>
            </div>
            <FitButton
              variant="ghost"
              label="RESTOCK ITEM"
              icon={RefreshCw}
              fullWidth
              onClick={() => {
                if (!inventory.selectedRetail) return;
                inventory.closeRetailDetails();
                inventory.openRetailRestock(inventory.selectedRetail.id);
              }}
              style={{ marginTop: 12 }}
            />
          </div>
        ) : inventory.productDetailLoading ? (
          <FitText style={{ fontSize: 13, color: colors.textMuted, marginTop: 12 }}>
            Loading retail item details...
          </FitText>
        ) : null}
      </DetailsModal>

      <DetailsModal
        isOpen={inventory.retailRestockOpen}
        title="Restock Retail Item"
        subtitle={inventory.restockRetailTarget?.name ?? "Retail item"}
        fields={INVENTORY_RETAIL_RESTOCK_FIELDS}
        initialValues={{ notes: "", quantity: "1" }}
        submitLabel={inventory.retailRestockPending ? "RESTOCKING..." : "RESTOCK ITEM"}
        isLoading={inventory.retailRestockPending}
        onSubmit={inventory.handleRestockRetail}
        onCancel={inventory.closeRetailRestock}
      />

      <ConfirmModal
        isOpen={inventory.archiveRetailOpen}
        title="Archive Retail Item"
        message={`Archive ${inventory.archiveRetailTarget?.name ?? "this retail item"} from the live catalog? Sales history stays intact, but the item will no longer appear as active inventory.`}
        confirmLabel="ARCHIVE ITEM"
        loadingLabel="ARCHIVING ITEM"
        confirmIcon={Archive}
        isDanger
        isLoading={inventory.archiveRetailPending}
        onConfirm={() => {
          void inventory.handleArchiveRetail();
        }}
        onCancel={inventory.closeRetailArchive}
      />

      <DetailsModal
        isOpen={inventory.createEquipmentOpen}
        title="Add Equipment Item"
        subtitle="Track operational equipment separately from retail stock."
        fields={INVENTORY_EQUIPMENT_CREATE_FIELDS}
        initialValues={{
          description: "",
          name: "",
          quantityCurrent: "0",
          quantityTotal: "0",
          unit: "units"
        }}
        submitLabel={inventory.createEquipmentPending ? "ADDING EQUIPMENT..." : "ADD EQUIPMENT"}
        isLoading={inventory.createEquipmentPending}
        onSubmit={inventory.handleCreateEquipment}
        onCancel={() => inventory.setCreateEquipmentOpen(false)}
      />

      <DetailsModal
        isOpen={inventory.selectedEquipment !== null}
        title="Equipment Details"
        subtitle={inventory.selectedEquipment?.name ?? "Equipment item"}
        fields={INVENTORY_EQUIPMENT_EDIT_FIELDS}
        initialValues={equipmentDetailValues}
        submitLabel={inventory.updateEquipmentPending ? "SAVING..." : "SAVE CHANGES"}
        isLoading={inventory.updateEquipmentPending}
        dangerLabel="ARCHIVE EQUIPMENT"
        dangerIcon={Archive}
        dangerDisabled={!inventory.selectedEquipment}
        onDanger={() => {
          if (!inventory.selectedEquipment) return;
          inventory.closeEquipmentDetails();
          inventory.openEquipmentArchive(inventory.selectedEquipment.id);
        }}
        onSubmit={inventory.handleUpdateEquipment}
        onCancel={inventory.closeEquipmentDetails}
      >
        {inventory.selectedEquipment ? (
          <div style={{ marginTop: 12, display: "grid", gap: 12 }}>
            <div
              style={{
                padding: 14,
                borderRadius: 16,
                border: `1px solid ${colors.border}`,
                backgroundColor: colors.surface
              }}
            >
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <FitPill
                  mode="status"
                  label={inventory.selectedEquipment.status}
                  color={EQUIPMENT_STATUS_COLOR[inventory.selectedEquipment.status]}
                  fontSize={12}
                />
                <FitPill
                  mode="status"
                  label={`${inventory.selectedEquipment.quantityCurrent}/${inventory.selectedEquipment.quantityTotal} ${inventory.selectedEquipment.unit}`}
                  color={colors.brand}
                  fontSize={12}
                />
              </div>
              <FitText style={{ fontSize: 13, color: colors.textMuted, marginTop: 10 }}>
                Equipment alerts live in an operational lane, such as missing or maintenance,
                instead of retail low-stock notifications.
              </FitText>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
                  gap: 10,
                  marginTop: 12
                }}
              >
                <div style={{ padding: 10, borderRadius: 12, backgroundColor: colors.surfaceRaised }}>
                  <FitText style={{ fontSize: 12, color: colors.textMuted }}>Current</FitText>
                  <FitText style={{ fontSize: 18, fontWeight: 700 }}>
                    {inventory.selectedEquipment.quantityCurrent}
                  </FitText>
                </div>
                <div style={{ padding: 10, borderRadius: 12, backgroundColor: colors.surfaceRaised }}>
                  <FitText style={{ fontSize: 12, color: colors.textMuted }}>Total</FitText>
                  <FitText style={{ fontSize: 18, fontWeight: 700 }}>
                    {inventory.selectedEquipment.quantityTotal}
                  </FitText>
                </div>
                <div style={{ padding: 10, borderRadius: 12, backgroundColor: colors.surfaceRaised }}>
                  <FitText style={{ fontSize: 12, color: colors.textMuted }}>Missing</FitText>
                  <FitText style={{ fontSize: 18, fontWeight: 700 }}>
                    {inventory.selectedEquipment.missingCount}
                  </FitText>
                </div>
              </div>
              <FitButton
                variant="ghost"
                label="RECORD WRITEOFF"
                fullWidth
                onClick={() => {
                  if (!inventory.selectedEquipment) return;
                  inventory.closeEquipmentDetails();
                  inventory.openEquipmentWriteOff(inventory.selectedEquipment.id);
                }}
                style={{ marginTop: 12 }}
              />
            </div>

            <div
              style={{
                padding: 14,
                borderRadius: 16,
                border: `1px solid ${colors.border}`,
                backgroundColor: colors.surface
              }}
            >
              <FitText style={{ fontSize: 12, fontWeight: 700, color: colors.textMuted, marginBottom: 10 }}>
                WRITEOFF HISTORY
              </FitText>
              {inventory.equipmentDetailLoading ? (
                <FitText style={{ fontSize: 13, color: colors.textMuted }}>
                  Loading equipment history...
                </FitText>
              ) : inventory.selectedEquipmentDetail?.writeOffs.length ? (
                <div style={{ display: "grid", gap: 10 }}>
                  {inventory.selectedEquipmentDetail.writeOffs.slice(0, 4).map((entry) => (
                    <div
                      key={entry.id}
                      style={{
                        padding: 10,
                        borderRadius: 12,
                        backgroundColor: colors.surfaceRaised
                      }}
                    >
                      <FitText style={{ fontSize: 13, fontWeight: 700 }}>
                        {entry.quantityBefore} to {entry.quantitySetTo} {inventory.selectedEquipment?.unit}
                      </FitText>
                      <FitText style={{ fontSize: 12, color: colors.textMuted, marginTop: 2 }}>
                        Lost {entry.quantityLost} - {entry.reason}
                      </FitText>
                      <FitText style={{ fontSize: 12, color: colors.textMuted, marginTop: 4 }}>
                        {formatActorName(entry.performer)} - {new Date(entry.createdAt).toLocaleString()}
                      </FitText>
                    </div>
                  ))}
                </div>
              ) : (
                <FitText style={{ fontSize: 13, color: colors.textMuted }}>
                  No writeoff history yet for this equipment item.
                </FitText>
              )}
            </div>
          </div>
        ) : inventory.equipmentDetailLoading ? (
          <FitText style={{ fontSize: 13, color: colors.textMuted, marginTop: 12 }}>
            Loading equipment details...
          </FitText>
        ) : null}
      </DetailsModal>

      <DetailsModal
        isOpen={inventory.writeOffEquipmentOpen}
        title="Record Equipment Writeoff"
        subtitle={inventory.writeOffEquipmentTarget?.name ?? "Equipment item"}
        fields={INVENTORY_EQUIPMENT_WRITEOFF_FIELDS}
        initialValues={{
          quantitySetTo: String(inventory.writeOffEquipmentTarget?.quantityCurrent ?? 0),
          reason: ""
        }}
        submitLabel={inventory.equipmentWriteOffPending ? "RECORDING..." : "RECORD WRITEOFF"}
        isLoading={inventory.equipmentWriteOffPending}
        onSubmit={inventory.handleWriteOffEquipment}
        onCancel={inventory.closeEquipmentWriteOff}
      />

      <ConfirmModal
        isOpen={inventory.archiveEquipmentOpen}
        title="Archive Equipment Item"
        message={`Archive ${inventory.archiveEquipmentTarget?.name ?? "this equipment item"} from active equipment tracking? Operational history stays intact, but it will no longer appear as active inventory.`}
        confirmLabel="ARCHIVE EQUIPMENT"
        loadingLabel="ARCHIVING EQUIPMENT"
        confirmIcon={Archive}
        isDanger
        isLoading={inventory.archiveEquipmentPending}
        onConfirm={() => {
          void inventory.handleArchiveEquipment();
        }}
        onCancel={inventory.closeEquipmentArchive}
      />

      <style>{`
        @media (max-width: 860px) {
          .inventory-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </FitSection>
  );
}
