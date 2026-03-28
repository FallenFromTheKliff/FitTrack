"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { BadgeCheck, Briefcase, Mail, Pencil, Skull, SlidersHorizontal, TrendingUp, UserPlus, UserX, Users } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@fittrack/query";
import { upgradeCoachSchema } from "@fittrack/validators";

import { useTheme } from "@/contexts/ThemeContext";
import { useMembers } from "@/contexts/MemberContext";
import { useAuth } from "@/contexts/AuthContext";
import { api } from "@/lib/axios";
import { useFadeIn } from "@/hooks/animations/useFadeIn";
import { useDebounce, useLoadingText, useTimedMessage } from "@fittrack/hooks";
import { useThemeTransition } from "@/hooks/animations/useThemeTransition";
import { dashboardStyles } from "@/styles/pageStyles";
import { CONFIRM_COPY } from "@/utils/confirmCopy";
import { fullName, membershipType } from "@fittrack/utils";
import {
  ADD_STAFF_FIELDS,
  EDIT_MEMBER_FIELDS,
  MEMBER_FILTER_OPTIONS,
  MEMBER_STATUS_TABS,
  STATUS_COLORS,
  TIER_COLORS,
  UPGRADE_COACH_FIELDS,
  type DeletionRequest,
  type DeletionRequestResponse,
  type MemberStatusTab
} from "@/data/members/members";
import type { CoachProfileRecord, MemberRecord } from "@fittrack/types";

import { FitButton, FitInlineFilterChips, FitKpiCard, FitPill, FitSearch, FitSection, FitTable, FitText } from "@/components/fit";
import type { FitTableColumn } from "@/components/fit/FitTable";
import { ConfirmModal, DetailsModal } from "@/components/modals";
import {
  filterMembers,
  getPendingRequestsByUserId,
  MIN_ACTION_DELAY_MS
} from "./helpers";

type StaffCoachRecord = CoachProfileRecord;

function toCoachMemberRecord(coach: StaffCoachRecord): MemberRecord {
  return {
    id: coach.user?.id ?? coach.id,
    email: coach.user?.email ?? "",
    phone_no: coach.user?.phone_no ?? null,
    role: { id: 0, name: "COACH" },
    createdAt: coach.user?.createdAt,
    profile: {
      ...coach.user?.profile,
      membershipType: coach.user?.profile?.membershipType ?? "member"
    }
  };
}

