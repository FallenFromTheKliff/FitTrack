"use client";
import type { Resource, Booking } from "./types";

import FitCard from "@/components/fit/FitCard";
import FitButton from "@/components/fit/FitButton";
import FitPill from "@/components/fit/FitPill";
import FitSection from "@/components/fit/FitSection";
import ResourceCard from "./ResourceCard";

const ADMIN_VIEW_TABS = [
    { key: "summary", label: "Today's Summary" },
    { key: "resources", label: "Gym Resources" }
] as const;

type AdminView = typeof ADMIN_VIEW_TABS[number]["key"];

type StatItem = { label: string; value: string | number };

type Props = {
    adminView: AdminView;
    onAdminViewChange: (v: AdminView) => void;
    stats: StatItem[];
    resources: Resource[];
    bookings: Booking[];
    isLoading: boolean;
    compact: boolean;
    onManageResources: () => void;
};

export default function AdminViewPanel({ adminView, onAdminViewChange, stats, resources, onManageResources }: Props) {
    return (
        <>
            <div style={{ marginBottom: 12 }}>
                <FitPill options={[...ADMIN_VIEW_TABS]} active={adminView} onChange={onAdminViewChange} />
            </div>
            {adminView === "summary" ? (
                <FitSection heading="Today's Summary" bare>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 12 }}>
                        {stats.map((stat) => (
                            <FitCard
                                key={stat.label}
                                statMode
                                statLabel={stat.label}
                                statValue={String(stat.value)}
                            />
                        ))}
                    </div>
                </FitSection>
            ) : (
                <FitSection heading="Gym Resources" bare>
                    <div style={{ display: "grid", gap: 12 }}>
                        {resources.map((resource) => (
                            <ResourceCard key={resource.id} resource={resource} />
                        ))}
                    </div>
                    <div style={{ marginTop: 12 }}>
                        <FitButton variant="primary" label="MANAGE RESOURCES" onClick={onManageResources} fullWidth />
                    </div>
                </FitSection>
            )}
        </>
    );
}