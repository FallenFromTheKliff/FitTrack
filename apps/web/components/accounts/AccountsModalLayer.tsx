"use client";

import { Archive, BadgeCheck } from "lucide-react";
import { fullName } from "@fittrack/utils";

import AttendanceScanModal from "@/components/accounts/AttendanceScanModal";
import MemberInspectorPanel from "@/components/accounts/MemberInspectorPanel";
import { FitButton, FitText } from "@/components/fit";
import { ConfirmModal, DetailsModal, FitModal } from "@/components/modals";
import { useTheme } from "@/contexts/ThemeContext";
import { EDIT_MEMBER_FIELDS } from "@/data/members/members";
import {
  getDirectoryAccessLabel,
  getDirectoryRoleLabel,
  getEditDraftValues,
  getMembershipFieldValue,
  validateEditDraft,
} from "@/components/accounts/accountComponentUtils";

import { AccountInspectorBody, AccountInspectorFooter } from "./AccountsInspectorSurface";
import { useAccountsPage } from "./AccountsPageContext";
import CoachClientModalLayer from "./coach-client/CoachClientModalLayer";

export default function AccountsModalLayer() {
  const { colors } = useTheme();
  const {
    archiveLoading,
    archiveLoadingLabel,
    archiveTarget,
    canEditTargetDetails,
    canInspectAccounts,
    canManageAccounts,
    canManageMemberCard,
    closeInspector,
    deleteTarget,
    editConfirmOpen,
    editInitialValues,
    editLoading,
    editLoadingLabel,
    editModalOpen,
    editTarget,
    grantCardTarget,
    handleArchiveMember,
    handleAttendanceScan,
    handleDelete,
    handleEdit,
    handleGrantMembershipCard,
    handleRejectDeleteRequest,
    handleRemoveMembership,
    handleRestoreMember,
    handleRevokeMembershipCard,
    handleVerifyNonMember,
    isAccountsHamburgerMode,
    isApproveDeletionPending,
    isRejectDeletionPending,
    isMembershipCardPending,
    isCoach,
    isScanAttendancePending,
    membershipCardLoadingLabel,
    mobileInspectorOpen,
    noticeModal,
    pendingEditSubmission,
    pendingRequestsByUserId,
    rejectLoadingLabel,
    rejectTerminationTarget,
    queueEditConfirmation,
    restoreLoading,
    restoreLoadingLabel,
    restoreTarget,
    removeMembershipTarget,
    revokeCardTarget,
    scanFeedback,
    scanOpen,
    setArchiveTarget,
    setDeleteTarget,
    setEditConfirmOpen,
    setEditDraft,
    setEditModalOpen,
    setGrantCardTarget,
    setRejectTerminationTarget,
    setRemoveMembershipTarget,
    setNoticeModal,
    setPendingEditSubmission,
    setRestoreTarget,
    setRevokeCardTarget,
    setVerifyNonMemberTarget,
    setScanFeedback,
    setScanOpen,
    verifyNonMemberTarget,
  } = useAccountsPage();
  const isVerifyNonMemberTarget = verifyNonMemberTarget?.role?.name === "USER";
  const verifyAccountRoleLabel = verifyNonMemberTarget
    ? getDirectoryRoleLabel(verifyNonMemberTarget.role?.name).toLowerCase()
    : "account";
  const archiveFulfillsTermination = archiveTarget
    ? pendingRequestsByUserId.has(archiveTarget.id)
    : false;

  return (
    <>
      {canInspectAccounts && !isCoach ? (
        <FitModal
          isOpen={
            mobileInspectorOpen &&
            !!editTarget &&
            isAccountsHamburgerMode &&
            !editModalOpen &&
            !editConfirmOpen
          }
          onClose={closeInspector}
          title="Account details"
          subtitle={
            editTarget
              ? fullName(editTarget) || editTarget.email
              : "Selected member profile"
          }
          icon={BadgeCheck}
          maxWidth={448}
          noScroll
          footer={<AccountInspectorFooter />}
        >
          <div
            className="members-account-details-modal"
            style={{
              height: "min(720px, calc(100vh - 96px))",
              minHeight: 0,
            }}
          >
            <MemberInspectorPanel ariaLabel="Account details">
              <AccountInspectorBody />
            </MemberInspectorPanel>
          </div>
        </FitModal>
      ) : null}
      {canEditTargetDetails ? (
        <DetailsModal
          isOpen={editModalOpen && !!editTarget}
          title="Edit account details"
          subtitle={
            editTarget
              ? `${fullName(editTarget) || "Unnamed account"} - ${getDirectoryAccessLabel(
                  editTarget,
                  pendingRequestsByUserId,
                )}`
              : ""
          }
          fields={EDIT_MEMBER_FIELDS}
          initialValues={editInitialValues}
          submitLabel="Review update"
          disableUnchanged
          validate={validateEditDraft}
          onChange={setEditDraft}
          onSubmit={queueEditConfirmation}
          onCancel={() => {
            setEditDraft(getEditDraftValues(editTarget));
            setEditModalOpen(false);
            setPendingEditSubmission(null);
          }}
        >
          {editTarget ? (
            <div
              style={{
                marginTop: 12,
                display: "grid",
                gap: 10,
                paddingTop: 12,
                borderTop: `1px solid ${colors.border}`,
                backgroundColor: "transparent",
              }}
            >
              {[
                {
                  label: "Access",
                  value: getDirectoryAccessLabel(editTarget, pendingRequestsByUserId),
                },
              ].map((item) => (
                <div key={item.label} style={{ display: "grid", gap: 3 }}>
                  <FitText
                    style={{
                      fontSize: 10.5,
                      fontWeight: 700,
                      color: colors.textMuted,
                      letterSpacing: "0.05em",
                    }}
                  >
                    {item.label}
                  </FitText>
                  <FitText style={{ fontSize: 13.5, fontWeight: 700, color: colors.textPrimary }}>
                    {item.value}
                  </FitText>
                </div>
              ))}
            </div>
          ) : null}
        </DetailsModal>
      ) : null}
      {canEditTargetDetails ? (
        <ConfirmModal
          isOpen={editConfirmOpen && !!editTarget && !!pendingEditSubmission}
          title="Confirm account update"
          message={
            editTarget
              ? `Save the updated profile details for ${
                  fullName(editTarget) || editTarget.email
                }? Access controls stay unchanged, and the page will refresh with the new account information.`
              : "Save these updated account details?"
          }
          confirmLabel="SAVE ACCOUNT DETAILS"
          loadingLabel={editLoadingLabel}
          isLoading={editLoading}
          onConfirm={() => {
            if (!pendingEditSubmission) return;
            void handleEdit(pendingEditSubmission);
          }}
          onCancel={() => {
            setEditConfirmOpen(false);
            setPendingEditSubmission(null);
            setEditModalOpen(true);
          }}
        />
      ) : null}
      {canManageAccounts ? (
        <AttendanceScanModal
          isOpen={scanOpen}
          isSubmitting={isScanAttendancePending}
          feedback={scanFeedback}
          onClearFeedback={() => setScanFeedback(null)}
          onClose={() => {
            setScanOpen(false);
            setScanFeedback(null);
          }}
          onSubmitToken={handleAttendanceScan}
        />
      ) : null}
      <FitModal
        isOpen={noticeModal !== null}
        title={noticeModal?.title ?? "Account Notice"}
        subtitle={noticeModal?.tone === "error" ? "Action needs attention" : undefined}
        onClose={() => setNoticeModal(null)}
        footer={
          <FitButton
            label="OK"
            onClick={() => setNoticeModal(null)}
            style={{ minHeight: 34 }}
          />
        }
      >
        <FitText
          as="p"
          style={{
            color: noticeModal?.tone === "error" ? colors.danger : colors.textSecondary,
            fontSize: 13,
            lineHeight: 1.5,
          }}
        >
          {noticeModal?.description ?? "The account action has completed."}
        </FitText>
      </FitModal>
      {canManageMemberCard ? (
        <ConfirmModal
          isOpen={!!grantCardTarget}
          title={
            grantCardTarget && getMembershipFieldValue(grantCardTarget) === "revoked"
              ? "Restore Membership"
              : "Grant Membership"
          }
          message={
            grantCardTarget && getMembershipFieldValue(grantCardTarget) === "revoked"
              ? `Restore membership access for ${grantCardTarget.email}? This re-enables scan access and member-only app access without creating a new membership-card payment.`
              : `Grant membership access to ${
                  grantCardTarget?.email ?? "this account"
                } after one-time payment approval? This enables member-only access and prepares the card for future scans.`
          }
          confirmLabel={
            grantCardTarget && getMembershipFieldValue(grantCardTarget) === "revoked"
              ? "RESTORE MEMBERSHIP"
              : "GRANT MEMBERSHIP"
          }
          loadingLabel={membershipCardLoadingLabel}
          confirmIcon={BadgeCheck}
          isLoading={isMembershipCardPending}
          onConfirm={handleGrantMembershipCard}
          onCancel={() => setGrantCardTarget(null)}
        />
      ) : null}
      {canManageMemberCard ? (
        <ConfirmModal
          isOpen={!!revokeCardTarget}
          title="Revoke Membership"
          message={`Revoke membership access for ${
            revokeCardTarget?.email ?? "this account"
          }? The account stays active, but scan access and member-only app access return to the non-member state. The original one-time payment record is preserved.`}
          confirmLabel="REVOKE MEMBERSHIP"
          loadingLabel={membershipCardLoadingLabel}
          confirmIcon={Archive}
          isDanger
          isLoading={isMembershipCardPending}
          onConfirm={handleRevokeMembershipCard}
          onCancel={() => setRevokeCardTarget(null)}
        />
      ) : null}
      {canManageMemberCard ? (
        <ConfirmModal
          isOpen={!!removeMembershipTarget}
          title="Remove Membership"
          message={`Remove active membership access for ${
            removeMembershipTarget?.email ?? "this account"
          }? The account stays active and returns to the non-member state. It will not be banned or archived.`}
          confirmLabel="REMOVE MEMBERSHIP"
          loadingLabel={membershipCardLoadingLabel}
          confirmIcon={BadgeCheck}
          isDanger
          isLoading={isMembershipCardPending}
          onConfirm={handleRemoveMembership}
          onCancel={() => setRemoveMembershipTarget(null)}
        />
      ) : null}
      {verifyNonMemberTarget ? (
        <ConfirmModal
          isOpen={!!verifyNonMemberTarget}
          title={isVerifyNonMemberTarget ? "Verify Non-Member" : "Verify Team Member"}
          message={
            isVerifyNonMemberTarget
              ? `Promote ${
                  verifyNonMemberTarget?.email ?? "this account"
                } from Not Verified to Non-member? This verifies account access without granting membership-card access.`
              : `Verify ${
                  verifyNonMemberTarget?.email ?? "this account"
                } and activate this ${verifyAccountRoleLabel} account? This confirms account access for the selected role.`
          }
          confirmLabel={isVerifyNonMemberTarget ? "VERIFY NON-MEMBER" : "VERIFY TEAM MEMBER"}
          confirmIcon={BadgeCheck}
          isLoading={false}
          onConfirm={handleVerifyNonMember}
          onCancel={() => setVerifyNonMemberTarget(null)}
        />
      ) : null}
      {canManageAccounts ? (
        <ConfirmModal
          isOpen={!!rejectTerminationTarget}
          title="Reject Termination Request"
          message={`Reject the pending termination request for ${
            rejectTerminationTarget?.email ?? "this account"
          }? The request will be cleared and the account will remain active with its normal actions restored.`}
          confirmLabel="REJECT TERMINATION REQUEST"
          loadingLabel={rejectLoadingLabel}
          isDanger
          isLoading={isRejectDeletionPending}
          onConfirm={handleRejectDeleteRequest}
          onCancel={() => setRejectTerminationTarget(null)}
        />
      ) : null}
      {canInspectAccounts && !isCoach ? (
        <ConfirmModal
          isOpen={!!deleteTarget}
          title="Approve Termination Request"
          message={`Approve the termination request for ${
            deleteTarget?.email ?? "this account"
          }? The account will be soft-deleted and moved to Archived until it is restored.`}
          confirmLabel="APPROVE REQUEST"
          loadingLabel="APPROVING REQUEST"
          confirmIcon={BadgeCheck}
          isDanger
          isLoading={isApproveDeletionPending}
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      ) : null}
      {isCoach ? <CoachClientModalLayer /> : null}
      {archiveTarget ? (
        <ConfirmModal
          isOpen={!!archiveTarget}
          title="Archive Account"
          message={
            archiveFulfillsTermination
              ? `Archive ${
                  archiveTarget?.email ?? "this account"
                } from the account directory? This fulfills the pending termination request and moves the profile to Archived.`
              : `Archive ${
                  archiveTarget?.email ?? "this account"
                } from the account directory? The profile stays recoverable in Archived.`
          }
          confirmLabel="ARCHIVE ACCOUNT"
          loadingLabel={archiveLoadingLabel}
          confirmIcon={Archive}
          isDanger
          isLoading={archiveLoading}
          onConfirm={handleArchiveMember}
          onCancel={() => setArchiveTarget(null)}
        />
      ) : null}
      {restoreTarget ? (
        <ConfirmModal
          isOpen={!!restoreTarget}
          title="Restore Account"
          message={`Restore ${
            restoreTarget?.email ?? "this account"
          } to the account directory? This clears soft deletion and cancels any pending deletion request for the account.`}
          confirmLabel="RESTORE ACCOUNT"
          loadingLabel={restoreLoadingLabel}
          confirmIcon={BadgeCheck}
          isLoading={restoreLoading}
          onConfirm={handleRestoreMember}
          onCancel={() => setRestoreTarget(null)}
        />
      ) : null}
    </>
  );
}
