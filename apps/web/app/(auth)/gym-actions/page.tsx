"use client";

import { useMemo, useState, type ReactNode } from "react";
import { Activity, CalendarRange, RefreshCcw, Search } from "lucide-react";
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
import type { FitTableColumn } from "@/components/fit/FitTable";
import FloatingHelpButton from "@/components/help/FloatingHelpButton";

export const dynamic = "force-dynamic";

type TransactionKind = "all" | "payment" | "sale" | "booking" | "coaching";
type AuditKind = "all" | "User" | "MembershipCard" | "Equipment" | "Payment";
type GymActionSectionFilter = "recent" | "transactions" | "audit";

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

const PAGE_SIZE = 6;
const GYM_ACTION_SECTION_OPTIONS: Array<{
  key: GymActionSectionFilter;
  label: string;
}> = [
  { key: "recent", label: "Recent Activity" },
  { key: "transactions", label: "Transaction History" },
  { key: "audit", label: "Audit Log" },
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

function matchesSearch(values: Array<string | number | null | undefined>, search: string) {
  const query = search.trim().toLowerCase();
  if (!query) return true;
  return values.some((value) => String(value ?? "").toLowerCase().includes(query));
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
  const [recentStatus, setRecentStatus] = useState("all");
  const [recentDateRange, setRecentDateRange] = useState<DateRangeFilter>({
    from: "",
    to: "",
  });
  const [recentPage, setRecentPage] = useState(1);
  const [sectionFilter, setSectionFilter] =
    useState<GymActionSectionFilter>("recent");

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

  const transactions = useMemo<TransactionRow[]>(() => {
    const payments =
      paymentsQuery.data?.data.map((payment) => ({
        actor: paymentUserName(payment),
        amount: Number(payment.amount),
        createdAt: payment.created_at,
        description: `${labelize(payment.payable_type)} via ${labelize(payment.provider)}`,
        id: payment.id,
        kind: "payment" as const,
        status: labelize(payment.status),
        title: "Payment",
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
      matchesSearch(
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
      matchesSearch(
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
    () =>
      isAdmin
        ? (snapshotQuery.data?.recentActivities ?? [])
        : staffSafeRecentActivities,
    [isAdmin, snapshotQuery.data?.recentActivities, staffSafeRecentActivities],
  );
  const filteredRecentActivities = recentActivities.filter(
    (activity) =>
      (recentStatus === "all" || activity.status === recentStatus) &&
      matchesDateRange(activity.occurredAt, recentDateRange) &&
      matchesSearch(
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
  const recentTotalPages = Math.max(1, Math.ceil(filteredRecentActivities.length / PAGE_SIZE));
  const recentRows = paginate(filteredRecentActivities, Math.min(recentPage, recentTotalPages));
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
    appointmentsQuery.isFetching;
  const shell = {
    ...fadeIn,
    display: "grid",
    gap: 12,
    paddingBottom: 32,
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
        <FitPill mode="status" label={row.status} color={c.brand} />
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
        <FitPill mode="status" label={log.entity} color={c.brand} />
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
        <FitPill mode="status" label={labelize(activity.status)} color={c.brand} />
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
    <main className={themeTransition} style={shell}>
      <div
        className="gym-actions-section-filter"
        style={{
          alignItems: "center",
          backgroundColor: colors.surface,
          border: `1px solid ${colors.border}`,
          borderRadius: 8,
          display: "flex",
          gap: 12,
          justifyContent: "space-between",
          order: 0,
          padding: "10px 12px",
        }}
      >
        <FitText style={{ color: colors.textSecondary, fontSize: 12, fontWeight: 850 }}>
          View
        </FitText>
        <FitPill
          mode="toggle"
          active={sectionFilter}
          options={GYM_ACTION_SECTION_OPTIONS}
          onChange={setSectionFilter}
          style={{ flexWrap: "wrap" }}
        />
      </div>

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
        <div style={{ display: "grid", gap: 0 }}>
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
          <FitTable
            columns={transactionColumns}
            rows={transactionRows}
            getRowKey={(row) => `${row.kind}-${row.id}`}
            isLoading={isBusy}
            loadingMessage="Loading transactions..."
            emptyMessage="No transactions match the current view."
            style={{ border: 0, borderRadius: 0 }}
          />
          <div style={{ borderTop: `1px solid ${colors.border}`, padding: "12px 14px" }}>
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
        <div style={{ display: "grid", gap: 0 }}>
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
          <FitTable
            columns={auditColumns}
            rows={auditRows}
            getRowKey={(log) => log.id}
            isLoading={auditQuery.isFetching}
            loadingMessage="Loading audit logs..."
            emptyMessage="No audit logs match the current view."
            style={{ border: 0, borderRadius: 0 }}
          />
          <div style={{ borderTop: `1px solid ${colors.border}`, padding: "12px 14px" }}>
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

      {shouldShowSection("recent") ? (
      <RecentActivitySection
        activities={recentRows}
        columns={recentColumns}
        colors={colors}
        dateRange={recentDateRange}
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
        .gym-actions-recent-section {
          order: 1;
        }

        .gym-actions-audit-section {
          order: 2;
        }

        .gym-actions-transactions-section {
          order: 3;
        }

        @media (max-width: 980px) {
          .gym-actions-section-filter,
          .gym-actions-filter-row {
            align-items: stretch !important;
            flex-direction: column !important;
            grid-template-columns: 1fr !important;
          }

          .gym-actions-section-filter > div {
            width: 100%;
          }
        }

        @media (max-width: 760px) {
          .gym-actions-filter-row {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </main>
    <FloatingHelpButton
      title="Gym Actions"
      description="This page reviews transactions, audit records, and recent operational activity across the gym."
      terms={[
        { label: "Transaction history", value: "Payments, sales, booking charges, and coaching revenue records." },
        { label: "Audit log", value: "Tracked admin or staff changes made to operational records." },
        { label: "Recent activity", value: "The latest system events used to understand what changed." },
      ]}
    />
    </>
  );
}

function RecentActivitySection({
  activities,
  columns,
  colors,
  dateRange,
  isLoading,
  onRefresh,
  page,
  search,
  setPage,
  setDateRange,
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
  isLoading: boolean;
  onRefresh: () => void;
  page: number;
  setPage: (page: number) => void;
  search: string;
  setDateRange: (nextRange: DateRangeFilter) => void;
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
      <div style={{ display: "grid", gap: 0 }}>
        <div
          className="gym-actions-filter-row"
          style={{
            display: "grid",
            gap: 10,
            gridTemplateColumns:
              "minmax(220px, 1.2fr) minmax(130px, 0.45fr) minmax(130px, 0.45fr) minmax(170px, 0.55fr)",
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
            onChange={(value) => setDateRange({ ...dateRange, from: value })}
            value={dateRange.from}
          />
          <DateFilterInput
            ariaLabel="Filter recent activity to date"
            colors={colors}
            id="gym-actions-recent-to"
            label="To"
            onChange={(value) => setDateRange({ ...dateRange, to: value })}
            value={dateRange.to}
          />
          <FitDropdown
            ariaLabel="Filter recent activity by status"
            fullWidth
            value={status}
            onChange={setStatus}
            options={statusOptions}
          />
        </div>
        <FitTable
          columns={columns}
          rows={activities}
          getRowKey={(activity) => activity.id}
          isLoading={isLoading}
          loadingMessage="Loading recent activity..."
          emptyMessage="No recent activities are available."
          style={{ border: 0, borderRadius: 0 }}
        />
        <div style={{ borderTop: `1px solid ${colors.border}`, padding: "12px 14px" }}>
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
  onChange,
  value,
}: {
  ariaLabel: string;
  colors: ReturnType<typeof useTheme>["colors"];
  id: string;
  label: string;
  onChange: (value: string) => void;
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
      <CalendarRange size={15} color={colors.textMuted} />
      <FitText style={{ color: colors.textMuted, fontSize: 11, fontWeight: 800 }}>
        {label}
      </FitText>
      <FitTextInput
        aria-label={ariaLabel}
        id={id}
        type="date"
        value={value}
        onInput={(event) => onChange(event.currentTarget.value)}
        onChange={(event) => onChange(event.target.value)}
        style={{ minWidth: 0 }}
      />
    </label>
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
      className={className}
      style={{
        backgroundColor: colors.surface,
        border: `1px solid ${colors.border}`,
        borderRadius: 8,
        overflow: "hidden",
      }}
    >
      <div
        style={{
          alignItems: "center",
          backgroundColor: colors.surfaceRaised,
          borderBottom: `1px solid ${colors.border}`,
          display: "flex",
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
      <div style={{ display: "grid", minWidth: 0 }}>{children}</div>
    </section>
  );
}
