"use client";

import { useMemo, useState } from "react";
import type { CSSProperties } from "react";
import { Activity, RefreshCcw, Search } from "lucide-react";
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

import { useTheme } from "@/contexts/ThemeContext";
import { useFadeIn } from "@/hooks/animations/useFadeIn";
import { useThemeTransition } from "@/hooks/animations/useThemeTransition";
import { webApiClient } from "@/lib/api-client";
import {
  FitButton,
  FitPill,
  FitSection,
  FitSelect,
  FitText,
  FitTextInput,
} from "@/components/fit";

type TransactionKind = "all" | "payment" | "sale" | "booking" | "coaching";
type AuditKind = "all" | "User" | "MembershipCard" | "Equipment" | "Payment";

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

function paginate<T>(items: T[], page: number) {
  const start = (page - 1) * PAGE_SIZE;
  return items.slice(start, start + PAGE_SIZE);
}

export default function GymActionsDashboard() {
  const { colors } = useTheme();
  const fadeIn = useFadeIn({ duration: 220 });
  const themeTransition = useThemeTransition();
  const [transactionSearch, setTransactionSearch] = useState("");
  const [transactionKind, setTransactionKind] = useState<TransactionKind>("all");
  const [transactionPage, setTransactionPage] = useState(1);
  const [auditSearch, setAuditSearch] = useState("");
  const [auditKind, setAuditKind] = useState<AuditKind>("all");
  const [auditPage, setAuditPage] = useState(1);

  const snapshotQuery = useQuery(analyticsSnapshotQueryOptions(webApiClient));
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
      matchesSearch(
        [row.actor, row.amount, row.description, row.status, row.title],
        transactionSearch,
      ),
  );
  const transactionTotalPages = Math.max(1, Math.ceil(filteredTransactions.length / PAGE_SIZE));
  const transactionRows = paginate(
    filteredTransactions,
    Math.min(transactionPage, transactionTotalPages),
  );

  const auditLogs = auditQuery.data?.data ?? [];
  const filteredAuditLogs = auditLogs.filter(
    (log) =>
      (auditKind === "all" || log.entity === auditKind) &&
      matchesSearch(
        [
          log.action,
          log.entity,
          log.entity_id,
          log.id,
          log.user_id,
          profileName(log.actor?.profile),
        ],
        auditSearch,
      ),
  );
  const auditTotalPages = Math.max(1, Math.ceil(filteredAuditLogs.length / PAGE_SIZE));
  const auditRows = paginate(filteredAuditLogs, Math.min(auditPage, auditTotalPages));
  const recentActivities = snapshotQuery.data?.recentActivities ?? [];
  const isBusy =
    snapshotQuery.isFetching ||
    auditQuery.isFetching ||
    paymentsQuery.isFetching ||
    salesQuery.isFetching ||
    bookingsQuery.isFetching ||
    appointmentsQuery.isFetching;
  const panelStyle = {
    backgroundColor: colors.surfaceRaised,
    border: `1px solid ${colors.border}`,
    borderRadius: 20,
    padding: 18,
  };
  const muted = { color: colors.textMuted, fontSize: 13, lineHeight: 1.45 };
  const shell = {
    ...fadeIn,
    display: "grid",
    gap: 18,
    paddingBottom: 32,
  };

  const refreshAll = () => {
    void snapshotQuery.refetch();
    void auditQuery.refetch();
    void paymentsQuery.refetch();
    void salesQuery.refetch();
    void bookingsQuery.refetch();
    void appointmentsQuery.refetch();
  };

  return (
    <main className={themeTransition} style={shell}>
      <section
        style={{
          ...panelStyle,
          display: "grid",
          gap: 14,
          gridTemplateColumns: "minmax(0, 1fr) auto",
          alignItems: "center",
        }}
      >
        <div style={{ display: "grid", gap: 8 }}>
          <FitText as="p" style={{ color: colors.brand, fontSize: 12, fontWeight: 800 }}>
            GYM ACTIONS
          </FitText>
          <FitText as="h2" style={{ fontSize: 28, fontWeight: 900 }}>
            Operational transaction and audit trail
          </FitText>
          <FitText as="p" style={muted}>
            Search manual actions, payments, bookings, coaching appointments,
            retail sales, and the recent activity stream in one place.
          </FitText>
        </div>
        <FitButton
          icon={RefreshCcw}
          label="REFRESH"
          loading={isBusy}
          onClick={refreshAll}
        />
      </section>

      <FitSection heading="Transaction History">
        <div style={{ display: "grid", gap: 12 }}>
          <div
            style={{
              display: "grid",
              gap: 10,
              gridTemplateColumns: "minmax(220px, 1fr) minmax(180px, 0.28fr)",
            }}
          >
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
                value={transactionSearch}
                onChange={(event) => {
                  setTransactionSearch(event.target.value);
                  setTransactionPage(1);
                }}
                placeholder="Search transactions"
              />
            </label>
            <FitSelect
              fullWidth
              value={transactionKind}
              onChange={(event) => {
                setTransactionKind(event.target.value as TransactionKind);
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
          <div style={{ display: "grid", gap: 10 }}>
            {transactionRows.map((row) => (
              <div
                key={`${row.kind}-${row.id}`}
                style={{
                  ...panelStyle,
                  backgroundColor: colors.surface,
                  display: "grid",
                  gap: 12,
                  gridTemplateColumns: "minmax(0, 1fr) minmax(120px, 0.2fr) minmax(130px, 0.22fr)",
                  alignItems: "center",
                }}
              >
                <div style={{ display: "grid", gap: 5 }}>
                  <FitText as="p" style={{ fontSize: 15, fontWeight: 800 }}>
                    {row.title} - {row.actor}
                  </FitText>
                  <FitText as="p" style={muted}>{row.description}</FitText>
                  <FitText as="p" style={{ ...muted, fontSize: 12 }}>
                    {formatDateTime(row.createdAt)}
                  </FitText>
                </div>
                <FitText style={{ fontSize: 14, fontWeight: 800 }}>
                  {formatPeso(row.amount)}
                </FitText>
                <FitPill mode="status" label={row.status} color={colors.brand} />
              </div>
            ))}
            {transactionRows.length === 0 ? (
              <FitText as="p" style={muted}>No transactions match the current view.</FitText>
            ) : null}
          </div>
          <Pager
            colors={colors}
            page={Math.min(transactionPage, transactionTotalPages)}
            setPage={setTransactionPage}
            totalPages={transactionTotalPages}
          />
        </div>
      </FitSection>

      <FitSection heading="Audit Log">
        <div style={{ display: "grid", gap: 12 }}>
          <div
            style={{
              display: "grid",
              gap: 10,
              gridTemplateColumns: "minmax(220px, 1fr) minmax(180px, 0.28fr)",
            }}
          >
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
                value={auditSearch}
                onChange={(event) => {
                  setAuditSearch(event.target.value);
                  setAuditPage(1);
                }}
                placeholder="Search audit logs"
              />
            </label>
            <FitSelect
              fullWidth
              value={auditKind}
              onChange={(event) => {
                setAuditKind(event.target.value as AuditKind);
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
          <div style={{ display: "grid", gap: 10 }}>
            {auditRows.map((log: AuditLogRecord) => (
              <div
                key={log.id}
                style={{
                  ...panelStyle,
                  backgroundColor: colors.surface,
                  display: "grid",
                  gap: 12,
                  gridTemplateColumns: "minmax(0, 1fr) minmax(130px, 0.22fr)",
                }}
              >
                <div style={{ display: "grid", gap: 5 }}>
                  <FitText as="p" style={{ fontSize: 15, fontWeight: 800 }}>
                    {labelize(log.action)}
                  </FitText>
                  <FitText as="p" style={muted}>
                    {log.entity} {log.entity_id}
                  </FitText>
                  <FitText as="p" style={{ ...muted, fontSize: 12 }}>
                    {profileName(log.actor?.profile) || log.actor?.role || "System"} - {formatDateTime(log.created_at)}
                  </FitText>
                </div>
                <FitPill mode="status" label={log.entity} color={colors.brand} />
              </div>
            ))}
            {auditRows.length === 0 ? (
              <FitText as="p" style={muted}>No audit logs match the current view.</FitText>
            ) : null}
          </div>
          <Pager
            colors={colors}
            page={Math.min(auditPage, auditTotalPages)}
            setPage={setAuditPage}
            totalPages={auditTotalPages}
          />
        </div>
      </FitSection>

      <RecentActivitySection
        activities={recentActivities}
        colors={colors}
        muted={muted}
        panelStyle={panelStyle}
      />

      <style>{`
        @media (max-width: 980px) {
          main > section:first-child,
          main [style*="grid-template-columns"] {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </main>
  );
}

function Pager({
  colors,
  page,
  setPage,
  totalPages,
}: {
  colors: ReturnType<typeof useTheme>["colors"];
  page: number;
  setPage: (page: number) => void;
  totalPages: number;
}) {
  return (
    <nav
      aria-label="Pagination"
      style={{ alignItems: "center", display: "flex", gap: 8, justifyContent: "flex-end" }}
    >
      <FitButton
        label="PREV"
        variant="ghost"
        disabled={page <= 1}
        onClick={() => setPage(Math.max(1, page - 1))}
      />
      <FitText style={{ color: colors.textMuted, fontSize: 12 }}>
        Page {page} of {totalPages}
      </FitText>
      <FitButton
        label="NEXT"
        variant="ghost"
        disabled={page >= totalPages}
        onClick={() => setPage(Math.min(totalPages, page + 1))}
      />
    </nav>
  );
}

function RecentActivitySection({
  activities,
  colors,
  muted,
  panelStyle,
}: {
  activities: AnalyticsRecentActivityRecord[];
  colors: ReturnType<typeof useTheme>["colors"];
  muted: { color: string; fontSize: number; lineHeight: number };
  panelStyle: CSSProperties;
}) {
  return (
    <FitSection
      heading="Recent Activity"
      action={
        <div style={{ alignItems: "center", display: "flex", gap: 8 }}>
          <Activity size={15} color={colors.brand} />
          <FitText style={{ color: colors.textMuted, fontSize: 12 }}>
            {activities.length} activity lanes
          </FitText>
        </div>
      }
    >
      <div style={{ display: "grid", gap: 10 }}>
        {activities.slice(0, 8).map((activity) => (
          <div
            key={activity.id}
            style={{
              ...panelStyle,
              backgroundColor: colors.surface,
              display: "grid",
              gap: 12,
              gridTemplateColumns: "minmax(0, 1fr) minmax(130px, 0.22fr)",
            }}
          >
            <div style={{ display: "grid", gap: 5 }}>
              <FitText as="p" style={{ fontSize: 15, fontWeight: 800 }}>
                {activity.title}
              </FitText>
              <FitText as="p" style={muted}>{activity.description}</FitText>
              <FitText as="p" style={{ ...muted, fontSize: 12 }}>
                {activity.actorName} - {formatDateTime(activity.occurredAt)}
              </FitText>
            </div>
            <FitPill mode="status" label={activity.status} color={colors.brand} />
          </div>
        ))}
        {activities.length === 0 ? (
          <FitText as="p" style={muted}>No recent activities are available.</FitText>
        ) : null}
      </div>
    </FitSection>
  );
}
