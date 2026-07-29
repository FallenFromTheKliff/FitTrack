"use client";

import { DndContext, DragOverlay } from "@dnd-kit/core";
import {
  CalendarDays,
  CalendarPlus,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  CircleCheck,
  Pencil,
  Plus,
  RefreshCw,
} from "lucide-react";
import type { MotionStyle } from "framer-motion";
import { formatWeekRange, toYmd } from "@fittrack/utils";

import {
  FitButton,
  FitPill,
  FitSection,
  FitSelect,
  FitText,
} from "@/components/fit";
import {
  BlockDetailModal,
  CalendarModal,
  ConfirmModal,
  DetailsModal,
  FitModal,
  StaffDetailsModal,
} from "@/components/modals";
import {
  GymOperationsCreateCoachBookingModal,
  GymOperationsCreateCoachModal,
  GymOperationsCreateVenueBookingModal,
} from "@/components/schedule/GymOperationsOverlays";
import { GymOperationsAvailabilityDrawer } from "@/components/schedule/GymOperationsAvailabilityDrawer";
import { GymOperationsCoachAppointmentModal } from "@/components/schedule/GymOperationsCoachAppointmentModal";
import { GymOperationsVenueBookingModal } from "@/components/schedule/GymOperationsVenueBookingModal";
import { GymOperationsMonthCalendar } from "@/components/schedule/GymOperationsMonthCalendar";
import {
  CoachAppointmentsTable,
  CoachDirectory,
  CoachIconRail,
  VenueBookingsTable,
} from "@/components/schedule/OperationsTables";
import {
  getAppointmentStatusColor,
  getCoachDisplayName,
  getReadableStatus,
} from "@/components/schedule/operationsUtils";
import { WeeklyTimeline } from "@/components/schedule";

import {
  COACH_PROFILE_FIELDS,
  COACH_VISIBILITY_SCOPE_OPTIONS,
  GymOperationsModeTabs,
  GymOperationsScheduleViewSwitcher,
  OperationsControlField,
  OperationsLoadingBlock,
  OperationsMetricCard,
  OperationsMetricGrid,
  STATUS_OPTIONS,
  VENUE_STATUS_OPTIONS,
  formatScheduleDay,
} from "@/components/schedule/SchedulePageShared";
import { getWeekStart } from "./helpers";
import { RecurringPlanCreateModal } from "@/components/schedule/RecurringPlanCreateModal";
import { RecurringPlanActionModal } from "@/components/schedule/RecurringPlanActionModal";
import {
  GymOperationsPageProvider,
  useGymOperationsPage,
} from "@/components/schedule/SchedulePageContext";
import FloatingHelpButton from "@/components/help/FloatingHelpButton";
import { useAuth } from "@/contexts/AuthContext";
export default function GymOperationsPage() {
  const { user } = useAuth();
  const isCoach = user?.role === "COACH";

  return (
    <GymOperationsPageProvider>
      <GymOperationsPageBody />
      <FloatingHelpButton
        title={isCoach ? "Coach Sessions" : "Gym Operations"}
        description={
          isCoach
            ? "This page manages your coaching appointments and session status actions."
            : "This page manages staff scheduling, venue bookings, coach appointments, and booking status actions."
        }
        terms={
          isCoach
            ? [
                { label: "Coach appointment", value: "A member coaching session that can move through confirmation, completion, or cancellation." },
                { label: "Availability", value: "The live coach windows used to prevent invalid booking choices." },
              ]
            : [
                { label: "Venue booking", value: "A reservable facility slot tied to a member, time window, and payment state." },
                { label: "Coach appointment", value: "A member coaching session that can move through payment, confirmation, completion, or cancellation." },
                { label: "Availability", value: "The live coach or venue windows used to prevent invalid booking choices." },
              ]
        }
      />
    </GymOperationsPageProvider>
  );
}

