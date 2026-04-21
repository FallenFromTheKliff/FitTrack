"use client";

import { FitText } from "@/components/fit/FitText";
import type { EquipmentDef } from "@/data/facilities/mapTypes";

type DraggableEquipmentProps = {
    item: EquipmentDef;
    disabled?: boolean;
    selected?: boolean;
    onSelect?: (equipmentId: string) => void;
    remainingQuantity?: number | null;
    isOutOfStock?: boolean;
};

export function DraggableEquipment({
    item,
    disabled = false,
    selected = false,
    onSelect,
    remainingQuantity,
    isOutOfStock = false,
}: DraggableEquipmentProps) {
    const inventoryText =
        item.quantityAvailable !== undefined
            ? remainingQuantity !== null && remainingQuantity !== undefined
                ? `${remainingQuantity} remaining of ${item.quantityAvailable}`
                : `${item.quantityAvailable} available`
            : item.category;

    return (
        <div
            draggable={!disabled}
            onClick={() => {
                if (disabled) return;
                onSelect?.(item.id);
            }}
            onDragStart={(event) => {
                if (disabled) return;
                event.dataTransfer.setData("text/plain", item.id);
                event.dataTransfer.effectAllowed = "copy";
                onSelect?.(item.id);
            }}
            style={{
                width: "100%",
                border: selected ? `1px solid ${item.color}` : "1px solid transparent",
                background: selected ? `${item.color}12` : "transparent",
                borderRadius: 10,
                padding: "2px 4px",
                textAlign: "left",
                cursor: disabled ? "not-allowed" : "grab",
                touchAction: "none",
                userSelect: "none",
                WebkitUserSelect: "none",
                outline: "none",
            }}
            role="button"
            tabIndex={disabled ? -1 : 0}
            aria-disabled={disabled}
            aria-pressed={selected}
        >
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div
                    style={{
                        width: 32,
                        height: 32,
                        borderRadius: 8,
                        border: `1px solid ${item.color}`,
                        backgroundColor: "transparent",
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0
                    }}
                >
                    <item.icon size={16} color={item.color} strokeWidth={2.1} />
                </div>
                <div style={{ minWidth: 0 }}>
                    <FitText style={{ fontSize: 13, fontWeight: 600, display: "block", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {item.name}
                    </FitText>
                    <FitText style={{ fontSize: 11, color: "var(--fit-text-muted)", display: "block", marginTop: 1 }}>
                        {item.quantityAvailable !== undefined
                            ? `${item.category} • ${inventoryText}`
                            : inventoryText}
                    </FitText>
                    {isOutOfStock ? (
                        <FitText style={{ fontSize: 10, color: "var(--fit-danger)", display: "block", marginTop: 2 }}>
                            All mapped units are already placed.
                        </FitText>
                    ) : null}
                    {item.detail ? (
                        <FitText
                            style={{
                                fontSize: 10,
                                color: "var(--fit-text-muted)",
                                display: "block",
                                marginTop: 2,
                                whiteSpace: "nowrap",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                            }}
                        >
                            {item.detail}
                        </FitText>
                    ) : null}
                </div>
            </div>
        </div>
    );
}
