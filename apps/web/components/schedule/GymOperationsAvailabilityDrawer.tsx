"use client";

import { useEffect, useMemo, useState } from "react";

import { useTheme } from "@/contexts/ThemeContext";
import { FitButton, FitSelect, FitText, FitTextInput } from "@/components/fit";
import { OverlayFrame } from "./GymOperationsOverlayFrame";
import {
  WEEKDAY_OPTIONS,
  actionPillStyle,
  overlaySurfaceStyle,
  type AvailabilitySlotDraft,
} from "./GymOperationsOverlayShared";

export function GymOperationsAvailabilityDrawer({
  coachName,
  initialSlots,
  isOpen,
  isSaving = false,
  isVisibleInBooking,
  onClose,
  onSave,
  onSetBookingVisibility,
}: {
  coachName: string;
  initialSlots: AvailabilitySlotDraft[];
  isOpen: boolean;
  isSaving?: boolean;
  isVisibleInBooking: boolean;
  onClose: () => void;
  onSave: (slots: AvailabilitySlotDraft[]) => Promise<void> | void;
  onSetBookingVisibility: (isVisible: boolean) => void;
}) {
  const { colors, settings } = useTheme();
  const [slots, setSlots] = useState<AvailabilitySlotDraft[]>([]);
  const shouldAnimate = settings.animationLevel !== "none";

  useEffect(() => {
    if (!isOpen) return;
    setSlots(
      [...initialSlots].sort((left, right) =>
        left.dayOfWeek === right.dayOfWeek
          ? left.startTime.localeCompare(right.startTime)
          : left.dayOfWeek - right.dayOfWeek,
      ),
    );
  }, [initialSlots, isOpen]);

  const slotRows = useMemo(() => {
    if (slots.length > 0) return slots;
    return [{ dayOfWeek: 1, startTime: "08:00", endTime: "10:00" }];
  }, [slots]);
  const coveredDaysCount = useMemo(
    () => new Set(slotRows.map((slot) => slot.dayOfWeek)).size,
    [slotRows],
  );
  const hasInvalidSlot = slotRows.some(
    (slot) =>
      !slot.startTime || !slot.endTime || slot.endTime <= slot.startTime,
  );

  const updateSlot = (index: number, patch: Partial<AvailabilitySlotDraft>) => {
    setSlots((current) =>
      current.map((slot, slotIndex) =>
        slotIndex === index ? { ...slot, ...patch } : slot,
      ),
    );
  };
  const addSlot = () => {
    setSlots((current) => [
      ...current,
      { dayOfWeek: 1, startTime: "08:00", endTime: "10:00" },
    ]);
  };

  const handleSave = async () => {
    if (hasInvalidSlot) return;
    await onSave(slotRows);
  };

  return (
    <OverlayFrame
      isOpen={isOpen}
      onClose={onClose}
      closeDisabled={isSaving}
      title="Manage availability"
      subtitle={`Set the weekly slots members can book for ${coachName}. Visibility controls whether this coach appears in member booking surfaces.`}
      footer={
        <FitButton
          variant="primary"
          label={isSaving ? "SAVING..." : "SAVE SCHEDULE"}
          onClick={() => void handleSave()}
          disabled={isSaving || hasInvalidSlot}
          style={actionPillStyle(colors, true)}
          textStyle={{ fontSize: 13, fontWeight: 700 }}
        />
      }
    >
      <div
        onClick={(event) => event.stopPropagation()}
        style={{
          display: "grid",
          gap: 14,
          transform: shouldAnimate && isOpen ? "scale(1)" : "scale(0.985)",
          transition: shouldAnimate ? "transform 180ms ease" : "none",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "flex-end",
            gap: 16,
          }}
        >
          <FitButton
            variant={isVisibleInBooking ? "ghost" : "primary"}
            label={isVisibleInBooking ? "HIDE FROM BOOKING" : "SHOW IN BOOKING"}
            onClick={() => onSetBookingVisibility(!isVisibleInBooking)}
            disabled={isSaving}
            style={actionPillStyle(colors, !isVisibleInBooking)}
            textStyle={{ fontSize: 12, fontWeight: 700 }}
          />
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
            gap: 12,
          }}
        >
          {[
            {
              label: "Booking visibility",
              tone: isVisibleInBooking ? colors.success : colors.warning,
              value: isVisibleInBooking ? "Visible" : "Hidden",
            },
            {
              label: "Weekly slots",
              tone: colors.brand,
              value: String(slotRows.length),
            },
            {
              label: "Days covered",
              tone: colors.textPrimary,
              value: String(coveredDaysCount),
            },
          ].map((item) => (
            <div
              key={item.label}
              style={{ ...overlaySurfaceStyle(colors), gap: 6 }}
            >
              <FitText
                excludeGlobalScale
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  color: colors.textMuted,
                  letterSpacing: "0.06em",
                }}
              >
                {item.label.toUpperCase()}
              </FitText>
              <FitText
                excludeGlobalScale
                style={{ fontSize: 20, fontWeight: 800, color: item.tone }}
              >
                {item.value}
              </FitText>
            </div>
          ))}
        </div>

        <div style={{ ...overlaySurfaceStyle(colors), gap: 16 }}>
          <div
            style={{
              display: "flex",
              alignItems: "flex-start",
              justifyContent: "space-between",
              gap: 12,
              flexWrap: "wrap",
            }}
          >
            <div style={{ display: "grid", gap: 6 }}>
              <FitText
                excludeGlobalScale
                style={{
                  fontSize: 15,
                  fontWeight: 800,
                  color: colors.textPrimary,
                }}
              >
                Weekly schedule
              </FitText>
              <FitText
                excludeGlobalScale
                style={{
                  fontSize: 12,
                  color: colors.textMuted,
                  lineHeight: 1.35,
                  maxWidth: 360,
                }}
              >
                Adjust the coach&apos;s recurring weekly windows here. Each row
                becomes a persisted booking slot after save.
              </FitText>
            </div>
            <FitButton
              variant="ghost"
              label="ADD SLOT"
              onClick={addSlot}
              disabled={isSaving}
              style={{ ...actionPillStyle(colors), minWidth: 88 }}
              textStyle={{ fontSize: 12, fontWeight: 700 }}
            />
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns:
                "minmax(110px, 0.8fr) minmax(0, 1fr) minmax(0, 1fr) auto",
              gap: 10,
              padding: "0 2px",
            }}
          >
            {["Day", "Start time", "End time", "Action"].map((label) => (
              <FitText
                key={label}
                excludeGlobalScale
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  color: colors.textMuted,
                  letterSpacing: "0.06em",
                }}
              >
                {label.toUpperCase()}
              </FitText>
            ))}
          </div>

          <div style={{ display: "grid", gap: 10 }}>
            {slotRows.map((slot, index) => (
              <div
                key={`${slot.dayOfWeek}-${slot.startTime}-${slot.endTime}-${index}`}
                style={{
                  borderRadius: 16,
                  border: `1px solid ${colors.border}`,
                  backgroundColor: colors.surfaceRaised,
                  padding: 14,
                  display: "grid",
                  gridTemplateColumns:
                    "minmax(110px, 0.8fr) minmax(0, 1fr) minmax(0, 1fr) auto",
                  gap: 10,
                  alignItems: "center",
                }}
              >
                <FitSelect
                  value={String(slot.dayOfWeek)}
                  onChange={(event) =>
                    updateSlot(index, { dayOfWeek: Number(event.target.value) })
                  }
                  options={WEEKDAY_OPTIONS}
                  compact
                  fullWidth
                />
                <FitTextInput
                  type="time"
                  value={slot.startTime}
                  onChange={(event) =>
                    updateSlot(index, { startTime: event.target.value })
                  }
                  disabled={isSaving}
                />
                <FitTextInput
                  type="time"
                  value={slot.endTime}
                  onChange={(event) =>
                    updateSlot(index, { endTime: event.target.value })
                  }
                  disabled={isSaving}
                />
                <FitButton
                  variant="ghost"
                  label="REMOVE"
                  onClick={() =>
                    setSlots((current) =>
                      current.filter((_, slotIndex) => slotIndex !== index),
                    )
                  }
                  disabled={isSaving || slotRows.length === 1}
                  style={{ ...actionPillStyle(colors), minWidth: 84 }}
                  textStyle={{ fontSize: 12, fontWeight: 700 }}
                />
              </div>
            ))}
          </div>

          {hasInvalidSlot ? (
            <FitText
              excludeGlobalScale
              style={{ fontSize: 12, color: colors.danger, lineHeight: 1.35 }}
            >
              End time must be later than start time for every slot before you
              can save.
            </FitText>
          ) : null}
        </div>

      </div>
    </OverlayFrame>
  );
}
