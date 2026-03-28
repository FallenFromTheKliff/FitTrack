"use client";
import { useMemo } from "react";
import { CalendarDays, CheckCircle2, Clock3, TrendingUp, Users } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@fittrack/query";
import { useMembers } from "@/contexts/MemberContext";
import { useAuth } from "@/contexts/AuthContext";
import { api } from "@/lib/axios";
import { DASHBOARD_KPIS } from "@/data/charts/dashboard";

type StaffDashboardStats = {
  total: number;
  byStatus: {
    pending: number;
    confirmed: number;
    cancelled: number;
    completed: number;
  };
  recentBookings: number;
  upcomingBookings: number;
};

export function useDashboardStats() {
  const { user } = useAuth();
  const { members } = useMembers();
  const isStaff = user?.role === "STAFF";

  const { data: staffStats } = useQuery<StaffDashboardStats>({
    queryKey: queryKeys.staffDashboardStats(),
    enabled: isStaff,
    queryFn: async () => {
      const { data } = await api.get<StaffDashboardStats>("/staff/dashboard/stats");
      return data;
    }
  });

  const activeCount = useMemo(
    () => members.filter((m) => !m.deletedAt).length,
    [members]
  );

  const kpis = useMemo(() => {
    if (isStaff) {
      return [
        {
          icon: CalendarDays,
          label: "Total Bookings",
          value: String(staffStats?.total ?? 0),
          delta: `${staffStats?.recentBookings ?? 0} recent`
        },
        {
          icon: Clock3,
          label: "Pending Approvals",
          value: String(staffStats?.byStatus.pending ?? 0),
          delta: "Needs action"
        },
        {
          icon: CheckCircle2,
          label: "Confirmed",
          value: String(staffStats?.byStatus.confirmed ?? 0),
          delta: `${staffStats?.upcomingBookings ?? 0} upcoming`
        },
        {
          icon: TrendingUp,
          label: "Completed",
          value: String(staffStats?.byStatus.completed ?? 0),
          delta: `${staffStats?.byStatus.cancelled ?? 0} cancelled`
        }
      ];
    }
    return DASHBOARD_KPIS.map((k) => {
      if (k.label === "Active Members") {
        return { ...k, icon: Users, value: activeCount > 0 ? String(activeCount) : k.value };
      }
      return k;
    });
  }, [activeCount, isStaff, staffStats]);

  return { isStaff, kpis, staffStats };
}
