"use client";

import { Archive, ChevronUp, CreditCard, LogIn, Pencil, ScanLine, UserCheck, UserPlus } from "lucide-react";
import { useId, useState, type CSSProperties } from "react";
import { fullName } from "@fittrack/utils";

import { FitButton, FitPill, FitText } from "@/components/fit";
import MemberInspectorPanel from "@/components/accounts/MemberInspectorPanel";
import { useTheme } from "@/contexts/ThemeContext";
import {
  formatLastCheckIn,
  getDirectoryAccessLabel,
  getDirectoryRoleLabel,
  getDirectoryStatusColor,
  getDirectoryStatusLabel,
  getMemberAvatarUrl,
  getMemberInitials,
  getMembershipFieldValue,
  getScanReadinessLabel,
} from "@/components/accounts/accountComponentUtils";

import { useAccountsPage } from "./AccountsPageContext";

function useAccountActionStyles() {
  const { colors, onBrandTextColor } = useTheme();
  const { canRestoreEditTarget } = useAccountsPage();
  const secondaryActionStyle: CSSProperties = {
    border: `1px solid ${colors.border}`,
    backgroundColor: `${colors.surfaceRaised}cc`,
    borderRadius: 8,
    minHeight: 42,
  };
  const primaryActionStyle: CSSProperties = {
    backgroundColor: colors.brand,
    color: onBrandTextColor,
    border: `1px solid ${colors.brand}`,
    borderRadius: 8,
    minHeight: 42,
  };
  const warningActionStyle: CSSProperties = {
    border: `1px solid ${colors.danger}45`,
    backgroundColor: `${colors.danger}10`,
    borderRadius: 8,
    minHeight: 42,
  };
  const accountLifecycleActionStyle: CSSProperties = canRestoreEditTarget
    ? {
        border: `1px solid ${colors.brand}42`,
        backgroundColor: `${colors.brand}10`,
        borderRadius: 8,
        minHeight: 42,
      }
    : warningActionStyle;

  return {
    accountLifecycleActionColor: canRestoreEditTarget ? colors.brand : colors.danger,
    accountLifecycleActionStyle,
    primaryActionStyle,
    primaryCommandTextColor: onBrandTextColor,
    secondaryActionStyle,
  };
}

function AccountInspectorCommandRow() {
  const { colors, onBrandTextColor } = useTheme();
  const { canManageAccounts, isAdmin, setContentMode, setScanFeedback, setScanOpen } = useAccountsPage();

  if (!canManageAccounts) return null;

  return (
    <div
      className="members-inspector-command-row"
      style={{
        display: "grid",
        gridTemplateColumns: isAdmin ? "minmax(0, 0.86fr) minmax(0, 1fr)" : "1fr",
        gap: 8,
        minWidth: 0,
      }}
    >
      {isAdmin ? (
        <FitButton
          variant="ghost"
          label="SCAN QR"
          icon={ScanLine}
          iconSize={14}
          title="Scan QR Attendance"
          aria-label="Scan QR Attendance"
          style={{
            minHeight: 40,
            borderRadius: 8,
            paddingInline: 8,
            border: `1px solid ${colors.brand}42`,
            backgroundColor: colors.surfaceRaised,
            color: colors.brand,
          }}
          onClick={() => {
            setScanOpen(true);
            setScanFeedback(null);
          }}
          textStyle={{
            color: colors.brand,
            fontSize: 10.75,
            fontWeight: 800,
            whiteSpace: "nowrap",
          }}
        />
      ) : null}
      <FitButton
        variant="primary"
        label="CREATE ACCOUNT"
        icon={UserPlus}
        iconSize={14}
        style={{
          backgroundColor: colors.brand,
          color: onBrandTextColor,
          border: `1px solid ${colors.brand}`,
          minHeight: 40,
          borderRadius: 8,
          paddingInline: 10,
        }}
        onClick={() => setContentMode("create")}
        textStyle={{
          color: onBrandTextColor,
          fontSize: 10.75,
          fontWeight: 800,
          whiteSpace: "nowrap",
        }}
      />
    </div>
  );
}

