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
