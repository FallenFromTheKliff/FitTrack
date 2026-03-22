"use client";
import { useMemo } from "react";
import { CalendarDays, DollarSign, TrendingUp, Users } from "lucide-react";
import { useMembers } from "@/contexts/MemberContext";
import { DASHBOARD_KPIS } from "@/data/charts/dashboard";

export function useDashboardStats() {
    const { members } = useMembers();

    const activeCount = useMemo(
        () => members.filter((m) => !m.deletedAt).length,
        [members]
    );

    const kpis = useMemo(() => {
        return DASHBOARD_KPIS.map((k) => {
            if (k.label === "Active Members") {
                return { ...k, icon: Users, value: activeCount > 0 ? String(activeCount) : k.value };
            }
            return k;
        });
    }, [activeCount]);

    return { kpis };
}