export function AccountInspectorFooter() {
  const { colors } = useTheme();
  const [actionsOpen, setActionsOpen] = useState(false);
  const actionsPanelId = useId();
  const {
    canEditTargetDetails,
    canManageMemberCard,
    canManualCheckInTarget,
    canRestoreEditTarget,
    canArchiveEditTarget,
    canVerifyNonMemberTarget,
    editTarget,
    handleManualCheckIn,
    isMembershipCardPending,
    isManualAttendancePending,
    membershipCardLoadingLabel,
    manualCheckInLoadingLabel,
    openEditModal,
    setArchiveTarget,
    setGrantCardTarget,
    setRestoreTarget,
    setRevokeCardTarget,
    setVerifyNonMemberTarget,
  } = useAccountsPage();
  const {
    accountLifecycleActionColor,
    accountLifecycleActionStyle,
    primaryActionStyle,
    primaryCommandTextColor,
    secondaryActionStyle,
  } = useAccountActionStyles();
  const editTargetMembershipStatus = editTarget ? getMembershipFieldValue(editTarget) : "none";
  const memberCardActionLabel =
    editTargetMembershipStatus === "active"
      ? "Revoke Membership"
      : editTargetMembershipStatus === "revoked"
        ? "Restore Membership"
        : "Grant Membership";
  const membershipActionTone =
    editTargetMembershipStatus === "active"
      ? {
          color: colors.danger,
          border: `1px solid ${colors.danger}42`,
          backgroundColor: `${colors.danger}10`,
        }
      : editTargetMembershipStatus === "revoked"
        ? {
            color: colors.brand,
            border: `1px solid ${colors.brand}42`,
            backgroundColor: `${colors.brand}10`,
          }
        : {
            color: colors.brand,
            border: `1px solid ${colors.brand}42`,
            backgroundColor: colors.surfaceRaised,
          };
  const accountActionLabel = canRestoreEditTarget ? "Restore Account" : "Archive Account";
  const canRunAccountArchiveAction = canArchiveEditTarget || canRestoreEditTarget;
  const compactActionStyle: CSSProperties = {
    minHeight: 36,
    paddingInline: 8,
  };
  const compactTextStyle: CSSProperties = {
    fontSize: 10.5,
    fontWeight: 800,
    lineHeight: 1.1,
    whiteSpace: "normal",
    textAlign: "center",
  };

  return (
    <div style={{ display: "grid", gap: 8 }}>
      <div
        id={actionsPanelId}
        aria-hidden={!actionsOpen}
        style={{
          display: "grid",
          gap: 8,
          maxHeight: actionsOpen ? 260 : 0,
          opacity: actionsOpen ? 1 : 0,
          overflow: "hidden",
          pointerEvents: actionsOpen ? "auto" : "none",
          transform: actionsOpen ? "translateY(0)" : "translateY(12px)",
          transformOrigin: "bottom center",
          transition: `max-height 240ms ease, opacity 180ms ease, transform 240ms ease, visibility 0ms linear ${
            actionsOpen ? "0ms" : "240ms"
          }`,
          visibility: actionsOpen ? "visible" : "hidden",
        }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
            gap: 8,
          }}
        >
          <FitButton
            variant="primary"
            label="Edit Details"
            icon={Pencil}
            iconSize={13}
            fullWidth
            disabled={!editTarget || !canEditTargetDetails}
            onClick={editTarget && canEditTargetDetails ? openEditModal : undefined}
            style={{ ...primaryActionStyle, ...compactActionStyle }}
            textStyle={{ ...compactTextStyle, color: primaryCommandTextColor }}
          />
          <FitButton
            variant="ghost"
            label={editTarget ? memberCardActionLabel : "Manage Membership"}
            icon={CreditCard}
            iconSize={13}
            fullWidth
            disabled={!editTarget || !canManageMemberCard || isMembershipCardPending}
            onClick={() => {
              if (!editTarget || !canManageMemberCard) return;
              if (getMembershipFieldValue(editTarget) === "active") {
                setRevokeCardTarget(editTarget);
                return;
              }
              setGrantCardTarget(editTarget);
            }}
            style={{
              ...secondaryActionStyle,
              ...compactActionStyle,
              border: membershipActionTone.border,
              backgroundColor: membershipActionTone.backgroundColor,
            }}
            textStyle={{ ...compactTextStyle, color: membershipActionTone.color }}
          />
          <FitButton
            variant="ghost"
            label="Verify Non-Member"
            icon={UserCheck}
            iconSize={13}
            fullWidth
            disabled={!editTarget || !canVerifyNonMemberTarget}
            onClick={() => {
              if (!editTarget || !canVerifyNonMemberTarget) return;
              setVerifyNonMemberTarget(editTarget);
            }}
            style={{
              ...secondaryActionStyle,
              ...compactActionStyle,
              border: `1px solid ${colors.brand}42`,
              backgroundColor: canVerifyNonMemberTarget ? `${colors.brand}10` : colors.surfaceRaised,
            }}
            textStyle={{ ...compactTextStyle, color: colors.brand }}
          />
          <FitButton
            variant="ghost"
            label="Check In"
            icon={LogIn}
            iconSize={13}
            fullWidth
            disabled={!editTarget || !canManualCheckInTarget || isManualAttendancePending}
            onClick={() => {
              if (!editTarget || !canManualCheckInTarget) return;
              void handleManualCheckIn(editTarget);
            }}
            style={{ ...secondaryActionStyle, ...compactActionStyle }}
            textStyle={{ ...compactTextStyle, color: colors.textPrimary }}
          />
          <FitButton
            variant="ghost"
            label={editTarget ? accountActionLabel : "Archive Account"}
            icon={Archive}
            iconSize={13}
            fullWidth
            disabled={!editTarget || !canRunAccountArchiveAction}
            onClick={() => {
              if (!editTarget) return;
              if (canRestoreEditTarget) {
                setRestoreTarget(editTarget);
                return;
              }
              if (canArchiveEditTarget) {
                setArchiveTarget(editTarget);
              }
            }}
            style={{
              ...accountLifecycleActionStyle,
              ...compactActionStyle,
              gridColumn: "1 / -1",
            }}
            textStyle={{ ...compactTextStyle, color: accountLifecycleActionColor }}
          />
        </div>
        {isMembershipCardPending ? (
          <FitText style={{ fontSize: 11, color: colors.textMuted }}>{membershipCardLoadingLabel}</FitText>
        ) : null}
        {isManualAttendancePending ? (
          <FitText style={{ fontSize: 11, color: colors.textMuted }}>{manualCheckInLoadingLabel}</FitText>
        ) : null}
      </div>
      <FitButton
        variant="ghost"
        aria-controls={actionsPanelId}
        aria-expanded={actionsOpen}
        onClick={() => setActionsOpen((current) => !current)}
        style={{
          border: `1px solid ${actionsOpen ? colors.brand : colors.border}`,
          backgroundColor: actionsOpen ? `${colors.brand}12` : colors.surface,
          color: colors.brand,
          minHeight: 44,
          borderRadius: 8,
        }}
        textStyle={{ color: colors.brand, fontWeight: 850, letterSpacing: "0.04em" }}
      >
        <span
          style={{
            alignItems: "center",
            display: "inline-flex",
            gap: 8,
            justifyContent: "center",
            lineHeight: 1,
          }}
        >
          <span>{actionsOpen ? "CLOSE ACTIONS" : "OPEN ACTIONS"}</span>
          <ChevronUp
            size={15}
            strokeWidth={2.4}
            style={{
              transform: actionsOpen ? "rotate(180deg)" : "rotate(0deg)",
              transition: "transform 180ms ease",
            }}
          />
        </span>
      </FitButton>
    </div>
  );
}