export default function MembersPage() {
  const { colors } = useTheme();
  const { user } = useAuth();
  const { members, isLoading, fetchMembers, createStaff } = useMembers();
  const queryClient = useQueryClient();
  const s = dashboardStyles(colors);
  const isAdmin = user?.role === "ADMIN";
  const isStaff = user?.role === "STAFF";
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
  const [upgradeTarget, setUpgradeTarget] = useState<MemberRecord | null>(null);
  const kpiColumnRef = useRef<HTMLDivElement | null>(null);
  const tableViewportRef = useRef<HTMLDivElement | null>(null);
  const [tableMaxHeight, setTableMaxHeight] = useState<number | null>(null);

  const { data: deletionRequests = [] } = useQuery<DeletionRequest[]>({
    queryKey: queryKeys.adminDeletionRequests(),
    enabled: isAdmin,
    queryFn: async () => {
      const { data } = await api.get<DeletionRequestResponse>("/admin/deletion-requests");
      return data.requests ?? [];
    }
  });

  const { data: staffUsers = [], isLoading: staffUsersLoading } = useQuery<MemberRecord[]>({
    queryKey: queryKeys.staffUsers(),
    enabled: isStaff,
    queryFn: async () => {
      const { data } = await api.get<MemberRecord[]>("/staff/users");
      return data;
    }
  });

  const { data: staffCoaches = [], isLoading: staffCoachesLoading } = useQuery<StaffCoachRecord[]>({
    queryKey: queryKeys.staffCoaches(),
    enabled: isStaff,
    queryFn: async () => {
      const { data } = await api.get<StaffCoachRecord[]>("/staff/coaches");
      return data;
    }
  });

  useEffect(() => {
    if (!isStaff) void fetchMembers();
  }, [fetchMembers, isStaff]);

  const coachMembers = useMemo(
    () => staffCoaches.map(toCoachMemberRecord),
    [staffCoaches]
  );

  const roleScopedMembers = useMemo(() => {
    if (!isStaff) return members;
    const coachIds = new Set(coachMembers.map((member) => member.id));
    const nonCoachUsers = staffUsers.filter((member) => member.role?.name !== "COACH" && !coachIds.has(member.id));
    return [...nonCoachUsers, ...coachMembers];
  }, [coachMembers, isStaff, members, staffUsers]);

  const pendingRequestsByUserId = useMemo(
    () => isAdmin ? getPendingRequestsByUserId(deletionRequests) : new Map<string, DeletionRequest>(),
    [deletionRequests, isAdmin]
  );

  const filtered = useMemo(
    () => filterMembers(roleScopedMembers, debouncedQ, activeChip, activeStatus, pendingRequestsByUserId),
    [roleScopedMembers, debouncedQ, activeChip, activeStatus, pendingRequestsByUserId]
  );

  useEffect(() => {
    const recalc = () => {
      if (!kpiColumnRef.current || !tableViewportRef.current) return;
      if (window.matchMedia("(max-width: 860px)").matches) {
        setTableMaxHeight(null);
        return;
      }
      const kpiRect = kpiColumnRef.current.getBoundingClientRect();
      const logoutButton = document.querySelector('button[aria-label="SIGN OUT"]') as HTMLButtonElement | null;
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
    return () => {
      resizeObserver.disconnect();
      window.removeEventListener("resize", recalc);
    };
  }, [filtered.length, isFilterOpen]);

  const memberStats = useMemo(() => {
    let active = 0;
    let frozen = 0;
    let staffCount = 0;
    let coachCount = 0;
    for (const member of roleScopedMembers) {
      if (member.deletedAt) continue;
      const isFrozenMember = pendingRequestsByUserId.has(member.id);
      if (isFrozenMember) frozen += 1; else active += 1;
      if (member.role?.name === "STAFF") staffCount += 1;
      if (member.role?.name === "COACH") coachCount += 1;
    }
    return { active, frozen, staffCount, coachCount };
  }, [pendingRequestsByUserId, roleScopedMembers]);

  const kpiItems = [
    { icon: Users, label: "Active Accounts", value: memberStats.active, color: colors.brand },
    { icon: TrendingUp, label: "Visible Users", value: roleScopedMembers.length, color: colors.brand },
    { icon: UserX, label: "Frozen Accounts", value: memberStats.frozen, color: colors.brand },
    {
      icon: isStaff ? BadgeCheck : Briefcase,
      label: isStaff ? "Coaches" : "Staff",
      value: isStaff ? memberStats.coachCount : memberStats.staffCount,
      color: colors.brand
    }
  ];

  const editInitialValues: Record<string, string> = {
    firstName: editTarget?.profile?.firstName ?? "",
    lastName: editTarget?.profile?.lastName ?? "",
    email: editTarget?.email ?? "",
    phone_no: editTarget?.phone_no ?? "",
    membershipType: (editTarget?.profile?.membershipType ?? "member").toLowerCase()
  };
  const editPendingRequest = editTarget ? pendingRequestsByUserId.get(editTarget.id) : undefined;
  const isSelfEdit = editTarget?.id === user?.id;

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
      return;
    }
    showMessage(result.error ?? "Failed to add staff.");
  };

  const approveDeletionMutation = useMutation({
    mutationFn: async (requestId: string) => {
      await api.patch(`/admin/deletion-requests/${requestId}/approve`, { reviewNotes: "Approved via members panel." });
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.adminMembers() }),
        queryClient.invalidateQueries({ queryKey: queryKeys.adminDeletionRequests() })
      ]);
    }
  });

  const rejectDeletionMutation = useMutation({
    mutationFn: async (requestId: string) => {
      await api.patch(`/admin/deletion-requests/${requestId}/reject`, { reviewNotes: "Rejected via members panel." });
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.adminMembers() }),
        queryClient.invalidateQueries({ queryKey: queryKeys.adminDeletionRequests() })
      ]);
    }
  });

  const upgradeCoachMutation = useMutation({
    mutationFn: async (payload: {
      userId: string;
      specialties: string[];
      bio?: string;
      certifications?: string[];
      yearsExperience: number;
      hourlyRate: number;
    }) => {
      await api.post("/admin/upgrade-to-coach", payload);
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.adminMembers() }),
        queryClient.invalidateQueries({ queryKey: queryKeys.staffUsers() }),
        queryClient.invalidateQueries({ queryKey: queryKeys.staffCoaches() })
      ]);
    }
  });

  const rejectLoadingLabel = useLoadingText("REJECTING REQUEST", rejectDeletionMutation.isPending);
  const upgradeLoadingLabel = useLoadingText("UPGRADING TO COACH", upgradeCoachMutation.isPending);
  const pageLoading = isStaff ? staffUsersLoading || staffCoachesLoading : isLoading;

  const handleDelete = async () => {
    if (!deleteTarget) return;
    const request = pendingRequestsByUserId.get(deleteTarget.id);
    if (!request) {
      showMessage("No pending termination request found.");
      setDeleteTarget(null);
      return;
    }
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
    if (!request) {
      showMessage("No pending termination request found.");
      return;
    }
    try {
      await rejectDeletionMutation.mutateAsync(request.id);
      setEditTarget(null);
      showMessage("Termination request rejected.");
    } catch {
      showMessage("Failed to reject termination request.");
    }
  };

  const handleUpgradeToCoach = async (data: Record<string, string>) => {
    if (!upgradeTarget) return;
    const parsed = upgradeCoachSchema.safeParse({
      specialties: data.specialties ?? "",
      bio: data.bio ?? "",
      certifications: data.certifications ?? "",
      yearsExperience: data.yearsExperience ?? "",
      hourlyRate: data.hourlyRate ?? ""
    });
    if (!parsed.success) {
      showMessage(parsed.error.issues[0]?.message ?? "Invalid coach profile details.");
      return;
    }
    const { specialties, bio, certifications, yearsExperience, hourlyRate } = parsed.data;
    try {
      await upgradeCoachMutation.mutateAsync({
        userId: upgradeTarget.id,
        specialties,
        bio: bio || undefined,
        certifications,
        yearsExperience,
        hourlyRate
      });
      setUpgradeTarget(null);
      showMessage(`${fullName(upgradeTarget) || upgradeTarget.email} is now a coach.`);
    } catch {
      showMessage("Failed to upgrade user to coach.");
    }
  };

  const memberColumns: FitTableColumn<MemberRecord>[] = [
    {
      key: "name",
      heading: "NAME",
      render: (member, c) => (
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <FitText style={{ fontSize: 15, fontWeight: 700, color: c.textPrimary }}>{fullName(member) || "Unnamed"}</FitText>
          <FitText style={{ fontSize: 13, color: c.textMuted }}>{member.email}</FitText>
        </div>
      )
    },
    {
      key: "role",
      heading: "USER TYPE",
      render: (member, c) => <FitPill mode="status" label={member.role?.name ?? "USER"} color={c.brand} fontSize={14} />
    },
    {
      key: "status",
      heading: "STATUS",
      render: (member, c) => {
        const stateLabel = pendingRequestsByUserId.has(member.id) ? "Frozen" : "Active";
        return <FitPill mode="status" label={stateLabel} color={STATUS_COLORS[stateLabel] ?? c.textMuted} fontSize={14} />;
      }
    },
    {
      key: "tier",
      heading: "TIER",
      render: (member, c) => {
        const tierLabel = membershipType(member);
        return <FitPill mode="status" label={tierLabel} color={TIER_COLORS[tierLabel] ?? c.textMuted} fontSize={14} />;
      }
    },
    {
      key: "checkin",
      heading: "LAST CHECK-IN",
      render: (member, c) => (
        <FitText style={{ fontSize: 14, color: c.textMuted }}>
          {member.createdAt ? new Date(member.createdAt).toLocaleDateString() : "-"}
        </FitText>
      )
    }
  ];

  const tableActions = isAdmin
    ? [
        {
          label: "Message",
          variant: "ghost" as const,
          icon: Mail,
          iconSize: 14,
          iconOnly: true,
          ariaLabel: () => "Message member",
          onClick: () => {},
          style: { padding: 6, width: 32, height: 32 }
        },
        {
          label: "Edit",
          variant: "ghost" as const,
          icon: Pencil,
          iconSize: 14,
          iconOnly: true,
          ariaLabel: () => "Edit member",
          onClick: (member: MemberRecord) => setEditTarget(member),
          style: { padding: 6, width: 32, height: 32, border: `1px solid ${colors.brand}`, backgroundColor: `${colors.brand}15`, color: colors.brand }
        },
        {
          label: "Upgrade to coach",
          variant: "ghost" as const,
          icon: BadgeCheck,
          iconSize: 14,
          iconOnly: true,
          ariaLabel: () => "Upgrade to coach",
          disabled: (member: MemberRecord) => member.role?.name === "ADMIN" || member.role?.name === "COACH" || member.id === user?.id,
          onClick: (member: MemberRecord) => setUpgradeTarget(member),
          style: { padding: 6, width: 32, height: 32 }
        }
      ]
    : [
        {
          label: "View",
          variant: "ghost" as const,
          icon: Pencil,
          iconSize: 14,
          iconOnly: true,
          ariaLabel: () => "View member",
          onClick: (member: MemberRecord) => setEditTarget(member),
          style: { padding: 6, width: 32, height: 32 }
        }
      ];

  return (
    <FitSection as="section" heading="" hideHeading bare noPadding className={themeTransition} style={fadeIn}>
      {message ? (
        <div style={{ marginBottom: 12 }}>
          <FitText style={{ fontSize: 13, color: colors.success, fontWeight: 500 }}>{message}</FitText>
        </div>
      ) : null}
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
            {isAdmin ? (
              <FitButton variant="primary" label="ADD STAFF" icon={UserPlus} iconSize={14} onClick={() => setAddOpen(true)} />
            ) : null}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14, flexWrap: "wrap" }}>
            <FitPill
              options={[...MEMBER_STATUS_TABS]}
              active={activeStatus}
              onChange={(value) => setActiveStatus(value as MemberStatusTab)}
            />
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <FitButton variant="ghost" label="Filter" icon={SlidersHorizontal} iconSize={16} onClick={() => setIsFilterOpen((value) => !value)} />
              <FitInlineFilterChips
                isOpen={isFilterOpen}
                options={MEMBER_FILTER_OPTIONS}
                activeValue={activeChip}
                onChange={setActiveChip}
                maxWidth={420}
              />
            </div>
          </div>
          <FitSection heading={isStaff ? "People Directory" : "Members List"} headingStyle={{ fontSize: 13 }} className="mb-0">
            <div ref={tableViewportRef}>
              <FitTable
                columns={memberColumns}
                rows={filtered}
                getRowKey={(member: MemberRecord) => member.id}
                isLoading={pageLoading}
                loadingMessage={isStaff ? "Loading staff directory..." : "Loading members..."}
                emptyMessage="No members match your search."
                maxHeight={tableMaxHeight}
                actions={tableActions}
              />
            </div>
          </FitSection>
        </div>
      </div>
      {isAdmin ? (
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
      ) : null}
      <DetailsModal
        isOpen={!!editTarget}
        title={isStaff ? "Member Details" : "Edit Member"}
        subtitle={editTarget?.email ?? ""}
        fields={EDIT_MEMBER_FIELDS}
        initialValues={editInitialValues}
        submitLabel={isStaff || isSelfEdit ? "CLOSE" : "SAVE CHANGES"}
        readOnly={isStaff || isSelfEdit}
        readOnlyBanner={isStaff ? "Staff access is read-only in this directory." : isSelfEdit ? "This is your own account. To edit your details, go to Profile." : undefined}
        disableUnchanged
        onSubmit={isStaff || isSelfEdit ? () => setEditTarget(null) : () => {
          showMessage("Coming soon.");
          setEditTarget(null);
        }}
        onCancel={() => setEditTarget(null)}
        dangerLabel={isAdmin && !isSelfEdit ? "TERMINATE ACCOUNT" : undefined}
        dangerIcon={Skull}
        dangerDisabled={isSelfEdit || !editPendingRequest}
        onDanger={isAdmin && !isSelfEdit ? () => {
          if (!editTarget) return;
          setDeleteTarget(editTarget);
          setEditTarget(null);
        } : undefined}
      >
        {isAdmin && !isSelfEdit && editPendingRequest ? (
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
      {isAdmin ? (
        <DetailsModal
          isOpen={!!upgradeTarget}
          title="Upgrade to Coach"
          subtitle={upgradeTarget ? `${fullName(upgradeTarget) || upgradeTarget.email}` : ""}
          fields={UPGRADE_COACH_FIELDS}
          submitLabel={upgradeCoachMutation.isPending ? upgradeLoadingLabel : "UPGRADE USER"}
          isLoading={upgradeCoachMutation.isPending}
          onSubmit={handleUpgradeToCoach}
          onCancel={() => setUpgradeTarget(null)}
        />
      ) : null}
      {isAdmin ? (
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
      ) : null}
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
