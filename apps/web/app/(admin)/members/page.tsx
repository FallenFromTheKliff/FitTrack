"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { Users, UserPlus, TrendingUp, SlidersHorizontal, UserX, Briefcase, Mail, Pencil, Skull } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";

import { useTheme } from "@/contexts/ThemeContext";
import { useMembers } from "@/contexts/MemberContext";
import { useAuth } from "@/contexts/AuthContext";
import { api } from "@/lib/axios";
import { useFadeIn } from "@/hooks/animations/useFadeIn";
import { useDebounce, useLoadingText, useTimedMessage } from "@fittrack/hooks";
import { useThemeTransition } from "@/hooks/animations/useThemeTransition";
import { dashboardStyles } from "@/styles/pageStyles";
import { CONFIRM_COPY } from "@/utils/confirmCopy";
import { fullName, membershipType } from "@/utils/members";
import {
  ADD_STAFF_FIELDS,
  EDIT_MEMBER_FIELDS,
  MEMBER_FILTER_OPTIONS,
  MEMBER_STATUS_TABS,
  STATUS_COLORS,
  TIER_COLORS,
  type DeletionRequest,
  type DeletionRequestResponse,
  type MemberStatusTab
} from "@/data/members/members";
import type { MemberRecord } from "@fittrack/types";

import { FitText } from "@/components/fit/FitText";
import FitButton from "@/components/fit/FitButton";
import FitPill from "@/components/fit/FitPill";
import { FitInlineFilterChips } from "@/components/fit/FitFilter";
import { FitKpiCard } from "@/components/fit/FitCard";
import FitSearch from "@/components/fit/FitSearch";
import FitSection from "@/components/fit/FitSection";
import FitTable from "@/components/fit/FitTable";
import type { FitTableColumn } from "@/components/fit/FitTable";
import { ConfirmModal, DetailsModal } from "@/components/modals";
import {
  filterMembers,
  getPendingRequestsByUserId,
  MIN_ACTION_DELAY_MS
} from "./helpers";