export function AccountInspectorBody() {
  const { colors } = useTheme();
  const { editTarget, pendingRequestsByUserId } = useAccountsPage();
  const emptyAccountValue = "N/A";
  const accountDetailsAvatarUrl = editTarget ? getMemberAvatarUrl(editTarget) : null;
  const accountDetailsTitle = editTarget ? fullName(editTarget) || "Unnamed account" : emptyAccountValue;
  const accountStatusLabel = editTarget
    ? getDirectoryStatusLabel(editTarget, pendingRequestsByUserId)
    : emptyAccountValue;
  const accountAccessLabel = editTarget
    ? getDirectoryAccessLabel(editTarget, pendingRequestsByUserId)
    : emptyAccountValue;
  const accountInspectorSections = [
    {
      title: "User Details",
      items: [
        {
          label: "User Type",
          value: editTarget ? getDirectoryRoleLabel(editTarget.role?.name) : emptyAccountValue,
        },
        { label: "Access", value: accountAccessLabel },
        { label: "Email", value: editTarget?.email ?? emptyAccountValue },
      ],
    },
    {
      title: "Activity",
      items: [
        {
          label: "Last Check-in",
          value: editTarget ? formatLastCheckIn(editTarget.lastCheckInAt) : emptyAccountValue,
        },
        {
          label: "Scan Status",
          value: editTarget ? getScanReadinessLabel(editTarget) : emptyAccountValue,
        },
      ],
    },
  ];

  return (
    <>
      <div
        style={{
          display: "grid",
          justifyItems: "center",
          gap: 8,
          padding: "0 0 4px",
          textAlign: "center",
        }}
      >
        <div
          style={{
            width: 74,
            height: 74,
            borderRadius: 8,
            border: `1px ${editTarget ? "solid" : "dashed"} ${colors.border}`,
            backgroundColor: colors.surfaceRaised,
            color: editTarget ? colors.brand : colors.textMuted,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            overflow: "hidden",
            position: "relative",
          }}
        >
          <FitText
            style={{
              fontSize: editTarget ? 24 : 15,
              fontWeight: 850,
              letterSpacing: "0.04em",
            }}
          >
            {editTarget ? getMemberInitials(editTarget) : emptyAccountValue}
          </FitText>
          {accountDetailsAvatarUrl ? (
            <img
              src={accountDetailsAvatarUrl}
              alt={`${accountDetailsTitle} profile`}
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
        <div style={{ display: "grid", justifyItems: "center", gap: 4 }}>
          <FitText
            style={{
              fontSize: 16,
              fontWeight: 850,
              color: colors.textPrimary,
              lineHeight: 1.22,
              overflowWrap: "anywhere",
            }}
          >
            {accountDetailsTitle}
          </FitText>
          <FitText
            style={{
              fontSize: 12,
              fontWeight: 600,
              color: editTarget ? colors.brand : colors.textSecondary,
              lineHeight: 1.28,
              overflowWrap: "anywhere",
            }}
          >
            {editTarget?.email ?? emptyAccountValue}
          </FitText>
          <div style={{ display: "flex", justifyContent: "center", gap: 6, flexWrap: "wrap" }}>
            <FitPill
              mode="status"
              label={accountStatusLabel}
              color={
                editTarget
                  ? getDirectoryStatusColor(editTarget, pendingRequestsByUserId, colors.warning)
                  : colors.textMuted
              }
              fontSize={9.5}
            />
            <FitPill
              mode="status"
              label={accountAccessLabel}
              color={editTarget ? colors.brand : colors.textMuted}
              fontSize={9.5}
              borderOpacity="35"
              bgOpacity="12"
            />
          </div>
        </div>
      </div>
      <div style={{ display: "grid", gap: 10 }}>
        {accountInspectorSections.map((section) => (
          <div key={section.title} style={{ display: "grid", gap: 10 }}>
            <FitText
              style={{
                fontSize: 11,
                fontWeight: 850,
                color: colors.brand,
                letterSpacing: "0.04em",
                textTransform: "uppercase",
              }}
            >
              {section.title}
            </FitText>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: section.items.length > 2 ? "repeat(2, minmax(0, 1fr))" : "1fr",
                gap: 8,
              }}
            >
              {section.items.map((item) => {
                const isEmailDetail = item.label === "Email";

                return (
                  <div
                    key={item.label}
                    style={{
                      display: "grid",
                      gap: 5,
                      minWidth: 0,
                      padding: "10px 11px",
                      borderRadius: 8,
                      border: `1px solid ${colors.border}`,
                      backgroundColor: colors.surfaceRaised,
                      gridColumn: isEmailDetail ? "1 / -1" : undefined,
                    }}
                  >
                    <FitText
                      excludeGlobalScale
                      style={{
                        fontSize: 9.5,
                        fontWeight: 850,
                        color: colors.textMuted,
                        letterSpacing: "0.04em",
                        textTransform: "uppercase",
                      }}
                    >
                      {item.label}
                    </FitText>
                    <FitText
                      excludeGlobalScale={isEmailDetail}
                      style={{
                        fontSize: isEmailDetail ? 10.5 : 12.25,
                        fontWeight: 800,
                        color: colors.textPrimary,
                        lineHeight: 1.3,
                        overflowWrap: "anywhere",
                        wordBreak: "normal",
                        whiteSpace: isEmailDetail ? "normal" : undefined,
                      }}
                    >
                      {item.value}
                    </FitText>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

export default function AccountsInspectorSurface() {
  const { canManageAccounts, isCoach } = useAccountsPage();

  return (
    <div
      className="members-directory-inspector"
      style={{
        display: "grid",
        gridTemplateRows: canManageAccounts
          ? "auto minmax(0, 1fr)"
          : "minmax(0, 1fr)",
        gap: canManageAccounts ? 10 : 0,
        height: "100%",
        minHeight: 0,
      }}
    >
      {canManageAccounts ? <AccountInspectorCommandRow /> : null}
      <MemberInspectorPanel
        ariaLabel={isCoach ? "Client details" : "Account details"}
        footer={<AccountInspectorFooter />}
      >
        <AccountInspectorBody />
      </MemberInspectorPanel>
    </div>
  );
}

export { useAccountActionStyles };
