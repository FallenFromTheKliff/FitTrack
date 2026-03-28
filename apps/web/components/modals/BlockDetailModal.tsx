"use client";
import { useEffect, useState } from "react";
import { CalendarDays } from "lucide-react";
import { BORDER_RADIUS } from "@fittrack/ui";
import { useTheme } from "@/contexts/ThemeContext";
import type { Booking, Resource } from "@/data/schedule-constants";

import { FitText, FitTextInput } from "@/components/fit/FitText";
import FitButton from "@/components/fit/FitButton";
import FitModal from "@/components/modals/FitModal";
import { FitSelect } from "@/components/fit/FitCard";

type Props = {
  isOpen: boolean;
  block: Booking | null;
  staffMembers: Resource[];
  onSave: (updated: Booking) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
};

export default function BlockDetailModal({ isOpen, block, staffMembers, onSave, onDelete, onClose }: Props) {
  const { colors, onBrandTextColor } = useTheme();
  const [title, setTitle] = useState("");
  const [venueLabel, setVenueLabel] = useState("");
  const [durationMin, setDurationMin] = useState("60");
  const [assignedId, setAssignedId] = useState("");

  useEffect(() => {
    if (block) {
      setTitle(block.title ?? "");
      setVenueLabel(block.venueLabel ?? "");
      setDurationMin(String(block.durationMin ?? 60));
      setAssignedId(block.resourceId ?? "");
    }
  }, [block]);

  if (!block) return null;

  const startLabel = `${String(block.startHour).padStart(2, "0")}:${String(block.startMinute).padStart(2, "0")}`;

  const handleSave = () => {
    onSave({
      ...block,
      title,
      venueLabel,
      durationMin: Math.max(15, Number(durationMin) || 60),
      resourceId: assignedId,
      resourceName: staffMembers.find((s) => s.id === assignedId)?.name ?? block.resourceName
    });
  };

  const inputStyle = {
    width: "100%",
    padding: "10px 13px",
    borderRadius: BORDER_RADIUS.input,
    border: `1px solid ${colors.fieldBorder}`,
    backgroundColor: colors.fieldBg,
    color: colors.textPrimary,
    fontSize: 15,
    fontFamily: "inherit",
    outline: "none"
  };

  const labelStyle = {
    fontSize: 13,
    fontWeight: 600,
    color: colors.textMuted,
    marginBottom: 7,
    display: "block",
    textTransform: "uppercase" as const,
    letterSpacing: "0.06em"
  };

  return (
    <FitModal
      isOpen={isOpen}
      onClose={onClose}
      title="Schedule Block"
      subtitle={`${block.date ?? ""} · ${startLabel}`}
      iconNode={<CalendarDays size={15} color={onBrandTextColor} strokeWidth={2} />}
      maxWidth={460}
      closeAriaLabel="Close schedule block"
      footer={
        <>
          <FitButton
            variant="danger"
            label="DELETE"
            onClick={() => onDelete(block.id)}
            style={{ flex: 1 }}
          />
          <FitButton
            variant="primary"
            label="SAVE"
            onClick={handleSave}
            style={{ flex: 1 }}
          />
        </>
      }
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <div>
          <FitText as="label" style={labelStyle}>Title</FitText>
          <FitTextInput
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Morning Shift"
            style={inputStyle}
          />
        </div>
        <div>
          <FitText as="label" style={labelStyle}>Venue Assigned</FitText>
          <FitTextInput
            value={venueLabel}
            onChange={(e) => setVenueLabel(e.target.value)}
            placeholder="e.g. Basketball Court"
            style={inputStyle}
          />
        </div>
        <div>
          <FitText as="label" style={labelStyle}>Duration (minutes)</FitText>
          <FitTextInput
            type="number"
            min={15}
            step={15}
            value={durationMin}
            onChange={(e) => setDurationMin(e.target.value)}
            style={inputStyle}
          />
        </div>
        <div>
          <FitText as="label" style={labelStyle}>Staff Assigned</FitText>
          <FitSelect
            fullWidth
            value={assignedId}
            onChange={(e) => setAssignedId(e.target.value)}
            options={staffMembers.map((s) => ({ label: s.name, value: s.id }))}
            style={{ borderColor: colors.fieldBorder, backgroundColor: colors.fieldBg }}
          />
        </div>
      </div>
    </FitModal>
  );
}
