"use client";

import { useMemo, useState, type CSSProperties, type ReactNode } from "react";
import {
  Activity,
  CalendarRange,
  Download,
  RefreshCcw,
  Search,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import type {
  AuditLogRecord,
  InventorySaleTransactionSummaryRecord,
  MembershipPaymentDetailsRecord,
  StaffAppointmentRecord,
  VenueBookingRecord,
} from "@fittrack/api-client";
import {
  analyticsSnapshotQueryOptions,
  auditLogsQueryOptions,
  inventorySalesQueryOptions,
  reviewMembershipPaymentsQueryOptions,
  staffAppointmentsQueryOptions,
  staffBookingsQueryOptions,
} from "@fittrack/query";
import type { AnalyticsRecentActivityRecord } from "@fittrack/types";

import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { useFadeIn } from "@/hooks/animations/useFadeIn";
import { useThemeTransition } from "@/hooks/animations/useThemeTransition";
import { webApiClient } from "@/lib/api-client";
import {
  FitButton,
  FitDropdown,
  FitPagination,
  FitPill,
  FitTable,
  FitText,
  FitTextInput,
} from "@/components/fit";
import { CalendarModal } from "@/components/modals";
import GymActionsExportScopeModal, {
  type GymActionsExportScope,
} from "@/components/gym-actions/GymActionsExportScopeModal";
import type { FitTableColumn } from "@/components/fit/FitTable";
import FloatingHelpButton from "@/components/help/FloatingHelpButton";
import { matchesGymActionSearch } from "@/lib/gymActionSearch";
import {
  normalizeGymActionPdfRows,
  type GymActionPdfRow,
} from "@/lib/gymActionExport";
import { toInclusiveLocalBoundary } from "@/lib/gymActionFilters";

export const dynamic = "force-dynamic";

type TransactionKind = "all" | "payment" | "sale" | "booking" | "coaching";
type AuditKind = "all" | "User" | "MembershipCard" | "Equipment" | "Payment";
type GymActionSectionFilter = "recent" | "transactions" | "audit" | "attendance";
type AttendanceOrder = "asc" | "desc";

type DateRangeFilter = {
  from: string;
  to: string;
};

type TransactionRow = {
  actor: string;
  amount: number | null;
  createdAt: string;
  description: string;
  id: string;
  kind: Exclude<TransactionKind, "all">;
  status: string;
  title: string;
};

type AttendanceQueryResult = Awaited<
  ReturnType<typeof webApiClient.gymActions.listAttendance>
>;
type AttendanceRow = AttendanceQueryResult["data"][number];

const PAGE_SIZE = 6;
const GYM_ACTION_SECTION_OPTIONS: Array<{
  key: GymActionSectionFilter;
  label: string;
}> = [
  { key: "recent", label: "Recent Activity" },
  { key: "transactions", label: "Transaction History" },
  { key: "audit", label: "Audit Log" },
  { key: "attendance", label: "Attendance" },
];

function formatDateTime(value?: string | null) {
  if (!value) return "No timestamp";
  return new Date(value).toLocaleString("en-PH", {
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatPeso(value: number | null) {
  if (value == null) return "No amount";
  return `PHP ${value.toLocaleString("en-PH", {
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
  })}`;
}

function labelize(value: string) {
  return value
    .split(/[_\s-]+/g)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function profileName(profile?: { first_name?: string | null; last_name?: string | null } | null) {
  return [profile?.first_name, profile?.last_name].filter(Boolean).join(" ").trim();
}

function paymentUserName(payment: MembershipPaymentDetailsRecord) {
  return (
    profileName(payment.user?.profile) ||
    payment.user?.id ||
    payment.user_id ||
    "Payment actor"
  );
}

function appointmentMemberName(appointment: StaffAppointmentRecord) {
  const profile = appointment.user.profile;
  return (
    [profile?.firstName, profile?.lastName].filter(Boolean).join(" ").trim() ||
    appointment.user.email ||
    "Coach appointment"
  );
}

function bookingMemberName(booking: VenueBookingRecord) {
  const profile = booking.user?.profile;
  return (
    [profile?.firstName, profile?.lastName].filter(Boolean).join(" ").trim() ||
    booking.user?.email ||
    "Venue booking"
  );
}

function matchesDateRange(value: string | null | undefined, range: DateRangeFilter) {
  if (!range.from && !range.to) return true;
  if (!value) return false;
  const timestamp = new Date(value).getTime();
  if (Number.isNaN(timestamp)) return false;
  const from = range.from ? new Date(`${range.from}T00:00:00`).getTime() : null;
  const to = range.to ? new Date(`${range.to}T23:59:59.999`).getTime() : null;
  return (from == null || timestamp >= from) && (to == null || timestamp <= to);
}

function formatDateLabel(value: string) {
  if (!value) return "Select date";
  const parsed = new Date(`${value}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return "Select date";
  return parsed.toLocaleDateString("en-PH", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function getDateRangeFilters(range: DateRangeFilter) {
  return [
    ...(range.from ? [`From: ${formatDateLabel(range.from)}`] : []),
    ...(range.to ? [`To: ${formatDateLabel(range.to)}`] : []),
  ];
}

function getAttendanceName(row: AttendanceRow) {
  return row.memberName?.trim() || row.memberEmail?.trim() || row.userId || "Member";
}

function formatAttendanceSource(row: AttendanceRow) {
  return [row.checkInMethod, row.accessSource].filter(Boolean).join(" · ") || "Not recorded";
}

function normalizeAttendanceRows(rows: AttendanceRow[]): GymActionPdfRow[] {
  return normalizeGymActionPdfRows(
    rows.map((row) => ({
      primary: getAttendanceName(row),
      secondary: `${formatAttendanceSource(row)} · ${row.checkOutAt ? "Closed" : "Open"}`,
      actor: row.scannedBy,
      status: row.checkOutAt ? "Completed" : "Open",
      occurredAt: row.checkInAt,
    })),
  );
}

function getFilterOptions(values: string[], allLabel: string) {
  const uniqueValues = Array.from(new Set(values.filter(Boolean))).sort((left, right) =>
    labelize(left).localeCompare(labelize(right)),
  );
  return [
    { label: allLabel, value: "all" },
    ...uniqueValues.map((value) => ({ label: labelize(value), value })),
  ];
}

function paginate<T>(items: T[], page: number) {
  const start = (page - 1) * PAGE_SIZE;
  return items.slice(start, start + PAGE_SIZE);
}

export default function GymActionsPage() {
  const { user } = useAuth();
  const { colors } = useTheme();
  const fadeIn = useFadeIn({ duration: 220 });
  const themeTransition = useThemeTransition();
  const isAdmin = user?.role === "ADMIN";
  const [transactionSearch, setTransactionSearch] = useState("");
  const [transactionKind, setTransactionKind] = useState<TransactionKind>("all");
  const [transactionStatus, setTransactionStatus] = useState("all");
  const [transactionDateRange, setTransactionDateRange] = useState<DateRangeFilter>({
    from: "",
    to: "",
  });
  const [transactionPage, setTransactionPage] = useState(1);
  const [auditSearch, setAuditSearch] = useState("");
  const [auditKind, setAuditKind] = useState<AuditKind>("all");
  const [auditStatus, setAuditStatus] = useState("all");
  const [auditDateRange, setAuditDateRange] = useState<DateRangeFilter>({
    from: "",
    to: "",
  });
  const [auditPage, setAuditPage] = useState(1);
  const [recentSearch, setRecentSearch] = useState("");
  const [recentKind, setRecentKind] = useState("all");
  const [recentStatus, setRecentStatus] = useState("all");
  const [recentDateRange, setRecentDateRange] = useState<DateRangeFilter>({
    from: "",
    to: "",
  });
  const [recentPage, setRecentPage] = useState(1);
  const [attendanceDateRange, setAttendanceDateRange] = useState<DateRangeFilter>({
    from: "",
    to: "",
  });
  const [attendanceSearch, setAttendanceSearch] = useState("");
  const [attendanceOrder, setAttendanceOrder] = useState<AttendanceOrder>("desc");
  const [attendancePage, setAttendancePage] = useState(1);
  const [sectionFilter, setSectionFilter] =
    useState<GymActionSectionFilter>("recent");
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [exportScope, setExportScope] =
    useState<GymActionsExportScope>("current");
  const [exportError, setExportError] = useState<string | null>(null);

  const snapshotQuery = useQuery({
    ...analyticsSnapshotQueryOptions(webApiClient),
    enabled: isAdmin,
  });
  const auditQuery = useQuery(auditLogsQueryOptions(webApiClient, { limit: 100, page: 1 }));
  const paymentsQuery = useQuery(
    reviewMembershipPaymentsQueryOptions(webApiClient, { limit: 100, page: 1 }),
  );
  const salesQuery = useQuery(
    inventorySalesQueryOptions(webApiClient, { limit: 100, page: 1 }),
  );
  const bookingsQuery = useQuery(
    staffBookingsQueryOptions<VenueBookingRecord>(webApiClient, "all"),
  );
  const appointmentsQuery = useQuery(
    staffAppointmentsQueryOptions<StaffAppointmentRecord>(webApiClient, {
      limit: 100,
      page: 1,
    }),
  );
  const gymActionsApi = webApiClient.gymActions;

  const transactions = useMemo<TransactionRow[]>(() => {
    const payments =
      paymentsQuery.data?.data.map((payment) => ({
        actor: paymentUserName(payment),
        amount: Number(payment.amount),
        createdAt: payment.created_at,
        description: `${
          payment.membership_item_name ??
          payment.membership_plan_name ??
          labelize(payment.payable_type)
        } via ${labelize(payment.provider)}`,
        id: payment.id,
        kind: "payment" as const,
        status: labelize(payment.status),
        title:
          payment.membership_kind === "membership_card"
            ? "Membership Card"
            : payment.membership_kind === "gym_membership"
              ? "Gym Membership"
              : "Payment",
      })) ?? [];
    const sales =
      salesQuery.data?.data.map((sale: InventorySaleTransactionSummaryRecord) => ({
        actor: sale.customerName ?? sale.staff?.firstName ?? "Retail customer",
        amount: sale.totalAmount,
        createdAt: sale.createdAt,
        description: `${sale.itemsCount} item${sale.itemsCount === 1 ? "" : "s"} sold at retail counter`,
        id: sale.id,
        kind: "sale" as const,
        status: labelize(sale.status),
        title: "Retail sale",
      })) ?? [];
    const bookings =
      bookingsQuery.data?.map((booking) => ({
        actor: bookingMemberName(booking),
        amount: booking.totalAmount ?? null,
        createdAt: booking.createdAt ?? booking.startTime,
        description: booking.venue?.name ?? "Venue booking",
        id: booking.id,
        kind: "booking" as const,
        status: labelize(booking.status ?? "pending"),
        title: "Venue booking",
      })) ?? [];
    const coaching =
      appointmentsQuery.data?.data.map((appointment) => ({
        actor: appointmentMemberName(appointment),
        amount: appointment.totalAmount ?? null,
        createdAt: appointment.createdAt,
        description: appointment.coach.displayName ?? "Coach appointment",
        id: appointment.id,
        kind: "coaching" as const,
        status: labelize(appointment.status ?? "pending"),
        title: "Coach appointment",
      })) ?? [];

    return [...payments, ...sales, ...bookings, ...coaching].sort(
      (left, right) =>
        new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime(),
    );
  }, [appointmentsQuery.data, bookingsQuery.data, paymentsQuery.data, salesQuery.data]);

  const filteredTransactions = transactions.filter(
    (row) =>
      (transactionKind === "all" || row.kind === transactionKind) &&
      (transactionStatus === "all" || row.status === transactionStatus) &&
      matchesDateRange(row.createdAt, transactionDateRange) &&
      matchesGymActionSearch(
        [row.actor, row.amount, row.description, row.status, row.title],
        transactionSearch,
      ),
  );
  const transactionStatusOptions = useMemo(
    () => getFilterOptions(transactions.map((row) => row.status), "All statuses"),
    [transactions],
  );
  const transactionTotalPages = Math.max(1, Math.ceil(filteredTransactions.length / PAGE_SIZE));
  const transactionRows = paginate(
    filteredTransactions,
    Math.min(transactionPage, transactionTotalPages),
  );

  const auditLogs = useMemo(() => auditQuery.data?.data ?? [], [auditQuery.data?.data]);
  const filteredAuditLogs = auditLogs.filter(
    (log) =>
      (auditKind === "all" || log.entity === auditKind) &&
      (auditStatus === "all" || log.actor?.status === auditStatus) &&
      matchesDateRange(log.created_at, auditDateRange) &&
      matchesGymActionSearch(
        [
          log.action,
          log.entity,
          log.entity_id,
          log.id,
          log.actor?.status,
          log.user_id,
          profileName(log.actor?.profile),
        ],
        auditSearch,
      ),
  );
  const auditStatusOptions = useMemo(
    () =>
      getFilterOptions(
        auditLogs.map((log) => log.actor?.status ?? "").filter(Boolean),
        "All actor statuses",
      ),
    [auditLogs],
  );
  const auditTotalPages = Math.max(1, Math.ceil(filteredAuditLogs.length / PAGE_SIZE));
  const auditRows = paginate(filteredAuditLogs, Math.min(auditPage, auditTotalPages));
  const staffSafeRecentActivities = useMemo<AnalyticsRecentActivityRecord[]>(
    () =>
      [
        ...transactions.map((row) => ({
          actorName: row.actor,
          description: row.description,
          entityId: row.id,
          entityLabel: labelize(row.kind),
          id: `transaction-${row.kind}-${row.id}`,
          kind: row.kind,
          occurredAt: row.createdAt,
          status: row.status,
          title: row.title,
        })),
        ...auditLogs.map((log) => ({
          actorName: profileName(log.actor?.profile) || log.user_id || "System",
          description: `${labelize(log.entity)} ${log.entity_id ?? ""}`.trim(),
          entityId: log.entity_id ?? log.id,
          entityLabel: labelize(log.entity),
          id: `audit-${log.id}`,
          kind: log.entity,
          occurredAt: log.created_at,
          status: log.actor?.status ? labelize(log.actor.status) : labelize(log.action),
          title: labelize(log.action),
        })),
      ].sort(
        (left, right) =>
          new Date(right.occurredAt).getTime() -
          new Date(left.occurredAt).getTime(),
      ),
    [auditLogs, transactions],
  );
  const recentActivities = useMemo(
    () => {
      const source = isAdmin
        ? (snapshotQuery.data?.recentActivities ?? [])
        : staffSafeRecentActivities;
      const unique = new Map<string, AnalyticsRecentActivityRecord>();

      for (const activity of source) {
        const signature = [
          activity.title,
          activity.description,
          activity.actorName,
          activity.status,
          activity.occurredAt,
        ].join("|");
        if (!unique.has(signature)) unique.set(signature, activity);
      }

      return [...unique.values()];
    },
    [isAdmin, snapshotQuery.data?.recentActivities, staffSafeRecentActivities],
  );
  const attendanceQuery = useQuery({
    queryKey: [
      "gym-actions",
      "attendance",
      attendanceDateRange.from,
      attendanceDateRange.to,
      attendanceSearch,
      attendanceOrder,
      attendancePage,
    ],
    queryFn: () => {
      if (!gymActionsApi?.listAttendance) {
        throw new Error("Gym Actions attendance is unavailable. Reload the page and try again.");
      }
      return gymActionsApi.listAttendance({
        startDate: toInclusiveLocalBoundary(attendanceDateRange.from, "start"),
        endDate: toInclusiveLocalBoundary(attendanceDateRange.to, "end"),
        search: attendanceSearch.trim() || undefined,
        order: attendanceOrder,
        page: attendancePage,
        limit: PAGE_SIZE,
      });
    },
    enabled: sectionFilter === "attendance",
  });
  const filteredRecentActivities = recentActivities.filter(
    (activity) =>
      (recentKind === "all" || activity.kind === recentKind) &&
      (recentStatus === "all" || activity.status === recentStatus) &&
      matchesDateRange(activity.occurredAt, recentDateRange) &&
      matchesGymActionSearch(
        [
          activity.actorName,
          activity.description,
          activity.status,
          labelize(activity.status),
          activity.title,
        ],
        recentSearch,
      ),
  );
  const recentStatusOptions = useMemo(
    () => getFilterOptions(recentActivities.map((activity) => activity.status), "All statuses"),
    [recentActivities],
  );
  const recentKindOptions = useMemo(
    () => {
      const knownKinds = ["attendance", "booking", "coaching", "sale"];
      const kinds = Array.from(
        new Set([
          ...knownKinds,
          ...recentActivities.map((activity) => activity.kind),
        ]),
      ).filter(Boolean);
      const labels: Record<string, string> = {
        attendance: "Attendance",
        booking: "Venue bookings",
        coaching: "Coaching",
        sale: "Retail sales",
      };
      return [
        { label: "All action types", value: "all" },
        ...kinds
          .sort((left, right) =>
            (labels[left] ?? labelize(left)).localeCompare(
              labels[right] ?? labelize(right),
            ),
          )
          .map((value) => ({
            label: labels[value] ?? labelize(value),
            value,
          })),
      ];
    },
    [recentActivities],
  );
  const recentTotalPages = Math.max(1, Math.ceil(filteredRecentActivities.length / PAGE_SIZE));
  const recentRows = paginate(filteredRecentActivities, Math.min(recentPage, recentTotalPages));
  const attendanceRows = attendanceQuery.data?.data ?? [];
  const attendanceMeta = attendanceQuery.data?.meta;
  const attendanceTotal = attendanceMeta?.total ?? attendanceRows.length;
  const attendanceTotalPages = Math.max(1, attendanceMeta?.total_pages ?? 1);
  const attendanceCurrentPage = Math.min(attendancePage, attendanceTotalPages);
  const recentLoading = isAdmin
    ? snapshotQuery.isFetching
    : auditQuery.isFetching ||
      paymentsQuery.isFetching ||
      salesQuery.isFetching ||
      bookingsQuery.isFetching ||
      appointmentsQuery.isFetching;
  const isBusy =
    (isAdmin && snapshotQuery.isFetching) ||
    auditQuery.isFetching ||
    paymentsQuery.isFetching ||
    salesQuery.isFetching ||
    bookingsQuery.isFetching ||
    appointmentsQuery.isFetching ||
    (sectionFilter === "attendance" && attendanceQuery.isFetching);
  const handleExportPdf = async (scope: GymActionsExportScope) => {
    setIsExportingPdf(true);
    setExportError(null);

    try {
      if (!gymActionsApi?.exportPdf) {
        throw new Error("Gym Actions export is unavailable. Reload the page and try again.");
      }

      let title = "Gym Actions";
      let sectionLabel = "Recent Activity";
      let filters: string[] = [];
      let rows: GymActionPdfRow[] = [];

      if (sectionFilter === "recent") {
        title = "Recent Activity";
        sectionLabel = "Recent Activity";
        filters = [
          ...(recentKind !== "all" ? [`Action type: ${labelize(recentKind)}`] : []),
          ...(recentStatus !== "all" ? [`Status: ${labelize(recentStatus)}`] : []),
          ...(recentSearch.trim() ? [`Search: ${recentSearch.trim()}`] : []),
          ...getDateRangeFilters(recentDateRange),
        ];
        const activities = scope === "current" ? recentRows : filteredRecentActivities;
        rows = normalizeGymActionPdfRows(
          activities.map((activity) => ({
            primary: activity.title,
            secondary: activity.description,
            actor: activity.actorName,
            status: activity.status,
            occurredAt: activity.occurredAt,
          })),
        );
      } else if (sectionFilter === "transactions") {
        title = "Transaction History";
        sectionLabel = "Transaction History";
        filters = [
          ...(transactionKind !== "all" ? [`Type: ${labelize(transactionKind)}`] : []),
          ...(transactionStatus !== "all" ? [`Status: ${labelize(transactionStatus)}`] : []),
          ...(transactionSearch.trim() ? [`Search: ${transactionSearch.trim()}`] : []),
          ...getDateRangeFilters(transactionDateRange),
        ];
        const transactionsForExport =
          scope === "current" ? transactionRows : filteredTransactions;
        rows = normalizeGymActionPdfRows(
          transactionsForExport.map((row) => ({
            primary: row.title,
            secondary: row.description,
            actor: row.actor,
            status: row.status,
            amount: row.amount,
            occurredAt: row.createdAt,
          })),
        );
      } else if (sectionFilter === "audit") {
        title = "Audit Log";
        sectionLabel = "Audit Log";
        filters = [
          ...(auditKind !== "all" ? [`Entity: ${labelize(auditKind)}`] : []),
          ...(auditStatus !== "all" ? [`Actor status: ${labelize(auditStatus)}`] : []),
          ...(auditSearch.trim() ? [`Search: ${auditSearch.trim()}`] : []),
          ...getDateRangeFilters(auditDateRange),
        ];
        const auditLogsForExport = scope === "current" ? auditRows : filteredAuditLogs;
        rows = normalizeGymActionPdfRows(
          auditLogsForExport.map((log) => ({
            primary: labelize(log.action),
            secondary: `${log.entity} ${log.entity_id ?? ""}`,
            actor: profileName(log.actor?.profile) || log.actor?.role || "System",
            status: log.actor?.status ? labelize(log.actor.status) : labelize(log.action),
            occurredAt: log.created_at,
          })),
        );
      } else {
        title = "Attendance";
        sectionLabel = "Attendance";
        filters = [
          ...(attendanceSearch.trim() ? [`Search: ${attendanceSearch.trim()}`] : []),
          `Sort: ${attendanceOrder === "desc" ? "Descending" : "Ascending"}`,
          ...getDateRangeFilters(attendanceDateRange),
        ];
        if (scope === "current") {
          rows = normalizeAttendanceRows(attendanceRows);
        } else {
          if (!gymActionsApi.listAttendance) {
            throw new Error("Gym Actions attendance is unavailable. Reload the page and try again.");
          }
          const startDate = toInclusiveLocalBoundary(attendanceDateRange.from, "start");
          const endDate = toInclusiveLocalBoundary(attendanceDateRange.to, "end");
          const firstPage = await gymActionsApi.listAttendance({
            startDate,
            endDate,
            search: attendanceSearch.trim() || undefined,
            order: attendanceOrder,
            page: 1,
            limit: 100,
          });
          const allAttendanceRows: AttendanceRow[] = [...firstPage.data];
          const totalPages = Math.max(1, firstPage.meta?.total_pages ?? 1);
          for (let page = 2; page <= totalPages; page += 1) {
            const nextPage = await gymActionsApi.listAttendance({
              startDate,
              endDate,
              search: attendanceSearch.trim() || undefined,
              order: attendanceOrder,
              page,
              limit: 100,
            });
            allAttendanceRows.push(...nextPage.data);
          }
          rows = normalizeAttendanceRows(allAttendanceRows);
        }
      }

      const result = await gymActionsApi.exportPdf({
        section: sectionFilter,
        title,
        sectionLabel,
        filterSummaries: filters,
        totalRecords: rows.length,
        rows,
      });
      const blob = new Blob([result.bytes], {
        type: result.contentType || "application/pdf",
      });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = result.fileName || "fittrack-gym-actions.pdf";
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      setIsExportModalOpen(false);
    } catch (error) {
      setExportError(error instanceof Error ? error.message : "Unable to export this view.");
    } finally {
      setIsExportingPdf(false);
    }
  };
  const openExportModal = () => {
    setExportError(null);
    setExportScope("current");
    setIsExportModalOpen(true);
  };
  const activeSectionLabel =
    GYM_ACTION_SECTION_OPTIONS.find((option) => option.key === sectionFilter)?.label ??
    "Gym Actions";
  const shell: CSSProperties = {
    ...fadeIn,
    display: "flex",
    flexDirection: "column",
    gap: 12,
    minHeight: 0,
    paddingBottom: 0,
  };
  const shouldShowSection = (section: GymActionSectionFilter) =>
    sectionFilter === section;

  const transactionColumns: FitTableColumn<TransactionRow>[] = [
    {
      key: "transaction",
      heading: "Transaction",
      render: (row, c) => (
        <div style={{ display: "grid", gap: 4, minWidth: 240 }}>
          <FitText style={{ fontSize: 14, fontWeight: 850, color: c.textPrimary }}>
            {row.title} - {row.actor}
          </FitText>
          <FitText style={{ fontSize: 12.5, color: c.textSecondary }}>
            {row.description}
          </FitText>
        </div>
      ),
    },
    {
      key: "amount",
      heading: "Amount",
      render: (row, c) => (
        <FitText style={{ fontSize: 13.5, fontWeight: 850, color: c.textPrimary }}>
          {formatPeso(row.amount)}
        </FitText>
      ),
    },
    {
      key: "status",
      heading: "Status",
      render: (row, c) => (
        <span data-ui="gym-actions-compact-chip">
          <FitPill
            mode="status"
            label={row.status}
            color={c.brand}
            style={{ borderRadius: 5, padding: "2px 7px" }}
          />
        </span>
      ),
    },
    {
      key: "created",
      heading: "Created",
      render: (row, c) => (
        <FitText style={{ fontSize: 12.5, color: c.textSecondary }}>
          {formatDateTime(row.createdAt)}
        </FitText>
      ),
    },
  ];

  const auditColumns: FitTableColumn<AuditLogRecord>[] = [
    {
      key: "action",
      heading: "Action",
      render: (log, c) => (
        <div style={{ display: "grid", gap: 4, minWidth: 240 }}>
          <FitText style={{ fontSize: 14, fontWeight: 850, color: c.textPrimary }}>
            {labelize(log.action)}
          </FitText>
          <FitText style={{ fontSize: 12.5, color: c.textSecondary }}>
            {log.entity} {log.entity_id}
          </FitText>
        </div>
      ),
    },
    {
      key: "actor",
      heading: "Actor",
      render: (log, c) => (
        <FitText style={{ fontSize: 13, color: c.textSecondary }}>
          {profileName(log.actor?.profile) || log.actor?.role || "System"}
        </FitText>
      ),
    },
    {
      key: "entity",
      heading: "Entity",
      render: (log, c) => (
        <span data-ui="gym-actions-compact-chip">
          <FitPill
            mode="status"
            label={log.entity}
            color={c.brand}
            style={{ borderRadius: 5, padding: "2px 7px" }}
          />
        </span>
      ),
    },
    {
      key: "created",
      heading: "Created",
      render: (log, c) => (
        <FitText style={{ fontSize: 12.5, color: c.textSecondary }}>
          {formatDateTime(log.created_at)}
        </FitText>
      ),
    },
  ];

  const recentColumns: FitTableColumn<AnalyticsRecentActivityRecord>[] = [
    {
      key: "activity",
      heading: "Activity",
      render: (activity, c) => (
        <div style={{ display: "grid", gap: 4, minWidth: 240 }}>
          <FitText style={{ fontSize: 14, fontWeight: 850, color: c.textPrimary }}>
            {activity.title}
          </FitText>
          <FitText style={{ fontSize: 12.5, color: c.textSecondary }}>
            {activity.description}
          </FitText>
        </div>
      ),
    },
    {
      key: "actor",
      heading: "Actor",
      render: (activity, c) => (
        <FitText style={{ fontSize: 13, color: c.textSecondary }}>
          {activity.actorName}
        </FitText>
      ),
    },
    {
      key: "status",
      heading: "Status",
      render: (activity, c) => (
        <span data-ui="gym-actions-compact-chip">
          <FitPill
            mode="status"
            label={labelize(activity.status)}
            color={c.brand}
            style={{ borderRadius: 5, padding: "2px 7px" }}
          />
        </span>
      ),
    },
    {
      key: "time",
      heading: "Time",
      render: (activity, c) => (
        <FitText style={{ fontSize: 12.5, color: c.textSecondary }}>
          {formatDateTime(activity.occurredAt)}
        </FitText>
      ),
    },
  ];

  return (
    <>
    <main className={`gym-actions-page ${themeTransition}`} style={shell}>
      <div
        className="gym-actions-section-filter"
        style={{
          alignItems: "center",
          backgroundColor: "transparent",
          border: 0,
          borderRadius: 0,
          display: "flex",
          gap: 12,
          justifyContent: "flex-end",
          order: 0,
          padding: 0,
        }}
      >
        <div
          className="gym-actions-section-actions"
          style={{
            alignItems: "center",
            display: "flex",
            flex: 1,
            gap: 10,
            justifyContent: "flex-end",
            minWidth: 0,
            flexWrap: "wrap",
          }}
        >
          <FitPill
            mode="toggle"
            active={sectionFilter}
            options={GYM_ACTION_SECTION_OPTIONS}
            onChange={(value) => {
              setSectionFilter(value as GymActionSectionFilter);
              setExportError(null);
            }}
            style={{ flexWrap: "wrap" }}
          />
          <FitButton
            icon={Download}
            label="EXPORT PDF"
            loading={isExportingPdf}
            loadingLabel="EXPORTING..."
            onClick={openExportModal}
          />
        </div>
      </div>
      {exportError ? (
        <div
          role="alert"
          style={{
            backgroundColor: `${colors.danger}12`,
            border: `1px solid ${colors.danger}66`,
            borderRadius: 8,
            color: colors.danger,
            fontSize: 12.5,
            padding: "10px 12px",
          }}
        >
          {exportError}
        </div>
      ) : null}

      {shouldShowSection("transactions") ? (
      <ActionTableSection
        className="gym-actions-transactions-section"
        colors={colors}
        heading="Transaction History"
        action={
          <FitButton
            icon={RefreshCcw}
            label="REFRESH"
            loading={
              paymentsQuery.isFetching ||
              salesQuery.isFetching ||
              bookingsQuery.isFetching ||
              appointmentsQuery.isFetching
            }
            onClick={() => {
              void paymentsQuery.refetch();
              void salesQuery.refetch();
              void bookingsQuery.refetch();
              void appointmentsQuery.refetch();
            }}
          />
        }
      >
        <div className="gym-actions-table-stack" style={{ gap: 0 }}>
          <div
            className="gym-actions-filter-row"
            style={{
              display: "grid",
              gap: 10,
              gridTemplateColumns:
                "minmax(220px, 1.2fr) minmax(130px, 0.45fr) minmax(130px, 0.45fr) minmax(170px, 0.55fr) minmax(180px, 0.6fr)",
              padding: 14,
              borderBottom: `1px solid ${colors.border}`,
            }}
          >
            <FilterSearchControl
              colors={colors}
              id="gym-actions-transactions-search"
              onChange={(value) => {
                setTransactionSearch(value);
                setTransactionPage(1);
              }}
              placeholder="Search transactions"
              value={transactionSearch}
            />
            <DateFilterInput
              ariaLabel="Filter transactions from date"
              colors={colors}
              id="gym-actions-transactions-from"
              label="From"
              maxDate={transactionDateRange.to || null}
              onChange={(value) => {
                setTransactionDateRange((current) => ({ ...current, from: value }));
                setTransactionPage(1);
              }}
              value={transactionDateRange.from}
            />
            <DateFilterInput
              ariaLabel="Filter transactions to date"
              colors={colors}
              id="gym-actions-transactions-to"
              label="To"
              minDate={transactionDateRange.from || null}
              onChange={(value) => {
                setTransactionDateRange((current) => ({ ...current, to: value }));
                setTransactionPage(1);
              }}
              value={transactionDateRange.to}
            />
            <FitDropdown
              ariaLabel="Filter transactions by status"
              fullWidth
              value={transactionStatus}
              onChange={(value) => {
                setTransactionStatus(value);
                setTransactionPage(1);
              }}
              options={transactionStatusOptions}
            />
            <FitDropdown
              ariaLabel="Filter transactions by type"
              fullWidth
              value={transactionKind}
              onChange={(value) => {
                setTransactionKind(value as TransactionKind);
                setTransactionPage(1);
              }}
              options={[
                { label: "All transactions", value: "all" },
                { label: "Payments", value: "payment" },
                { label: "Retail sales", value: "sale" },
                { label: "Venue bookings", value: "booking" },
                { label: "Coach appointments", value: "coaching" },
              ]}
            />
          </div>
          <div className="gym-actions-table-viewport" data-ui="gym-actions-table-viewport">
            <FitTable
              columns={transactionColumns}
              rows={transactionRows}
              getRowKey={(row) => `${row.kind}-${row.id}`}
              isLoading={isBusy}
              loadingMessage="Loading transactions..."
              emptyMessage="No transactions match the current view."
              emptyStateHeight="100%"
              style={{
                border: 0,
                borderRadius: 0,
                height: "100%",
                minHeight: 0,
                overflowY: "auto",
              }}
            />
          </div>
          <div data-ui="gym-actions-table-footer" style={{ borderTop: `1px solid ${colors.border}`, padding: "12px 14px" }}>
            <FitPagination
              ariaLabel="Transaction history pagination"
              currentPage={Math.min(transactionPage, transactionTotalPages)}
              totalPages={transactionTotalPages}
              onPageChange={setTransactionPage}
              showSinglePage
            />
          </div>
        </div>
      </ActionTableSection>
      ) : null}

      {shouldShowSection("audit") ? (
      <ActionTableSection
        className="gym-actions-audit-section"
        colors={colors}
        heading="Audit Log"
        action={
          <FitButton
            icon={RefreshCcw}
            label="REFRESH"
            loading={auditQuery.isFetching}
            onClick={() => void auditQuery.refetch()}
          />
        }
      >
        <div className="gym-actions-table-stack" style={{ gap: 0 }}>
          <div
            className="gym-actions-filter-row"
            style={{
              display: "grid",
              gap: 10,
              gridTemplateColumns:
                "minmax(220px, 1.2fr) minmax(130px, 0.45fr) minmax(130px, 0.45fr) minmax(170px, 0.55fr) minmax(180px, 0.6fr)",
              padding: 14,
              borderBottom: `1px solid ${colors.border}`,
            }}
          >
            <FilterSearchControl
              colors={colors}
              id="gym-actions-audit-search"
              onChange={(value) => {
                setAuditSearch(value);
                setAuditPage(1);
              }}
              placeholder="Search audit logs"
              value={auditSearch}
            />
            <DateFilterInput
              ariaLabel="Filter audit logs from date"
              colors={colors}
              id="gym-actions-audit-from"
              label="From"
              maxDate={auditDateRange.to || null}
              onChange={(value) => {
                setAuditDateRange((current) => ({ ...current, from: value }));
                setAuditPage(1);
              }}
              value={auditDateRange.from}
            />
            <DateFilterInput
              ariaLabel="Filter audit logs to date"
              colors={colors}
              id="gym-actions-audit-to"
              label="To"
              minDate={auditDateRange.from || null}
              onChange={(value) => {
                setAuditDateRange((current) => ({ ...current, to: value }));
                setAuditPage(1);
              }}
              value={auditDateRange.to}
            />
            <FitDropdown
              ariaLabel="Filter audit logs by actor status"
              fullWidth
              value={auditStatus}
              onChange={(value) => {
                setAuditStatus(value);
                setAuditPage(1);
              }}
              options={auditStatusOptions}
            />
            <FitDropdown
              ariaLabel="Filter audit logs by entity"
              fullWidth
              value={auditKind}
              onChange={(value) => {
                setAuditKind(value as AuditKind);
                setAuditPage(1);
              }}
              options={[
                { label: "All actions", value: "all" },
                { label: "Accounts", value: "User" },
                { label: "Membership cards", value: "MembershipCard" },
                { label: "Equipment", value: "Equipment" },
                { label: "Payments", value: "Payment" },
              ]}
            />
          </div>
          <div className="gym-actions-table-viewport" data-ui="gym-actions-table-viewport">
            <FitTable
              columns={auditColumns}
              rows={auditRows}
              getRowKey={(log) => log.id}
              isLoading={auditQuery.isFetching}
              loadingMessage="Loading audit logs..."
              emptyMessage="No audit logs match the current view."
              emptyStateHeight="100%"
              style={{
                border: 0,
                borderRadius: 0,
                height: "100%",
                minHeight: 0,
                overflowY: "auto",
              }}
            />
          </div>
          <div data-ui="gym-actions-table-footer" style={{ borderTop: `1px solid ${colors.border}`, padding: "12px 14px" }}>
            <FitPagination
              ariaLabel="Audit log pagination"
              currentPage={Math.min(auditPage, auditTotalPages)}
              totalPages={auditTotalPages}
              onPageChange={setAuditPage}
              showSinglePage
            />
          </div>
        </div>
      </ActionTableSection>
      ) : null}

      {shouldShowSection("attendance") ? (
        <AttendanceSection
          colors={colors}
          dateRange={attendanceDateRange}
          error={
            attendanceQuery.isError
              ? attendanceQuery.error instanceof Error
                ? attendanceQuery.error.message
                : "Unable to load attendance records."
              : null
          }
          isLoading={attendanceQuery.isFetching}
          onRefresh={() => void attendanceQuery.refetch()}
          order={attendanceOrder}
          page={attendanceCurrentPage}
          rows={attendanceRows}
          search={attendanceSearch}
          setDateRange={(nextRange) => {
            setAttendanceDateRange(nextRange);
            setAttendancePage(1);
          }}
          setOrder={(value) => {
            setAttendanceOrder(value);
            setAttendancePage(1);
          }}
          setPage={setAttendancePage}
          setSearch={(value) => {
            setAttendanceSearch(value);
            setAttendancePage(1);
          }}
          total={attendanceTotal}
          totalPages={attendanceTotalPages}
        />
      ) : null}

      {shouldShowSection("recent") ? (
      <RecentActivitySection
        activities={recentRows}
        columns={recentColumns}
        colors={colors}
        dateRange={recentDateRange}
        kind={recentKind}
        kindOptions={recentKindOptions}
        isLoading={recentLoading}
        onRefresh={() => {
          if (isAdmin) {
            void snapshotQuery.refetch();
            return;
          }
          void Promise.all([
            auditQuery.refetch(),
            paymentsQuery.refetch(),
            salesQuery.refetch(),
            bookingsQuery.refetch(),
            appointmentsQuery.refetch(),
          ]);
        }}
        page={Math.min(recentPage, recentTotalPages)}
        search={recentSearch}
        setPage={setRecentPage}
        setSearch={(value) => {
          setRecentSearch(value);
          setRecentPage(1);
        }}
        setKind={(value) => {
          setRecentKind(value);
          setRecentPage(1);
        }}
        setStatus={(value) => {
          setRecentStatus(value);
          setRecentPage(1);
        }}
        setDateRange={(nextRange) => {
          setRecentDateRange(nextRange);
          setRecentPage(1);
        }}
        status={recentStatus}
        statusOptions={recentStatusOptions}
        totalPages={recentTotalPages}
      />
      ) : null}

      <style>{`
        .gym-actions-page {
          box-sizing: border-box;
          height: min(100%, 100dvh);
          min-height: 0;
        }

        .gym-actions-page > .gym-actions-section {
          flex: 1 1 0;
          min-height: 0;
        }

        .gym-actions-recent-section {
          order: 1;
        }

        .gym-actions-audit-section {
          order: 2;
        }

        .gym-actions-transactions-section {
          order: 3;
        }

        .gym-actions-attendance-section {
          order: 4;
        }

        .gym-actions-table-stack {
          display: flex;
          flex: 1 1 auto;
          flex-direction: column;
          min-height: 0;
          min-width: 0;
        }

        .gym-actions-table-viewport {
          box-sizing: border-box;
          display: flex;
          flex: 1 1 0;
          flex-direction: column;
          height: auto;
          min-height: 0;
          min-width: 0;
          overflow: hidden;
        }

        .gym-actions-table-viewport > div {
          flex: 1 1 auto;
          height: 100%;
          min-height: 0;
          min-width: 0;
          width: 100%;
        }

        .gym-actions-table-viewport thead {
          position: sticky;
          top: 0;
          z-index: 1;
        }

        .gym-actions-table-stack > .gym-actions-filter-row,
        .gym-actions-table-stack > [aria-live="polite"],
        .gym-actions-table-stack > [data-ui="gym-actions-table-footer"] {
          flex: 0 0 auto;
        }

        .gym-actions-table-stack > [role="alert"] {
          flex: 0 0 auto;
        }

        @media (max-width: 980px) {
          .gym-actions-page {
            height: auto;
          }

          .gym-actions-page > .gym-actions-section {
            flex: 0 1 auto;
          }

          .gym-actions-section-filter,
          .gym-actions-filter-row {
            align-items: stretch !important;
            flex-direction: column !important;
            grid-template-columns: 1fr !important;
          }

          .gym-actions-section-filter > div {
            width: 100%;
          }

          .gym-actions-section-actions {
            justify-content: flex-start !important;
          }

          .gym-actions-table-stack {
            display: grid;
            flex: none;
            height: auto;
          }

          .gym-actions-table-viewport {
            flex: none;
            height: auto;
            min-height: 0;
            overflow: visible;
          }

          .gym-actions-table-viewport > div {
            flex: none;
            height: auto !important;
            max-height: none !important;
            overflow: visible !important;
          }
        }

        @media (max-width: 760px) {
          .gym-actions-filter-row {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </main>
    <GymActionsExportScopeModal
      isOpen={isExportModalOpen}
      scope={exportScope}
      isExporting={isExportingPdf}
      sectionLabel={activeSectionLabel}
      onScopeChange={setExportScope}
      onCancel={() => {
        if (!isExportingPdf) setIsExportModalOpen(false);
      }}
      onConfirm={() => void handleExportPdf(exportScope)}
    />
    <FloatingHelpButton
      title="Gym Actions"
      description="Review operational activity, transactions, audit records, and attendance. Export the active filtered view as a PDF."
      terms={[
        { label: "Transaction history", value: "Payments, sales, booking charges, and coaching revenue records." },
        { label: "Audit log", value: "Tracked admin or staff changes made to operational records." },
        { label: "Recent activity", value: "The latest system events used to understand what changed." },
        { label: "Attendance", value: "Use one FitTrack calendar day or an inclusive From/To range to review check-ins, open sessions, and access sources." },
        { label: "Export PDF", value: "Choose Current page for the visible records or All pages for every record matching the active tab's filters." },
      ]}
    />
    </>
  );
}

function AttendanceSection({
  colors,
  dateRange,
  error,
  isLoading,
  onRefresh,
  order,
  page,
  rows,
  search,
  setDateRange,
  setOrder,
  setPage,
  setSearch,
  total,
  totalPages,
}: {
  colors: ReturnType<typeof useTheme>["colors"];
  dateRange: DateRangeFilter;
  error: string | null;
  isLoading: boolean;
  onRefresh: () => void;
  order: AttendanceOrder;
  page: number;
  rows: AttendanceRow[];
  search: string;
  setDateRange: (nextRange: DateRangeFilter) => void;
  setOrder: (value: AttendanceOrder) => void;
  setPage: (page: number) => void;
  setSearch: (value: string) => void;
  total: number;
  totalPages: number;
}) {
  const windowLabel =
    dateRange.from && dateRange.to
      ? dateRange.from === dateRange.to
        ? `Day: ${formatDateLabel(dateRange.from)}`
        : `Range: ${formatDateLabel(dateRange.from)} – ${formatDateLabel(dateRange.to)}`
      : dateRange.from
        ? `From: ${formatDateLabel(dateRange.from)}`
        : dateRange.to
          ? `Through: ${formatDateLabel(dateRange.to)}`
          : "All attendance dates";
  const firstRecord = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const lastRecord = Math.min(page * PAGE_SIZE, total);
  const columns: FitTableColumn<AttendanceRow>[] = [
    {
      key: "member",
      heading: "Member",
      render: (row, c) => (
        <div style={{ display: "grid", gap: 4, minWidth: 180 }}>
          <FitText style={{ color: c.textPrimary, fontSize: 14, fontWeight: 850 }}>
            {getAttendanceName(row)}
          </FitText>
          {row.memberEmail ? (
            <FitText style={{ color: c.textSecondary, fontSize: 12.5 }}>
              {row.memberEmail}
            </FitText>
          ) : null}
        </div>
      ),
    },
    {
      key: "check-in",
      heading: "Check-in",
      render: (row, c) => (
        <FitText style={{ color: c.textSecondary, fontSize: 12.5 }}>
          {formatDateTime(row.checkInAt)}
        </FitText>
      ),
    },
    {
      key: "check-out",
      heading: "Check-out",
      render: (row, c) => (
        <FitText
          style={{
            color: row.checkOutAt ? c.textSecondary : c.brand,
            fontSize: 12.5,
            fontWeight: row.checkOutAt ? 500 : 800,
          }}
        >
          {row.checkOutAt ? formatDateTime(row.checkOutAt) : "Open"}
        </FitText>
      ),
    },
    {
      key: "method",
      heading: "Check-in method",
      render: (row, c) => (
        <FitText style={{ color: c.textSecondary, fontSize: 12.5 }}>
          {row.checkInMethod?.trim() || "Not recorded"}
        </FitText>
      ),
    },
    {
      key: "source",
      heading: "Access source",
      render: (row, c) => (
        <FitText style={{ color: c.textSecondary, fontSize: 12.5 }}>
          {row.accessSource?.trim() || "Not recorded"}
        </FitText>
      ),
    },
    {
      key: "scanned-by",
      heading: "Scanned by",
      render: (row, c) => (
        <FitText style={{ color: c.textSecondary, fontSize: 12.5 }}>
          {row.scannedBy?.trim() || "Not recorded"}
        </FitText>
      ),
    },
  ];

  return (
    <ActionTableSection
      colors={colors}
      heading="Attendance"
      className="gym-actions-attendance-section"
      action={
        <FitButton
          icon={RefreshCcw}
          label="REFRESH"
          loading={isLoading}
          onClick={onRefresh}
        />
      }
    >
        <div className="gym-actions-table-stack" style={{ gap: 0 }}>
        <div
          className="gym-actions-filter-row"
          style={{
            display: "grid",
            gap: 10,
            gridTemplateColumns:
              "minmax(220px, 1.2fr) minmax(140px, 0.55fr) minmax(140px, 0.55fr) minmax(200px, 0.7fr)",
            padding: 14,
            borderBottom: `1px solid ${colors.border}`,
          }}
        >
          <FilterSearchControl
            colors={colors}
            id="gym-actions-attendance-search"
            onChange={setSearch}
            placeholder="Search attendance"
            value={search}
          />
          <DateFilterInput
            ariaLabel="Filter attendance from date"
            colors={colors}
            id="gym-actions-attendance-from"
            label="From"
            maxDate={dateRange.to || null}
            onChange={(value) => setDateRange({ ...dateRange, from: value })}
            value={dateRange.from}
          />
          <DateFilterInput
            ariaLabel="Filter attendance to date"
            colors={colors}
            id="gym-actions-attendance-to"
            label="To"
            minDate={dateRange.from || null}
            onChange={(value) => setDateRange({ ...dateRange, to: value })}
            value={dateRange.to}
          />
          <FitDropdown
            ariaLabel="Sort attendance"
            fullWidth
            onChange={(value) => setOrder(value as AttendanceOrder)}
            options={[
              { label: "Descending (Newest first)", value: "desc" },
              { label: "Ascending (Oldest first)", value: "asc" },
            ]}
            value={order}
          />
        </div>
        <div
          aria-live="polite"
          style={{
            borderBottom: `1px solid ${colors.border}`,
            color: colors.textSecondary,
            fontSize: 12.5,
            padding: "10px 14px",
          }}
        >
          {total.toLocaleString("en-PH")} attendance records · {windowLabel}
          <FitText
            style={{ color: colors.textMuted, display: "block", fontSize: 11.5, marginTop: 4 }}
          >
            Choose the same From and To date for one day, or set a range for multiple days.
          </FitText>
        </div>
        {error ? (
          <div
            role="alert"
            style={{
              backgroundColor: `${colors.danger}12`,
              borderBottom: `1px solid ${colors.danger}55`,
              color: colors.danger,
              fontSize: 12.5,
              padding: "10px 14px",
            }}
          >
            {error}
          </div>
        ) : null}
        <div className="gym-actions-table-viewport" data-ui="gym-actions-table-viewport">
          <FitTable
            columns={columns}
            rows={rows}
            getRowKey={(row) => row.id}
            isLoading={isLoading}
            loadingMessage="Loading attendance records..."
            emptyMessage={error ? "No attendance records could be loaded." : "No attendance matches this date window."}
            emptyStateHeight="100%"
            style={{
              border: 0,
              borderRadius: 0,
              height: "100%",
              minHeight: 0,
              overflowY: "auto",
            }}
          />
        </div>
        <div
          data-ui="gym-actions-table-footer"
          style={{
            alignItems: "center",
            borderTop: `1px solid ${colors.border}`,
            display: "flex",
            flexWrap: "wrap",
            gap: 10,
            justifyContent: "space-between",
            padding: "12px 14px",
          }}
        >
          <FitText style={{ color: colors.textSecondary, fontSize: 12 }}>
            {total === 0 ? "Showing 0 records" : `Showing ${firstRecord.toLocaleString("en-PH")}–${lastRecord.toLocaleString("en-PH")} of ${total.toLocaleString("en-PH")}`}
          </FitText>
          <FitPagination
            ariaLabel="Attendance pagination"
            currentPage={page}
            totalPages={totalPages}
            onPageChange={setPage}
            showSinglePage
          />
        </div>
      </div>
    </ActionTableSection>
  );
}

function RecentActivitySection({
  activities,
  columns,
  colors,
  dateRange,
  kind,
  kindOptions,
  isLoading,
  onRefresh,
  page,
  search,
  setPage,
  setDateRange,
  setKind,
  setSearch,
  setStatus,
  status,
  statusOptions,
  totalPages,
}: {
  activities: AnalyticsRecentActivityRecord[];
  columns: FitTableColumn<AnalyticsRecentActivityRecord>[];
  colors: ReturnType<typeof useTheme>["colors"];
  dateRange: DateRangeFilter;
  kind: string;
  kindOptions: Array<{ label: string; value: string }>;
  isLoading: boolean;
  onRefresh: () => void;
  page: number;
  setPage: (page: number) => void;
  search: string;
  setDateRange: (nextRange: DateRangeFilter) => void;
  setKind: (value: string) => void;
  setSearch: (value: string) => void;
  setStatus: (value: string) => void;
  status: string;
  statusOptions: Array<{ label: string; value: string }>;
  totalPages: number;
}) {
  return (
    <ActionTableSection
      colors={colors}
      heading="Recent Activity"
      className="gym-actions-recent-section"
      action={
        <div style={{ alignItems: "center", display: "flex", gap: 8 }}>
          <Activity size={15} color={colors.brand} />
          <FitButton
            icon={RefreshCcw}
            label="REFRESH"
            loading={isLoading}
            onClick={onRefresh}
          />
        </div>
      }
    >
      <div className="gym-actions-table-stack" style={{ gap: 0 }}>
        <div
          className="gym-actions-filter-row"
          style={{
            display: "grid",
            gap: 10,
            gridTemplateColumns:
              "minmax(220px, 1.2fr) minmax(130px, 0.45fr) minmax(130px, 0.45fr) minmax(170px, 0.55fr) minmax(180px, 0.6fr)",
            padding: 14,
            borderBottom: `1px solid ${colors.border}`,
          }}
        >
          <FilterSearchControl
            colors={colors}
            id="gym-actions-recent-search"
            onChange={setSearch}
            placeholder="Search activity"
            value={search}
          />
        <DateFilterInput
            ariaLabel="Filter recent activity from date"
            colors={colors}
            id="gym-actions-recent-from"
            label="From"
            maxDate={dateRange.to || null}
            onChange={(value) => setDateRange({ ...dateRange, from: value })}
            value={dateRange.from}
          />
          <DateFilterInput
            ariaLabel="Filter recent activity to date"
            colors={colors}
            id="gym-actions-recent-to"
            label="To"
            minDate={dateRange.from || null}
            onChange={(value) => setDateRange({ ...dateRange, to: value })}
            value={dateRange.to}
          />
          <FitDropdown
            ariaLabel="Filter recent activity by action type"
            fullWidth
            value={kind}
            onChange={setKind}
            options={kindOptions}
          />
          <FitDropdown
            ariaLabel="Filter recent activity by status"
            fullWidth
            value={status}
            onChange={setStatus}
            options={statusOptions}
          />
        </div>
        <div className="gym-actions-table-viewport" data-ui="gym-actions-table-viewport">
          <FitTable
            columns={columns}
            rows={activities}
            getRowKey={(activity) => activity.id}
            isLoading={isLoading}
            loadingMessage="Loading recent activity..."
            emptyMessage="No recent activities are available."
            emptyStateHeight="100%"
            style={{
              border: 0,
              borderRadius: 0,
              height: "100%",
              minHeight: 0,
              overflowY: "auto",
            }}
          />
        </div>
        <div data-ui="gym-actions-table-footer" style={{ borderTop: `1px solid ${colors.border}`, padding: "12px 14px" }}>
          <FitPagination
            ariaLabel="Recent activity pagination"
            currentPage={page}
            totalPages={totalPages}
            onPageChange={setPage}
            showSinglePage
          />
        </div>
      </div>
    </ActionTableSection>
  );
}

function FilterSearchControl({
  colors,
  id,
  onChange,
  placeholder,
  value,
}: {
  colors: ReturnType<typeof useTheme>["colors"];
  id: string;
  onChange: (value: string) => void;
  placeholder: string;
  value: string;
}) {
  return (
    <label
      style={{
        alignItems: "center",
        backgroundColor: colors.surface,
        border: `1px solid ${colors.fieldBorder}`,
        borderRadius: 12,
        display: "flex",
        gap: 8,
        minHeight: 44,
        padding: "0 12px",
      }}
    >
      <Search size={15} color={colors.textMuted} />
      <FitTextInput
        aria-label={placeholder}
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
      />
    </label>
  );
}

function DateFilterInput({
  ariaLabel,
  colors,
  id,
  label,
  maxDate = null,
  minDate = null,
  onChange,
  value,
}: {
  ariaLabel: string;
  colors: ReturnType<typeof useTheme>["colors"];
  id: string;
  label: string;
  maxDate?: string | null;
  minDate?: string | null;
  onChange: (value: string) => void;
  value: string;
}) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        id={id}
        aria-label={`${ariaLabel}: ${value ? formatDateLabel(value) : "Select date"}`}
        onClick={() => setIsOpen(true)}
        style={{
          alignItems: "center",
          backgroundColor: colors.surface,
          border: `1px solid ${colors.fieldBorder}`,
          borderRadius: 12,
          color: colors.textPrimary,
          cursor: "pointer",
          display: "flex",
          font: "inherit",
          gap: 8,
          minHeight: 44,
          minWidth: 0,
          padding: "0 12px",
          textAlign: "left",
          width: "100%",
        }}
      >
        <CalendarRange size={15} color={colors.brand} aria-hidden="true" />
        <span style={{ color: colors.textMuted, fontSize: 11, fontWeight: 800 }}>
          {label}
        </span>
        <span
          style={{
            color: value ? colors.textPrimary : colors.textMuted,
            fontSize: 13,
            fontWeight: value ? 750 : 600,
            minWidth: 0,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {value ? formatDateLabel(value) : "Select date"}
        </span>
      </button>
      <CalendarModal
        isOpen={isOpen}
        selectedDate={value || undefined}
        minDate={minDate}
        maxDate={maxDate}
        onSelect={onChange}
        onClose={() => setIsOpen(false)}
      />
    </>
  );
}

function ActionTableSection({
  action,
  children,
  className,
  colors,
  heading,
}: {
  action: ReactNode;
  children: ReactNode;
  className?: string;
  colors: ReturnType<typeof useTheme>["colors"];
  heading: string;
}) {
  return (
    <section
      className={`gym-actions-section${className ? ` ${className}` : ""}`}
      style={{
        backgroundColor: colors.surface,
        border: `1px solid ${colors.border}`,
        borderRadius: 8,
        display: "flex",
        flexDirection: "column",
        minHeight: 0,
        overflow: "hidden",
      }}
    >
      <div
        style={{
          alignItems: "center",
          backgroundColor: colors.surfaceRaised,
          borderBottom: `1px solid ${colors.border}`,
          display: "flex",
          flexShrink: 0,
          gap: 12,
          justifyContent: "space-between",
          padding: "14px 16px",
        }}
      >
        <FitText style={{ fontSize: 18, fontWeight: 900 }}>
          {heading}
        </FitText>
        {action}
      </div>
      <div
        style={{
          display: "flex",
          flex: "1 1 auto",
          flexDirection: "column",
          minHeight: 0,
          minWidth: 0,
        }}
      >
        {children}
      </div>
    </section>
  );
}
