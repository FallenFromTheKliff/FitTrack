"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Archive, ImagePlus, Plus, ReceiptText, RefreshCw, Trash2 } from "lucide-react";

import { buildRenderableAssetUrl } from "@fittrack/utils";

import { useTheme } from "@/contexts/ThemeContext";
import { useFadeIn } from "@/hooks/animations/useFadeIn";
import { useThemeTransition } from "@/hooks/animations/useThemeTransition";
import {
  EQUIPMENT_STATUS_COLOR,
  INVENTORY_EQUIPMENT_ARCHIVE_FIELDS,
  INVENTORY_EQUIPMENT_EDIT_FIELDS,
  INVENTORY_EQUIPMENT_PRESET_OPTIONS,
  INVENTORY_EQUIPMENT_WRITEOFF_FIELDS,
  INVENTORY_RETAIL_PRODUCT_FIELDS,
  INVENTORY_RETAIL_RESTOCK_FIELDS,
  RETAIL_STOCK_STATUS_COLOR
} from "@/data/inventory/inventory";
import FitButton from "@/components/fit/FitButton";
import FitPill from "@/components/fit/FitPill";
import FitSection from "@/components/fit/FitSection";
import { FitSelect } from "@/components/fit/FitCard";
import { FitText, FitTextArea, FitTextInput } from "@/components/fit/FitText";
import { ConfirmModal, DetailsModal } from "@/components/modals";
import FitModal from "@/components/modals/FitModal";
import { InventoryMainPanel } from "@/components/inventory/InventoryMainPanel";
import {
  useInventoryDashboard,
  type InventoryRetailSaleInput,
  type InventoryRetailTableRow
} from "@/hooks/inventory/useInventoryDashboard";
import { WEB_API_BASE_URL } from "@/lib/api-client";

export const dynamic = "force-dynamic";

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

function parseWholeNumber(value: string | undefined) {
  const parsed = Number((value ?? "").trim());

  if (!Number.isFinite(parsed) || !Number.isInteger(parsed)) {
    return { error: "Value must be a whole number." };
  }

  return { value: parsed };
}

function parsePositiveDecimal(value: string | undefined) {
  const parsed = Number((value ?? "").trim());

  if (!Number.isFinite(parsed)) {
    return { error: "Value must be a number." };
  }

  return { value: parsed };
}

function getImageReferenceLabel(imageUrl: string | null | undefined) {
  if (!imageUrl) return "No image uploaded";

  try {
    const url = new URL(imageUrl);
    const fileName = url.pathname.split("/").filter(Boolean).pop();
    if (fileName) return fileName.length > 24 ? `${fileName.slice(0, 21)}...` : fileName;
    return url.hostname;
  } catch {
    return imageUrl.length > 24 ? `${imageUrl.slice(0, 21)}...` : imageUrl;
  }
}

function validateRetailProductForm(data: Record<string, string>) {
  const errors: Record<string, string> = {};
  const price = parsePositiveDecimal(data.price);
  const cost = parsePositiveDecimal(data.cost);
  const stockQuantity = parseWholeNumber(data.stockQuantity);
  const reorderThreshold = parseWholeNumber(data.reorderThreshold);

  if (!data.name?.trim()) {
    errors.name = "Product Name is required";
  }
  if (!data.category?.trim()) {
    errors.category = "Category is required";
  }
  if (price.error) {
    errors.price = "Price must be a number.";
  } else if ((price.value ?? 0) <= 0) {
    errors.price = "Price must be greater than 0.";
  }
  if (cost.error) {
    errors.cost = "Cost must be a number.";
  } else if ((cost.value ?? 0) <= 0) {
    errors.cost = "Cost must be greater than 0.";
  }
  if (stockQuantity.error) {
    errors.stockQuantity = "Stock Quantity must be a whole number.";
  } else if ((stockQuantity.value ?? 0) < 0) {
    errors.stockQuantity = "Stock Quantity cannot be negative.";
  }
  if (reorderThreshold.error) {
    errors.reorderThreshold = "Reorder Threshold must be a whole number.";
  } else if ((reorderThreshold.value ?? 0) < 0) {
    errors.reorderThreshold = "Reorder Threshold cannot be negative.";
  }

  return errors;
}

