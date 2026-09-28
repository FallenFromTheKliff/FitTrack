"use client";
import type { RefObject } from "react";
import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";

import { useTheme } from "@/contexts/ThemeContext";
import type { Booking, Resource } from "@/data/schedule-constants";

import FitPill from "@/components/fit/FitPill";
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
  canDrag?: boolean;
  canSelect?: boolean;
  selectedStaffId?: string | null;
  onStaffClick: (staffId: string) => void;
  resourceLabelPlural?: string;
  resourceLabelSingular?: string;
  searchPlaceholder?: string;
};

export default function RosterPanel({
  scrollRef,
  maxHeight,
  staffQuery,
  onStaffQueryChange,
  filteredStaff,
  bookings,
  deletionRequestIds = new Set(),
  canDrag = false,
  canSelect = false,
  selectedStaffId = null,
  onStaffClick,
  resourceLabelPlural = "Staff",
  resourceLabelSingular = "staff",
  searchPlaceholder = "Search staff..."
}: Props) {
  const { colors } = useTheme();
  const panelHeight = maxHeight ?? undefined;

  return (
    <FitSection
      heading={`${resourceLabelPlural} Roster`}
      hideHeading
      noPadding
      style={panelHeight ? { height: panelHeight } : undefined}
    >
      <div
        style={{
          height: panelHeight,
          minHeight: panelHeight,
          backgroundColor: colors.surface,
          border: `1px solid ${colors.border}`,
          borderRadius: 16,
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
        }}
      >
      <div
        ref={scrollRef}
        style={{
          height: "100%",
          overflowY: "auto",
        }}
      >
        <div style={{ minHeight: "100%", padding: 12, display: "grid", alignContent: "start", gap: 10 }}>
          <FitSearch
            value={staffQuery}
            onChangeText={onStaffQueryChange}
            placeholder={searchPlaceholder}
            compact
          />
          <FitText
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: colors.textMuted,
              letterSpacing: "0.08em",
              textTransform: "uppercase"
            }}
          >
            {resourceLabelPlural.toUpperCase()}
          </FitText>
          {filteredStaff.length === 0 ? (
            <FitText style={{ fontSize: 14, color: colors.textMuted }}>
              No {resourceLabelSingular} found.
            </FitText>
          ) : (
            filteredStaff.map((staff) => {
              const bookingCount = bookings.filter((b) => b.resourceId === staff.id).length;
              const hasDeletion = deletionRequestIds.has(staff.id);
              const borderColor = canDrag
                ? urgencyBorderColor(bookingCount, hasDeletion, colors)
                : colors.border;
              const isCoachMeta = staff as Resource & {
                availabilityCount?: number;
                isActive?: boolean;
                specialties?: string[];
              };
              const isVisible = isCoachMeta.isActive ?? true;
              const availabilityCount = isCoachMeta.availabilityCount ?? 0;
              const specialties = isCoachMeta.specialties ?? [];
              const metaPrimary = specialties.length
                ? specialties.slice(0, 2).join(" / ")
                : `${bookingCount} booking${bookingCount !== 1 ? "s" : ""}`;
              const metaSecondary = isVisible
                ? `${availabilityCount} slot${availabilityCount !== 1 ? "s" : ""} / visible`
                : `${availabilityCount} slot${availabilityCount !== 1 ? "s" : ""} / hidden`;
              const statusLabel = hasDeletion
                ? "review"
                : !isVisible
                  ? "hidden"
                  : bookingCount >= 6
                    ? "peak"
                    : bookingCount >= 3
                      ? "active"
                      : "light";
              return (
                <DraggableStaffCard
                  key={staff.id}
                  staff={staff}
                  bookingCount={bookingCount}
                  borderColor={borderColor}
                  canDrag={canDrag}
                  canSelect={canSelect}
                  isSelected={staff.id === selectedStaffId}
                  colors={colors}
                  metaPrimary={metaPrimary}
                  metaSecondary={metaSecondary}
                  statusLabel={statusLabel}
                  isVisible={isVisible}
                  onCardClick={() => canSelect && onStaffClick(staff.id)}
                />
              );
            })
          )}
        </div>
      </div>
      </div>
    </FitSection>
  );
}

