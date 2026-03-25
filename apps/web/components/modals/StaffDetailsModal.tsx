"use client";
import { X, Activity, MapPin, Clock } from "lucide-react";
import type { ThemeColors } from "@fittrack/types";
import type { Booking } from "@/data/schedule-constants";

import { FitText } from "@/components/fit/FitText";
import FitButton from "@/components/fit/FitButton";

type Props = {
  isOpen: boolean;
  staffId: string;
  staffName: string;
  bookings: Booking[];
  colors: ThemeColors;
  onClose: () => void;
};

const MOCK_LOGS = [
  { label: "Assigned to Basketball Court", date: "Mar 24, 2026" },
  { label: "Booking #8821 confirmed", date: "Mar 23, 2026" },
  { label: "Shift updated by Admin", date: "Mar 22, 2026" }
];

export default function StaffDetailsModal({ isOpen, staffId, staffName, bookings, colors, onClose }: Props) {
  if (!isOpen) return null;

  const confirmedCount = bookings.filter((b) => b.status === "confirmed").length;
  const venues = [...new Set(bookings.map((b) => b.venueLabel).filter(Boolean))];

  return (
    <div style={{ position: "fixed", inset: 0, backgroundColor: colors.overlay, display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9000, padding: 20 }}>
      <div style={{ backgroundColor: colors.surface, borderRadius: 16, border: `1px solid ${colors.border}`, width: "100%", maxWidth: 520, boxShadow: "0 20px 40px rgba(0,0,0,0.25)" }}>
        <div style={{ padding: "18px 20px", borderBottom: `1px solid ${colors.border}`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 40, height: 40, borderRadius: 10, backgroundColor: colors.brand, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <FitText style={{ fontSize: 15, fontWeight: 700, color: colors.onBrand ?? colors.surface }}>
                {staffName.slice(0, 2).toUpperCase()}
              </FitText>
            </div>
            <div>
              <FitText style={{ fontSize: 17, fontWeight: 700 }}>{staffName}</FitText>
              <FitText style={{ fontSize: 13, color: colors.textMuted }}>Staff Member</FitText>
            </div>
          </div>
          <FitButton variant="ghost" icon={X} iconOnly onClick={onClose} style={{ padding: 6, minHeight: 32, minWidth: 32 }} aria-label="Close staff details" />
        </div>
        <div style={{ padding: "18px 20px", display: "flex", flexDirection: "column", gap: 18 }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
            {[
              { icon: Activity, label: "Availability", value: confirmedCount < 6 ? "Available" : "Busy", color: confirmedCount < 6 ? colors.success : colors.warning },
              { icon: MapPin, label: "Venues", value: venues.length > 0 ? venues[0] : "Unassigned", color: colors.brand },
              { icon: Clock, label: "Bookings", value: String(confirmedCount), color: colors.brand }
            ].map((item) => (
              <div key={item.label} style={{ backgroundColor: colors.surfaceRaised, borderRadius: 10, border: `1px solid ${colors.border}`, padding: "12px 14px" }}>
                <item.icon size={16} color={item.color} strokeWidth={2} />
                <FitText style={{ fontSize: 11, color: colors.textMuted, display: "block", marginTop: 6 }}>{item.label}</FitText>
                <FitText style={{ fontSize: 14, fontWeight: 700, color: item.color, display: "block", marginTop: 2 }}>{item.value}</FitText>
              </div>
            ))}
          </div>
          <div>
            <FitText style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.08em", color: colors.textMuted, marginBottom: 8, display: "block" }}>ASSIGNED VENUES</FitText>
            {venues.length > 0 ? venues.map((v) => (
              <div key={v} style={{ padding: "8px 12px", borderRadius: 8, backgroundColor: `${colors.brand}12`, border: `1px solid ${colors.brand}30`, marginBottom: 6 }}>
                <FitText style={{ fontSize: 14, color: colors.brand }}>{v}</FitText>
              </div>
            )) : (
              <FitText style={{ fontSize: 14, color: colors.textMuted }}>No venues assigned yet.</FitText>
            )}
          </div>
          <div>
            <FitText style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.08em", color: colors.textMuted, marginBottom: 8, display: "block" }}>RECENT INTERACTIONS & LOGS</FitText>
            {MOCK_LOGS.map((log, i) => (
              <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: i < MOCK_LOGS.length - 1 ? `1px solid ${colors.border}` : "none" }}>
                <FitText style={{ fontSize: 14 }}>{log.label}</FitText>
                <FitText style={{ fontSize: 12, color: colors.textMuted }}>{log.date}</FitText>
              </div>
            ))}
          </div>
        </div>
        <div style={{ padding: "14px 20px", borderTop: `1px solid ${colors.border}` }}>
          <FitButton variant="ghost" label="Close" onClick={onClose} fullWidth />
        </div>
      </div>
    </div>
  );
}
