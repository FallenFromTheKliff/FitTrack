"use client";

import { useMemo } from "react";
import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  Clock3,
  TrendingUp,
  Users,
  Wrench
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import {
  analyticsOverviewQueryOptions,
  inventoryEquipmentQueryOptions,
  inventoryProductsQueryOptions,
  staffDashboardStatsQueryOptions
} from "@fittrack/query";

import { useMembers } from "@/contexts/MemberContext";
import { useAuth } from "@/contexts/AuthContext";
import { webApiClient } from "@/lib/api-client";
import { DASHBOARD_KPIS, type DashboardAlert } from "@/data/charts/dashboard";

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

const INVENTORY_LIST_PARAMS = {
  limit: 100,
  page: 1,
  isActive: true
} as const;

const EMPTY_META = {
  limit: 0,
  page: 1,
  total: 0,
  total_pages: 0
} as const;

function formatCompactPeso(value: number) {
  return new Intl.NumberFormat("en-PH", {
    currency: "PHP",
    maximumFractionDigits: 0,
    notation: "compact",
    style: "currency"
  }).format(value);
}

export function useDashboardStats() {
  const { user } = useAuth();
  const { members } = useMembers();
  const isStaff = user?.role === "STAFF";

  const { data: staffStats } = useQuery({
    ...staffDashboardStatsQueryOptions<StaffDashboardStats>(webApiClient),
    enabled: isStaff
  });
  const { data: overview } = useQuery({
    ...analyticsOverviewQueryOptions(webApiClient),
    enabled: !isStaff,
    staleTime: 60_000,
    gcTime: 300_000
  });
  const { data: productsResponse = { data: [], meta: EMPTY_META } } = useQuery({
    ...inventoryProductsQueryOptions(
      webApiClient,
      INVENTORY_LIST_PARAMS
    ),
    enabled: !isStaff,
    staleTime: 60_000,
    gcTime: 300_000
  });
  const { data: equipmentResponse = { data: [], meta: EMPTY_META } } = useQuery({
    ...inventoryEquipmentQueryOptions(
      webApiClient,
      INVENTORY_LIST_PARAMS
    ),
    enabled: !isStaff,
    staleTime: 60_000,
    gcTime: 300_000
  });

  const activeCount = useMemo(
    () => members.filter((member) => !member.deletedAt).length,
    [members]
  );

  const dashboardAlerts = useMemo<DashboardAlert[]>(() => {
    if (isStaff) return [];

    const lowStockProducts = productsResponse.data.filter(
      (product) => product.isActive && product.stockQuantity <= product.reorderThreshold
    );
    const equipmentAttentionItems = equipmentResponse.data.filter(
      (item) => item.isActive && item.quantityCurrent < item.quantityTotal
    );
    const firstLowStockProduct = lowStockProducts[0];
    const firstEquipmentAttentionItem = equipmentAttentionItems[0];

    return [
      {
        action: lowStockProducts.length > 0 ? "OPEN INVENTORY" : "VIEW INVENTORY",
        body:
          lowStockProducts.length > 0 && firstLowStockProduct
            ? `${firstLowStockProduct.name} and ${Math.max(lowStockProducts.length - 1, 0)} more retail item(s) are at or below their reorder threshold.`
            : "All active retail products are above their reorder thresholds.",
        colorKey: lowStockProducts.length > 0 ? "warning" : "textSecondary",
        icon: AlertTriangle,
        title: "Low Stock Alert"
      },
      {
        action: equipmentAttentionItems.length > 0 ? "CHECK EQUIPMENT" : "VIEW EQUIPMENT",
        body:
          equipmentAttentionItems.length > 0 && firstEquipmentAttentionItem
            ? `${firstEquipmentAttentionItem.name} and ${Math.max(equipmentAttentionItems.length - 1, 0)} more equipment item(s) need maintenance or quantity follow-up.`
            : "All active equipment is currently fully available.",
        colorKey: equipmentAttentionItems.length > 0 ? "warning" : "textSecondary",
        icon: Wrench,
        title: "Maintenance Due"
      }
    ];
  }, [equipmentResponse.data, isStaff, productsResponse.data]);

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

    return DASHBOARD_KPIS.map((kpi) => {
      if (kpi.label === "Active Members") {
        return {
          ...kpi,
          icon: Users,
          value: activeCount > 0 ? String(activeCount) : kpi.value
        };
      }
      if (kpi.label === "Sessions Today" && overview) {
        return {
          ...kpi,
          delta: "Live",
          value: String(overview.totalCheckIns)
        };
      }
      if (kpi.label === "Monthly Revenue" && overview) {
        return {
          ...kpi,
          delta: "Live",
          value: formatCompactPeso(overview.revenue.totalRevenue)
        };
      }
      return kpi;
    });
  }, [activeCount, isStaff, overview, staffStats]);

  return { dashboardAlerts, isStaff, kpis, staffStats };
}
