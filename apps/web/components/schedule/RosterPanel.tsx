"use client";
import type { RefObject } from "react";

import { useTheme } from "@/contexts/ThemeContext";
import type { Resource, Booking } from "./types";

import { FitText } from "@/components/fit/FitText";
import FitSearch from "@/components/fit/FitSearch";
import FitSection from "@/components/fit/FitSection";
import RosterCard from "./RosterCard";

type Props = {
    scrollRef: RefObject<HTMLDivElement | null>;
    maxHeight: number | null;
    staffQuery: string;
    onStaffQueryChange: (v: string) => void;
    filteredStaff: Resource[];
    bookings: Booking[];
    activePersona: string;
    onSelectPersona: (id: string) => void;
};

export default function RosterPanel({ scrollRef, maxHeight, staffQuery, onStaffQueryChange, filteredStaff, bookings, activePersona, onSelectPersona }: Props) {
    const { colors } = useTheme();
    const adminBookingCount = bookings.length;

    return (
        <FitSection heading="Schedule Roster" hideHeading>
            <div ref={scrollRef} style={{ maxHeight: maxHeight ?? undefined, overflowY: "auto" }}>
                <div style={{ padding: 14, display: "grid", gap: 12 }}>
                    <FitSearch value={staffQuery} onChangeText={onStaffQueryChange} placeholder="Search staff..." />
                    <div style={{ display: "grid", gap: 8 }}>
                        <FitText style={{ fontSize: 11, fontWeight: 700, color: colors.textMuted, letterSpacing: "0.08em" }}>ADMIN</FitText>
                        <RosterCard
                            resource={{ id: "admin", name: "Admin", type: "trainer", icon: "", initials: "A" }}
                            bookingCount={adminBookingCount}
                            isActive={activePersona === "admin"}
                            onSelect={onSelectPersona}
                            subtitle="Administrator"
                        />
                        <FitText style={{ fontSize: 11, fontWeight: 700, color: colors.textMuted, letterSpacing: "0.08em", marginTop: 4 }}>STAFF</FitText>
                        {filteredStaff.length === 0 ? (
                            <FitText style={{ fontSize: 12, color: colors.textMuted }}>No staff found.</FitText>
                        ) : (
                            filteredStaff.map((staff) => (
                                <RosterCard
                                    key={staff.id}
                                    resource={staff}
                                    bookingCount={bookings.filter((b) => b.resourceId === staff.id).length}
                                    isActive={activePersona === staff.id}
                                    onSelect={onSelectPersona}
                                    subtitle="Staff"
                                />
                            ))
                        )}
                    </div>
                </div>
            </div>
        </FitSection>
    );
}