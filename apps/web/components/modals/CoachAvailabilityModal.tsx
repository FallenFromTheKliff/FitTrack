"use client";
import { useEffect, useMemo, useState } from "react";

import { FitButton, FitSelect, FitText, FitTextInput } from "@/components/fit";
import FitModal from "@/components/modals/FitModal";
import { useTheme } from "@/contexts/ThemeContext";

type AvailabilitySlotDraft = {
  dayOfWeek: number;
  endTime: string;
  startTime: string;
};

type Props = {
  coachName: string;
  initialSlots: AvailabilitySlotDraft[];
  isOpen: boolean;
  isSaving?: boolean;
  onClose: () => void;
  onSave: (slots: AvailabilitySlotDraft[]) => Promise<void> | void;
};

const DAY_OPTIONS = [
  { label: "Sunday", value: "0" },
  { label: "Monday", value: "1" },
  { label: "Tuesday", value: "2" },
  { label: "Wednesday", value: "3" },
  { label: "Thursday", value: "4" },
  { label: "Friday", value: "5" },
  { label: "Saturday", value: "6" },
];

function sortSlots(slots: AvailabilitySlotDraft[]) {
  return [...slots].sort((left, right) => {
    if (left.dayOfWeek !== right.dayOfWeek) {
      return left.dayOfWeek - right.dayOfWeek;
    }
    return left.startTime.localeCompare(right.startTime);
  });
}

export default function CoachAvailabilityModal({
  coachName,
  initialSlots,
  isOpen,
  isSaving = false,
  onClose,
  onSave,
}: Props) {
  const { colors } = useTheme();
  const [slots, setSlots] = useState<AvailabilitySlotDraft[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setSlots(sortSlots(initialSlots));
    setErrorMessage(null);
  }, [initialSlots, isOpen]);

  const slotCountLabel = useMemo(() => {
    if (slots.length === 0) return "No weekly slots configured";
    return `${slots.length} weekly slot${slots.length === 1 ? "" : "s"} configured`;
  }, [slots.length]);

  const updateSlot = (
    index: number,
    patch: Partial<AvailabilitySlotDraft>,
  ) => {
    setSlots((current) =>
      current.map((slot, slotIndex) =>
        slotIndex === index ? { ...slot, ...patch } : slot,
      ),
    );
  };

  const removeSlot = (index: number) => {
    setSlots((current) => current.filter((_, slotIndex) => slotIndex !== index));
  };

  const addSlot = () => {
    setSlots((current) => [
      ...current,
      { dayOfWeek: 1, startTime: "08:00", endTime: "10:00" },
    ]);
  };

  const handleSave = async () => {
    const normalizedSlots = sortSlots(slots).map((slot) => ({
      dayOfWeek: slot.dayOfWeek,
      startTime: slot.startTime,
      endTime: slot.endTime,
    }));

    for (const slot of normalizedSlots) {
      if (!slot.startTime || !slot.endTime) {
        setErrorMessage("Every slot needs both a start and end time.");
        return;
      }

      if (slot.startTime >= slot.endTime) {
        setErrorMessage("Each slot must end after it starts.");
        return;
      }
    }

    for (let index = 1; index < normalizedSlots.length; index += 1) {
      const previous = normalizedSlots[index - 1];
      const current = normalizedSlots[index];

      if (
        previous &&
        current.dayOfWeek === previous.dayOfWeek &&
        current.startTime < previous.endTime
      ) {
        setErrorMessage("Slots on the same day cannot overlap.");
        return;
      }
    }

    setErrorMessage(null);
    await onSave(normalizedSlots);
  };

  return (
    <FitModal
      isOpen={isOpen}
      onClose={isSaving ? () => {} : onClose}
      title="Manage Coach Availability"
      subtitle={`${coachName} - ${slotCountLabel}`}
      maxWidth={720}
      closeAriaLabel="Close coach availability editor"
      footer={
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            width: "100%",
          }}
        >
          <FitButton
            variant="ghost"
            label="CANCEL"
            onClick={onClose}
            disabled={isSaving}
          />
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <FitButton
              variant="ghost"
              label="ADD SLOT"
              onClick={addSlot}
              disabled={isSaving}
            />
            <FitButton
              variant="primary"
              label={isSaving ? "SAVING..." : "SAVE AVAILABILITY"}
              onClick={() => void handleSave()}
              disabled={isSaving}
            />
          </div>
        </div>
      }
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <FitText style={{ fontSize: 14, color: colors.textMuted }}>
          Staff-managed weekly availability powers the coach roster, booking review,
          and member-facing coach previews. Removing every slot will clear this
          coach from bookable weekly hours until new availability is saved.
        </FitText>
        {errorMessage ? (
          <div
            style={{
              borderRadius: 10,
              border: `1px solid ${colors.danger}55`,
              backgroundColor: `${colors.danger}12`,
              padding: "10px 12px",
            }}
          >
            <FitText style={{ fontSize: 13, color: colors.danger, fontWeight: 700 }}>
              {errorMessage}
            </FitText>
          </div>
        ) : null}
        {slots.length === 0 ? (
          <div
            style={{
              borderRadius: 12,
              border: `1px dashed ${colors.border}`,
              backgroundColor: colors.surfaceRaised,
              padding: 20,
            }}
          >
            <FitText style={{ fontSize: 14, color: colors.textMuted }}>
              No weekly slots configured yet. Add a slot to define when this coach
              can be booked.
            </FitText>
          </div>
        ) : (
          slots.map((slot, index) => (
            <div
              key={`${slot.dayOfWeek}-${slot.startTime}-${slot.endTime}-${index}`}
              style={{
                display: "grid",
                gridTemplateColumns: "minmax(150px, 1fr) minmax(120px, 1fr) minmax(120px, 1fr) auto",
                gap: 10,
                alignItems: "end",
                borderRadius: 12,
                border: `1px solid ${colors.border}`,
                backgroundColor: colors.surfaceRaised,
                padding: 14,
              }}
            >
              <div style={{ display: "grid", gap: 6 }}>
                <FitText style={{ fontSize: 12, fontWeight: 700, color: colors.textMuted }}>
                  Day
                </FitText>
                <FitSelect
                  value={String(slot.dayOfWeek)}
                  options={DAY_OPTIONS}
                  onChange={(event) =>
                    updateSlot(index, { dayOfWeek: Number(event.target.value) })
                  }
                  fullWidth
                  disabled={isSaving}
                />
              </div>
              <div style={{ display: "grid", gap: 6 }}>
                <FitText style={{ fontSize: 12, fontWeight: 700, color: colors.textMuted }}>
                  Start
                </FitText>
                <FitTextInput
                  type="time"
                  value={slot.startTime}
                  onChange={(event) =>
                    updateSlot(index, { startTime: event.target.value })
                  }
                  disabled={isSaving}
                />
              </div>
              <div style={{ display: "grid", gap: 6 }}>
                <FitText style={{ fontSize: 12, fontWeight: 700, color: colors.textMuted }}>
                  End
                </FitText>
                <FitTextInput
                  type="time"
                  value={slot.endTime}
                  onChange={(event) =>
                    updateSlot(index, { endTime: event.target.value })
                  }
                  disabled={isSaving}
                />
              </div>
              <FitButton
                variant="danger"
                label="REMOVE"
                onClick={() => removeSlot(index)}
                disabled={isSaving}
              />
            </div>
          ))
        )}
      </div>
    </FitModal>
  );
}
