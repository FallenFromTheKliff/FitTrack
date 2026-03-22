"use client";
import type { ReactNode } from "react";
import type { MotionStyle } from "framer-motion";

import { useTheme } from "@/contexts/ThemeContext";
import type { Resource, Booking } from "./types";

import { FitText } from "@/components/fit/FitText";
import FitSection from "@/components/fit/FitSection";
import TimelineHeader from "./TimelineHeader";
import TimelineBookingTile from "./TimelineBookingTile";

const START_HOUR = 6;
const END_HOUR = 14;
const BASE_ROW_HEIGHT = 72;
const COMPACT_ROW_HEIGHT = 52;
const BASE_RESOURCE_COL_WIDTH = 230;
const COMPACT_RESOURCE_COL_WIDTH = 84;
const BASE_MIN_SLOT_WIDTH = 72;
const COMPACT_MIN_SLOT_WIDTH = 52;

type Props = {
    heading?: string;
    action?: ReactNode;
    footer?: ReactNode;
    compact: boolean;
    resources: Resource[];
    bookings: Booking[];
    isLoading: boolean;
    date: Date;
    dateSlideStyle: MotionStyle;
    bookingActionId: string | null;
    onPrevDay: () => void;
    onNextDay: () => void;
    onOpenCalendar: () => void;
    onConfirmBooking: (id: string) => void;
    onRejectBooking: (id: string) => void;
};

export default function TimelinePanel({
    heading = "Timeline", action, footer,
    compact, resources, bookings,
    isLoading, date, dateSlideStyle,
    bookingActionId, onPrevDay, onNextDay,
    onOpenCalendar, onConfirmBooking, onRejectBooking
}: Props) {
    const { colors } = useTheme();

    const rowHeight = compact ? COMPACT_ROW_HEIGHT : BASE_ROW_HEIGHT;
    const resourceColWidth = compact ? COMPACT_RESOURCE_COL_WIDTH : BASE_RESOURCE_COL_WIDTH;
    const minSlotWidth = compact ? COMPACT_MIN_SLOT_WIDTH : BASE_MIN_SLOT_WIDTH;
    const hourSlots = Array.from({ length: END_HOUR - START_HOUR + 1 }, (_, i) => START_HOUR + i);
    const slotCount = hourSlots.length;
    const totalTimelineMinutes = slotCount * 60;
    const timelineHeight = resources.length * rowHeight;
    const timelineMinWidth = resourceColWidth + slotCount * minSlotWidth;
    const showDetails = !compact;

    return (
        <FitSection heading={heading} action={action} noPadding>
            <div style={{ backgroundColor: colors.surface, border: `1px solid ${colors.border}`, borderRadius: 14, overflow: "hidden" }}>
                {isLoading ? (
                    <div style={{ padding: "10px 12px", borderBottom: `1px solid ${colors.border}` }}>
                        <FitText style={{ fontSize: 12, color: colors.textMuted }}>Loading schedule data...</FitText>
                    </div>
                ) : null}
                <TimelineHeader
                    date={date}
                    dateSlideStyle={dateSlideStyle}
                    onPrevDay={onPrevDay}
                    onNextDay={onNextDay}
                    onOpenCalendar={onOpenCalendar}
                />
                <div style={{ overflowX: "auto" }}>
                    <div style={{ width: "100%", minWidth: timelineMinWidth, display: "grid", gridTemplateColumns: `${resourceColWidth}px minmax(${slotCount * minSlotWidth}px, 1fr)` }}>
                        {/* Resource column */}
                        <div style={{ borderRight: `1px solid ${colors.border}` }}>
                            <div style={{ height: 40, display: "flex", alignItems: "center", justifyContent: showDetails ? "flex-start" : "center", padding: showDetails ? "0 12px" : "0 6px", borderBottom: `1px solid ${colors.border}` }}>
                                {showDetails ? (
                                    <FitText style={{ fontSize: 12, fontWeight: 700, color: colors.textMuted, letterSpacing: "0.06em", textTransform: "uppercase" }}>Resource</FitText>
                                ) : null}
                            </div>
                            {resources.map((resource) => (
                                <div key={resource.id} style={{ height: rowHeight, padding: showDetails ? "0 12px" : "0 4px", borderBottom: `1px solid ${colors.border}`, display: "flex", alignItems: "center", gap: showDetails ? 10 : 0, justifyContent: showDetails ? "flex-start" : "center" }}>
                                    <div style={{ width: 26, height: 26, borderRadius: 8, backgroundColor: colors.surfaceRaised, border: `1px solid ${colors.border}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                                        {resource.initials ? (
                                            <FitText as="span" style={{ fontSize: 10, fontWeight: 700, color: colors.brand }}>{resource.initials}</FitText>
                                        ) : (
                                            <FitText as="span" style={{ fontSize: 15 }}>{resource.icon}</FitText>
                                        )}
                                    </div>
                                    {showDetails ? (
                                        <div style={{ minWidth: 0 }}>
                                            <FitText style={{ fontSize: 13, fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", display: "block" }}>{resource.name}</FitText>
                                            {resource.type === "trainer" && (
                                                <FitText style={{ fontSize: 10, color: colors.textMuted, marginTop: 1, display: "block", textTransform: "capitalize" }}>Staff</FitText>
                                            )}
                                        </div>
                                    ) : null}
                                </div>
                            ))}
                        </div>
                        {/* Time + booking grid */}
                        <div style={{ position: "relative" }}>
                            <div style={{ display: "grid", gridTemplateColumns: `repeat(${slotCount}, minmax(${minSlotWidth}px, 1fr))`, borderBottom: `1px solid ${colors.border}` }}>
                                {hourSlots.map((hour) => (
                                    <div key={hour} style={{ height: 40, display: "flex", alignItems: "center", justifyContent: "center", borderRight: `1px solid ${colors.border}` }}>
                                        <FitText style={{ fontSize: 11, color: colors.textMuted }}>{hour}:00</FitText>
                                    </div>
                                ))}
                            </div>
                            <div style={{ position: "relative", height: timelineHeight }}>
                                {resources.map((resource, rowIndex) => (
                                    <div key={resource.id} style={{ position: "absolute", left: 0, right: 0, top: rowIndex * rowHeight, height: rowHeight, borderBottom: `1px solid ${colors.border}`, display: "grid", gridTemplateColumns: `repeat(${slotCount}, minmax(${minSlotWidth}px, 1fr))` }}>
                                        {hourSlots.map((hour) => (
                                            <div key={hour} style={{ borderRight: `1px solid ${colors.border}`, height: "100%" }} />
                                        ))}
                                    </div>
                                ))}
                                {bookings.map((booking) => {
                                    const rowIndex = resources.findIndex((r) => r.id === booking.resourceId);
                                    if (rowIndex < 0) return null;
                                    return (
                                        <TimelineBookingTile
                                            key={booking.id}
                                            booking={booking}
                                            rowIndex={rowIndex}
                                            rowHeight={rowHeight}
                                            startHour={START_HOUR}
                                            totalTimelineMinutes={totalTimelineMinutes}
                                            compact={compact}
                                            bookingActionId={bookingActionId}
                                            onConfirm={onConfirmBooking}
                                            onReject={onRejectBooking}
                                        />
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                </div>
                {footer ? <div style={{ marginTop: 12 }}>{footer}</div> : null}
            </div>
        </FitSection>
    );
}