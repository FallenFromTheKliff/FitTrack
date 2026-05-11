"use client";

import { Filter, LayoutGrid, List } from "lucide-react";
import type { MemberRecord } from "@fittrack/types";
import { fullName } from "@fittrack/utils";

import MembersDirectoryPanel from "@/components/accounts/MembersDirectoryPanel";
import { FitButton, FitPill, FitSearch, FitSelect, FitText } from "@/components/fit";
import type { FitTableColumn } from "@/components/fit/FitTable";
import { useTheme } from "@/contexts/ThemeContext";
import { MEMBERSHIP_CARD_STATUS_COLORS, type MemberStatusTab } from "@/data/members/members";
import {
  formatLastCheckIn,
  getDirectoryAccessLabel,
  getDirectoryRoleLabel,
  getDirectoryStatusColor,
  getDirectoryStatusLabel,
  getMemberAvatarUrl,
  getMemberInitials,
  getScanReadinessLabel,
} from "@/components/accounts/accountComponentUtils";

import AccountsInspectorSurface from "./AccountsInspectorSurface";
import { useAccountsPage } from "./AccountsPageContext";

export default function AccountsDirectorySurface() {
  const { colors } = useTheme();
  const {
    activeChip,
    activeStatus,
    directoryEmptyMessage,
    directoryPageSize,
    editTarget,
    filtered,
    isAdmin,
    isCreateMode,
    isTerminationRequestsView,
    openInspector,
    page,
    pageLoading,
    paginatedRows,
    pendingRequestsByUserId,
    q,
    roleSelectOptions,
    setActiveChip,
    setActiveStatus,
    setPage,
    setQ,
    setViewMode,
    statusSelectOptions,
    totalPages,
    viewMode,
  } = useAccountsPage();

  if (isCreateMode) return null;

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
          className="members-directory-panel__emphasis-text"
          style={{ fontSize: 12, fontWeight: 700, color: c.textPrimary }}
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
        const profileTone = getDirectoryStatusColor(member, pendingRequestsByUserId, c.warning);

        return <FitPill mode="status" label={statusLabel} color={profileTone ?? c.textMuted} fontSize={9} />;
      },
    },
    {
      key: "tier",
      heading: "TIER",
      render: (member, c) => (
        <FitText
          className="members-directory-panel__emphasis-text"
          style={{ fontSize: 12, fontWeight: 700, color: c.textPrimary }}
        >
          {getDirectoryAccessLabel(member, pendingRequestsByUserId)}
        </FitText>
      ),
    },
    {
      key: "lastCheckIn",
      heading: "LAST CHECK-IN",
      render: (member, c) => (
        <FitText
          className="members-directory-panel__emphasis-text"
          style={{
            fontSize: 12,
            fontWeight: 700,
            color: member.lastCheckInAt ? c.textPrimary : c.textSecondary,
          }}
        >
          {formatLastCheckIn(member.lastCheckInAt)}
        </FitText>
      ),
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
                    label={roleLabel}
                    color={colors.brand}
                    fontSize={10}
                    borderOpacity="35"
                    bgOpacity="14"
                  />
                ) : null}
                <FitPill
                  mode="status"
                  label={statusLabel}
                  color={getDirectoryStatusColor(member, pendingRequestsByUserId, colors.warning)}
                  fontSize={10}
                />
              </div>
              <FitText style={{ fontSize: 15, fontWeight: 700, color: colors.textPrimary }}>
                {fullName(member) || "Unnamed account"}
              </FitText>
              <FitText style={{ fontSize: 12.5, color: colors.textSecondary }}>{member.email}</FitText>
            </div>
          </div>
          <FitPill
            mode="status"
            label={accessLabel}
            color={MEMBERSHIP_CARD_STATUS_COLORS[accessLabel] ?? colors.textMuted}
            fontSize={11}
          />
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
                <FitPill
                  mode="status"
                  label={statusLabel}
                  color={getDirectoryStatusColor(member, pendingRequestsByUserId, colors.warning)}
                  fontSize={12}
                />
              ) : (
                <FitText
                  style={{
                    fontSize: 12.5,
                    fontWeight: label === "SCAN" || label === "ACCESS" ? 600 : undefined,
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
    const accessLabel = getDirectoryAccessLabel(member, pendingRequestsByUserId);
    const initials = getMemberInitials(member);

    return (
      <div
        className="members-grid-card"
        style={{
          display: "grid",
          gridTemplateRows: "46px 42px 38px 38px",
          justifyItems: "center",
          alignContent: "space-between",
          gap: 10,
          minHeight: 180,
          padding: "14px 10px",
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
          <FitText style={{ fontSize: 10.5, fontWeight: 700, color: colors.textSecondary }}>
            {getDirectoryRoleLabel(member.role?.name)}
          </FitText>
        </div>
        <div style={{ display: "flex", justifyContent: "center", gap: 6, flexWrap: "wrap" }}>
          <FitPill
            mode="status"
            label={statusLabel}
            color={getDirectoryStatusColor(member, pendingRequestsByUserId, colors.warning)}
            fontSize={10}
          />
          <FitPill
            mode="status"
            label={accessLabel}
            color={MEMBERSHIP_CARD_STATUS_COLORS[accessLabel] ?? colors.textMuted}
            fontSize={10}
            borderOpacity="35"
            bgOpacity="12"
          />
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
              fontWeight: 800,
              color: member.lastCheckInAt ? colors.textPrimary : colors.textSecondary,
            }}
          >
            {formatLastCheckIn(member.lastCheckInAt)}
          </FitText>
        </div>
      </div>
    );
  };

  const directoryToolbar = (
    <div
      className="members-directory-toolbar"
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        flexWrap: "wrap",
        gap: 10,
        minHeight: 40,
      }}
    >
      <div
        className="members-directory-toolbar-left"
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          minWidth: 0,
          flex: "1 1 360px",
        }}
      >
        <div
          className="members-directory-search"
          style={{ flex: "1 1 250px", minWidth: 220, maxWidth: 320 }}
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
      </div>
      <div
        className="members-directory-toolbar-right"
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "flex-end",
          gap: 8,
          flex: "1 1 520px",
          minWidth: 0,
          marginLeft: "auto",
          flexWrap: "wrap",
        }}
      >
        <div
          className="members-view-toggle"
          aria-label="Account view mode"
          style={{
            display: "inline-flex",
            gap: 4,
            padding: 3,
            borderRadius: 8,
            border: `1px solid ${colors.border}`,
            backgroundColor: colors.surface,
            flex: "0 0 auto",
          }}
        >
          <FitButton
            variant="chip"
            icon={List}
            iconOnly
            iconSize={15}
            active={viewMode === "list"}
            title="List view"
            aria-label="Show accounts as a list"
            onClick={() => setViewMode("list")}
            style={{ minHeight: 31, width: 33, borderRadius: 7 }}
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
            style={{ minHeight: 31, width: 33, borderRadius: 7 }}
          />
        </div>
        <div
          className="members-toolbar-status-filter"
          style={{
            display: "grid",
            gridTemplateColumns: "14px minmax(96px, 124px)",
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
            gridTemplateColumns: "14px minmax(82px, 102px)",
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
        height: "calc(100vh - 154px)",
        minHeight: 600,
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
        tableColumns={memberColumns}
        toolbar={directoryToolbar}
        totalPages={totalPages}
        viewMode={viewMode}
      />
      <AccountsInspectorSurface />
    </div>
  );
}
