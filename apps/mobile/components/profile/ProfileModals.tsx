import { EditProfileModal, ConfirmModal, TimeSlotModal } from "@/components/modals";
import AttendanceQrModal from "@/components/modals/profile/AttendanceQrModal";
import TimeAvailabilityModal from "@/components/modals/profile/TimeAvailabilityModal";
import MembershipAccessModal from "@/components/modals/profile/MembershipAccessModal";
import NoticeModal from "@/components/modals/shared/NoticeModal";
import { TIME_SLOTS } from "@/data/bookings";
import { type ProfileScreenController } from "@/hooks/profile/useProfileScreen";
import { to12HourLabel } from "@fittrack/utils";

type ProfileModalsProps = {
  controller: ProfileScreenController;
};

export default function ProfileModals({ controller }: ProfileModalsProps) {
  return (
    <>
      {controller.isMember && controller.terminateVisible ? (
        <ConfirmModal
          isVisible={controller.terminateVisible}
          title="Request Account Termination?"
          message="Your account will be flagged for review. You can cancel this request before it is approved."
          yesLabel="Request Termination"
          noLabel="Cancel"
          isDestructive
          isLoading={controller.isTerminating}
          loadingLabel="SUBMITTING"
          loadingTitle="Submitting request"
          onYes={controller.handleRequestTermination}
          onNo={() => controller.setTerminateVisible(false)}
        />
      ) : null}
      {controller.isMember && controller.cancelVisible ? (
        <ConfirmModal
          isVisible={controller.cancelVisible}
          title="Cancel Termination Request?"
          message="Your account will be restored to active status."
          yesLabel="Cancel Request"
          noLabel="Go Back"
          isDestructive={false}
          isLoading={controller.isCancelling}
          loadingLabel="CANCELLING"
          loadingTitle="Cancelling request"
          onYes={controller.handleCancelTermination}
          onNo={() => controller.setCancelVisible(false)}
        />
      ) : null}
      {controller.availabilityDeleteTarget ? (
        <ConfirmModal
          isVisible={!!controller.availabilityDeleteTarget}
          title="Delete Availability Slot?"
          message="This slot will no longer appear in coach availability."
          yesLabel="Delete"
          noLabel="Keep Slot"
          isDestructive
          isLoading={controller.isAvailabilityDeleting}
          loadingLabel="DELETING"
          loadingTitle="Removing slot"
          onYes={controller.handleDeleteAvailability}
          onNo={() => controller.setAvailabilityDeleteTarget(null)}
        />
      ) : null}
      {controller.rankingPrivacyTarget ? (
        <ConfirmModal
          isVisible={!!controller.rankingPrivacyTarget}
          title={`Set Ranking Visibility to ${controller.rankingPrivacyTargetLabel}?`}
          message={controller.rankingPrivacyTargetMessage}
          yesLabel="Apply"
          noLabel="Keep Current"
          isDestructive={controller.rankingPrivacyTarget === "private"}
          isLoading={controller.isRankingPrivacySaving}
          loadingLabel="UPDATING"
          loadingTitle="Updating visibility"
          onYes={controller.handleConfirmRankingPrivacy}
          onNo={() => controller.setRankingPrivacyTarget(null)}
        />
      ) : null}
      {controller.editVisible ? (
        <EditProfileModal
          isVisible={controller.editVisible}
          onClose={() => controller.setEditVisible(false)}
          coachProfile={controller.coachProfile}
        />
      ) : null}
      {controller.isMember ? (
        <AttendanceQrModal
          attendanceQr={controller.attendanceQrData}
          countdownLabel={controller.attendanceQrCountdownLabel}
          errorMessage={controller.attendanceQrError}
          isRefreshing={controller.isRefreshingAttendanceQr}
          isLoading={controller.isAttendanceQrLoading}
          isVisible={controller.attendanceQrVisible}
          onClose={() => controller.setAttendanceQrVisible(false)}
          onCopy={controller.handleCopyAttendanceQrValue}
          onRefresh={() => {
            void controller.handleRefreshAttendanceQr();
          }}
          refreshDisabled={controller.attendanceQrRefreshDisabled}
          refreshLabel={controller.attendanceQrRefreshLabel}
        />
      ) : null}
      {controller.isMember && controller.membershipPaymentConfirmation ? (
        <NoticeModal
          isVisible={controller.membershipPaymentConfirmation != null}
          title={controller.membershipPaymentConfirmation.title}
          message={controller.membershipPaymentConfirmation.message}
          buttonLabel="Stay on Profile"
          onClose={() => controller.setMembershipPaymentConfirmation(null)}
        />
      ) : null}
      {controller.isMember ? (
        <MembershipAccessModal
          card={controller.membershipCard}
          cardPriceLabel={controller.membershipCardPriceLabel}
          canPurchaseCard={controller.canPurchaseMembershipCard}
          currentMembership={controller.currentMembership}
          freeDayPassEligibility={controller.freeDayPassEligibility}
          isPurchasePending={controller.isMembershipPurchasePending}
          isVisible={controller.membershipAccessVisible}
          onClose={() => controller.setMembershipAccessVisible(false)}
          onPurchaseCard={controller.handlePurchaseMembershipCard}
          onPurchasePlan={controller.handlePurchaseMembershipPlan}
          plans={controller.membershipPlans}
        />
      ) : null}
      {controller.isCoach ? (
        <TimeAvailabilityModal
          controller={controller}
          isVisible={controller.isAvailabilityEditorOpen}
          onClose={() => {
            controller.setIsAvailabilityEditorOpen(false);
            controller.setAvailabilityDeleteTarget(null);
          }}
        />
      ) : null}
      <TimeSlotModal
        isVisible={controller.isAvailabilityTimeOpen}
        slots={controller.availabilityTimeTarget === "start" ? TIME_SLOTS : controller.availabilityEndSlots}
        selectedTime={
          controller.availabilityTimeTarget === "start"
            ? to12HourLabel(controller.availabilityDraft.startTime)
            : to12HourLabel(controller.availabilityDraft.endTime)
        }
        showAvailabilityLegend={false}
        title="Choose Availability Time"
        emptyMessage="Select a start time before choosing an end time."
        onSelect={controller.handleAvailabilitySelect}
        onClose={() => controller.setIsAvailabilityTimeOpen(false)}
      />
    </>
  );
}
