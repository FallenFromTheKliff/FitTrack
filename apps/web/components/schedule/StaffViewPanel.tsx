"use client";
import { CalendarPlus } from "lucide-react";

import type { Resource, Booking } from "./types";
import type { MotionStyle } from "framer-motion";

import FitButton from "@/components/fit/FitButton";
import FitPill from "@/components/fit/FitPill";
import FitSection from "@/components/fit/FitSection";
import ActivityItem from "./ActivityItem";
import TimelinePanel from "./TimelinePanel";

const STAFF_VIEW_TABS = [
    { key: "activities", label: "Recent Activities" },
    { key: "schedule", label: "Schedule" }
] as const;

type StaffView = typeof STAFF_VIEW_TABS[number]["key"];

type ActivityEntry = { id: string; label: string; date: string };

type Props = {
    staffView: StaffView;
    onStaffViewChange: (v: StaffView) => void;
    activities: ActivityEntry[];
    resources: Resource[];
    bookings: Booking[];
    isLoading: boolean;
    compact: boolean;
    date: Date;
    dateSlideStyle: MotionStyle;
    bookingActionId: string | null;
    onPrevDay: () => void;
    onNextDay: () => void;
    onOpenCalendar: () => void;
    onConfirmBooking: (id: string) => void;
    onRejectBooking: (id: string) => void;
    onCreateBooking: () => void;
};

export default function StaffViewPanel({
    staffView, onStaffViewChange,
    activities, resources, bookings, isLoading, compact,
    date, dateSlideStyle, bookingActionId,
    onPrevDay, onNextDay, onOpenCalendar,
    onConfirmBooking, onRejectBooking, onCreateBooking
}: Props) {
    return (
        <>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
                <FitPill options={[...STAFF_VIEW_TABS]} active={staffView} onChange={onStaffViewChange} />
                <FitButton variant="primary" label="CREATE BOOKING" icon={CalendarPlus} iconSize={14} onClick={onCreateBooking} />
            </div>
            {staffView === "activities" ? (
                <FitSection heading="Recent Activities">
                    <div style={{ display: "grid", gap: 10 }}>
                        {activities.map((activity) => (
                            <ActivityItem key={activity.id} label={activity.label} date={activity.date} />
                        ))}
                    </div>
                </FitSection>
            ) : (
                <TimelinePanel
                    heading="Schedule"
                    compact={compact}
                    resources={resources}
                    bookings={bookings}
                    isLoading={isLoading}
                    date={date}
                    dateSlideStyle={dateSlideStyle}
                    bookingActionId={bookingActionId}
                    onPrevDay={onPrevDay}
                    onNextDay={onNextDay}
                    onOpenCalendar={onOpenCalendar}
                    onConfirmBooking={onConfirmBooking}
                    onRejectBooking={onRejectBooking}
                />
            )}
        </>
    );
}