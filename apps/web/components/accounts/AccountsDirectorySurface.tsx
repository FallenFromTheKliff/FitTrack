"use client";

import { Check, Filter, LayoutGrid, List, X } from "lucide-react";
import { parseRevocationReasons, type MemberRecord } from "@fittrack/types";
import { fullName } from "@fittrack/utils";

import MembersDirectoryPanel from "@/components/accounts/MembersDirectoryPanel";
import { FitButton, FitPill, FitSearch, FitSelect, FitText } from "@/components/fit";
import type { FitTableColumn } from "@/components/fit/FitTable";
import { useTheme } from "@/contexts/ThemeContext";
import type { MemberStatusTab } from "@/data/members/members";
import {
  formatLastCheckIn,
  getDirectoryAccessLabel,
  getDirectoryRoleLabel,
  getDirectoryStatusLabel,
  getMemberAvatarUrl,
  getMemberInitials,
  getScanReadinessLabel,
} from "@/components/accounts/accountComponentUtils";

import CoachClientInspectorSurface from "./coach-client/CoachClientInspectorSurface";
import AccountsInspectorSurface from "./AccountsInspectorSurface";
import { useAccountsPage } from "./AccountsPageContext";

export default function AccountsDirectorySurface() {
  const { colors } = useTheme();
  const {
    activeChip,
    activeCoachActivityLevel,
    activeCoachMembershipStatus,
    activeCoachSessionStatus,
    activeRevokeReason,
    activeStatus,
    activeTier,
    coachClientSummary,
    directoryEmptyMessage,
    directoryPageSize,
    editTarget,
    filtered,
    isAdmin,
    isCoach,
    isTerminationRequestsView,
    openInspector,
    page,
    pageLoading,
    paginatedRows,
    pendingRequestsByUserId,
    q,
    roleSelectOptions,
    revokeReasonFilterOptions,
    setActiveChip,
    setActiveCoachActivityLevel,
    setActiveCoachMembershipStatus,
    setActiveCoachSessionStatus,
    setActiveRevokeReason,
    setActiveStatus,
    setActiveTier,
    setPage,
    setQ,
    setViewMode,
    statusSelectOptions,
    tierSelectOptions,
    totalPages,
    viewMode,
  } = useAccountsPage();

  const coachMembershipStatusOptions = [
    { label: "All Clients", value: "all" },
    { label: "Members", value: "active_member" },
    { label: "Non-members", value: "verified_non_member" },
  ];
  const coachSessionStatusOptions = [
    { label: "All Sessions", value: "all" },
    { label: "Has Upcoming", value: "has_upcoming" },
    { label: "No Upcoming", value: "no_upcoming" },
  ];
  const coachActivityLevelOptions = [
    { label: "All Activity", value: "all" },
    { label: "Sedentary", value: "sedentary" },
    { label: "Lightly Active", value: "light" },
    { label: "Moderate", value: "moderate" },
    { label: "Active", value: "active" },
    { label: "Very Active", value: "very_active" },
  ];
  const detailTextStyle = (c: typeof colors) => ({
    fontSize: 12,
    fontWeight: 500,
    color: c.textSecondary,
    lineHeight: 1.3,
  });
  const getStatusLines = (label: string) =>
    label === "Requesting Termination" ? ["Requesting", "Termination"] : [label];
  const getStatusTone = (label: string, c: typeof colors) => {
    if (label === "Archived" || label === "Pending" || label === "Requesting Termination") return c.warning;
    if (label === "Suspended" || label === "Banned") return c.danger;
    return c.success;
  };
  const isVerifiedAccess = (member: MemberRecord, label: string) =>
    label !== "Archived" &&
    label !== "Not Verified" &&
    label !== "Revoked" &&
    (member.emailVerified || member.status === "active");
  const getAccessTone = (member: MemberRecord, label: string, c: typeof colors) => {
    if (label === "Archived") return c.warning;
    if (label === "Revoked") return c.danger;
    if (label === "Not Verified") return c.textSecondary;
    if (isVerifiedAccess(member, label)) return c.success;
    return c.textMuted;
  };
  const renderTierMarker = (member: MemberRecord, label: string, c: typeof colors, size = 13) => {
    if (label === "Revoked") return <X size={size} color={c.danger} strokeWidth={2.4} />;
    if (label === "Not Verified") {
      return (
        <FitText
          as="span"
          excludeGlobalScale
          style={{ color: c.textSecondary, fontSize: size, fontWeight: 700, lineHeight: 1 }}
        >
          !
        </FitText>
      );
    }
    return isVerifiedAccess(member, label) ? (
      <Check size={size} color={c.warning} strokeWidth={2.4} />
    ) : null;
  };
  const renderStatusBox = (label: string, tone: string, c: typeof colors, fontSize = 9.5) => {
    const lines = getStatusLines(label);

    return (
      <span
        style={{
          display: "inline-grid",
          justifyItems: "center",
          alignItems: "center",
          minWidth: lines.length > 1 ? 78 : 64,
          padding: lines.length > 1 ? "4px 8px" : "4px 9px",
          borderRadius: 6,
          border: `1px solid ${tone}55`,
          backgroundColor: `${tone}14`,
          textAlign: "center",
        }}
      >
        {lines.map((line, index) => (
          <FitText
            key={`${line}-${index}`}
            as="span"
            excludeGlobalScale
            style={{
              fontSize,
              fontWeight: 500,
              lineHeight: 1.08,
              color: tone,
            }}
          >
            {line}
          </FitText>
        ))}
      </span>
    );
  };
  const renderTierValue = (member: MemberRecord, c: typeof colors) => {
    const label = getDirectoryAccessLabel(member, pendingRequestsByUserId);
    return (
      <span style={{ display: "inline-flex", alignItems: "center", gap: 5, minWidth: 0 }}>
        {renderTierMarker(member, label, c, 13)}
        <FitText
          className="members-directory-panel__detail-text"
          style={{
            ...detailTextStyle(c),
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {label}
        </FitText>
      </span>
    );
  };
  const renderAccessBox = (
    member: MemberRecord,
    c: typeof colors,
    fontSize = 10,
    options?: { neutral?: boolean },
  ) => {
    const label = getDirectoryAccessLabel(member, pendingRequestsByUserId);
    const tone = options?.neutral ? c.textSecondary : getAccessTone(member, label, c);
    const borderColor = options?.neutral ? c.border : `${tone}45`;
    const backgroundColor = options?.neutral ? c.surface : `${tone}12`;

    return (
      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 5,
          minWidth: 0,
          padding: "4px 8px",
          borderRadius: 6,
          border: `1px solid ${borderColor}`,
          backgroundColor,
        }}
      >
        {renderTierMarker(member, label, c, 12)}
        <FitText
          as="span"
          excludeGlobalScale
          style={{
            fontSize,
            fontWeight: 500,
            lineHeight: 1.15,
            color: tone,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {label}
        </FitText>
      </span>
    );
  };

  const showRevocationReasonsColumn =
    !isCoach && (activeTier === "revoked" || activeRevokeReason !== "all");
  const revocationReasonsColumn: FitTableColumn<MemberRecord> = {
    key: "revocationReasons",
    heading: "REVOCATION REASONS",
    render: (member, c) => {
      const reasons = parseRevocationReasons(member.membershipCard?.revokeReason);
      const summary = reasons.length
        ? `${reasons[0]}${reasons.length > 1 ? ` +${reasons.length - 1}` : ""}`
        : "Not recorded";

      return (
        <FitText
          className="members-directory-panel__detail-text"
          title={reasons.length ? reasons.join(" | ") : "Not recorded"}
          style={{
            ...detailTextStyle(c),
            display: "block",
            maxWidth: 220,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {summary}
        </FitText>
      );
    },
  };

  const memberColumns: FitTableColumn<MemberRecord>[] = [
    {
      key: "name",
      heading: "NAME",
      render: (member, c) => {
        const avatarUrl = getMemberAvatarUrl(member);
        const initials = getMemberInitials(member);

        return (
          <div
            className="members-directory-panel__identity"
            style={{
              display: "flex",
              gap: 10,
              alignItems: "center",
              minWidth: 0,
            }}
          >
            <div
              className="members-directory-panel__identity-avatar"
              style={{
                width: 34,
                height: 34,
                borderRadius: 8,
                backgroundColor: c.surfaceRaised,
                border: `1px solid ${c.border}`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                overflow: "hidden",
                position: "relative",
                flexShrink: 0,
              }}
            >
              <FitText
                style={{
                  fontSize: 10.5,
                  fontWeight: 850,
                  color: c.brand,
                  letterSpacing: "0.03em",
                }}
              >
                {initials}
              </FitText>
              {avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt={`${fullName(member) || member.email} avatar`}
                  onError={(event) => {
                    event.currentTarget.style.display = "none";
                  }}
                  style={{
                    position: "absolute",
                    inset: 0,
                    width: "100%",
                    height: "100%",
                    objectFit: "cover",
                  }}
                />
              ) : null}
            </div>
            <div
              className="members-directory-panel__identity-copy"
              style={{ display: "grid", gap: 3, minWidth: 0 }}
            >
              <FitText
                className="members-directory-panel__primary-text"
                style={{
                  fontSize: 13,
                  fontWeight: 800,
                  color: c.textPrimary,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {fullName(member) || "Unnamed account"}
              </FitText>
              <FitText
                className="members-directory-panel__secondary-text"
                style={{
                  fontSize: 11,
                  color: c.textSecondary,
                  minWidth: 0,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {member.email}
              </FitText>
            </div>
          </div>
        );
      },
    },
    {
      key: "userType",
      heading: "USER TYPE",
      render: (member, c) => (
        <FitText
          className="members-directory-panel__detail-text"
          style={{
            ...detailTextStyle(c),
            textTransform: "uppercase",
            letterSpacing: "0.02em",
          }}
        >
          {getDirectoryRoleLabel(member.role?.name)}
        </FitText>
      ),
    },
    {
      key: "status",
      heading: "STATUS",
      render: (member, c) => {
        const statusLabel = getDirectoryStatusLabel(member, pendingRequestsByUserId);

        return renderStatusBox(statusLabel, getStatusTone(statusLabel, c), c, 9);
      },
    },
    {
      key: "tier",
      heading: "TIER",
      render: (member, c) => renderTierValue(member, c),
    },
    ...(showRevocationReasonsColumn ? [revocationReasonsColumn] : []),
  ];
  const coachClientColumns: FitTableColumn<MemberRecord>[] = [
    memberColumns[0],
    {
      key: "membership",
      heading: "MEMBERSHIP",
      render: (member, c) => renderTierValue(member, c),
    },
    {
      key: "activity",
      heading: "ACTIVITY",
      render: (member, c) => (
        <FitText
          className="members-directory-panel__detail-text"
          style={detailTextStyle(c)}
        >
          {member.profile?.activityLevel ?? "Not set"}
        </FitText>
      ),
    },
    {
      key: "sessions",
      heading: "SESSIONS",
      render: (member, c) => {
        const summary = coachClientSummary.get(member.id);

        return (
          <FitText
            className="members-directory-panel__detail-text"
            style={detailTextStyle(c)}
          >
            {summary
              ? `${summary.completed}/${summary.total} done, ${summary.upcoming} upcoming`
              : "No sessions"}
          </FitText>
        );
      },
    },
    {
      key: "reviewStatus",
      heading: "NEXT / REVIEW",
      render: (member, c) => {
        const summary = coachClientSummary.get(member.id);
        const reviewLabel = !summary?.completed
          ? "No completed"
          : summary.notReviewed > 0
            ? `${summary.notReviewed} not reviewed`
            : "Reviewed";
        const reviewColor = !summary?.completed
          ? c.textMuted
          : summary.notReviewed > 0
            ? c.warning
            : c.success;

        return (
          <div style={{ display: "grid", gap: 5, minWidth: 0 }}>
            <FitText
              className="members-directory-panel__detail-text"
              style={{
                fontSize: 11,
                fontWeight: 500,
                color: c.textSecondary,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {summary?.nextSessionLabel ?? "None scheduled"}
            </FitText>
            {renderStatusBox(reviewLabel, reviewColor, c, 8.5)}
          </div>
        );
      },
    },
  ];

  const renderMobileCard = (member: MemberRecord) => {
    const avatarUrl = getMemberAvatarUrl(member);
    const statusLabel = getDirectoryStatusLabel(member, pendingRequestsByUserId);
    const roleLabel = getDirectoryRoleLabel(member.role?.name);
    const showRoleLabel = member.role?.name !== "USER";
    const accessLabel = getDirectoryAccessLabel(member, pendingRequestsByUserId);
    const initials = getMemberInitials(member);

    return (
      <div
        className="members-account-card"
        style={{
          display: "grid",
          gap: 14,
          padding: 16,
          borderRadius: 8,
          border: `1px solid ${colors.border}`,
          background: `linear-gradient(180deg, ${colors.surfaceRaised} 0%, ${colors.surface} 100%)`,
          boxShadow: "0 12px 24px rgba(0,0,0,0.10)",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            gap: 12,
            flexWrap: "wrap",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              minWidth: 0,
              flex: "1 1 240px",
            }}
          >
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: 10,
                backgroundColor: colors.textPrimary,
                border: `1px solid ${colors.border}`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                overflow: "hidden",
                position: "relative",
                flexShrink: 0,
              }}
            >
              <FitText
                style={{
                  fontSize: 13,
                  fontWeight: 800,
                  color: colors.surfaceRaised,
                  letterSpacing: "0.04em",
                }}
              >
                {initials}
              </FitText>
              {avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt={`${fullName(member) || member.email} avatar`}
                  onError={(event) => {
                    event.currentTarget.style.display = "none";
                  }}
                  style={{
                    position: "absolute",
                    inset: 0,
                    width: "100%",
                    height: "100%",
                    objectFit: "cover",
                  }}
                />
              ) : null}
            </div>
            <div style={{ minWidth: 0, display: "grid", gap: 4 }}>
              <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                {showRoleLabel ? (
                  <FitPill
                    mode="status"
                    label={roleLabel.toUpperCase()}
                    color={colors.brand}
                    fontSize={10}
                    fontWeight={500}
                    borderOpacity="35"
                    bgOpacity="14"
                    style={{ borderRadius: 6 }}
                  />
                ) : null}
                {renderStatusBox(
                  statusLabel,
                  getStatusTone(statusLabel, colors),
                  colors,
                  10,
                )}
              </div>
              <FitText style={{ fontSize: 15, fontWeight: 700, color: colors.textPrimary }}>
                {fullName(member) || "Unnamed account"}
              </FitText>
              <FitText style={{ fontSize: 12.5, color: colors.textSecondary }}>{member.email}</FitText>
            </div>
          </div>
          {renderAccessBox(member, colors, 11)}
        </div>
        <div
          className="members-mobile-meta-grid"
          style={{
            display: "grid",
            gap: 10,
            gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
          }}
        >
          {[
            ["LAST ACTIVITY", formatLastCheckIn(member.lastCheckInAt)],
            ["ACCESS", accessLabel],
            ["ACCOUNT", statusLabel],
            ["SCAN", getScanReadinessLabel(member)],
          ].map(([label, value]) => (
            <div key={label} style={{ display: "grid", gap: 5 }}>
              <FitText
                style={{
                  fontSize: 10.5,
                  fontWeight: 700,
                  color: colors.textMuted,
                  letterSpacing: "0.06em",
                }}
              >
                {label}
              </FitText>
              {label === "ACCOUNT" ? (
                renderStatusBox(
                  statusLabel,
                  getStatusTone(statusLabel, colors),
                  colors,
                  12,
                )
              ) : (
                <FitText
                  style={{
                    fontSize: 12.5,
                    fontWeight: 500,
                    color:
                      label === "SCAN" && member.attendanceQrReady
                        ? colors.brand
                        : colors.textSecondary,
                  }}
                >
                  {value}
                </FitText>
              )}
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderGridCard = (member: MemberRecord) => {
    const avatarUrl = getMemberAvatarUrl(member);
    const statusLabel = getDirectoryStatusLabel(member, pendingRequestsByUserId);
    const initials = getMemberInitials(member);

    return (
      <div
        className="members-grid-card"
        style={{
          display: "grid",
          gridTemplateRows: "46px 42px auto auto 38px",
          justifyItems: "center",
          alignContent: "space-between",
          gap: 9,
          minHeight: 218,
          padding: "15px 10px",
          borderRadius: 8,
          border: `1px solid ${colors.border}`,
          backgroundColor: colors.surfaceRaised,
          boxShadow: "none",
          textAlign: "center",
        }}
      >
        <div
          style={{
            width: 46,
            height: 46,
            borderRadius: 8,
            backgroundColor: colors.surface,
            border: `1px solid ${colors.border}`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            overflow: "hidden",
            position: "relative",
          }}
        >
          <FitText
            style={{
              fontSize: 15,
              fontWeight: 850,
              color: colors.brand,
              letterSpacing: "0.03em",
            }}
          >
            {initials}
          </FitText>
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt={`${fullName(member) || member.email} avatar`}
              onError={(event) => {
                event.currentTarget.style.display = "none";
              }}
              style={{
                position: "absolute",
                inset: 0,
                width: "100%",
                height: "100%",
                objectFit: "cover",
              }}
            />
          ) : null}
        </div>
        <div style={{ display: "grid", gap: 2, width: "100%", minWidth: 0 }}>
          <FitText
            style={{
              fontSize: 13.5,
              fontWeight: 850,
              color: colors.textPrimary,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {fullName(member) || "Unnamed account"}
          </FitText>
          <FitText
            style={{
              fontSize: 10.5,
              fontWeight: 500,
              color: colors.textSecondary,
              textTransform: "uppercase",
              letterSpacing: "0.02em",
            }}
          >
            {getDirectoryRoleLabel(member.role?.name)}
          </FitText>
        </div>
        <div style={{ display: "grid", justifyItems: "center", gap: 4, width: "100%" }}>
          <FitText
            style={{
              fontSize: 9.5,
              fontWeight: 700,
              color: colors.textMuted,
              letterSpacing: "0.04em",
              textTransform: "uppercase",
            }}
          >
            Status
          </FitText>
          {renderStatusBox(
            statusLabel,
            getStatusTone(statusLabel, colors),
            colors,
            10,
          )}
        </div>
        <div style={{ display: "grid", justifyItems: "center", gap: 4, width: "100%" }}>
          <FitText
            style={{
              fontSize: 9.5,
              fontWeight: 700,
              color: colors.textMuted,
              letterSpacing: "0.04em",
              textTransform: "uppercase",
            }}
          >
            Tier
          </FitText>
          {renderAccessBox(member, colors, 10, { neutral: true })}
        </div>
        <div style={{ display: "grid", gap: 2 }}>
          <FitText
            style={{
              fontSize: 10,
              fontWeight: 800,
              color: colors.textMuted,
              letterSpacing: "0.04em",
            }}
          >
            Last Check-in
          </FitText>
          <FitText
            style={{
              fontSize: 11,
              fontWeight: 500,
              color: colors.textSecondary,
            }}
          >
            {formatLastCheckIn(member.lastCheckInAt)}
          </FitText>
        </div>
      </div>
    );
  };

  const directoryToolbar = (
    <div style={{ display: "grid", gap: 10, minWidth: 0 }}>
      <div
        className={isCoach ? "members-directory-toolbar members-directory-toolbar-coach" : "members-directory-toolbar"}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "nowrap",
          gap: isCoach ? 8 : 10,
          minHeight: isCoach ? 38 : 40,
          minWidth: 0,
          overflowX: isCoach ? "auto" : undefined,
          overflowY: isCoach ? "hidden" : undefined,
        }}
      >
      <div
        className="members-directory-toolbar-left"
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          minWidth: isCoach ? 174 : 0,
          flex: isCoach ? "0 1 300px" : "0 1 auto",
        }}
      >
        <div
          className="members-directory-search"
          style={{
            flex: isCoach ? "1 1 auto" : "1 1 240px",
            minWidth: isCoach ? 174 : 190,
            maxWidth: isCoach ? 300 : 320,
          }}
        >
          <FitSearch
            id="members_people_search"
            name="members_people_search"
            ariaLabel="Search accounts by name, email, or mobile number"
            value={q}
            onChangeText={setQ}
            placeholder="Search accounts..."
          />
        </div>
        <FitButton
          variant="chip"
          icon={List}
          iconOnly
          iconSize={15}
          active={viewMode === "list"}
          title="List view"
          aria-label="Show accounts as a list"
          onClick={() => setViewMode("list")}
          style={{ minHeight: 33, width: 35, borderRadius: 6, flex: "0 0 auto" }}
        />
        <FitButton
          variant="chip"
          icon={LayoutGrid}
          iconOnly
          iconSize={15}
          active={viewMode === "grid"}
          title="Grid view"
          aria-label="Show accounts as a grid"
          onClick={() => setViewMode("grid")}
          style={{ minHeight: 33, width: 35, borderRadius: 6, flex: "0 0 auto" }}
        />
      </div>
      <div
        className="members-directory-toolbar-right"
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "flex-end",
          gap: 8,
          flex: isCoach ? "0 0 auto" : "0 1 auto",
          minWidth: isCoach ? "max-content" : 0,
          marginLeft: "auto",
          flexWrap: "nowrap",
        }}
      >
        {!isCoach ? (
          <>
            <div
              className="members-toolbar-status-filter"
              style={{
                display: "grid",
                gridTemplateColumns: "14px minmax(122px, 156px)",
                alignItems: "center",
                gap: 6,
                flex: "0 0 auto",
                minWidth: 0,
              }}
            >
              <Filter size={14} color={colors.textMuted} strokeWidth={2} />
              <FitSelect
                compact
                fullWidth
                aria-label="Filter accounts by status"
                name="membersStatusFilter"
                value={activeStatus}
                options={statusSelectOptions}
                onChange={(event) => {
                  const nextStatus = event.target.value as MemberStatusTab;
                  setActiveStatus(nextStatus);
                  if (nextStatus === "Termination Requests") {
                    setActiveChip("Member");
                  }
                }}
                style={{
                  width: "100%",
                  minWidth: 0,
                  height: 38,
                  borderRadius: 8,
                  paddingLeft: 8,
                  paddingRight: 22,
                  fontSize: 12,
                }}
              />
            </div>
            <div
              className="members-toolbar-filters"
              style={{
                display: "grid",
                gridTemplateColumns: "14px minmax(112px, 140px)",
                alignItems: "center",
                gap: 6,
                flex: "0 0 auto",
                minWidth: 0,
              }}
            >
              <Filter size={14} color={colors.textMuted} strokeWidth={2} />
              <FitSelect
                compact
                fullWidth
                aria-label="Filter accounts by role"
                name="membersRoleFilter"
                value={activeChip}
                options={roleSelectOptions}
                onChange={(event) => {
                  const nextRole = event.target.value;
                  if (isTerminationRequestsView && nextRole !== "Member") return;
                  setActiveChip(nextRole);
                }}
                style={{
                  width: "100%",
                  minWidth: 0,
                  height: 38,
                  borderRadius: 8,
                  paddingLeft: 8,
                  paddingRight: 22,
                  fontSize: 12,
                }}
              />
            </div>
            <div
              className="members-toolbar-tier-filter"
              style={{
                display: "grid",
                gridTemplateColumns: "14px minmax(142px, 184px)",
                alignItems: "center",
                gap: 6,
                flex: "0 0 auto",
                minWidth: 0,
              }}
            >
              <Filter size={14} color={colors.textMuted} strokeWidth={2} />
              <FitSelect
                compact
                fullWidth
                aria-label="Filter accounts by membership tier"
                name="membersTierFilter"
                value={activeTier}
                options={tierSelectOptions}
                onChange={(event) => {
                  const nextTier = event.target.value;
                  setActiveTier(nextTier);
                  if (nextTier !== "revoked") setActiveRevokeReason("all");
                }}
                style={{
                  width: "100%",
                  minWidth: 0,
                  height: 38,
                  borderRadius: 8,
                  paddingLeft: 8,
                  paddingRight: 22,
                  fontSize: 12,
                }}
              />
            </div>
            {activeTier === "revoked" ? (
              <div
                className="members-toolbar-revocation-reason-filter"
                style={{
                  display: "grid",
                  gridTemplateColumns: "14px minmax(154px, 196px)",
                  alignItems: "center",
                  gap: 6,
                  flex: "0 0 auto",
                  minWidth: 0,
                }}
              >
                <Filter size={14} color={colors.textMuted} strokeWidth={2} />
                <FitSelect
                  compact
                  fullWidth
                  aria-label="Filter accounts by revocation reason"
                  name="membersRevocationReasonFilter"
                  value={activeRevokeReason}
                  options={revokeReasonFilterOptions}
                  onChange={(event) => {
                    const nextReason = event.target.value;
                    setActiveRevokeReason(nextReason);
                    if (nextReason !== "all") setActiveTier("revoked");
                  }}
                  style={{
                    width: "100%",
                    minWidth: 0,
                    height: 38,
                    borderRadius: 8,
                    paddingLeft: 8,
                    paddingRight: 22,
                    fontSize: 12,
                  }}
                />
              </div>
            ) : null}
          </>
        ) : null}
        {isCoach ? (
          <>
            <div
              className="members-toolbar-coach-membership-filter"
              style={{
                display: "grid",
                gridTemplateColumns: "14px minmax(126px, 154px)",
                alignItems: "center",
                gap: 6,
                flex: "0 0 auto",
                minWidth: 0,
              }}
            >
              <Filter size={14} color={colors.textMuted} strokeWidth={2} />
              <FitSelect
                compact
                fullWidth
                aria-label="Filter clients by member tier"
                name="coachMembershipStatusFilter"
                value={activeCoachMembershipStatus}
                options={coachMembershipStatusOptions}
                onChange={(event) => setActiveCoachMembershipStatus(event.target.value)}
                style={{
                  width: "100%",
                  minWidth: 0,
                  height: 38,
                  borderRadius: 8,
                  paddingLeft: 8,
                  paddingRight: 22,
                  fontSize: 12,
                }}
              />
            </div>
            <div
              className="members-toolbar-coach-session-filter"
              style={{
                display: "grid",
                gridTemplateColumns: "14px minmax(126px, 154px)",
                alignItems: "center",
                gap: 6,
                flex: "0 0 auto",
                minWidth: 0,
              }}
            >
              <Filter size={14} color={colors.textMuted} strokeWidth={2} />
              <FitSelect
                compact
                fullWidth
                aria-label="Filter clients by session status"
                name="coachSessionStatusFilter"
                value={activeCoachSessionStatus}
                options={coachSessionStatusOptions}
                onChange={(event) => setActiveCoachSessionStatus(event.target.value)}
                style={{
                  width: "100%",
                  minWidth: 0,
                  height: 38,
                  borderRadius: 8,
                  paddingLeft: 8,
                  paddingRight: 22,
                  fontSize: 12,
                }}
              />
            </div>
            <div
              className="members-toolbar-coach-activity-filter"
              style={{
                display: "grid",
                gridTemplateColumns: "14px minmax(126px, 154px)",
                alignItems: "center",
                gap: 6,
                flex: "0 0 auto",
                minWidth: 0,
              }}
            >
              <Filter size={14} color={colors.textMuted} strokeWidth={2} />
              <FitSelect
                compact
                fullWidth
                aria-label="Filter clients by activity level"
                name="coachActivityLevelFilter"
                value={activeCoachActivityLevel}
                options={coachActivityLevelOptions}
                onChange={(event) => setActiveCoachActivityLevel(event.target.value)}
                style={{
                  width: "100%",
                  minWidth: 0,
                  height: 38,
                  borderRadius: 8,
                  paddingLeft: 8,
                  paddingRight: 22,
                  fontSize: 12,
                }}
              />
            </div>
          </>
        ) : null}
      </div>
    </div>
    </div>
  );

  return (
    <div
      key="directory"
      className="members-directory-stage"
      style={{
        display: "grid",
        gap: 12,
        gridTemplateColumns: "minmax(0, 1fr) minmax(284px, 0.36fr)",
        alignItems: "stretch",
        height: "100%",
        minHeight: 0,
        width: "100%",
        marginRight: 0,
        padding: 0,
        borderRadius: 8,
        border: "none",
        backgroundColor: "transparent",
      }}
    >
      <MembersDirectoryPanel
        activeRowId={editTarget?.id}
        emptyMessage={directoryEmptyMessage}
        filteredCount={filtered.length}
        isAdmin={isAdmin}
        onPageChange={setPage}
        onRowClick={openInspector}
        page={page}
        pageSize={directoryPageSize}
        pageLoading={pageLoading}
        renderGridCard={renderGridCard}
        renderMobileCard={renderMobileCard}
        rows={paginatedRows}
        tableColumns={isCoach ? coachClientColumns : memberColumns}
        toolbar={directoryToolbar}
        compactToolbar={isCoach}
        totalPages={totalPages}
        viewMode={viewMode}
      />
      {isCoach ? <CoachClientInspectorSurface /> : <AccountsInspectorSurface />}
    </div>
  );
}
