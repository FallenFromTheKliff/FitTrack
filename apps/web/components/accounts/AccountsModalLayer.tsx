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
  formatReviewPayableLabel,
  getDirectoryAccessLabel,
  getEditDraftValues,
  getMembershipFieldValue,
  getScanReadinessLabel,
  validateEditDraft,
} from "@/components/accounts/accountComponentUtils";

import { AccountInspectorBody, AccountInspectorFooter } from "./AccountsInspectorSurface";
import { useAccountsPage } from "./AccountsPageContext";

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
    handleApproveMembershipPayment,
    handleArchiveMember,
    handleAttendanceScan,
    handleDelete,
    handleEdit,
    handleGrantMembershipCard,
    handleRejectMembershipPayment,
    handleRestoreMember,
    handleRevokeMembershipCard,
    handleVerifyNonMember,
    isAccountsHamburgerMode,
    isAdmin,
    isApproveDeletionPending,
    isMembershipCardPending,
    isMembershipPaymentReviewPending,
    isScanAttendancePending,
    membershipCardLoadingLabel,
    mobileInspectorOpen,
    noticeModal,
    paymentReviewAction,
    paymentReviewLoadingLabel,
    pendingEditSubmission,
    pendingMembershipPayment,
    pendingRequestsByUserId,
    queueEditConfirmation,
    restoreLoading,
    restoreLoadingLabel,
    restoreTarget,
    revokeCardTarget,
    scanFeedback,
    scanOpen,
    setArchiveTarget,
    setDeleteTarget,
    setEditConfirmOpen,
    setEditDraft,
    setEditModalOpen,
    setGrantCardTarget,
    setNoticeModal,
    setPaymentReviewAction,
    setPendingEditSubmission,
    setRestoreTarget,
    setRevokeCardTarget,
    setVerifyNonMemberTarget,
    setScanFeedback,
    setScanOpen,
    verifyNonMemberTarget,
  } = useAccountsPage();

  return (
    <>
      {canInspectAccounts ? (
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
          maxWidth={448}
          noScroll
          hideHeaderText
          hideHeaderDivider
          headerStyle={{ paddingBottom: 0 }}
        >
          <div
            className="members-account-details-modal"
            style={{
              height: "min(720px, calc(100vh - 96px))",
              minHeight: 0,
            }}
          >
            <MemberInspectorPanel ariaLabel="Account details" footer={<AccountInspectorFooter />}>
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
                padding: 14,
                borderRadius: 10,
                border: `1px solid ${colors.border}`,
                backgroundColor: `${colors.surface}ee`,
              }}
            >
              {[
                {
                  label: "Access",
                  value: getDirectoryAccessLabel(editTarget, pendingRequestsByUserId),
                },
                {
                  label: "Scan status",
                  value: getScanReadinessLabel(editTarget),
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
        <ConfirmModal
          isOpen={paymentReviewAction !== null && !!pendingMembershipPayment}
          title={paymentReviewAction === "reject" ? "Reject Payment Review" : "Approve Payment Review"}
          message={
            pendingMembershipPayment
              ? paymentReviewAction === "reject"
                ? `Reject this ${formatReviewPayableLabel(
                    pendingMembershipPayment.payable_type ?? undefined,
                  ).toLowerCase()} review? The payment will remain blocked until the member submits a new valid proof.`
                : `Approve this ${formatReviewPayableLabel(
                    pendingMembershipPayment.payable_type ?? undefined,
                  ).toLowerCase()} for PHP ${Number(pendingMembershipPayment.amount).toLocaleString("en-PH", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}?`
              : "Review this payment action before continuing."
          }
          confirmLabel={paymentReviewAction === "reject" ? "REJECT PAYMENT" : "APPROVE PAYMENT"}
          loadingLabel={paymentReviewLoadingLabel}
          isDanger={paymentReviewAction === "reject"}
          isLoading={isMembershipPaymentReviewPending}
          onConfirm={() => {
            if (paymentReviewAction === "reject") {
              void handleRejectMembershipPayment();
              return;
            }
            void handleApproveMembershipPayment();
          }}
          onCancel={() => setPaymentReviewAction(null)}
        />
      ) : null}
      {isAdmin ? (
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
      {verifyNonMemberTarget ? (
        <ConfirmModal
          isOpen={!!verifyNonMemberTarget}
          title="Verify Non-Member"
          message={`Promote ${
            verifyNonMemberTarget?.email ?? "this account"
          } from Pending Verification to Verified Non-Member? This verifies account access without granting membership-card access.`}
          confirmLabel="VERIFY NON-MEMBER"
          confirmIcon={BadgeCheck}
          isLoading={false}
          onConfirm={handleVerifyNonMember}
          onCancel={() => setVerifyNonMemberTarget(null)}
        />
      ) : null}
      {canInspectAccounts ? (
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
      {archiveTarget ? (
        <ConfirmModal
          isOpen={!!archiveTarget}
          title="Archive Account"
          message={`Archive ${
            archiveTarget?.email ?? "this account"
          } from the account directory? The profile stays recoverable in Archived.`}
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