function GymOperationsPageBody() {
  const {
    activeBlock,
    activeCoach,
    activeCoachId,
    activeOperationsTab,
    activeScheduleSurfaceTab,
    allBookings,
    appointmentReviewReadiness,
    appointmentReviewTarget,
    appointmentsLoading,
    appointmentStatusFilter,
    appointmentSummary,
    availabilityEditorCoach,
    blockDetailOpen,
    bookingDateRange,
    bookableVenueOptions,
    bulkUpdateRecurringSessionsMutation,
    calendarOpen,
    canAnimate,
    cancelAppointmentPending,
    cancelRecurringPlanMutation,
    canManageCoaching,
    coachAppointments,
    coachDetailsOpen,
    coachFilterId,
    coachOptions,
    coachProfiles,
    coachRailAsRow,
    coachRoster,
    coachVisibilityScope,
    colors,
    completeAppointmentPending,
    createCoachBookingMutation,
    createCoachBookingOpen,
    createCoachMutation,
    createCoachOpen,
    createRecurringPlanMutation,
    createVenueBookingMutation,
    createVenueBookingOpen,
    draggingBooking,
    draggingCoach,
    fadeIn,
    feedbackModal,
    filteredStaff,
    filteredVenueBookings,
    focusedCoachId,
    focusedCoachScheduleBookings,
    isAdmin,
    isCoach,
    handleApproveVenueBooking,
    handleBlockClick,
    handleBlockDelete,
    handleBlockSave,
    handleCancelAppointment,
    handleCancelVenueBooking,
    handleCoachFocus,
    handleCompleteAppointment,
    handleCompleteVenueBooking,
    handleConfirmAppointment,
    handleConfirmPaymentAction,
    handleConfirmRecurringPlan,
    handleCreateCoach,
    handleCreateCoachBooking,
    handleCreateVenueBooking,
    handleDragEnd,
    handleDragStart,
    handleNoShowVenueBooking,
    handlePreviewRecurringPlan,
    handleRecurringFutureUpdate,
    handleRecurringPlanCancel,
    handleRecurringSessionReschedule,
    handleRecurringSessionSkip,
    handleRejectAppointment,
    handleRejectVenueBooking,
    handleSaveAppointmentFeedback,
    handleSaveAvailability,
    handleVenueEndDateSelect,
    handleVenueStartDateSelect,
    handleSaveCoachProfile,
    handleMarkCoachPayoutPaid,
    handleSetCoachBookingVisibility,
    handleStaffClick,
    leftRailRef,
    markCoachPayoutPaidMutation,
    memberOptions,
    nextWeek,
    payAppointmentInitialMutation,
    paymentConfirm,
    paymentConfirmLoading,
    payRecurringCycleMutation,
    prevWeek,
    processAppointmentBalanceMutation,
    processBookingBalanceMutation,
    profileEditorCoach,
    recurringActionBusy,
    recurringActionCoachId,
    recurringActionDate,
    recurringActionDays,
    recurringActionReason,
    recurringActionTime,
    recurringCompletedCount,
    recurringCreateBusy,
    recurringPlanAction,
    recurringPlanForm,
    recurringPlanInputInvalid,
    recurringPlanOpen,
    recurringPlanPreview,
    recurringPlanSessions,
    recurringRemainingCount,
    refreshGymOperationsData,
    replaceAvailabilityMutation,
    requestApproveAppointmentPayment,
    requestCollectAppointmentBalance,
    requestCollectAppointmentInitialPayment,
    requestCollectVenueBalance,
    requestRecurringCyclePayment,
    respondAppointmentPending,
    rightScrollRef,
    rosterBookings,
    scheduleLoading,
    scheduleRangeMode,
    scheduleRosterMaxHeight,
    scheduleTimelineMaxHeight,
    selectedCoachProfile,
    selectedCoachRoster,
    selectedVenueFilterLabel,
    sensors,
    setActiveBlock,
    setActiveCoachId,
    setActiveOperationsTab,
    setActiveScheduleSurfaceTab,
    setAppointmentReviewTarget,
    setAppointmentStatusFilter,
    setAvailabilityEditorCoachId,
    setBlockDetailOpen,
    setCalendarOpen,
    setCoachDetailsOpen,
    setCoachFilterId,
    setCoachVisibilityScope,
    setCreateCoachBookingOpen,
    setCreateCoachOpen,
    setCreateVenueBookingOpen,
    setFeedbackModal,
    setPaymentConfirm,
    setProfileEditorCoachId,
    setRecurringActionCoachId,
    setRecurringActionDate,
    setRecurringActionReason,
    setRecurringActionTime,
    setRecurringPlanAction,
    setRecurringPlanForm,
    setRecurringPlanOpen,
    setRecurringPlanPreview,
    setScheduleRangeMode,
    setSlideKey,
    setVenueFilterId,
    setVenueEndCalendarOpen,
    setVenueReviewTarget,
    setVenueStartCalendarOpen,
    setVenueStatusFilter,
    setWeekStart,
    slideStyle,
    themeTransition,
    toggleRecurringActionDay,
    toggleRecurringPlanDay,
    updateCoachProfilePending,
    updateRecurringSessionMutation,
    venueBookingDateLabel,
    venueBookingSummary,
    venueEndCalendarOpen,
    venueFilterId,
    venueFilterOptions,
    venueReviewTarget,
    venueStartCalendarOpen,
    venueStatusFilter,
    verifyPaymentMutation,
    visibleTimelineDays,
    visibleTimelineHours,
    weekStart,
    clearVenueBookingDateRange,
  } = useGymOperationsPage();

  const selectedCoachCompletedAppointments = coachAppointments.filter(
    (appointment) =>
      appointment.status === "completed" &&
      (!selectedCoachProfile || appointment.coachId === selectedCoachProfile.id),
  );
  const selectedCoachEarningsTotal = selectedCoachCompletedAppointments.reduce(
    (sum, appointment) => sum + Number(appointment.coachEarnings ?? 0),
    0,
  );
  const formatPhpAmount = (value: number) =>
    `PHP ${value.toLocaleString("en-PH", {
      maximumFractionDigits: 0,
      minimumFractionDigits: 0,
    })}`;
  const selectedAppointmentStatusLabel =
    STATUS_OPTIONS.find((option) => option.value === appointmentStatusFilter)
      ?.label ?? "All statuses";
  const selectedVenueStatusLabel =
    VENUE_STATUS_OPTIONS.find((option) => option.value === venueStatusFilter)
      ?.label ?? "All statuses";
  const selectedCoachAppointmentFilterLabel =
    coachOptions.find((option) => option.value === (coachFilterId ?? ""))
      ?.label ?? "All coaches";

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <FitSection
        as="section"
        heading=""
        hideHeading
        bare
        noPadding
        className={themeTransition}
        style={fadeIn}
      >
        <div
          className="gym-operations-command-row"
          data-ui="gym-operations-command-row"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 14,
            flexWrap: "wrap",
            marginBottom: 14,
          }}
        >
          {canManageCoaching ? (
            <GymOperationsModeTabs
              activeTab={activeOperationsTab}
              onChange={setActiveOperationsTab}
              colors={colors}
            />
          ) : null}
          <div
            data-ui="gym-operations-actions"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              flexWrap: "wrap",
              marginLeft: "auto",
            }}
          >
            {activeOperationsTab === "schedule" ? (
              <>
                <FitButton
                  variant="primary"
                  iconOnly
                  icon={RefreshCw}
                  iconSize={15}
                  onClick={() => {
                    void refreshGymOperationsData();
                  }}
                  aria-label="Refresh Gym Operations data"
                  style={{
                    minHeight: 38,
                    borderRadius: 8,
                    backgroundColor: colors.warning,
                    border: `1px solid ${colors.warning}`,
                    boxShadow: `0 8px 18px ${colors.warning}24`,
                    color: colors.onBrand,
                  }}
                />
                {activeScheduleSurfaceTab === "coach-schedule" && isAdmin ? (
                  <FitButton
                    variant="primary"
                    data-ui="gym-operations-create-recurring-plan"
                    label="RECURRING PLAN"
                    icon={Plus}
                    iconSize={14}
                    onClick={() => {
                      setRecurringPlanPreview(null);
                      setRecurringPlanOpen(true);
                    }}
                    disabled={
                      memberOptions.length === 0 || coachOptions.length === 0
                    }
                    style={{
                      minHeight: 38,
                      borderRadius: 8,
                      padding: "8px 14px",
                      backgroundColor: colors.brand,
                      color: colors.onBrand,
                    }}
                    textStyle={{ fontSize: 11, fontWeight: 800 }}
                  />
                ) : null}
                {canManageCoaching ? (
                  <FitButton
                    variant="primary"
                    data-ui={
                      activeScheduleSurfaceTab === "venue-bookings"
                        ? "gym-operations-create-venue-booking"
                        : "gym-operations-create-coach-booking"
                    }
                    label={
                      activeScheduleSurfaceTab === "venue-bookings"
                        ? "NEW VENUE BOOKING"
                        : "NEW COACH BOOKING"
                    }
                    icon={CalendarPlus}
                    iconSize={15}
                    onClick={() =>
                      activeScheduleSurfaceTab === "venue-bookings"
                        ? setCreateVenueBookingOpen(true)
                        : setCreateCoachBookingOpen(true)
                    }
                    style={{
                      minHeight: 38,
                      borderRadius: 8,
                      padding: "8px 16px",
                      backgroundColor: colors.brand,
                      color: colors.onBrand,
                    }}
                    textStyle={{ fontSize: 12, fontWeight: 800 }}
                  />
                ) : null}
              </>
            ) : activeOperationsTab === "appointments" ? (
              <>
                <FitButton
                  variant="primary"
                  iconOnly
                  icon={RefreshCw}
                  iconSize={15}
                  onClick={() => {
                    void refreshGymOperationsData();
                  }}
                  aria-label="Refresh Gym Operations data"
                  style={{
                    minHeight: 38,
                    borderRadius: 8,
                    backgroundColor: colors.warning,
                    border: `1px solid ${colors.warning}`,
                    boxShadow: `0 8px 18px ${colors.warning}24`,
                    color: colors.onBrand,
                  }}
                />
                {canManageCoaching ? (
                  <FitButton
                    variant="primary"
                    data-ui="gym-operations-create-coach-booking"
                    label="CREATE COACH BOOKING"
                    icon={CalendarPlus}
                    iconSize={15}
                    onClick={() => setCreateCoachBookingOpen(true)}
                    style={{
                      minHeight: 38,
                      borderRadius: 8,
                      padding: "8px 16px",
                      backgroundColor: colors.brand,
                      color: colors.onBrand,
                    }}
                    textStyle={{ fontSize: 12, fontWeight: 800 }}
                  />
                ) : null}
              </>
            ) : (
              <>
                <FitButton
                  variant="primary"
                  data-ui="gym-operations-create-coach"
                  label="ADD COACH"
                  icon={Plus}
                  iconSize={14}
                  onClick={() => setCreateCoachOpen(true)}
                  style={{
                    minHeight: 38,
                    borderRadius: 8,
                    padding: "8px 14px",
                    backgroundColor: colors.brand,
                    color: colors.onBrand,
                  }}
                  textStyle={{ fontSize: 12, fontWeight: 800 }}
                />
              </>
            )}
          </div>
        </div>
        <div
          data-ui="gym-operations-content"
          style={{ minHeight: 180, position: "relative" }}
        >
        {activeOperationsTab === "schedule" ? (
          <div
            data-ui="gym-operations-schedule-panel"
            data-option-count={3}
            style={{ display: "grid", gap: 12 }}
          >
            {canManageCoaching ? (
              <div
                style={{
                  alignItems: "center",
                  borderBottom: `1px solid ${colors.border}`,
                  display: "flex",
                  justifyContent: "space-between",
                  minHeight: 44,
                  padding: "0 2px 10px",
                }}
              >
                <GymOperationsScheduleViewSwitcher
                  activeView={activeScheduleSurfaceTab}
                  colors={colors}
                  onChange={setActiveScheduleSurfaceTab}
                />
              </div>
            ) : null}
            {activeScheduleSurfaceTab === "month-calendar" ? (
              <GymOperationsMonthCalendar />
            ) : activeScheduleSurfaceTab === "coach-schedule" ? (
              <div
                className="gym-operations-schedule-grid"
                style={{
                  display: "grid",
                  gridTemplateColumns: coachRailAsRow
                    ? "minmax(0, 1fr)"
                    : "94px minmax(0, 1fr)",
                  gap: 10,
                  alignItems: "stretch",
                }}
              >
                <CoachIconRail
                  draggable
                  railRef={leftRailRef}
                  maxHeight={coachRailAsRow ? null : scheduleRosterMaxHeight}
                  orientation={coachRailAsRow ? "row" : "column"}
                  filteredStaff={filteredStaff}
                  bookings={rosterBookings}
                  selectedStaffId={focusedCoachId}
                  onStaffPreview={handleCoachFocus}
                  onStaffClick={handleStaffClick}
                  requireSecondClickToOpen
                  colors={colors}
                />
                <div
                  style={{
                    borderRadius: 8,
                    border: `1px solid ${colors.border}`,
                    backgroundColor: colors.surface,
                    display: "grid",
                    gridTemplateRows: "auto minmax(0, 1fr)",
                    gap: 0,
                    minHeight: scheduleTimelineMaxHeight,
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 12,
                      flexWrap: "wrap",
                      minHeight: 48,
                      padding: "10px 12px",
                      borderBottom: `1px solid ${colors.border}`,
                      backgroundColor: colors.surfaceRaised,
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 14,
                        flexWrap: "wrap",
                      }}
                      aria-label="Schedule legend"
                    >
                      {STATUS_OPTIONS.filter((option) => option.value !== "all").map((option) => (
                        <div
                          key={option.value}
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 6,
                          }}
                        >
                          <span
                            style={{
                              width: 8,
                              height: 8,
                              borderRadius: 2,
                              backgroundColor: getAppointmentStatusColor(option.value, colors),
                            }}
                          />
                          <FitText
                            excludeGlobalScale
                            style={{
                              fontSize: 10,
                              fontWeight: 800,
                              color: colors.textSecondary,
                            }}
                          >
                            {getReadableStatus(option.value)}
                          </FitText>
                        </div>
                      ))}
                    </div>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        flexWrap: "wrap",
                      }}
                    >
                      <FitButton
                        variant="ghost"
                        iconOnly
                        icon={ChevronLeft}
                        iconSize={16}
                        onClick={prevWeek}
                        aria-label={
                          scheduleRangeMode === "weekly"
                            ? "Previous week"
                            : "Previous day"
                        }
                        style={{ minHeight: 32, borderRadius: 8 }}
                      />
                      <FitButton
                        variant="ghost"
                        icon={CalendarDays}
                        iconSize={15}
                        label={
                          scheduleRangeMode === "weekly"
                            ? formatWeekRange(weekStart)
                            : formatScheduleDay(weekStart)
                        }
                        onClick={() => setCalendarOpen(true)}
                        style={{
                          minHeight: 32,
                          minWidth: 188,
                          padding: "4px 9px",
                          borderRadius: 8,
                          backgroundColor: `${colors.brand}12`,
                          color: colors.brand,
                          whiteSpace: "nowrap",
                        }}
                        textStyle={{
                          color: colors.brand,
                          fontSize: 11,
                          fontWeight: 800,
                          lineHeight: 1,
                          whiteSpace: "nowrap",
                        }}
                        aria-label={
                          scheduleRangeMode === "weekly"
                            ? "Pick week"
                            : "Pick day"
                        }
                      />
                      {isCoach ? (
                        <OperationsControlField label="Status" minWidth={154}>
                          <FitSelect
                            compact
                            fullWidth
                            value={appointmentStatusFilter}
                            onChange={(event) =>
                              setAppointmentStatusFilter(event.target.value || "all")
                            }
                            options={STATUS_OPTIONS}
                            aria-label={`Schedule status filter: ${selectedAppointmentStatusLabel}`}
                          />
                        </OperationsControlField>
                      ) : null}
                      <FitButton
                        variant="ghost"
                        iconOnly
                        icon={ChevronRight}
                        iconSize={16}
                        onClick={nextWeek}
                        aria-label={
                          scheduleRangeMode === "weekly"
                            ? "Next week"
                            : "Next day"
                        }
                        style={{ minHeight: 32, borderRadius: 8 }}
                      />
                      <FitButton
                        variant="ghost"
                        label={
                          scheduleRangeMode === "weekly" ? "Weekly" : "Daily"
                        }
                        onClick={() => {
                          setScheduleRangeMode((current) => {
                            const next = current === "weekly" ? "daily" : "weekly";
                            setWeekStart((date) =>
                              next === "weekly" ? getWeekStart(date) : date,
                            );
                            setSlideKey((key) => key + 1);
                            return next;
                          });
                        }}
                        aria-label="Toggle schedule range"
                        style={{
                          minHeight: 32,
                          width: 74,
                          borderRadius: 8,
                          padding: "4px 0",
                          fontSize: 10,
                          fontWeight: 800,
                        }}
                      />
                    </div>
                  </div>
                  <div
                    ref={rightScrollRef}
                    style={{
                      height: scheduleTimelineMaxHeight,
                      minHeight: 0,
                      overflow: "hidden",
                      boxSizing: "border-box",
                    }}
                  >
                    <WeeklyTimeline
                      weekDays={visibleTimelineDays}
                      hours={visibleTimelineHours}
                      bookings={focusedCoachScheduleBookings}
                      slideStyle={slideStyle as MotionStyle}
                      isLoading={appointmentsLoading}
                      colors={colors}
                      flush
                      height={Math.max(320, scheduleTimelineMaxHeight)}
                      allowDrag={false}
                      onBlockClick={handleBlockClick}
                    />
                  </div>
                </div>
              </div>
            ) : (
              <div
                data-ui="gym-operations-venue-panel"
                style={{
                  borderRadius: 8,
                  border: `1px solid ${colors.border}`,
                  backgroundColor: colors.surface,
                  padding: "14px",
                  display: "grid",
                  gap: 14,
                }}
              >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "flex-end",
                      justifyContent: "space-between",
                      gap: 12,
                      flexWrap: "wrap",
                    }}
                  >
                    <div style={{ display: "grid", gap: 6 }}>
                      <FitText
                        excludeGlobalScale
                        style={{
                          fontSize: 11,
                          fontWeight: 700,
                          color: colors.brand,
                          letterSpacing: "0.08em",
                        }}
                      >
                        VENUE BOOKING CONTROL
                      </FitText>
                      <FitText
                        excludeGlobalScale
                        style={{
                          fontSize: 18,
                          color: colors.textPrimary,
                          lineHeight: 1.45,
                          letterSpacing: 0,
                          fontWeight: 700,
                        }}
                      >
                        Review basketball courts, boxing rings, and yoga rooms
                        without leaving the main Gym Operations route.
                      </FitText>
                    </div>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                        flexWrap: "wrap",
                      }}
                    >
                      <OperationsControlField label="Venue Filter" minWidth={220}>
                        <FitSelect
                          value={venueFilterId}
                          onChange={(event) =>
                            setVenueFilterId(event.target.value || "all")
                          }
                          options={venueFilterOptions}
                          compact
                          fullWidth
                          aria-label={`Venue filter: ${selectedVenueFilterLabel}`}
                        />
                      </OperationsControlField>
                      <OperationsControlField label="Status Filter" minWidth={180}>
                        <FitSelect
                          value={venueStatusFilter}
                          onChange={(event) =>
                            setVenueStatusFilter(event.target.value || "all")
                          }
                          options={VENUE_STATUS_OPTIONS}
                          compact
                          fullWidth
                          aria-label={`Venue booking status filter: ${selectedVenueStatusLabel}`}
                        />
                      </OperationsControlField>
                      <OperationsControlField label="Start Date" minWidth={160}>
                        <FitButton
                          variant="ghost"
                          icon={CalendarDays}
                          iconSize={15}
                          label={bookingDateRange.startDate ?? "Any date"}
                          aria-label={`Venue booking start date: ${
                            bookingDateRange.startDate ?? "Any date"
                          }`}
                          onClick={() => setVenueStartCalendarOpen(true)}
                          style={{
                            justifyContent: "flex-start",
                            minHeight: 34,
                            width: "100%",
                          }}
                        />
                      </OperationsControlField>
                      <OperationsControlField label="End Date" minWidth={160}>
                        <FitButton
                          variant="ghost"
                          icon={CalendarDays}
                          iconSize={15}
                          label={bookingDateRange.endDate ?? "Any date"}
                          aria-label={`Venue booking end date: ${
                            bookingDateRange.endDate ?? "Any date"
                          }`}
                          onClick={() => setVenueEndCalendarOpen(true)}
                          style={{
                            justifyContent: "flex-start",
                            minHeight: 34,
                            width: "100%",
                          }}
                        />
                      </OperationsControlField>
                      {bookingDateRange.startDate || bookingDateRange.endDate ? (
                        <FitButton
                          variant="ghost"
                          label="Clear Dates"
                          onClick={clearVenueBookingDateRange}
                          style={{
                            minHeight: 34,
                            alignSelf: "flex-end",
                          }}
                        />
                      ) : null}
                    </div>
                    <FitText
                      style={{
                        color: colors.textMuted,
                        fontSize: 12,
                        marginTop: 8,
                      }}
                    >
                      Showing venue bookings {venueBookingDateLabel}.
                    </FitText>
                  </div>
                  <OperationsMetricGrid>
                    <OperationsMetricCard
                      colors={colors}
                      label="Visible Venue Bookings"
                      value={venueBookingSummary.visible}
                      tone={colors.brand}
                    />
                    <OperationsMetricCard
                      colors={colors}
                      label="Pending Venue Bookings"
                      value={venueBookingSummary.pending}
                      tone={colors.warning}
                    />
                    <OperationsMetricCard
                      colors={colors}
                      label="Confirmed Venue Sessions"
                      value={venueBookingSummary.confirmed}
                      tone={colors.success}
                    />
                    <OperationsMetricCard
                      colors={colors}
                      label="Active Venues"
                      value={venueBookingSummary.activeVenues}
                    />
                  </OperationsMetricGrid>
                  {scheduleLoading ? (
                    <OperationsLoadingBlock
                      colors={colors}
                      maxHeight={170}
                      message="Loading venue bookings..."
                    />
                  ) : (
                    <VenueBookingsTable
                      bookings={filteredVenueBookings}
                      colors={colors}
                      emptyMessage={
                        venueFilterId === "all"
                          ? "No venue bookings match the current filters."
                          : `No bookings made in ${selectedVenueFilterLabel}.`
                      }
                      onOpenReview={setVenueReviewTarget}
                    />
                  )}
              </div>
            )}
          </div>
        ) : null}

        {activeOperationsTab === "appointments" && canManageCoaching ? (
          <div
            className="gym-operations-work-panel"
            data-ui="gym-operations-appointments-panel"
            style={{
              borderRadius: 8,
              border: "none",
              backgroundColor: "transparent",
              padding: 0,
              display: "grid",
              gridTemplateColumns: "minmax(0, 1fr)",
              alignItems: "stretch",
              minHeight: 0,
            }}
          >
            <div
              style={{
                display: "grid",
                gap: 10,
                gridTemplateRows: "auto auto minmax(0, 1fr)",
                borderRadius: 8,
                border: `1px solid ${colors.border}`,
                backgroundColor: colors.surface,
                padding: 14,
                minWidth: 0,
                minHeight: 0,
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  justifyContent: "space-between",
                  gap: 10,
                  flexWrap: "wrap",
                  paddingTop: 0,
                }}
              >
                <div style={{ display: "grid", gap: 6 }}>
                  <FitText
                    excludeGlobalScale
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      color: colors.brand,
                      letterSpacing: "0.08em",
                    }}
                  >
                    COACH APPOINTMENTS
                  </FitText>
                  <FitText
                    excludeGlobalScale
                    style={{
                      fontSize: 18,
                      fontWeight: 700,
                      color: colors.textPrimary,
                      lineHeight: 1.2,
                    }}
                  >
                    Appointment control
                  </FitText>
                  <FitText
                    excludeGlobalScale
                    style={{
                      fontSize: 12,
                      color: colors.textMuted,
                      lineHeight: 1.45,
                      letterSpacing: 0,
                    }}
                  >
                    Review, filter, and resolve coaching sessions.
                  </FitText>
                </div>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    flexWrap: "wrap",
                  }}
                >
                  <OperationsControlField label="Coach Filter" minWidth={220}>
                    <FitSelect
                      value={coachFilterId ?? ""}
                      onChange={(event) =>
                        setCoachFilterId(event.target.value || null)
                      }
                      options={coachOptions}
                      placeholder="All coaches"
                      compact
                      fullWidth
                      aria-label={`Coach appointment filter: ${selectedCoachAppointmentFilterLabel}`}
                      style={{ minHeight: 34 }}
                    />
                  </OperationsControlField>
                  <OperationsControlField label="Status Filter" minWidth={180}>
                    <FitSelect
                      value={appointmentStatusFilter}
                      onChange={(event) =>
                        setAppointmentStatusFilter(event.target.value || "all")
                      }
                      options={STATUS_OPTIONS}
                      compact
                      fullWidth
                      aria-label={`Coach appointment status filter: ${selectedAppointmentStatusLabel}`}
                      style={{ minHeight: 34 }}
                    />
                  </OperationsControlField>
                </div>
              </div>
              <OperationsMetricGrid>
                <OperationsMetricCard
                  colors={colors}
                  label="Visible Appointments"
                  value={appointmentSummary.visible}
                  tone={colors.brand}
                />
                <OperationsMetricCard
                  colors={colors}
                  label="Pending Coach Decisions"
                  value={appointmentSummary.pendingCoach}
                  tone={colors.warning}
                />
                <OperationsMetricCard
                  colors={colors}
                  label="Confirmed Sessions"
                  value={appointmentSummary.confirmed}
                  tone={colors.success}
                />
                <OperationsMetricCard
                  colors={colors}
                  label={
                    coachFilterId
                      ? "Selected Coach Slots"
                      : "Preview Coach Slots"
                  }
                  value={
                    selectedCoachProfile
                      ? (selectedCoachProfile.availability?.length ?? 0)
                      : coachProfiles.filter((coach) => coach.isActive).length
                  }
                />
              </OperationsMetricGrid>

              {appointmentsLoading ? (
                <OperationsLoadingBlock
                  colors={colors}
                  message="Loading coach appointments..."
                />
              ) : (
                <CoachAppointmentsTable
                  appointments={coachAppointments}
                  colors={colors}
                  onOpenReview={setAppointmentReviewTarget}
                  resetKey={`${coachFilterId ?? "all"}:${appointmentStatusFilter}`}
                />
              )}
            </div>
          </div>
        ) : null}

        {activeOperationsTab === "coaches" && canManageCoaching ? (
          <div
            className="gym-operations-coaches-grid"
            data-ui="gym-operations-coaches-panel"
            style={{
              display: "grid",
              gridTemplateColumns: "minmax(270px, 310px) minmax(0, 1fr)",
              gap: 12,
              alignItems: "stretch",
              minHeight: 0,
            }}
          >
                <CoachDirectory
                  coaches={coachRoster}
                  colors={colors}
                  onSelect={(coachId) => setCoachFilterId(coachId)}
                  onVisibilityChange={(nextScope) => {
                    setCoachVisibilityScope(nextScope);
                    const nextCoach = coachRoster.find((coach) => {
                      if (nextScope === "visible") return coach.isActive;
                      if (nextScope === "hidden") return !coach.isActive;
                      return true;
                    });
                    setCoachFilterId(nextCoach?.id ?? null);
                  }}
                  selectedCoachId={focusedCoachId}
                  visibilityOptions={COACH_VISIBILITY_SCOPE_OPTIONS}
                  visibilityScope={coachVisibilityScope}
                />
                <div
                  style={{
                    border: `1px solid ${colors.border}`,
                    borderRadius: 8,
                    backgroundColor: colors.surface,
                    padding: 14,
                    display: "grid",
                    gap: 12,
                    minHeight: 0,
                    transition: canAnimate
                      ? "border-color 180ms ease"
                      : "border-color 180ms ease, box-shadow 180ms ease",
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
                    <div style={{ display: "grid", gap: 4 }}>
                      <FitText
                        excludeGlobalScale
                        style={{
                          fontSize: 24,
                          fontWeight: 800,
                          color: colors.textPrimary,
                          lineHeight: 1.02,
                        }}
                      >
                        {selectedCoachRoster?.name ??
                          "Choose a coach from the roster"}
                      </FitText>
                      <FitText
                        excludeGlobalScale
                        style={{ fontSize: 10, color: colors.textMuted }}
                      >
                        {selectedCoachRoster
                          ? selectedCoachRoster.email ||
                            "No contact email yet."
                          : "Choose a coach to review their booking profile."}
                      </FitText>
                    </div>
                    <div
                      style={{
                        alignItems: "center",
                        display: "flex",
                        flexWrap: "wrap",
                        gap: 8,
                      }}
                    >
                      <FitPill
                        mode="status"
                        label={
                          selectedCoachProfile
                            ? selectedCoachProfile.isActive
                              ? "VISIBLE IN BOOKING"
                              : "HIDDEN FROM BOOKING"
                            : "NO COACH SELECTED"
                        }
                        color={
                          selectedCoachProfile
                            ? selectedCoachProfile.isActive
                              ? colors.brand
                              : colors.warning
                            : colors.textMuted
                        }
                        fontSize={10}
                        fontWeight={700}
                        borderOpacity="35"
                        bgOpacity="14"
                        style={{ borderRadius: 6 }}
                      />
                      <FitButton
                        data-ui="gym-operations-manage-availability"
                        variant="ghost"
                        label="AVAILABILITY"
                        onClick={() => {
                          if (!selectedCoachProfile) return;
                          setAvailabilityEditorCoachId(selectedCoachProfile.id);
                        }}
                        disabled={!selectedCoachProfile}
                        style={{
                          minHeight: 34,
                          borderRadius: 7,
                          padding: "7px 11px",
                        }}
                        textStyle={{ fontSize: 10, fontWeight: 800 }}
                      />
                      <FitButton
                        data-ui="gym-operations-edit-profile"
                        variant="primary"
                        label="EDIT PROFILE"
                        icon={Pencil}
                        iconSize={13}
                        onClick={() => {
                          if (!selectedCoachProfile) return;
                          setProfileEditorCoachId(selectedCoachProfile.id);
                        }}
                        disabled={!selectedCoachProfile}
                        style={{
                          minHeight: 34,
                          borderRadius: 7,
                          padding: "7px 11px",
                          backgroundColor: colors.brand,
                          color: colors.onBrand,
                        }}
                        textStyle={{ fontSize: 10, fontWeight: 800 }}
                      />
                    </div>
                  </div>

                  <OperationsMetricGrid columns={4}>
                    <OperationsMetricCard
                      colors={colors}
                      label="Weekly Slots"
                      value={selectedCoachProfile?.availability?.length ?? 0}
                    />
                    <OperationsMetricCard
                      colors={colors}
                      label="Schedule Type"
                      value={
                        selectedCoachProfile?.scheduleType === "full_time"
                          ? "Full-time"
                          : "Part-time"
                      }
                      tone={colors.brand}
                    />
                    <OperationsMetricCard
                      colors={colors}
                      label="Hourly Rate"
                      value={
                        selectedCoachRoster?.hourlyRate != null
                          ? `PHP ${selectedCoachRoster.hourlyRate.toLocaleString("en-PH")}`
                          : "Unset"
                      }
                      tone={
                        selectedCoachRoster?.hourlyRate != null
                          ? colors.brand
                          : colors.textPrimary
                      }
                    />
                    <OperationsMetricCard
                      colors={colors}
                      label="Upcoming Sessions"
                      value={coachAppointments.filter(
                        (appointment) =>
                          !focusedCoachId ||
                          appointment.coachId === focusedCoachId,
                      ).length}
                      tone={colors.success}
                    />
                  </OperationsMetricGrid>

                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)",
                      gap: 10,
                    }}
                  >
                    <div
                      style={{
                        borderRadius: 8,
                        border: `1px solid ${colors.border}`,
                        backgroundColor: colors.surfaceRaised,
                        padding: "14px 16px",
                        display: "grid",
                        gap: 8,
                      }}
                    >
                      <FitText
                        excludeGlobalScale
                        style={{
                          fontSize: 13,
                          fontWeight: 700,
                          color: colors.textPrimary,
                        }}
                      >
                        Availability snapshot
                      </FitText>
                      {(selectedCoachProfile?.availability?.length ?? 0) > 0 ? (
                        selectedCoachProfile?.availability
                          ?.slice(0, 4)
                          .map((slot) => (
                            <FitText
                              key={`${slot.dayOfWeek}-${slot.startTime}-${slot.endTime}`}
                              excludeGlobalScale
                              style={{
                                fontSize: 12,
                                color: colors.textSecondary,
                              }}
                            >
                              {[
                                "Sun",
                                "Mon",
                                "Tue",
                                "Wed",
                                "Thu",
                                "Fri",
                                "Sat",
                              ][slot.dayOfWeek] ?? `Day ${slot.dayOfWeek}`}{" "}
                              / {slot.startTime} - {slot.endTime}
                            </FitText>
                          ))
                      ) : (
                        <FitText
                          excludeGlobalScale
                          style={{ fontSize: 12, color: colors.textMuted }}
                        >
                          No availability recorded yet.
                        </FitText>
                      )}
                    </div>
                    <div
                      style={{
                        borderRadius: 8,
                        border: `1px solid ${colors.border}`,
                        backgroundColor: colors.surfaceRaised,
                        padding: "14px 16px",
                        display: "grid",
                        gap: 10,
                      }}
                    >
                      <FitText
                        excludeGlobalScale
                        style={{
                          fontSize: 13,
                          fontWeight: 700,
                          color: colors.textPrimary,
                        }}
                      >
                        Expertise & credentials
                      </FitText>
                      <div
                        style={{ display: "flex", flexWrap: "wrap", gap: 8 }}
                      >
                        {(selectedCoachRoster?.specialties ?? []).length > 0 ? (
                          selectedCoachRoster?.specialties.map(
                            (specialty, index) => (
                              <FitPill
                                key={specialty}
                                mode="status"
                                label={specialty.toUpperCase()}
                                color={
                                  index === 0 ? colors.brand : colors.textMuted
                                }
                                fontSize={9}
                                fontWeight={700}
                                borderOpacity="28"
                                bgOpacity="12"
                                style={{ borderRadius: 6 }}
                              />
                            ),
                          )
                        ) : (
                          <FitText
                            excludeGlobalScale
                            style={{ fontSize: 12, color: colors.textMuted }}
                          >
                            No specialties recorded for the current selection.
                          </FitText>
                        )}
                      </div>
                      <FitText
                        excludeGlobalScale
                        style={{
                          borderTop: `1px solid ${colors.border}`,
                          color: colors.textSecondary,
                          fontSize: 11.5,
                          lineHeight: 1.45,
                          paddingTop: 9,
                        }}
                      >
                        {(selectedCoachRoster?.certifications ?? []).length > 0
                          ? selectedCoachRoster?.certifications.join(" · ")
                          : "No certifications recorded yet."}
                      </FitText>
                    </div>
                  </div>

                  <div
                    style={{
                      borderRadius: 8,
                      border: `1px solid ${colors.border}`,
                      backgroundColor: colors.surfaceRaised,
                      padding: "14px 16px",
                      display: "grid",
                      gap: 8,
                    }}
                  >
                    <FitText
                      excludeGlobalScale
                      style={{
                        fontSize: 13,
                        fontWeight: 700,
                        color: colors.textPrimary,
                      }}
                    >
                      Booking bio
                    </FitText>
                    <FitText
                      excludeGlobalScale
                      style={{
                        fontSize: 12,
                        lineHeight: 1.5,
                        color: colors.textSecondary,
                      }}
                    >
                      {selectedCoachRoster?.bio?.trim() ||
                        "No booking bio yet."}
                    </FitText>
                  </div>

                  <div
                    style={{
                      borderRadius: 8,
                      border: `1px solid ${colors.border}`,
                      backgroundColor: colors.surfaceRaised,
                      padding: "14px 16px",
                      display: "grid",
                      gap: 10,
                    }}
                  >
                    <div
                      style={{
                        alignItems: "center",
                        display: "flex",
                        gap: 10,
                        justifyContent: "space-between",
                        flexWrap: "wrap",
                      }}
                    >
                      <div>
                        <FitText
                          excludeGlobalScale
                          style={{
                            fontSize: 13,
                            fontWeight: 700,
                            color: colors.textPrimary,
                          }}
                        >
                          Earnings breakdown
                        </FitText>
                        <FitText
                          excludeGlobalScale
                          style={{
                            color: colors.textSecondary,
                            display: "block",
                            fontSize: 11.5,
                            marginTop: 3,
                          }}
                        >
                          {selectedCoachCompletedAppointments.length} completed session
                          {selectedCoachCompletedAppointments.length === 1 ? "" : "s"} /{" "}
                          {formatPhpAmount(selectedCoachEarningsTotal)} commission
                        </FitText>
                      </div>
                    </div>
                    {selectedCoachCompletedAppointments.length > 0 ? (
                      <div style={{ display: "grid", gap: 0, overflowX: "auto" }}>
                        <div style={{ display: "grid", gap: 0, minWidth: 620 }}>
                          <div
                            style={{
                              color: colors.textMuted,
                              display: "grid",
                              fontSize: 10,
                              fontWeight: 800,
                              gap: 8,
                              gridTemplateColumns: "1fr 1.2fr 0.9fr 0.8fr 0.8fr",
                              letterSpacing: "0.06em",
                              padding: "6px 0 8px",
                              textTransform: "uppercase",
                            }}
                          >
                            <span>Date</span>
                            <span>Member Name</span>
                            <span>Commission</span>
                            <span>Status</span>
                            <span>Action</span>
                          </div>
                          {selectedCoachCompletedAppointments.map((appointment) => {
                            const memberName = `${appointment.user.profile?.firstName ?? ""} ${
                              appointment.user.profile?.lastName ?? ""
                            }`.trim() || appointment.user.email || "Member";
                            const isPaid = Boolean(appointment.coachPayoutPaidAt);
                            return (
                              <div
                                key={appointment.id}
                                style={{
                                  alignItems: "center",
                                  borderTop: `1px solid ${colors.border}`,
                                  display: "grid",
                                  gap: 8,
                                  gridTemplateColumns: "1fr 1.2fr 0.9fr 0.8fr 0.8fr",
                                  minHeight: 42,
                                  padding: "8px 0",
                                }}
                              >
                                <FitText excludeGlobalScale style={{ fontSize: 11.5, fontWeight: 700 }}>
                                  {new Date(appointment.scheduledAt).toLocaleDateString("en-PH", {
                                    month: "short",
                                    day: "numeric",
                                    year: "numeric",
                                  })}
                                </FitText>
                                <FitText excludeGlobalScale style={{ fontSize: 11.5, color: colors.textSecondary }}>
                                  {memberName}
                                </FitText>
                                <FitText excludeGlobalScale style={{ fontSize: 11.5, color: colors.brand, fontWeight: 800 }}>
                                  {formatPhpAmount(Number(appointment.coachEarnings ?? 0))}
                                </FitText>
                                <FitText
                                  excludeGlobalScale
                                  style={{
                                    color: isPaid ? colors.success : colors.warning,
                                    fontSize: 11,
                                    fontWeight: 800,
                                  }}
                                >
                                  {isPaid ? "Paid" : "Pending"}
                                </FitText>
                                <FitButton
                                  variant="ghost"
                                  label={isPaid ? "PAID" : "MARK PAID"}
                                  onClick={() => void handleMarkCoachPayoutPaid(appointment)}
                                  disabled={isPaid || markCoachPayoutPaidMutation.isPending}
                                  style={{ minHeight: 28, padding: "5px 8px", borderRadius: 8 }}
                                  textStyle={{ fontSize: 10, fontWeight: 800 }}
                                />
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ) : (
                      <FitText
                        excludeGlobalScale
                        style={{ color: colors.textMuted, fontSize: 12 }}
                      >
                        Completed sessions and payout status will appear here.
                      </FitText>
                    )}
                  </div>
                </div>

              </div>
        ) : null}
        </div>

        <StaffDetailsModal
          isOpen={coachDetailsOpen && canManageCoaching}
          coachName={activeCoach?.name ?? "Coach"}
          coachBio={activeCoach?.bio ?? null}
          coachCertifications={activeCoach?.certifications ?? []}
          coachEmail={activeCoach?.email ?? ""}
          coachHourlyRate={activeCoach?.hourlyRate ?? null}
          coachSpecialties={activeCoach?.specialties ?? []}
          coachAvailability={activeCoach?.availabilityPreview ?? []}
          bookings={allBookings.filter(
            (booking) => booking.resourceId === activeCoachId,
          )}
          colors={colors}
          onClose={() => {
            setCoachDetailsOpen(false);
            setActiveCoachId(null);
          }}
        />
        <BlockDetailModal
          isOpen={blockDetailOpen}
          block={activeBlock}
          staffMembers={coachRoster}
          onSave={handleBlockSave}
          onDelete={handleBlockDelete}
          resourceLabel="Coach"
          onClose={() => {
            setBlockDetailOpen(false);
            setActiveBlock(null);
          }}
        />
        <CalendarModal
          isOpen={calendarOpen}
          minDate={toYmd(new Date())}
          selectedDate={toYmd(weekStart)}
          onSelect={(ymd) => {
            if (!ymd) return;
            const [year, month, day] = ymd.split("-").map(Number);
            if (
              Number.isFinite(year) &&
              Number.isFinite(month) &&
              Number.isFinite(day)
            ) {
              const selectedDate = new Date(year, month - 1, day);
              setWeekStart(
                scheduleRangeMode === "weekly"
                  ? getWeekStart(selectedDate)
                  : selectedDate,
              );
              setSlideKey((key) => key + 1);
            }
          }}
          onClose={() => setCalendarOpen(false)}
        />
        <CalendarModal
          isOpen={venueStartCalendarOpen}
          minDate={null}
          selectedDate={bookingDateRange.startDate}
          onSelect={handleVenueStartDateSelect}
          onClose={() => setVenueStartCalendarOpen(false)}
        />
        <CalendarModal
          isOpen={venueEndCalendarOpen}
          minDate={bookingDateRange.startDate ?? null}
          selectedDate={bookingDateRange.endDate}
          onSelect={handleVenueEndDateSelect}
          onClose={() => setVenueEndCalendarOpen(false)}
        />
        <RecurringPlanCreateModal
          coachOptions={coachOptions}
          form={recurringPlanForm}
          inputInvalid={recurringPlanInputInvalid}
          isBusy={recurringCreateBusy}
          isCreatePending={createRecurringPlanMutation.isPending}
          isOpen={isAdmin && recurringPlanOpen}
          memberOptions={memberOptions}
          onClose={() => setRecurringPlanOpen(false)}
          onConfirm={(skipConflicts) => void handleConfirmRecurringPlan(skipConflicts)}
          onPreview={() => void handlePreviewRecurringPlan()}
          onResetPreview={() => setRecurringPlanPreview(null)}
          onToggleDay={toggleRecurringPlanDay}
          preview={recurringPlanPreview}
          setForm={setRecurringPlanForm}
        />
        <GymOperationsCoachAppointmentModal
          appointment={appointmentReviewTarget}
          billingCycles={recurringPlanSessions?.plan.billingCycles ?? []}
          coachReadiness={appointmentReviewReadiness}
          isOpen={!!appointmentReviewTarget}
          isSubmitting={
            respondAppointmentPending ||
            completeAppointmentPending ||
            cancelAppointmentPending ||
            payAppointmentInitialMutation.isPending ||
            processAppointmentBalanceMutation.isPending ||
            payRecurringCycleMutation.isPending ||
            verifyPaymentMutation.isPending
          }
          onClose={() => setAppointmentReviewTarget(null)}
          onConfirm={() => void handleConfirmAppointment()}
          onReject={(note) => {
            if (!appointmentReviewTarget) return;
            void handleRejectAppointment(appointmentReviewTarget, note);
          }}
          onComplete={(payload) => {
            if (!appointmentReviewTarget) return;
            void handleCompleteAppointment(appointmentReviewTarget, payload);
          }}
          isCoachView={isCoach}
          onSaveFeedback={(payload) => {
            if (!appointmentReviewTarget) return;
            void handleSaveAppointmentFeedback(appointmentReviewTarget, payload);
          }}
          onCancelAppointment={(note) => {
            if (!appointmentReviewTarget) return;
            void handleCancelAppointment(appointmentReviewTarget, note);
          }}
          onEditRecurringSession={() => {
            if (!appointmentReviewTarget?.recurringPlanId) return;
            const currentAppointment = appointmentReviewTarget;
            setAppointmentReviewTarget(null);
            setRecurringPlanAction({
              appointment: currentAppointment,
              mode: "single",
            });
          }}
          onEditRecurringFuture={() => {
            if (!appointmentReviewTarget?.recurringPlanId) return;
            const currentAppointment = appointmentReviewTarget;
            setAppointmentReviewTarget(null);
            setRecurringPlanAction({
              appointment: currentAppointment,
              mode: "future",
            });
          }}
          onCancelRecurringPlan={() => {
            if (!appointmentReviewTarget?.recurringPlanId) return;
            const currentAppointment = appointmentReviewTarget;
            setAppointmentReviewTarget(null);
            setRecurringPlanAction({
              appointment: currentAppointment,
              mode: "cancel",
            });
          }}
          onCollectBalance={(provider) => {
            if (!appointmentReviewTarget) return;
            requestCollectAppointmentBalance(
              appointmentReviewTarget,
              provider,
            );
          }}
          onCollectInitialPayment={(provider, paymentStage) => {
            if (!appointmentReviewTarget) return;
            requestCollectAppointmentInitialPayment(
              appointmentReviewTarget,
              provider,
              paymentStage,
            );
          }}
          onApprovePayment={(paymentId) => {
            if (!appointmentReviewTarget) return;
            requestApproveAppointmentPayment(
              appointmentReviewTarget,
              paymentId,
            );
          }}
          onPayRecurringCycle={(cycle, provider) =>
            requestRecurringCyclePayment(cycle, provider)
          }
          canManageRecurringPlan={isAdmin}
        />
        <RecurringPlanActionModal
          action={isAdmin ? recurringPlanAction : null}
          coachOptions={coachOptions}
          completedCount={recurringCompletedCount}
          isBusy={recurringActionBusy}
          isBulkUpdatePending={bulkUpdateRecurringSessionsMutation.isPending}
          isCancelPending={cancelRecurringPlanMutation.isPending}
          isSessionUpdatePending={updateRecurringSessionMutation.isPending}
          onCancelPlan={() => void handleRecurringPlanCancel()}
          onClose={() => setRecurringPlanAction(null)}
          onRescheduleSession={() => void handleRecurringSessionReschedule()}
          onSkipSession={() => void handleRecurringSessionSkip()}
          onToggleFutureDay={toggleRecurringActionDay}
          onUpdateFuture={() => void handleRecurringFutureUpdate()}
          remainingCount={recurringRemainingCount}
          selectedCoachId={recurringActionCoachId}
          selectedDate={recurringActionDate}
          selectedDays={recurringActionDays}
          selectedTime={recurringActionTime}
          note={recurringActionReason}
          setNote={setRecurringActionReason}
          setSelectedCoachId={setRecurringActionCoachId}
          setSelectedDate={setRecurringActionDate}
          setSelectedTime={setRecurringActionTime}
        />
        <GymOperationsCreateVenueBookingModal
          isOpen={canManageCoaching && createVenueBookingOpen}
          isSubmitting={createVenueBookingMutation.isPending}
          onClose={() => setCreateVenueBookingOpen(false)}
          onCreate={(payload) => void handleCreateVenueBooking(payload)}
          memberOptions={memberOptions}
          coachOptions={coachOptions}
          venueOptions={bookableVenueOptions}
        />
        <GymOperationsCreateCoachBookingModal
          isOpen={canManageCoaching && createCoachBookingOpen}
          isSubmitting={createCoachBookingMutation.isPending}
          onClose={() => setCreateCoachBookingOpen(false)}
          onCreate={(payload) => void handleCreateCoachBooking(payload)}
          memberOptions={memberOptions}
          coachOptions={coachOptions}
        />
        <GymOperationsCreateCoachModal
          isOpen={isAdmin && createCoachOpen}
          isSubmitting={createCoachMutation.isPending}
          onClose={() => setCreateCoachOpen(false)}
          onCreate={(payload) => void handleCreateCoach(payload)}
        />
        <GymOperationsAvailabilityDrawer
          isOpen={!!availabilityEditorCoach}
          coachName={
            availabilityEditorCoach
              ? getCoachDisplayName(availabilityEditorCoach, "Coach")
              : "Coach"
          }
          isVisibleInBooking={availabilityEditorCoach?.isActive ?? false}
          initialSlots={
            availabilityEditorCoach?.availability?.map((slot) => ({
              dayOfWeek: slot.dayOfWeek,
              startTime: slot.startTime,
              endTime: slot.endTime,
            })) ?? []
          }
          isSaving={
            replaceAvailabilityMutation.isPending ||
            updateCoachProfilePending
          }
          onClose={() => setAvailabilityEditorCoachId(null)}
          onSave={(slots) => void handleSaveAvailability(slots)}
          onSetBookingVisibility={(isVisible) => {
            if (!availabilityEditorCoach) return;
            void handleSetCoachBookingVisibility(
              availabilityEditorCoach.id,
              isVisible,
            );
          }}
        />
        <GymOperationsVenueBookingModal
          booking={venueReviewTarget}
          isOpen={!!venueReviewTarget}
          isSubmitting={
            scheduleLoading ||
            processBookingBalanceMutation.isPending ||
            verifyPaymentMutation.isPending
          }
          onClose={() => setVenueReviewTarget(null)}
          onApprove={(note) => void handleApproveVenueBooking(note)}
          onCancel={(note) => void handleCancelVenueBooking(note)}
          onCollectBalance={(provider) => {
            if (!venueReviewTarget) return;
            requestCollectVenueBalance(venueReviewTarget, provider);
          }}
          onComplete={() => void handleCompleteVenueBooking()}
          onNoShow={() => void handleNoShowVenueBooking()}
          onReject={(note) => void handleRejectVenueBooking(note)}
          onVenueDetails={() => {
            window.location.assign("/facilities");
          }}
        />
        <ConfirmModal
          isOpen={!!paymentConfirm}
          title={paymentConfirm?.title ?? "Confirm payment action"}
          message={
            paymentConfirm?.message ??
            "Review this payment action before continuing."
          }
          confirmLabel={paymentConfirm?.confirmLabel ?? "CONFIRM"}
          loadingLabel={paymentConfirm?.confirmLabel ?? "CONFIRM"}
          isLoading={paymentConfirmLoading}
          onConfirm={() => {
            void handleConfirmPaymentAction();
          }}
          onCancel={() => setPaymentConfirm(null)}
        />
        <FitModal
          isOpen={feedbackModal !== null}
          title={feedbackModal?.tone === "danger" ? "Schedule Action Failed" : "Schedule Updated"}
          subtitle={feedbackModal?.tone === "danger" ? "Review the message before trying again" : "The schedule change has been applied."}
          icon={feedbackModal?.tone === "danger" ? CircleAlert : CircleCheck}
          onClose={() => setFeedbackModal(null)}
          footer={
            <FitButton
              label="OK"
              onClick={() => setFeedbackModal(null)}
              style={{ minHeight: 34 }}
            />
          }
        >
          <FitText
            as="p"
            style={{
              color: feedbackModal?.tone === "danger" ? colors.danger : colors.textSecondary,
              fontSize: 13,
              lineHeight: 1.5,
            }}
          >
            {feedbackModal?.message ?? "The schedule action has completed."}
          </FitText>
        </FitModal>
        <DetailsModal
          isOpen={!!profileEditorCoach}
          title={
            profileEditorCoach
              ? `${getCoachDisplayName(profileEditorCoach, "Coach")} Profile`
              : "Coach Profile"
          }
          subtitle="Keep this member-facing profile trustworthy before new bookings."
          fields={COACH_PROFILE_FIELDS.map((field) =>
            field.name === "scheduleType" && !isAdmin
              ? {
                  ...field,
                  hint: "Admin controlled. Staff and coaches can view this value but cannot change it.",
                  readOnly: true,
                }
              : field,
          )}
          initialValues={
            profileEditorCoach
              ? {
                  bio: profileEditorCoach.bio ?? "",
                  contactEmail: profileEditorCoach.contactEmail ?? "",
                  contactPhone: profileEditorCoach.contactPhone ?? "",
                  displayName: profileEditorCoach.displayName ?? "",
                  specialties: (profileEditorCoach.specialties ?? []).join(
                    ", ",
                  ),
                  certifications: (
                    profileEditorCoach.certifications ?? []
                  ).join(", "),
                  hourlyRate:
                    profileEditorCoach.hourlyRate != null
                      ? String(profileEditorCoach.hourlyRate)
                      : "",
                  scheduleType:
                    profileEditorCoach.scheduleType ?? "part_time",
                  isAvailableForBooking: profileEditorCoach.isActive
                    ? "active"
                    : "inactive",
                }
              : undefined
          }
          submitLabel={
            updateCoachProfilePending
              ? "SAVING PROFILE"
              : "SAVE PROFILE"
          }
          isLoading={updateCoachProfilePending}
          disableUnchanged
          onCancel={() => setProfileEditorCoachId(null)}
          onSubmit={(data) => void handleSaveCoachProfile(data)}
        >
          <FitText style={{ fontSize: 12, color: colors.textMuted }}>
            Years of experience is still outside the live coach-profile
            contract, so this management pass focuses on the fields members can
            already see during booking review.
          </FitText>
        </DetailsModal>
        <style>{`
          @media (max-width: 1180px) {
            .gym-operations-schedule-grid,
            .gym-operations-coaches-grid,
            .gym-operations-work-panel {
              grid-template-columns: minmax(0, 1fr) !important;
            }

            .gym-operations-coach-rail {
              height: auto !important;
              min-height: 0 !important;
              grid-template-columns: 56px minmax(0, 1fr) !important;
              grid-template-rows: auto auto !important;
            }

            .gym-operations-coach-rail-list {
              grid-auto-flow: column;
              grid-auto-columns: 58px;
              overflow-x: auto !important;
              overflow-y: hidden !important;
            }

            .gym-operations-coach-rail-pagination {
              grid-column: 1 / -1 !important;
            }

            .gym-operations-metric-grid {
              grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
            }
          }

          @media (max-width: 760px) {
            .gym-operations-metric-grid {
              grid-template-columns: minmax(0, 1fr) !important;
            }
          }
        `}</style>
      </FitSection>
      <DragOverlay>
        {draggingCoach ? (
          <div
            style={{
              width: 254,
              maxWidth: 254,
              backgroundColor: colors.surface,
              color: colors.textPrimary,
              borderRadius: 14,
              border: `1.5px solid ${colors.brand}55`,
              padding: "10px 12px",
              fontSize: 13,
              fontWeight: 700,
              boxShadow: "0 12px 28px rgba(0,0,0,0.26)",
              opacity: 0.96,
              pointerEvents: "none",
              display: "grid",
              gap: 3,
              overflow: "hidden",
            }}
          >
            <FitText
              excludeGlobalScale
              style={{
                fontSize: 13,
                fontWeight: 700,
                color: colors.textPrimary,
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
                letterSpacing: 0,
              }}
            >
              {draggingCoach.name}
            </FitText>
            <FitText
              excludeGlobalScale
              style={{
                fontSize: 10,
                color: colors.textMuted,
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
                letterSpacing: 0,
              }}
            >
              Drag into a schedule slot
            </FitText>
          </div>
        ) : draggingBooking ? (
          <div
            style={{
              width: 152,
              maxWidth: 152,
              backgroundColor: draggingBooking.color ?? colors.brand,
              color: colors.onBrand ?? colors.surface,
              borderRadius: 10,
              padding: "8px 14px",
              fontSize: 13,
              fontWeight: 700,
              boxShadow: "0 10px 24px rgba(0,0,0,0.24)",
              opacity: 0.92,
              pointerEvents: "none",
              overflow: "hidden",
            }}
          >
            <FitText
              excludeGlobalScale
              style={{
                fontSize: 12,
                fontWeight: 700,
                color: colors.onBrand ?? colors.surface,
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
                letterSpacing: 0,
              }}
            >
              {draggingBooking.resourceName}
            </FitText>
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
