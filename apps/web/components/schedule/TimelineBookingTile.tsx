"use client";
import { useTheme } from "@/contexts/ThemeContext";
import type { Booking } from "@/data/schedule-constants";

import { FitText } from "@/components/fit/FitText";
import FitButton from "@/components/fit/FitButton";

type Props = {
    booking: Booking;
    rowIndex: number;
    rowHeight: number;
    startHour: number;
    totalTimelineMinutes: number;
    compact: boolean;
    bookingActionId: string | null;
    onConfirm: (id: string) => void;
    onReject: (id: string) => void;
};

export default function TimelineBookingTile({
    booking, rowIndex, rowHeight, startHour,
    totalTimelineMinutes, compact,
    bookingActionId, onConfirm, onReject
}: Props) {
    const { colors } = useTheme();
    const startOffset = (booking.startHour - startHour) * 60 + booking.startMinute;
    const leftPct = (startOffset / totalTimelineMinutes) * 100;
    const widthPct = (booking.durationMin / totalTimelineMinutes) * 100;
    const isPending = booking.source === "api" && booking.status === "pending";
    const isActing = bookingActionId === booking.id;

    return (
        <div style={{
            position: "absolute",
            left: `calc(${leftPct}% + 4px)`,
            top: rowIndex * rowHeight + 10,
            width: `max(calc(${widthPct}% - 8px), 58px)`,
            height: rowHeight - 20,
            borderRadius: 8,
            backgroundColor: booking.color,
            color: colors.surface,
            padding: "7px 9px",
            overflow: "hidden",
            boxShadow: "0 8px 18px rgba(0,0,0,0.18)"
        }}>
            <FitText as="span" style={{ color: colors.surface, fontSize: 12, fontWeight: 600, lineHeight: 1.25, display: "block", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {booking.title}
            </FitText>
            <FitText as="span" style={{ color: colors.surface, fontSize: 11, marginTop: 2, display: "block" }}>
                {`${String(booking.startHour).padStart(2, "0")}:${String(booking.startMinute).padStart(2, "0")}`}
            </FitText>
            {isPending && !compact ? (
                <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
                    <FitButton
                        variant="overlay"
                        onClick={(e) => { e.stopPropagation(); onConfirm(booking.id); }}
                        disabled={isActing}
                        style={{ color: colors.surface }}
                    >
                        {isActing ? "..." : "CONFIRM"}
                    </FitButton>
                    <FitButton
                        variant="overlay"
                        onClick={(e) => { e.stopPropagation(); onReject(booking.id); }}
                        disabled={isActing}
                        style={{ color: colors.surface }}
                    >
                        REJECT
                    </FitButton>
                </div>
            ) : null}
        </div>
    );
}