function validateRetailRestockForm(data: Record<string, string>) {
  const errors: Record<string, string> = {};
  const quantity = parseWholeNumber(data.quantity);

  if (quantity.error) {
    errors.quantity = "Quantity Added must be a whole number.";
  } else if ((quantity.value ?? 0) < 1) {
    errors.quantity = "Quantity Added must be at least 1.";
  }

  return errors;
}

function validateEquipmentCreateForm(
  data: Record<string, string>,
  presetSelection: string,
) {
  const errors: Record<string, string> = {};
  const quantity = parseWholeNumber(data.quantity);

  if (!presetSelection.trim()) {
    errors.presetSelection = "Equipment Option is required";
  }
  if (quantity.error) {
    errors.quantity = "Quantity must be a whole number.";
  } else if ((quantity.value ?? 0) < 1) {
    errors.quantity = "Quantity must be at least 1.";
  }
  if (presetSelection === "new" && !data.name?.trim()) {
    errors.name = "Equipment Name is required";
  }

  return errors;
}

function validateEquipmentDetailForm(data: Record<string, string>) {
  const errors: Record<string, string> = {};

  if (!data.name?.trim()) {
    errors.name = "Equipment Name is required";
  }
  if (!data.unit?.trim()) {
    errors.unit = "Unit is required";
  }
  if (
    data.status !== "Available" &&
    data.status !== "Under Maintenance" &&
    data.status !== "Broken"
  ) {
    errors.status = "Choose a valid equipment status.";
  }

  return errors;
}

function validateEquipmentWriteOffForm(
  data: Record<string, string>,
  quantityCurrent: number | null,
) {
  const errors: Record<string, string> = {};
  const quantitySetTo = parseWholeNumber(data.quantitySetTo);

  if (quantitySetTo.error) {
    errors.quantitySetTo = "New Current Quantity must be a whole number.";
  } else if ((quantitySetTo.value ?? 0) < 0) {
    errors.quantitySetTo = "New Current Quantity cannot be negative.";
  } else if (
    quantityCurrent !== null &&
    (quantitySetTo.value ?? 0) > quantityCurrent
  ) {
    errors.quantitySetTo = "New Current Quantity cannot exceed the current quantity.";
  }
  if (!data.reason?.trim()) {
    errors.reason = "Reason is required";
  }

  return errors;
}

function validateEquipmentArchiveForm(
  data: Record<string, string>,
  quantityCurrent: number | null,
) {
  const errors: Record<string, string> = {};
  const quantityToArchive = parseWholeNumber(data.quantityToArchive);

  if (quantityToArchive.error) {
    errors.quantityToArchive = "Quantity to Archive must be a whole number.";
  } else if ((quantityToArchive.value ?? 0) < 1) {
    errors.quantityToArchive = "Quantity to Archive must be at least 1.";
  } else if (
    quantityCurrent !== null &&
    (quantityToArchive.value ?? 0) > quantityCurrent
  ) {
    errors.quantityToArchive = "Quantity to Archive cannot exceed the current quantity.";
  }
  if (!data.reason?.trim()) {
    errors.reason = "Reason is required";
  }

  return errors;
}

type InventoryImageUploadCardProps = {
  buttonLabel: string;
  imageUrl: string;
  onUpload: (file: File) => void;
  title: string;
};

function InventoryImageUploadCard({
  buttonLabel,
  imageUrl,
  onUpload,
  title
}: InventoryImageUploadCardProps) {
  const { colors } = useTheme();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const renderableImageUrl = buildRenderableAssetUrl({
    apiBaseUrl: WEB_API_BASE_URL,
    assetUrl: imageUrl || null
  });

  return (
    <div
      style={{
        marginTop: 12,
        padding: 14,
        borderRadius: 16,
        border: `1px solid ${colors.border}`,
        backgroundColor: colors.surface
      }}
    >
      <FitText style={{ fontSize: 12, fontWeight: 700, color: colors.textMuted }}>
        {title.toUpperCase()}
      </FitText>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 14,
          marginTop: 12,
          flexWrap: "wrap"
        }}
      >
        <div
          style={{
            width: 92,
            height: 92,
            borderRadius: 18,
            border: `1px solid ${colors.border}`,
            overflow: "hidden",
            display: "grid",
            placeItems: "center",
            backgroundColor: colors.surfaceRaised
          }}
        >
          {renderableImageUrl ? (
            <img
              src={renderableImageUrl}
              alt={title}
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
            />
          ) : (
            <ImagePlus size={22} color={colors.textMuted} />
          )}
        </div>
        <div style={{ display: "grid", gap: 8 }}>
          <FitText style={{ fontSize: 13, color: colors.textMuted }}>
            Upload a new image to keep the item card and details view current.
          </FitText>
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            style={{ display: "none" }}
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (!file) return;
              onUpload(file);
              event.currentTarget.value = "";
            }}
          />
          <FitButton
            variant="ghost"
            label={buttonLabel}
            icon={ImagePlus}
            onClick={() => inputRef.current?.click()}
            style={{ alignSelf: "flex-start" }}
          />
        </div>
      </div>
    </div>
  );
}