function DraggableStaffCard({ staff, bookingCount, borderColor, canDrag, canSelect, isSelected, colors, onCardClick, metaPrimary, metaSecondary, statusLabel, isVisible }: {
  staff: Resource;
  bookingCount: number;
  borderColor: string;
  canDrag: boolean;
  canSelect: boolean;
  isSelected: boolean;
  colors: ReturnType<typeof useTheme>["colors"];
  onCardClick: () => void;
  metaPrimary: string;
  metaSecondary: string;
  statusLabel: string;
  isVisible: boolean;
}) {
  const { settings } = useTheme();
  const canAnimate = settings.animationLevel !== "none";
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `coach:${staff.id}`,
    data: {
      kind: "coach",
      coachId: staff.id,
    },
    disabled: !canDrag
  });
  const isInteractive = canDrag || canSelect;
  const statusTone = statusLabel === "hidden"
    ? colors.textMuted
    : statusLabel === "peak"
      ? colors.warning
      : statusLabel === "review"
        ? colors.danger
        : isVisible
          ? colors.brand
          : colors.textMuted;

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Translate.toString(transform),
        opacity: isDragging ? 0.45 : 1,
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "10px 12px",
        minHeight: 88,
        width: "100%",
        borderRadius: 14,
        border: `1.5px solid ${isSelected ? colors.brand : borderColor}`,
        backgroundColor: isSelected ? `${colors.brand}14` : colors.surface,
        boxShadow: isSelected ? `0 0 0 1px ${colors.brand}1f inset` : "none",
        cursor: isInteractive ? "pointer" : "default",
        touchAction: canDrag ? "none" : "auto",
        transformOrigin: "center",
        transition: canAnimate
          ? "border-color 0.2s ease, background-color 0.2s ease"
          : "border-color 0.2s ease, background-color 0.2s ease"
      }}
      onClick={onCardClick}
      role={isInteractive ? "button" : undefined}
      aria-pressed={isInteractive ? isSelected : undefined}
      tabIndex={isInteractive ? 0 : undefined}
      onKeyDown={isInteractive ? (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onCardClick();
        }
      } : undefined}
    >
      <div
        style={{
          width: 4,
          alignSelf: "stretch",
          borderRadius: 999,
          backgroundColor: isSelected ? colors.brand : borderColor,
          opacity: isSelected ? 1 : 0.9,
          flexShrink: 0,
        }}
      />
      <div
        style={{
          width: 34,
          height: 34,
          borderRadius: 10,
          backgroundColor: isSelected ? `${colors.brand}24` : colors.surfaceRaised,
          border: `1px solid ${isSelected ? colors.brand + "44" : colors.border}`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0
        }}
      >
        <FitText
          style={{
            fontSize: 11,
            fontWeight: 700,
            color: isSelected ? colors.brand : colors.textMuted
          }}
        >
          {staff.initials ?? staff.name.slice(0, 2).toUpperCase()}
        </FitText>
      </div>
      <div style={{ flex: 1, minWidth: 0, display: "grid", gap: 2 }}>
        <FitText
          style={{
            fontSize: 13,
            fontWeight: 700,
            display: "block",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis"
          }}
        >
          {staff.name}
        </FitText>
        <FitText
          style={{
            fontSize: 11,
            color: colors.textSecondary,
            display: "block",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis"
          }}
        >
          {metaPrimary}
        </FitText>
        <FitText style={{ fontSize: 10, color: colors.textMuted, display: "block" }}>
          {metaSecondary}
        </FitText>
      </div>
      <div style={{ display: "grid", justifyItems: "end", gap: 8, flexShrink: 0 }}>
        <FitPill
          mode="status"
          label={statusLabel.toUpperCase()}
          color={statusTone}
          fontSize={9}
          fontWeight={700}
          borderOpacity="35"
          bgOpacity="14"
        />
        {canDrag && (
          <div
            {...listeners}
            {...attributes}
            style={{ cursor: "grab", color: colors.textMuted, lineHeight: 0 }}
            onClick={(e) => e.stopPropagation()}
            title="Drag to schedule"
          >
            <GripVertical size={15} strokeWidth={2} />
          </div>
        )}
        {!canDrag ? (
          <FitText style={{ fontSize: 10, color: colors.textMuted }}>
            {bookingCount} booked
          </FitText>
        ) : null}
      </div>
    </div>
  );
}
