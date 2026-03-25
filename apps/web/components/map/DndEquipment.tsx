"use client";
import { useDraggable, useDroppable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { Trash2 } from "lucide-react";
import type { ReactNode } from "react";

import FitButton from "@/components/fit/FitButton";
import { FitText } from "@/components/fit/FitText";
import type { EquipmentDef } from "@/data/facilities/mapTypes";

type DraggableEquipmentProps = {
    item: EquipmentDef;
    disabled?: boolean;
};

export function DraggableEquipment({ item, disabled = false }: DraggableEquipmentProps) {
    const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
        id: `equip-${item.id}`,
        data: { equipmentId: item.id },
        disabled
    });

    return (
        <FitButton
            buttonRef={setNodeRef}
            style={{
                transform: CSS.Translate.toString(transform),
                opacity: isDragging ? 0.55 : 1,
                width: "100%",
                border: "none",
                background: "none",
                textAlign: "left",
                cursor: disabled ? "not-allowed" : "grab"
            }}
            {...listeners}
            {...attributes}
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
                        {item.category}
                    </FitText>
                </div>
            </div>
        </FitButton>
    );
}

type PlacedEquipmentTileProps = {
    cellId: string;
    item: EquipmentDef;
    onRequestDelete: (cellId: string) => void;
    disabled?: boolean;
    removeIconColor: string;
};

export function PlacedEquipmentTile({ cellId, item, onRequestDelete, disabled = false, removeIconColor }: PlacedEquipmentTileProps) {
    const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
        id: `placed-${cellId}`,
        data: { equipmentId: item.id, sourceCellId: cellId },
        disabled
    });

    return (
        <div
            ref={setNodeRef}
            style={{
                transform: CSS.Translate.toString(transform),
                opacity: isDragging ? 0.6 : 1,
                border: `1px solid ${item.color}`,
                backgroundColor: "transparent",
                cursor: disabled ? "default" : "grab",
                width: "100%",
                height: "100%",
                borderRadius: 4,
                position: "relative",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center"
            }}
            {...listeners}
            {...attributes}
            role="button"
            tabIndex={0}
            aria-label={`${item.name} placed on floor`}
        >
            <item.icon size={18} color={item.color} strokeWidth={2.2} />
            {!disabled && (
                <FitButton
                    variant="ghost"
                    icon={Trash2}
                    iconOnly
                    aria-label={`Remove ${item.name}`}
                    onClick={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        onRequestDelete(cellId);
                    }}
                    onPointerDown={(event) => event.stopPropagation()}
                    style={{
                        position: "absolute",
                        right: -7,
                        top: -7,
                        width: 22,
                        height: 22,
                        borderRadius: 7,
                        border: "1px solid rgba(0,0,0,0.12)",
                        backgroundColor: "rgba(255,255,255,0.95)",
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        cursor: "pointer",
                        color: removeIconColor,
                        padding: 0
                    }}
                />
            )}
        </div>
    );
}

type DropCellProps = {
    id: string;
    children?: ReactNode;
};

export function DropCell({ id, children }: DropCellProps) {
    const { setNodeRef, isOver } = useDroppable({ id });
    return (
        <div
            ref={setNodeRef}
            style={{
                border: `1px solid ${isOver ? "var(--fit-brand)" : "rgba(148,163,184,0.14)"}`,
                borderRadius: 4,
                backgroundColor: isOver ? "rgba(249,115,22,0.14)" : "transparent",
                display: "flex",
                alignItems: "center",
                justifyContent: "center"
            }}
        >
            {children}
        </div>
    );
}