type RetailSaleLineItem = {
  key: string;
  productId: string;
  quantity: string;
};

type RetailSaleModalProps = {
  initialProductId: string | null;
  isLoading: boolean;
  isOpen: boolean;
  onCancel: () => void;
  onSubmit: (input: InventoryRetailSaleInput) => void;
  products: InventoryRetailTableRow[];
};

function createRetailSaleLine(productId = ""): RetailSaleLineItem {
  return {
    key: `sale-line-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    productId,
    quantity: "1"
  };
}

function parseSaleQuantity(value: string) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || !Number.isInteger(parsed)) return null;
  return parsed;
}

function RetailSaleModal({
  initialProductId,
  isLoading,
  isOpen,
  onCancel,
  onSubmit,
  products
}: RetailSaleModalProps) {
  const { colors } = useTheme();
  const [lineItems, setLineItems] = useState<RetailSaleLineItem[]>([
    createRetailSaleLine(initialProductId ?? "")
  ]);
  const [notes, setNotes] = useState("");
  const productsById = useMemo(
    () => new Map(products.map((product) => [product.id, product])),
    [products]
  );
  const productOptions = useMemo(
    () =>
      products.map((product) => ({
        label: `${product.name} (${product.stockQuantity} in stock)`,
        value: product.id
      })),
    [products]
  );
  const selectedProductIds = useMemo(
    () => lineItems.map((item) => item.productId).filter(Boolean),
    [lineItems]
  );
  const duplicateProductIds = useMemo(() => {
    const counts = new Map<string, number>();
    selectedProductIds.forEach((productId) => {
      counts.set(productId, (counts.get(productId) ?? 0) + 1);
    });
    return new Set(
      [...counts.entries()]
        .filter(([, count]) => count > 1)
        .map(([productId]) => productId)
    );
  }, [selectedProductIds]);
  const lineErrors = useMemo(
    () =>
      lineItems.map((item) => {
        if (!item.productId) return "Choose a product.";
        const product = productsById.get(item.productId);
        if (!product) return "Choose a valid product.";
        if (duplicateProductIds.has(item.productId)) {
          return "Product is already in the sale. Update the existing row instead.";
        }
        const quantity = parseSaleQuantity(item.quantity);
        if (quantity === null) return "Quantity must be a whole number.";
        if (quantity < 1) return "Quantity must be at least 1.";
        if (quantity > product.stockQuantity) {
          return `Only ${product.stockQuantity} item(s) are in stock.`;
        }
        return "";
      }),
    [duplicateProductIds, lineItems, productsById]
  );
  const saleTotal = useMemo(
    () =>
      lineItems.reduce((total, item) => {
        const product = productsById.get(item.productId);
        const quantity = parseSaleQuantity(item.quantity);
        if (!product || quantity === null || quantity < 1) return total;
        return total + product.price * quantity;
      }, 0),
    [lineItems, productsById]
  );
  const hasValidationErrors =
    products.length === 0 || lineErrors.some((error) => error.length > 0);

  useEffect(() => {
    if (!isOpen) return;
    setLineItems([createRetailSaleLine(initialProductId ?? "")]);
    setNotes("");
  }, [initialProductId, isOpen]);

  const updateLineItem = (
    key: string,
    patch: Partial<Pick<RetailSaleLineItem, "productId" | "quantity">>
  ) => {
    setLineItems((current) =>
      current.map((item) => (item.key === key ? { ...item, ...patch } : item))
    );
  };

  const removeLineItem = (key: string) => {
    setLineItems((current) =>
      current.length > 1 ? current.filter((item) => item.key !== key) : current
    );
  };

  const addLineItem = () => {
    const nextProduct = products.find(
      (product) => !selectedProductIds.includes(product.id)
    );
    setLineItems((current) => [
      ...current,
      createRetailSaleLine(nextProduct?.id ?? "")
    ]);
  };

  const submitSale = () => {
    if (hasValidationErrors) return;

    onSubmit({
      items: lineItems.map((item) => ({
        productId: item.productId,
        quantity: parseSaleQuantity(item.quantity) ?? 1
      })),
      ...(notes.trim() ? { notes: notes.trim() } : {})
    });
  };

  return (
    <FitModal
      isOpen={isOpen}
      onClose={onCancel}
      title="Record Manual Sale"
      subtitle="Build an on-site retail sale. Unit prices come from the live product records."
      icon={ReceiptText}
      maxWidth={760}
      footer={
        <div style={{ display: "flex", gap: 10, width: "100%", alignItems: "center" }}>
          <div style={{ flex: 1 }}>
            <FitText as="p" style={{ fontSize: 12, color: colors.textMuted }}>
              Sale total
            </FitText>
            <FitText as="p" style={{ fontSize: 20, fontWeight: 800 }}>
              PHP{" "}
              {saleTotal.toLocaleString("en-PH", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2
              })}
            </FitText>
          </div>
          <FitButton
            variant="primary"
            label={isLoading ? "CONFIRMING SALE..." : "CONFIRM SALE"}
            loading={isLoading}
            disabled={hasValidationErrors}
            onClick={submitSale}
            style={{ minWidth: 180 }}
          />
        </div>
      }
      hideFooterDivider
    >
      {products.length === 0 ? (
        <div
          style={{
            border: `1px solid ${colors.border}`,
            borderRadius: 16,
            padding: 14,
            backgroundColor: colors.surfaceRaised
          }}
        >
          <FitText style={{ fontSize: 14, color: colors.textMuted }}>
            No active retail products with available stock can be sold right now.
          </FitText>
        </div>
      ) : null}
      <div style={{ display: "grid", gap: 12 }}>
        {lineItems.map((item, index) => {
          const product = productsById.get(item.productId);
          const quantity = parseSaleQuantity(item.quantity);
          const subtotal = product && quantity ? product.price * quantity : 0;
          const error = lineErrors[index];

          return (
            <div
              key={item.key}
              style={{
                display: "grid",
                gap: 10,
                padding: 14,
                border: `1px solid ${error ? colors.danger : colors.border}`,
                borderRadius: 16,
                backgroundColor: colors.surface
              }}
            >
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "minmax(220px, 1.5fr) minmax(90px, 0.55fr) minmax(120px, 0.8fr) minmax(120px, 0.8fr) auto",
                  gap: 10,
                  alignItems: "end"
                }}
              >
                <div style={{ display: "grid", gap: 6 }}>
                  <FitText as="label" style={{ fontSize: 12, fontWeight: 700, color: colors.textMuted }}>
                    Product
                  </FitText>
                  <FitSelect
                    fullWidth
                    value={item.productId}
                    placeholder="Choose product"
                    options={productOptions}
                    onChange={(event) =>
                      updateLineItem(item.key, { productId: event.target.value })
                    }
                  />
                </div>
                <div style={{ display: "grid", gap: 6 }}>
                  <FitText as="label" style={{ fontSize: 12, fontWeight: 700, color: colors.textMuted }}>
                    Qty
                  </FitText>
                  <FitTextInput
                    type="number"
                    min={1}
                    max={product?.stockQuantity}
                    value={item.quantity}
                    onChange={(event) =>
                      updateLineItem(item.key, { quantity: event.target.value })
                    }
                    style={{
                      minHeight: 42,
                      border: `1px solid ${colors.border}`,
                      borderRadius: 12,
                      padding: "0 12px",
                      backgroundColor: colors.surfaceRaised
                    }}
                  />
                </div>
                <div style={{ display: "grid", gap: 6 }}>
                  <FitText style={{ fontSize: 12, fontWeight: 700, color: colors.textMuted }}>
                    Unit Price
                  </FitText>
                  <FitText style={{ fontSize: 15, fontWeight: 800 }}>
                    PHP{" "}
                    {(product?.price ?? 0).toLocaleString("en-PH", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2
                    })}
                  </FitText>
                </div>
                <div style={{ display: "grid", gap: 6 }}>
                  <FitText style={{ fontSize: 12, fontWeight: 700, color: colors.textMuted }}>
                    Subtotal
                  </FitText>
                  <FitText style={{ fontSize: 15, fontWeight: 800 }}>
                    PHP{" "}
                    {subtotal.toLocaleString("en-PH", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2
                    })}
                  </FitText>
                </div>
                <FitButton
                  variant="ghost"
                  iconOnly
                  icon={Trash2}
                  iconSize={16}
                  onClick={() => removeLineItem(item.key)}
                  disabled={lineItems.length === 1}
                  aria-label="Remove sale item"
                  style={{ minWidth: 42, minHeight: 42 }}
                />
              </div>
              {product ? (
                <FitText style={{ fontSize: 12, color: colors.textMuted }}>
                  Stock after sale: {Math.max(product.stockQuantity - (quantity ?? 0), 0)}
                </FitText>
              ) : null}
              {error ? (
                <FitText style={{ fontSize: 12, color: colors.danger, fontWeight: 700 }}>
                  {error}
                </FitText>
              ) : null}
            </div>
          );
        })}
      </div>
      <FitButton
        variant="ghost"
        label="ADD ANOTHER ITEM"
        icon={Plus}
        iconSize={14}
        onClick={addLineItem}
        disabled={lineItems.length >= products.length}
        style={{ marginTop: 12 }}
      />
      <div style={{ display: "grid", gap: 6, marginTop: 16 }}>
        <FitText as="label" style={{ fontSize: 12, fontWeight: 700, color: colors.textMuted }}>
          Notes
        </FitText>
        <FitTextArea
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          placeholder="Optional cashier or walk-in sale notes"
          maxLength={500}
          rows={3}
          style={{
            border: `1px solid ${colors.border}`,
            borderRadius: 14,
            padding: 12,
            backgroundColor: colors.surfaceRaised
          }}
        />
      </div>
    </FitModal>
  );
}

export default function InventoryPage() {
  const { colors } = useTheme();
  const fadeIn = useFadeIn();
  const themeTransition = useThemeTransition();
  const inventory = useInventoryDashboard();
  const [detailEditorOpen, setDetailEditorOpen] = useState<
    "retail" | "equipment" | null
  >(null);
  const [isCompactDetail, setIsCompactDetail] = useState(false);
  const [pendingArchiveEquipmentForm, setPendingArchiveEquipmentForm] =
    useState<Record<string, string> | null>(null);

  const createEquipmentFields = [
    {
      name: "presetSelection",
      label: "Equipment Option",
      type: "select" as const,
      required: true,
      options: INVENTORY_EQUIPMENT_PRESET_OPTIONS
    },
    ...(inventory.createEquipmentPreset === "new"
      ? [
          {
            name: "name",
            label: "Equipment Name",
            type: "text" as const,
            required: true,
            placeholder: "e.g., Adjustable Bench"
          },
          {
            name: "description",
            label: "Description",
            type: "textarea" as const,
            placeholder: "What should staff know about this equipment?",
            maxLength: 240
          },
          {
            name: "quantity",
            label: "Quantity",
            type: "text" as const,
            required: true,
            placeholder: "e.g., 4"
          }
        ]
      : [
          {
            name: "quantity",
            label: "Quantity",
            type: "text" as const,
            required: true,
            placeholder: "e.g., 2"
          }
        ])
  ];

  const retailDetailValues = inventory.selectedRetail
    ? {
        cost: String(inventory.selectedRetail.cost),
        name: inventory.selectedRetail.name,
        category: inventory.selectedRetail.category,
        description: inventory.selectedRetail.description ?? "",
        price: String(inventory.selectedRetail.price),
        stockQuantity: String(inventory.selectedRetail.stockQuantity),
        reorderThreshold: String(inventory.selectedRetail.reorderThreshold)
      }
    : undefined;

  const equipmentDetailValues = inventory.selectedEquipment
    ? {
        name: inventory.selectedEquipment.name,
        description: inventory.selectedEquipment.description ?? "",
        unit: inventory.selectedEquipment.unit,
        status: inventory.selectedEquipment.status
      }
    : undefined;

  useEffect(() => {
    const evaluateDetailMode = () => {
      setIsCompactDetail(window.innerWidth < 1040);
    };

    evaluateDetailMode();
    window.addEventListener("resize", evaluateDetailMode);
    return () => window.removeEventListener("resize", evaluateDetailMode);
  }, []);

  useEffect(() => {
    if (!inventory.selectedRetail && detailEditorOpen === "retail") {
      setDetailEditorOpen(null);
    }
    if (!inventory.selectedEquipment && detailEditorOpen === "equipment") {
      setDetailEditorOpen(null);
    }
  }, [detailEditorOpen, inventory.selectedEquipment, inventory.selectedRetail]);

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

      <InventoryMainPanel
        colors={colors}
        inventory={inventory}
        isCompactDetail={isCompactDetail}
        onOpenDetailEditor={setDetailEditorOpen}
      />

      <DetailsModal
        isOpen={inventory.createRetailOpen}
        title="Add Retail Product"
        subtitle="Create a retail item with category and stock thresholds."
        fields={INVENTORY_RETAIL_PRODUCT_FIELDS}
        initialValues={{
          category: "other",
          cost: "",
          description: "",
          name: "",
          price: "",
          reorderThreshold: "10",
          stockQuantity: "0"
        }}
        submitLabel={inventory.createRetailPending ? "ADDING PRODUCT..." : "ADD PRODUCT"}
        isLoading={inventory.createRetailPending}
        validate={(data) => ({
          ...validateRetailProductForm(data),
          ...(!inventory.createRetailImageUrl.trim()
            ? { productImage: "Product image is required." }
            : {})
        })}
        onSubmit={inventory.handleCreateRetail}
        onCancel={() => inventory.setCreateRetailOpen(false)}
      >
        <InventoryImageUploadCard
          title="Product Image"
          imageUrl={inventory.createRetailImageUrl}
          buttonLabel="UPLOAD PRODUCT IMAGE"
          onUpload={(file) => {
            void inventory.handleUploadInventoryImage(file, "create-retail");
          }}
        />
        {!inventory.createRetailImageUrl.trim() ? (
          <FitText
            as="p"
            style={{
              color: colors.danger,
              fontSize: 12,
              fontWeight: 700,
              marginTop: 8
            }}
          >
            Product image is required before saving.
          </FitText>
        ) : null}
      </DetailsModal>

      <DetailsModal
        isOpen={
          inventory.retailDetailOpen &&
          (isCompactDetail || detailEditorOpen === "retail")
        }
        title="Retail Item Details"
        subtitle={inventory.selectedRetail?.name ?? "Retail item"}
        fields={INVENTORY_RETAIL_PRODUCT_FIELDS}
        initialValues={retailDetailValues}
        submitLabel={inventory.updateRetailPending ? "SAVING..." : "SAVE CHANGES"}
        isLoading={inventory.updateRetailPending}
        validate={validateRetailProductForm}
        dangerLabel="ARCHIVE ITEM"
        dangerIcon={Archive}
        dangerDisabled={!inventory.selectedRetail}
        onDanger={() => {
          if (!inventory.selectedRetail) return;
          inventory.closeRetailDetails();
          inventory.openRetailArchive(inventory.selectedRetail.id);
        }}
        onSubmit={(data) => {
          void inventory.handleUpdateRetail(data);
          if (!isCompactDetail) setDetailEditorOpen(null);
        }}
        onCancel={() => {
          if (isCompactDetail) {
            inventory.closeRetailDetails();
          } else {
            setDetailEditorOpen(null);
          }
        }}
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
            <InventoryImageUploadCard
              title="Product Image"
              imageUrl={inventory.detailRetailImageUrl}
              buttonLabel="UPLOAD NEW IMAGE"
              onUpload={(file) => {
                void inventory.handleUploadInventoryImage(file, "detail-retail");
              }}
            />
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
                gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
                gap: 10,
                marginTop: 12
              }}
            >
              <div style={{ padding: 10, borderRadius: 12, backgroundColor: colors.surfaceRaised }}>
                <FitText style={{ fontSize: 12, color: colors.textMuted }}>Product Code</FitText>
                <FitText style={{ fontSize: 18, fontWeight: 700 }}>
                  {inventory.selectedRetail.id.slice(0, 8).toUpperCase()}
                </FitText>
              </div>
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
                <FitText style={{ fontSize: 12, color: colors.textMuted }}>Cost</FitText>
                <FitText style={{ fontSize: 18, fontWeight: 700 }}>
                  PHP{" "}
                  {inventory.selectedRetail.cost.toLocaleString("en-PH", {
                    maximumFractionDigits: 2,
                    minimumFractionDigits: 2
                  })}
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
              <div style={{ padding: 10, borderRadius: 12, backgroundColor: colors.surfaceRaised }}>
                <FitText style={{ fontSize: 12, color: colors.textMuted }}>Image Reference</FitText>
                <FitText style={{ fontSize: 13, fontWeight: 700, lineHeight: 1.35 }}>
                  {getImageReferenceLabel(inventory.detailRetailImageUrl || inventory.selectedRetail.imageUrl)}
                </FitText>
              </div>
            </div>
            <FitButton
              variant="primary"
              label="RECORD SALE"
              fullWidth
              disabled={inventory.selectedRetail.stockQuantity <= 0}
              onClick={() => {
                if (!inventory.selectedRetail) return;
                inventory.closeRetailDetails();
                inventory.openRetailSale(inventory.selectedRetail.id);
              }}
              style={{ marginTop: 12 }}
            />
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
              style={{ marginTop: 10 }}
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
        subtitle={
          inventory.restockRetailTarget?.name ??
          (inventory.retailRestockLoading ? "Loading retail item..." : "Retail item")
        }
        fields={INVENTORY_RETAIL_RESTOCK_FIELDS}
        initialValues={{ notes: "", quantity: "1" }}
        submitLabel={
          inventory.retailRestockLoading
            ? "LOADING ITEM..."
            : inventory.retailRestockPending
              ? "RESTOCKING..."
              : "RESTOCK ITEM"
        }
        isLoading={inventory.retailRestockPending || inventory.retailRestockLoading}
        validate={validateRetailRestockForm}
        onSubmit={inventory.handleRestockRetail}
        onCancel={inventory.closeRetailRestock}
      />

      <RetailSaleModal
        isOpen={inventory.retailSaleOpen}
        initialProductId={inventory.saleRetailTarget?.id ?? null}
        products={inventory.retailSaleProducts}
        isLoading={inventory.retailSalePending}
        onSubmit={inventory.handleRecordRetailSale}
        onCancel={inventory.closeRetailSale}
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
        fields={createEquipmentFields}
        initialValues={{
          description: "",
          name: "",
          presetSelection: inventory.createEquipmentPreset,
          quantity: "1"
        }}
        submitLabel={inventory.createEquipmentPending ? "ADDING EQUIPMENT..." : "ADD EQUIPMENT"}
        isLoading={inventory.createEquipmentPending}
        validate={(data) =>
          validateEquipmentCreateForm(
            data,
            data.presetSelection ?? inventory.createEquipmentPreset
          )
        }
        onSubmit={inventory.handleCreateEquipment}
        onChange={(data) => {
          const nextPreset = data.presetSelection ?? "new";
          if (nextPreset !== inventory.createEquipmentPreset) {
            inventory.setCreateEquipmentPreset(nextPreset);
          }
        }}
        onCancel={() => inventory.setCreateEquipmentOpen(false)}
      >
        {inventory.createEquipmentPreset === "new" ? (
          <InventoryImageUploadCard
            title="Equipment Picture"
            imageUrl={inventory.createEquipmentImageUrl}
            buttonLabel="UPLOAD PICTURE"
            onUpload={(file) => {
              void inventory.handleUploadInventoryImage(file, "create-equipment");
            }}
          />
        ) : null}
      </DetailsModal>

      <DetailsModal
        isOpen={
          inventory.selectedEquipment !== null &&
          (isCompactDetail || detailEditorOpen === "equipment")
        }
        title="Equipment Details"
        subtitle={inventory.selectedEquipment?.name ?? "Equipment item"}
        fields={INVENTORY_EQUIPMENT_EDIT_FIELDS}
        initialValues={equipmentDetailValues}
        submitLabel={inventory.updateEquipmentPending ? "SAVING..." : "SAVE CHANGES"}
        isLoading={inventory.updateEquipmentPending}
        validate={validateEquipmentDetailForm}
        dangerLabel="ARCHIVE EQUIPMENT"
        dangerIcon={Archive}
        dangerDisabled={!inventory.selectedEquipment}
        onDanger={() => {
          if (!inventory.selectedEquipment) return;
          inventory.closeEquipmentDetails();
          inventory.openEquipmentArchive(inventory.selectedEquipment.id);
        }}
        onSubmit={(data) => {
          void inventory.handleUpdateEquipment(data);
          if (!isCompactDetail) setDetailEditorOpen(null);
        }}
        onCancel={() => {
          if (isCompactDetail) {
            inventory.closeEquipmentDetails();
          } else {
            setDetailEditorOpen(null);
          }
        }}
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
              <InventoryImageUploadCard
                title="Equipment Picture"
                imageUrl={inventory.detailEquipmentImageUrl}
                buttonLabel="UPLOAD NEW IMAGE"
                onUpload={(file) => {
                  void inventory.handleUploadInventoryImage(file, "detail-equipment");
                }}
              />
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
                  gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
                  gap: 10,
                  marginTop: 12
                }}
              >
                <div style={{ padding: 10, borderRadius: 12, backgroundColor: colors.surfaceRaised }}>
                  <FitText style={{ fontSize: 12, color: colors.textMuted }}>Equipment Code</FitText>
                  <FitText style={{ fontSize: 18, fontWeight: 700 }}>
                    {inventory.selectedEquipment.id.slice(0, 8).toUpperCase()}
                  </FitText>
                </div>
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
                <div style={{ padding: 10, borderRadius: 12, backgroundColor: colors.surfaceRaised }}>
                  <FitText style={{ fontSize: 12, color: colors.textMuted }}>Status</FitText>
                  <FitText style={{ fontSize: 18, fontWeight: 700 }}>
                    {inventory.selectedEquipment.status}
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
        validate={(data) =>
          validateEquipmentWriteOffForm(
            data,
            inventory.writeOffEquipmentTarget?.quantityCurrent ?? null
          )
        }
        onSubmit={inventory.handleWriteOffEquipment}
        onCancel={inventory.closeEquipmentWriteOff}
      />

      <DetailsModal
        isOpen={inventory.archiveEquipmentOpen}
        title="Archive Equipment"
        subtitle={inventory.archiveEquipmentTarget?.name ?? "Equipment item"}
        fields={INVENTORY_EQUIPMENT_ARCHIVE_FIELDS}
        initialValues={{ quantityToArchive: "1", reason: "" }}
        submitLabel="CONTINUE"
        isLoading={false}
        validate={(data) =>
          validateEquipmentArchiveForm(
            data,
            inventory.archiveEquipmentTarget?.quantityCurrent ?? null
          )
        }
        onSubmit={(data) => {
          setPendingArchiveEquipmentForm(data);
        }}
        onCancel={() => {
          setPendingArchiveEquipmentForm(null);
          inventory.closeEquipmentArchive();
        }}
      />

      <ConfirmModal
        isOpen={pendingArchiveEquipmentForm !== null}
        title="Confirm Equipment Archive"
        message={`Archive ${pendingArchiveEquipmentForm?.quantityToArchive ?? "0"} unit(s) from ${inventory.archiveEquipmentTarget?.name ?? "this equipment item"}? This will remove them from active inventory and record the provided reason.`}
        confirmLabel="ARCHIVE EQUIPMENT"
        loadingLabel="ARCHIVING EQUIPMENT"
        confirmIcon={Archive}
        isDanger
        isLoading={inventory.archiveEquipmentPending}
        onConfirm={() => {
          if (!pendingArchiveEquipmentForm) return;
          void inventory.handleArchiveEquipment(pendingArchiveEquipmentForm);
          setPendingArchiveEquipmentForm(null);
        }}
        onCancel={() => {
          setPendingArchiveEquipmentForm(null);
        }}
      />
    </FitSection>
  );
}
