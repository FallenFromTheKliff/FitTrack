"use client";
import type { RefObject } from "react";
import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";
import { BORDER_RADIUS } from "@fittrack/ui";

import { useTheme } from "@/contexts/ThemeContext";
import type { Booking, Resource } from "@/data/schedule-constants";

import { FitText } from "@/components/fit/FitText";
import FitSearch from "@/components/fit/FitSearch";
import FitSection from "@/components/fit/FitSection";

function urgencyBorderColor(
  bookingCount: number,
  hasDeletionRequest: boolean,
  colors: ReturnType<typeof useTheme>["colors"]
): string {
  if (hasDeletionRequest) return colors.danger;
  if (bookingCount >= 6) return colors.danger;
  if (bookingCount >= 3) return colors.warning;
  return colors.success;
}

type Props = {
  scrollRef: RefObject<HTMLDivElement | null>;
  maxHeight: number | null;
  staffQuery: string;
  onStaffQueryChange: (v: string) => void;
  filteredStaff: Resource[];
  bookings: Booking[];
  deletionRequestIds?: Set<string>;
  isAdmin: boolean;
  onStaffClick: (staffId: string) => void;
};

export default function RosterPanel({
  scrollRef,
  maxHeight,
  staffQuery,
  onStaffQueryChange,
  filteredStaff,
  bookings,
  deletionRequestIds = new Set(),
  isAdmin,
  onStaffClick
}: Props) {
  const { colors } = useTheme();

  return (
    <FitSection heading="Schedule Roster" hideHeading>
      <div ref={scrollRef} style={{ maxHeight: maxHeight ?? undefined, overflowY: "auto" }}>
        <div style={{ padding: 14, display: "grid", gap: 12 }}>
          <FitSearch
            value={staffQuery}
            onChangeText={onStaffQueryChange}
            placeholder="Search staff..."
          />
          <FitText
            style={{
              fontSize: 12,
              fontWeight: 700,
              color: colors.textMuted,
              letterSpacing: "0.08em",
              textTransform: "uppercase"
            }}
          >
            STAFF
          </FitText>
          {filteredStaff.length === 0 ? (
            <FitText style={{ fontSize: 14, color: colors.textMuted }}>
              No staff found.
            </FitText>
          ) : (
            filteredStaff.map((staff) => {
              const bookingCount = bookings.filter((b) => b.resourceId === staff.id).length;
              const hasDeletion = deletionRequestIds.has(staff.id);
              const borderColor = isAdmin
                ? urgencyBorderColor(bookingCount, hasDeletion, colors)
                : colors.border;
              return (
                <DraggableStaffCard
                  key={staff.id}
                  staff={staff}
                  bookingCount={bookingCount}
                  borderColor={borderColor}
                  isAdmin={isAdmin}
                  colors={colors}
                  onCardClick={() => isAdmin && onStaffClick(staff.id)}
                />
              );
            })
          )}
        </div>
      </div>
    </FitSection>
  );
}

function DraggableStaffCard({ staff, bookingCount, borderColor, isAdmin, colors, onCardClick }: {
  staff: Resource;
  bookingCount: number;
  borderColor: string;
  isAdmin: boolean;
  colors: ReturnType<typeof useTheme>["colors"];
  onCardClick: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: staff.id,
    disabled: !isAdmin
  });

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Translate.toString(transform),
        opacity: isDragging ? 0.45 : 1,
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "11px 13px",
        borderRadius: BORDER_RADIUS.card,
        border: `1.5px solid ${borderColor}`,
        backgroundColor: `${borderColor}0d`,
        cursor: isAdmin ? "pointer" : "default",
        transition: "border-color 0.2s ease, background-color 0.2s ease"
      }}
      onClick={onCardClick}
      role={isAdmin ? "button" : undefined}
      tabIndex={isAdmin ? 0 : undefined}
      onKeyDown={isAdmin ? (e) => { if (e.key === "Enter") onCardClick(); } : undefined}
    >
      {isAdmin && (
        <div
          {...listeners}
          {...attributes}
          style={{ cursor: "grab", color: colors.textMuted, flexShrink: 0, lineHeight: 0 }}
          onClick={(e) => e.stopPropagation()}
          title="Drag to schedule"
        >
          <GripVertical size={18} strokeWidth={2} />
        </div>
      )}
      <div
        style={{
          width: 36,
          height: 36,
          borderRadius: 9,
          backgroundColor: colors.brand,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0
        }}
      >
        <FitText
          style={{
            fontSize: 13,
            fontWeight: 700,
            color: colors.onBrand ?? "#FFFFFF"
          }}
        >
          {staff.initials ?? staff.name.slice(0, 2).toUpperCase()}
        </FitText>
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <FitText
          style={{
            fontSize: 15,
            fontWeight: 600,
            display: "block",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis"
          }}
        >
          {staff.name}
        </FitText>
        <FitText style={{ fontSize: 13, color: colors.textMuted, display: "block", marginTop: 1 }}>
          {bookingCount} booking{bookingCount !== 1 ? "s" : ""}
        </FitText>
      </div>
      {isAdmin && (
        <div
          style={{
            width: 9,
            height: 9,
            borderRadius: "50%",
            backgroundColor: borderColor,
            flexShrink: 0
          }}
          title={
            borderColor === colors.danger
              ? "Maxed / deletion request"
              : borderColor === colors.warning
                ? "Busy"
                : "Normal"
          }
        />
      )}
    </div>
  );
}