export default function MembersPage() {
  const { colors } = useTheme();
  const { user } = useAuth();
  const { members, isLoading, fetchMembers, createStaff } = useMembers();
  const router = useRouter();
  const queryClient = useQueryClient();
  const s = dashboardStyles(colors);
  const [q, setQ] = useState("");
  const debouncedQ = useDebounce(q, 250);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [activeChip, setActiveChip] = useState("all");
  const [activeStatus, setActiveStatus] = useState<MemberStatusTab>("Active");
  const fadeIn = useFadeIn();
  const themeTransition = useThemeTransition();
  const { message, showMessage } = useTimedMessage(2500);

  const [addOpen, setAddOpen] = useState(false);
  const [addLoading, setAddLoading] = useState(false);
  const addLoadingLabel = useLoadingText("ADDING STAFF", addLoading);

  const [editTarget, setEditTarget] = useState<MemberRecord | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<MemberRecord | null>(null);
  const kpiColumnRef = useRef<HTMLDivElement | null>(null);
  const tableViewportRef = useRef<HTMLDivElement | null>(null);
  const [tableMaxHeight, setTableMaxHeight] = useState<number | null>(null);

  useEffect(() => {
    if (user?.role === "STAFF") {
      router.replace("/dashboard");
    }
  }, [user?.role, router]);

  const { data: deletionRequests = [] } = useQuery<DeletionRequest[]>({
    queryKey: ["deletion-requests"],
    queryFn: async () => {
      const { data } = await api.get<DeletionRequestResponse>("/admin/deletion-requests");
      return data.requests ?? [];
    }
  });

  useEffect(() => { void fetchMembers(); }, [fetchMembers]);

  const pendingRequestsByUserId = useMemo(
    () => getPendingRequestsByUserId(deletionRequests),
    [deletionRequests]
  );

  const filtered = useMemo(
    () => filterMembers(members, debouncedQ, activeChip, activeStatus, pendingRequestsByUserId),
    [members, debouncedQ, activeChip, activeStatus, pendingRequestsByUserId]
  );

  useEffect(() => {
    const recalc = () => {
      if (!kpiColumnRef.current || !tableViewportRef.current) return;
      if (window.matchMedia("(max-width: 860px)").matches) { setTableMaxHeight(null); return; }
      const kpiRect = kpiColumnRef.current.getBoundingClientRect();
      const logoutButton = document.querySelector('button[aria-label="LOG OUT"]') as HTMLButtonElement | null;
      const viewportRect = tableViewportRef.current.getBoundingClientRect();
      const maxBottom = logoutButton ? logoutButton.getBoundingClientRect().bottom : kpiRect.bottom;
      const availableHeight = Math.floor(maxBottom - viewportRect.top);
      setTableMaxHeight(availableHeight > 240 ? availableHeight : 240);
    };
    recalc();
    const resizeObserver = new ResizeObserver(recalc);
    if (kpiColumnRef.current) resizeObserver.observe(kpiColumnRef.current);
    if (tableViewportRef.current) resizeObserver.observe(tableViewportRef.current);
    window.addEventListener("resize", recalc);
    return () => { resizeObserver.disconnect(); window.removeEventListener("resize", recalc); };
  }, [isFilterOpen, filtered.length]);

  const memberStats = useMemo(() => {
    let active = 0; let frozen = 0; let staff = 0;
    for (const member of members) {
      if (member.deletedAt) continue;
      const isFrozen = pendingRequestsByUserId.has(member.id);
      if (isFrozen) frozen += 1; else active += 1;
      if (member.role?.name === "STAFF") staff += 1;
    }
    return { active, frozen, staff };
  }, [members, pendingRequestsByUserId]);

  const kpiItems = [
    { icon: Users, label: "Total Active Members", value: memberStats.active, color: colors.brand },
    { icon: TrendingUp, label: "New Joins This Month", value: 0, color: colors.brand },
    { icon: UserX, label: "Frozen Members", value: memberStats.frozen, color: colors.brand },
    { icon: Briefcase, label: "Staff", value: memberStats.staff, color: colors.brand }
  ];

  const isSelfEdit = editTarget?.id === user?.id;
  const editPendingRequest = editTarget ? pendingRequestsByUserId.get(editTarget.id) : undefined;
  const editInitialValues: Record<string, string> = {
    firstName: editTarget?.profile?.firstName ?? "",
    lastName: editTarget?.profile?.lastName ?? "",
    email: editTarget?.email ?? "",
    phone_no: editTarget?.phone_no ?? "",
    membershipType: (editTarget?.profile?.membershipType ?? "member").toLowerCase()
  };

  const handleAdd = async (data: Record<string, string>) => {
    setAddLoading(true);
    await new Promise((resolve) => setTimeout(resolve, MIN_ACTION_DELAY_MS));
    const result = await createStaff({
      email: data.email ?? "",
      password: data.password ?? "",
      firstName: data.firstName || undefined,
      lastName: data.lastName || undefined,
      phone_no: data.phone_no || undefined
    });
    setAddLoading(false);
    if (result.success) {
      setAddOpen(false);
      showMessage("Staff account created successfully.");
    } else {
      showMessage(result.error ?? "Failed to add staff.");
    }
  };

  const approveDeletionMutation = useMutation({
    mutationFn: async (requestId: string) => {
      await api.patch(`/admin/deletion-requests/${requestId}/approve`, { reviewNotes: "Approved via members panel." });
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["members"] }),
        queryClient.invalidateQueries({ queryKey: ["deletion-requests"] })
      ]);
    }
  });

  const rejectDeletionMutation = useMutation({
    mutationFn: async (requestId: string) => {
      await api.patch(`/admin/deletion-requests/${requestId}/reject`, { reviewNotes: "Rejected via members panel." });
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["members"] }),
        queryClient.invalidateQueries({ queryKey: ["deletion-requests"] })
      ]);
    }
  });

  const rejectLoadingLabel = useLoadingText("REJECTING REQUEST", rejectDeletionMutation.isPending);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    const request = pendingRequestsByUserId.get(deleteTarget.id);
    if (!request) { showMessage("No pending termination request found."); setDeleteTarget(null); return; }
    await new Promise((resolve) => setTimeout(resolve, MIN_ACTION_DELAY_MS));
    try {
      await approveDeletionMutation.mutateAsync(request.id);
      setDeleteTarget(null);
      showMessage("Account terminated.");
    } catch {
      showMessage("Failed to terminate account.");
    }
  };

  const handleRejectDeleteRequest = async () => {
    if (!editTarget) return;
    const request = pendingRequestsByUserId.get(editTarget.id);
    if (!request) { showMessage("No pending termination request found."); return; }
    try {
      await rejectDeletionMutation.mutateAsync(request.id);
      setEditTarget(null);
      showMessage("Termination request rejected.");
    } catch {
      showMessage("Failed to reject termination request.");
    }
  };

  const memberColumns: FitTableColumn<MemberRecord>[] = [
    {
      key: "name",
      heading: "NAME",
      render: (m, c) => (
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <FitText style={{ fontSize: 15, fontWeight: 700, color: c.textPrimary }}>{fullName(m) || "Unnamed"}</FitText>
            <FitText style={{ fontSize: 13, color: c.textMuted }}>{m.email}</FitText>
          </div>
      )
    },
    {
      key: "role",
      heading: "USER TYPE",
      render: (m, c) => <FitPill mode="status" label={m.role?.name ?? "USER"} color={c.brand} fontSize={14} />
    },
    {
      key: "status",
      heading: "STATUS",
      render: (m, c) => {
        const stateLabel = pendingRequestsByUserId.has(m.id) ? "Frozen" : "Active";
        return <FitPill mode="status" label={stateLabel} color={STATUS_COLORS[stateLabel] ?? c.textMuted} fontSize={14} />;
      }
    },
    {
      key: "tier",
      heading: "TIER",
      render: (m, c) => {
        const tierLabel = membershipType(m);
        return <FitPill mode="status" label={tierLabel} color={TIER_COLORS[tierLabel] ?? c.textMuted} fontSize={14} />;
      }
    },
    {
      key: "checkin",
      heading: "LAST CHECK-IN",
      render: (m, c) => (
          <FitText style={{ fontSize: 14, color: c.textMuted }}>
            {m.createdAt ? new Date(m.createdAt).toLocaleDateString() : "-"}
          </FitText>
      )
    }
  ];

  if (user?.role === "STAFF") return null;

  return (
      <FitSection as="section" heading="" hideHeading bare noPadding className={themeTransition} style={fadeIn}>
        {message && (
            <div style={{ marginBottom: 12 }}>
              <FitText style={{ fontSize: 13, color: colors.success, fontWeight: 500 }}>{message}</FitText>
            </div>
        )}
        <div
            className="members-grid"
            style={{ display: "grid", gridTemplateColumns: "minmax(220px, 260px) 1fr", gap: 20, alignItems: "start" }}
        >
          <div ref={kpiColumnRef} className="members-kpis" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {kpiItems.map((item) => (
                <FitKpiCard
                    key={item.label}
                    icon={item.icon}
                    label={item.label}
                    value={item.value}
                    color={item.color}
                    style={{ ...s.kpiCard, padding: "12px 14px" }}
                    valueStyle={{ fontSize: 22, lineHeight: 1.1 }}
                />
            ))}
          </div>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
              <div style={{ flex: "1 1 360px", minWidth: 240 }}>
                <FitSearch value={q} onChangeText={setQ} placeholder="Search by name or email..." />
              </div>
              <FitButton variant="primary" label="ADD STAFF" icon={UserPlus} iconSize={14} onClick={() => setAddOpen(true)} />
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14, flexWrap: "wrap" }}>
              <FitPill
                  options={[...MEMBER_STATUS_TABS]}
                  active={activeStatus}
                  onChange={(v) => setActiveStatus(v as MemberStatusTab)}
              />
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <FitButton variant="ghost" label="Filter" icon={SlidersHorizontal} iconSize={16} onClick={() => setIsFilterOpen((v) => !v)} />
                <FitInlineFilterChips
                    isOpen={isFilterOpen}
                    options={MEMBER_FILTER_OPTIONS}
                    activeValue={activeChip}
                    onChange={setActiveChip}
                    maxWidth={420}
                />
              </div>
            </div>
            <FitSection heading="Members List" headingStyle={{ fontSize: 13 }} className="mb-0">
              <div ref={tableViewportRef}>
                <FitTable
                    columns={memberColumns}
                    rows={filtered}
                    getRowKey={(m) => m.id}
                    isLoading={isLoading}
                    loadingMessage="Loading members..."
                    emptyMessage="No members match your search."
                    maxHeight={tableMaxHeight}
                    actions={[
                      {
                        label: "Message",
                        variant: "ghost",
                        icon: Mail,
                        iconSize: 14,
                        iconOnly: true,
                        ariaLabel: () => "Message member",
                        onClick: () => {},
                        style: { padding: 6, width: 32, height: 32 }
                      },
                      {
                        label: "Edit",
                        variant: "ghost",
                        icon: Pencil,
                        iconSize: 14,
                        iconOnly: true,
                        ariaLabel: () => "Edit member",
                        onClick: (m) => setEditTarget(m),
                        style: { padding: 6, width: 32, height: 32, border: `1px solid ${colors.brand}`, backgroundColor: `${colors.brand}15`, color: colors.brand }
                      }
                    ]}
                />
              </div>
            </FitSection>
          </div>
        </div>
        <DetailsModal
            isOpen={addOpen}
            title="Add Staff"
            subtitle="Create a new staff account for the system"
            fields={ADD_STAFF_FIELDS}
            submitLabel={addLoading ? addLoadingLabel : "ADD STAFF"}
            isLoading={addLoading}
            onSubmit={handleAdd}
            onCancel={() => setAddOpen(false)}
        />
        <DetailsModal
            isOpen={!!editTarget}
            title="Edit Member"
            subtitle={editTarget?.email ?? ""}
            fields={EDIT_MEMBER_FIELDS}
            initialValues={editInitialValues}
            submitLabel={isSelfEdit ? "CLOSE" : "SAVE CHANGES"}
            readOnly={isSelfEdit}
            readOnlyBanner="This is your own account. To edit your details, go to Profile."
            disableUnchanged
            onSubmit={isSelfEdit ? () => setEditTarget(null) : (_data) => { showMessage("Coming soon."); setEditTarget(null); }}
            onCancel={() => setEditTarget(null)}
            dangerLabel={isSelfEdit ? undefined : "TERMINATE ACCOUNT"}
            dangerIcon={Skull}
            dangerDisabled={isSelfEdit || !editPendingRequest}
            onDanger={isSelfEdit ? undefined : () => {
              if (!editTarget) return;
              setDeleteTarget(editTarget);
              setEditTarget(null);
            }}
        >
          {!isSelfEdit && editPendingRequest ? (
              <FitButton
                  variant="ghost"
                  label={rejectDeletionMutation.isPending ? rejectLoadingLabel : "REJECT REQUEST"}
                  onClick={handleRejectDeleteRequest}
                  disabled={rejectDeletionMutation.isPending}
                  fullWidth
                  style={{ marginTop: 8 }}
              />
          ) : null}
        </DetailsModal>
        <ConfirmModal
            isOpen={!!deleteTarget}
            title="Terminate Account"
            message={`Approve the termination request for ${deleteTarget?.email ?? "this user"}? This action cannot be undone.`}
            confirmLabel={CONFIRM_COPY.terminateAccount.confirmLabel}
            loadingLabel={CONFIRM_COPY.terminateAccount.loadingLabel}
            confirmIcon={Skull}
            isDanger
            isLoading={approveDeletionMutation.isPending}
            onConfirm={handleDelete}
            onCancel={() => setDeleteTarget(null)}
        />
        <style>{`
          @media (max-width: 860px) {
            .members-grid { grid-template-columns: 1fr !important; }
            .members-kpis { display: grid !important; grid-template-columns: repeat(2, minmax(0, 1fr)) !important; gap: 10px !important; }
            .members-kpis .fit-kpi-card { padding: 10px 12px !important; min-height: 72px !important; }
          }
        `}</style>
      </FitSection>
  );
}

