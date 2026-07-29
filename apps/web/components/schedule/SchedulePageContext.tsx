"use client";
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  RecurringCoachingBillingCycleRecord,
  RecurringCoachingPlanPreviewResult,
  StaffAppointmentRecord,
  SubmitCoachAppointmentFeedbackPayload,
} from "@fittrack/api-client";
import type { CoachProfileRecord, MemberRecord } from "@fittrack/types";
import {
  bulkUpdateRecurringCoachingSessionsMutationOptions,
  cancelStaffAppointmentMutationOptions,
  cancelAppointmentMutationOptions,
  cancelRecurringCoachingPlanMutationOptions,
  coachScheduleQueryOptions,
  coachSelfProfileQueryOptions,
  completeCoachAppointmentMutationOptions,
  completeStaffAppointmentMutationOptions,
  confirmCoachAppointmentMutationOptions,
  createStaffAppointmentMutationOptions,
  createStaffBookingMutationOptions,
  createStaffCoachMutationOptions,
  declineCoachAppointmentMutationOptions,
  markCoachPayoutPaidMutationOptions,
  payAppointmentDownpaymentMutationOptions,
  createRecurringCoachingPlanMutationOptions,
  previewRecurringCoachingPlanMutationOptions,
  processAppointmentBalanceMutationOptions,
  processBookingBalanceMutationOptions,
  payRecurringCoachingBillingCycleMutationOptions,
  recurringCoachingPlanSessionsQueryOptions,
  replaceStaffCoachAvailabilityMutationOptions,
  respondToStaffAppointmentMutationOptions,
  queryKeys,
  staffAppointmentsQueryOptions,
  staffCoachesQueryOptions,
  staffUsersQueryOptions,
  updateCoachProfileMutationOptions,
  updateRecurringCoachingSessionMutationOptions,
  updateStaffCoachProfileMutationOptions,
  venuesQueryOptions,
  verifyMembershipPaymentMutationOptions,
} from "@fittrack/query";
import { coachProfileSchema } from "@fittrack/validators";

import { useTheme } from "@/contexts/ThemeContext";
import { useAuth } from "@/contexts/AuthContext";
import {
  useSchedule,
  type VenueBookingRecord,
} from "@/contexts/ScheduleContext";
import { webApiClient } from "@/lib/api-client";
import { useFadeIn } from "@/hooks/animations/useFadeIn";
import { useThemeTransition } from "@/hooks/animations/useThemeTransition";
import { usePowerSlide } from "@/hooks/animations/usePowerSlide";
import { useFitSensors } from "@/hooks/useFitSensors";
import { toYmd } from "@fittrack/utils";
import {
  getPersonDisplayName,
  isPendingFullCoachPayment,
  mapAppointmentToTimelineBooking,
} from "@/components/schedule/operationsUtils";
import { getDefaultDateInput } from "@/components/schedule/GymOperationsOverlayShared";
import type { Booking, Resource } from "@/components/schedule";

import {
  EMPTY_APPOINTMENT_RESULT,
  SCHEDULE_TIMELINE_HOURS,
  buildLocalIso,
  createDefaultRecurringPlanForm,
  getErrorMessage,
  getRecurringInput,
  normalizeOperationsTab,
  normalizeScheduleSurfaceTab,
  type CoachVisibilityScope,
  type GymOperationsTab,
  type PaymentCollectionProvider,
  type PaymentConfirmState,
  type RecurringPlanActionState,
  type RecurringPlanFormState,
  type ScheduleRangeMode,
  type ScheduleSurfaceTab,
} from "./SchedulePageShared";
import {
  addDays,
  buildManualBooking,
  getWeekStart,
  mapCoachesToRoster,
} from "@/app/(auth)/schedule/helpers";

function isBookableOperationsMember(member: MemberRecord) {
  const role = (
    member as MemberRecord & { role?: MemberRecord["role"] | string }
  ).role;
  const roleName =
    typeof role === "string" ? role.toUpperCase() : role?.name?.toUpperCase();
  const status = (
    member as MemberRecord & { status?: string | null }
  ).status?.toLowerCase();

  return (
    (roleName === "USER" || roleName === "MEMBER") &&
    (!status || status === "active") &&
    member.membershipCard?.status === "active" &&
    !member.deletedAt
  );
}

function useGymOperationsPageState() {
  const { colors, settings } = useTheme();
  const { user } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const [feedbackModal, setFeedbackModal] = useState<{
    message: string;
    tone: "danger" | "success";
  } | null>(null);
  const isAdmin = user?.role === "ADMIN";
  const isCoach = user?.role === "COACH";
  const canManageCoaching = isAdmin || user?.role === "STAFF";
  const canViewVenueBookings = canManageCoaching;
  const {
    cancelBooking,
    completeBooking,
    confirmBooking,
    noShowBooking,
    rejectBooking,
    bookingDateRange,
    setBookingDateRange,
    rawBookings,
    isLoading: scheduleLoading,
  } = useSchedule();
  const fadeIn = useFadeIn();
  const themeTransition = useThemeTransition();

  const showFeedback = (
    nextMessage: string,
    tone: "danger" | "success" = "success",
  ) => {
    setFeedbackModal({ message: nextMessage, tone });
  };

  const refreshGymOperationsData = async () => {
    const keys = [
      queryKeys.adminBookings(),
      queryKeys.staffAppointments(),
      queryKeys.staffBookings(),
      queryKeys.staffBookings("all"),
      queryKeys.staffCoaches(),
      queryKeys.staffUsers(),
      queryKeys.recurringCoachingPlanSessions(),
      queryKeys.venues(),
      queryKeys.analyticsSnapshot(),
      queryKeys.analyticsOverview(),
    ];

    await Promise.all(
      keys.map((queryKey) => queryClient.invalidateQueries({ queryKey })),
    );
    await Promise.all(
      keys.map((queryKey) =>
        queryClient.refetchQueries({ queryKey, type: "active" }),
      ),
    );
    showFeedback("Gym Operations data refreshed.");
  };

  const [weekStart, setWeekStart] = useState(() => getWeekStart(new Date()));
  const [slideKey, setSlideKey] = useState(0);
  const [slideDir, setSlideDir] = useState<"left" | "right">("right");
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [activeOperationsTab, setActiveOperationsTab] =
    useState<GymOperationsTab>(() =>
      normalizeOperationsTab(searchParams.get("tab"), canManageCoaching),
    );
  const [activeScheduleSurfaceTab, setActiveScheduleSurfaceTab] =
    useState<ScheduleSurfaceTab>(() =>
      normalizeScheduleSurfaceTab(
        searchParams.get("schedule_view"),
        canViewVenueBookings,
      ),
    );
  const [scheduleRangeMode, setScheduleRangeMode] =
    useState<ScheduleRangeMode>("weekly");
  const { style: slideStyle } = usePowerSlide(slideKey, slideDir);

  const prevWeek = () => {
    setSlideDir("left");
    setSlideKey((key) => key + 1);
    setWeekStart((date) => addDays(date, scheduleRangeMode === "weekly" ? -7 : -1));
  };

  const nextWeek = () => {
    setSlideDir("right");
    setSlideKey((key) => key + 1);
    setWeekStart((date) => addDays(date, scheduleRangeMode === "weekly" ? 7 : 1));
  };

  const weekDays = useMemo(
    () => Array.from({ length: 7 }, (_, index) => addDays(weekStart, index)),
    [weekStart],
  );
  const visibleTimelineDays = useMemo(
    () => (scheduleRangeMode === "weekly" ? weekDays : [weekStart]),
    [scheduleRangeMode, weekDays, weekStart],
  );
  const visibleTimelineHours = SCHEDULE_TIMELINE_HOURS;

  const [coachVisibilityScope, setCoachVisibilityScope] =
    useState<CoachVisibilityScope>("all");
  const [manualBookings, setManualBookings] = useState<Booking[]>([]);
  const [bookingOverrides, setBookingOverrides] = useState<
    Record<string, Pick<Booking, "date" | "startHour" | "startMinute">>
  >({});
  const [draggingCoach, setDraggingCoach] = useState<Resource | null>(null);
  const [draggingBooking, setDraggingBooking] = useState<Booking | null>(null);
  const [coachFilterId, setCoachFilterId] = useState<string | null>(null);
  const [appointmentStatusFilter, setAppointmentStatusFilter] = useState("all");
  const [venueFilterId, setVenueFilterId] = useState("all");
  const [venueStatusFilter, setVenueStatusFilter] = useState("all");
  const [venueStartCalendarOpen, setVenueStartCalendarOpen] = useState(false);
  const [venueEndCalendarOpen, setVenueEndCalendarOpen] = useState(false);
  const [availabilityEditorCoachId, setAvailabilityEditorCoachId] = useState<
    string | null
  >(null);
  const [profileEditorCoachId, setProfileEditorCoachId] = useState<
    string | null
  >(null);
  const [appointmentReviewTarget, setAppointmentReviewTarget] =
    useState<StaffAppointmentRecord | null>(null);
  const [venueReviewTarget, setVenueReviewTarget] =
    useState<VenueBookingRecord | null>(null);
  const [createVenueBookingOpen, setCreateVenueBookingOpen] = useState(false);
  const [createCoachBookingOpen, setCreateCoachBookingOpen] = useState(false);
  const [createCoachOpen, setCreateCoachOpen] = useState(false);
  const [recurringPlanOpen, setRecurringPlanOpen] = useState(false);
  const [recurringPlanForm, setRecurringPlanForm] =
    useState<RecurringPlanFormState>(() => createDefaultRecurringPlanForm());
  const [recurringPlanPreview, setRecurringPlanPreview] =
    useState<RecurringCoachingPlanPreviewResult | null>(null);
  const [recurringPlanAction, setRecurringPlanAction] =
    useState<RecurringPlanActionState | null>(null);
  const [recurringActionDate, setRecurringActionDate] = useState("");
  const [recurringActionTime, setRecurringActionTime] = useState("09:00");
  const [recurringActionCoachId, setRecurringActionCoachId] = useState("");
  const [recurringActionDays, setRecurringActionDays] = useState<number[]>([]);
  const [recurringActionReason, setRecurringActionReason] = useState("");
  const [paymentConfirm, setPaymentConfirm] =
    useState<PaymentConfirmState | null>(null);

  const { data: staffCoachProfiles = [] } = useQuery({
    ...staffCoachesQueryOptions(webApiClient),
    enabled: canManageCoaching,
    staleTime: 60_000,
  });
  const { data: coachSelfProfile = null } = useQuery({
    ...coachSelfProfileQueryOptions<CoachProfileRecord>(webApiClient, user?.id),
    enabled: isCoach && Boolean(user?.id),
    staleTime: 60_000,
  });
  const coachProfiles = useMemo(
    () =>
      isCoach
        ? coachSelfProfile
          ? [coachSelfProfile]
          : []
        : staffCoachProfiles,
    [coachSelfProfile, isCoach, staffCoachProfiles],
  );
  const { data: staffUsers = [] } = useQuery({
    ...staffUsersQueryOptions(webApiClient),
    enabled: canManageCoaching,
    staleTime: 60_000,
  });
  const { data: venues = [] } = useQuery({
    ...venuesQueryOptions(webApiClient),
    enabled: canManageCoaching,
    staleTime: 60_000,
  });

  const appointmentFilters = useMemo(
    () => ({
      limit: 100,
      page: 1,
      ...(activeOperationsTab === "appointments"
        ? {}
        : {
            startDate: toYmd(visibleTimelineDays[0] ?? weekStart),
            endDate: toYmd(
              visibleTimelineDays[visibleTimelineDays.length - 1] ?? weekStart,
            ),
          }),
      ...(coachFilterId ? { coachId: coachFilterId } : {}),
      ...(appointmentStatusFilter !== "all" &&
      appointmentStatusFilter !== "pending_full_payment"
        ? { status: appointmentStatusFilter }
        : {}),
    }),
    [
      activeOperationsTab,
      appointmentStatusFilter,
      coachFilterId,
      visibleTimelineDays,
      weekStart,
    ],
  );

  const rosterAppointmentFilters = useMemo(
    () => ({
      limit: 100,
      page: 1,
      startDate: toYmd(visibleTimelineDays[0] ?? weekStart),
      endDate: toYmd(
        visibleTimelineDays[visibleTimelineDays.length - 1] ?? weekStart,
      ),
    }),
    [visibleTimelineDays, weekStart],
  );

  const {
    data: appointmentResult = EMPTY_APPOINTMENT_RESULT,
    isLoading: staffAppointmentsLoading,
  } = useQuery({
    ...staffAppointmentsQueryOptions<StaffAppointmentRecord>(
      webApiClient,
      appointmentFilters,
    ),
    enabled: canManageCoaching,
    staleTime: 30_000,
  });
  const { data: rosterAppointmentResult = EMPTY_APPOINTMENT_RESULT } = useQuery(
    {
      ...staffAppointmentsQueryOptions<StaffAppointmentRecord>(
        webApiClient,
        rosterAppointmentFilters,
      ),
      enabled: canManageCoaching,
      staleTime: 30_000,
    },
  );
  const {
    data: coachScheduleAppointments = [],
    isLoading: coachScheduleLoading,
  } = useQuery({
    ...coachScheduleQueryOptions<StaffAppointmentRecord>(
      webApiClient,
      user?.id,
    ),
    enabled: isCoach && Boolean(user?.id),
    staleTime: 30_000,
  });
  const appointmentRows = isCoach
    ? coachScheduleAppointments
    : appointmentResult.data;
  const rosterAppointmentRows = isCoach
    ? coachScheduleAppointments
    : rosterAppointmentResult.data;
  const appointmentsLoading = isCoach
    ? coachScheduleLoading
    : staffAppointmentsLoading;

  const replaceAvailabilityMutation = useMutation(
    replaceStaffCoachAvailabilityMutationOptions(webApiClient, queryClient),
  );
  const respondAppointmentMutation = useMutation(
    respondToStaffAppointmentMutationOptions(webApiClient, queryClient),
  );
  const confirmCoachAppointmentMutation = useMutation(
    confirmCoachAppointmentMutationOptions(webApiClient, queryClient),
  );
  const declineCoachAppointmentMutation = useMutation(
    declineCoachAppointmentMutationOptions(webApiClient, queryClient),
  );
  const completeAppointmentMutation = useMutation(
    completeStaffAppointmentMutationOptions(webApiClient, queryClient),
  );
  const completeCoachAppointmentMutation = useMutation(
    completeCoachAppointmentMutationOptions(webApiClient, queryClient),
  );
  const saveCoachFeedbackMutation = useMutation({
    mutationFn: ({
      appointmentId,
      payload,
    }: {
      appointmentId: string;
      payload: SubmitCoachAppointmentFeedbackPayload;
    }) => webApiClient.coaches.submitAppointmentFeedback(appointmentId, payload),
  });
  const cancelAppointmentMutation = useMutation(
    cancelStaffAppointmentMutationOptions(webApiClient, queryClient),
  );
  const cancelCoachAppointmentMutation = useMutation(
    cancelAppointmentMutationOptions(webApiClient, queryClient),
  );
  const updateCoachProfileMutation = useMutation(
    updateStaffCoachProfileMutationOptions(webApiClient, queryClient),
  );
  const updateCoachSelfProfileMutation = useMutation(
    updateCoachProfileMutationOptions(webApiClient, queryClient),
  );
  const createVenueBookingMutation = useMutation(
    createStaffBookingMutationOptions(webApiClient, queryClient),
  );
  const createCoachBookingMutation = useMutation(
    createStaffAppointmentMutationOptions(webApiClient, queryClient),
  );
  const createCoachMutation = useMutation(
    createStaffCoachMutationOptions(webApiClient, queryClient),
  );
  const previewRecurringPlanMutation = useMutation(
    previewRecurringCoachingPlanMutationOptions(webApiClient),
  );
  const createRecurringPlanMutation = useMutation(
    createRecurringCoachingPlanMutationOptions(webApiClient, queryClient),
  );
  const updateRecurringSessionMutation = useMutation(
    updateRecurringCoachingSessionMutationOptions(webApiClient, queryClient),
  );
  const bulkUpdateRecurringSessionsMutation = useMutation(
    bulkUpdateRecurringCoachingSessionsMutationOptions(
      webApiClient,
      queryClient,
    ),
  );
  const cancelRecurringPlanMutation = useMutation(
    cancelRecurringCoachingPlanMutationOptions(webApiClient, queryClient),
  );
  const processAppointmentBalanceMutation = useMutation(
    processAppointmentBalanceMutationOptions(webApiClient, queryClient),
  );
  const markCoachPayoutPaidMutation = useMutation(
    markCoachPayoutPaidMutationOptions(webApiClient, queryClient),
  );
  const processBookingBalanceMutation = useMutation(
    processBookingBalanceMutationOptions(webApiClient, queryClient),
  );
  const payRecurringCycleMutation = useMutation(
    payRecurringCoachingBillingCycleMutationOptions(webApiClient, queryClient),
  );
  const payAppointmentInitialMutation = useMutation(
    payAppointmentDownpaymentMutationOptions(webApiClient, queryClient),
  );
  const verifyPaymentMutation = useMutation(
    verifyMembershipPaymentMutationOptions(webApiClient, queryClient),
  );
  const respondAppointmentPending =
    respondAppointmentMutation.isPending ||
    confirmCoachAppointmentMutation.isPending ||
    declineCoachAppointmentMutation.isPending;
  const completeAppointmentPending =
    completeAppointmentMutation.isPending ||
    completeCoachAppointmentMutation.isPending;
  const cancelAppointmentPending =
    cancelAppointmentMutation.isPending ||
    cancelCoachAppointmentMutation.isPending;
  const updateCoachProfilePending =
    updateCoachProfileMutation.isPending ||
    updateCoachSelfProfileMutation.isPending;

  const coachRoster = useMemo(
    () => mapCoachesToRoster(coachProfiles),
    [coachProfiles],
  );

  const coachOptions = useMemo(
    () =>
      coachRoster
        .filter((coach) => coach.isActive)
        .map((coach) => ({
          hourlyRate: coach.hourlyRate ?? 0,
          label: coach.name,
          value: coach.id,
        })),
    [coachRoster],
  );
  const memberOptions = useMemo(
    () =>
      (staffUsers as MemberRecord[])
        .filter(isBookableOperationsMember)
        .map((member) => {
          const label = getPersonDisplayName(
            member.profile,
            member.email,
            "Member",
          );
          return { label, value: member.id };
        }),
    [staffUsers],
  );
  const coachAppointments = useMemo(
    () =>
      appointmentStatusFilter === "pending_full_payment"
        ? appointmentRows.filter(isPendingFullCoachPayment)
        : appointmentRows,
    [appointmentRows, appointmentStatusFilter],
  );
  const activeRecurringPlanId =
    recurringPlanAction?.appointment.recurringPlanId ??
    appointmentReviewTarget?.recurringPlanId ??
    null;
  const { data: recurringPlanSessions } = useQuery({
    ...recurringCoachingPlanSessionsQueryOptions(
      webApiClient,
      activeRecurringPlanId ?? "pending",
    ),
    enabled: isAdmin && Boolean(activeRecurringPlanId),
    staleTime: 20_000,
  });
  const recurringSessionRows = recurringPlanSessions?.sessions ?? [];
  const recurringCompletedCount = recurringSessionRows.filter(
    (session) =>
      session.status === "completed" || session.recurringState === "completed",
  ).length;
  const recurringRemainingCount = recurringSessionRows.filter(
    (session) =>
      session.status !== "completed" &&
      session.status !== "cancelled" &&
      session.recurringState !== "completed" &&
      session.recurringState !== "cancelled" &&
      session.recurringState !== "skipped",
  ).length;
  const recurringCreateBusy =
    previewRecurringPlanMutation.isPending ||
    createRecurringPlanMutation.isPending;
  const recurringActionBusy =
    updateRecurringSessionMutation.isPending ||
    bulkUpdateRecurringSessionsMutation.isPending ||
    cancelRecurringPlanMutation.isPending;
  const paymentConfirmLoading =
    payAppointmentInitialMutation.isPending ||
    processAppointmentBalanceMutation.isPending ||
    payRecurringCycleMutation.isPending ||
    processBookingBalanceMutation.isPending ||
    verifyPaymentMutation.isPending;
  const recurringPlanMinStartDate = getDefaultDateInput();
  const recurringPlanStartDateInvalid =
    !recurringPlanForm.startDate ||
    recurringPlanForm.startDate < recurringPlanMinStartDate;
  const recurringPlanInputInvalid =
    !recurringPlanForm.memberId ||
    !recurringPlanForm.coachId ||
    recurringPlanStartDateInvalid ||
    !recurringPlanForm.preferredTime ||
    recurringPlanForm.preferredDays.length === 0;
  const recurringPreviewConflictOverrides = useMemo(
    () =>
      recurringPlanPreview?.sessions
        .filter((session) => session.conflict)
        .map((session) => ({
          action: "skip" as const,
          reason: "Skipped during recurring plan conflict review.",
          scheduledAt: session.scheduledAt,
        })) ?? [],
    [recurringPlanPreview],
  );
  const appointmentBookings = useMemo<Booking[]>(
    () =>
      coachAppointments.map((appointment) =>
        mapAppointmentToTimelineBooking(appointment, colors),
      ),
    [coachAppointments, colors],
  );

  const rosterAppointmentBookings = useMemo<Booking[]>(
    () =>
      rosterAppointmentRows.map((appointment) =>
        mapAppointmentToTimelineBooking(appointment, colors),
      ),
    [colors, rosterAppointmentRows],
  );

  const allBookings = useMemo(
    () =>
      [...appointmentBookings, ...manualBookings].map((booking) => {
        const override = bookingOverrides[booking.id];
        return override ? { ...booking, ...override } : booking;
      }),
    [appointmentBookings, bookingOverrides, manualBookings],
  );

  const rosterBookings = useMemo(
    () =>
      [...rosterAppointmentBookings, ...manualBookings].map((booking) => {
        const override = bookingOverrides[booking.id];
        return override ? { ...booking, ...override } : booking;
      }),
    [bookingOverrides, manualBookings, rosterAppointmentBookings],
  );

  const filteredStaff = useMemo(
    () =>
      coachRoster.filter((coach) => {
        if (coachVisibilityScope === "visible" && !coach.isActive) {
          return false;
        }
        if (coachVisibilityScope === "hidden" && coach.isActive) {
          return false;
        }
        return true;
      }),
    [coachRoster, coachVisibilityScope],
  );

  const defaultCoachId = coachRoster[0]?.id ?? null;
  const focusedCoachId = coachFilterId ?? defaultCoachId;
  const selectedCoachProfile = useMemo(
    () => coachProfiles.find((coach) => coach.id === focusedCoachId) ?? null,
    [coachProfiles, focusedCoachId],
  );
  const selectedCoachRoster = useMemo(
    () => coachRoster.find((coach) => coach.id === focusedCoachId) ?? null,
    [coachRoster, focusedCoachId],
  );
  const focusedCoachScheduleBookings = useMemo(
    () =>
      allBookings.filter((booking) =>
        focusedCoachId ? booking.resourceId === focusedCoachId : true,
      ),
    [allBookings, focusedCoachId],
  );
  const availabilityEditorCoach = useMemo(
    () =>
      coachProfiles.find((coach) => coach.id === availabilityEditorCoachId) ??
      null,
    [availabilityEditorCoachId, coachProfiles],
  );
  const profileEditorCoach = useMemo(
    () =>
      coachProfiles.find((coach) => coach.id === profileEditorCoachId) ?? null,
    [coachProfiles, profileEditorCoachId],
  );
  const reviewCoachProfile = useMemo(
    () =>
      appointmentReviewTarget
        ? (coachProfiles.find(
            (coach) => coach.id === appointmentReviewTarget.coachId,
          ) ?? null)
        : null,
    [appointmentReviewTarget, coachProfiles],
  );
  const appointmentReviewReadiness = useMemo(
    () => ({
      isVisible: reviewCoachProfile?.isActive ?? true,
      openPeakSlots: Math.max(
        0,
        (reviewCoachProfile?.availability?.length ?? 0) -
          coachAppointments.filter(
            (appointment) =>
              appointment.coachId === appointmentReviewTarget?.coachId &&
              (appointment.status === "confirmed" ||
                appointment.status === "pending_coach"),
          ).length,
      ),
      trustLabel:
        (reviewCoachProfile?.certifications?.length ?? 0) > 0
          ? "clear"
          : "review",
    }),
    [appointmentReviewTarget?.coachId, coachAppointments, reviewCoachProfile],
  );

  const appointmentSummary = useMemo(
    () => ({
      visible: coachAppointments.length,
      pendingCoach: coachAppointments.filter(
        (appointment) => appointment.status === "pending_coach",
      ).length,
      confirmed: coachAppointments.filter(
        (appointment) => appointment.status === "confirmed",
      ).length,
      completed: coachAppointments.filter(
        (appointment) => appointment.status === "completed",
      ).length,
    }),
    [coachAppointments],
  );

  useEffect(() => {
    setRecurringPlanForm((current) => {
      const nextCoachId = coachOptions.some(
        (coach) => coach.value === current.coachId,
      )
        ? current.coachId
        : coachOptions[0]?.value || "";
      const nextMemberId = current.memberId || memberOptions[0]?.value || "";

      if (
        current.coachId === nextCoachId &&
        current.memberId === nextMemberId
      ) {
        return current;
      }

      return {
        ...current,
        coachId: nextCoachId,
        memberId: nextMemberId,
      };
    });
  }, [coachOptions, memberOptions]);

  useEffect(() => {
    if (!recurringPlanAction) return;
    const start = new Date(recurringPlanAction.appointment.scheduledAt);
    setRecurringActionDate(toYmd(start));
    setRecurringActionTime(
      `${String(start.getHours()).padStart(2, "0")}:${String(
        start.getMinutes(),
      ).padStart(2, "0")}`,
    );
    setRecurringActionCoachId(
      coachOptions.some(
        (coach) => coach.value === recurringPlanAction.appointment.coachId,
      )
        ? recurringPlanAction.appointment.coachId
        : coachOptions[0]?.value || "",
    );
    setRecurringActionDays([start.getDay()]);
    setRecurringActionReason("");
  }, [coachOptions, recurringPlanAction]);

  const sensors = useFitSensors();

  const handleDragStart = (event: DragStartEvent) => {
    const activeData = event.active.data.current as
      | { kind?: "coach"; coachId?: string }
      | { kind?: "booking"; bookingId?: string }
      | undefined;

    if (activeData?.kind === "coach" && activeData.coachId) {
      const coach = coachRoster.find(
        (resource) => resource.id === activeData.coachId,
      );
      if (coach) setDraggingCoach(coach);
      return;
    }

    if (activeData?.kind === "booking" && activeData.bookingId) {
      const booking = allBookings.find(
        (item) => item.id === activeData.bookingId,
      );
      if (booking) setDraggingBooking(booking);
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setDraggingCoach(null);
    setDraggingBooking(null);
    if (!event.over || !canManageCoaching) return;
    const [dayIndexValue, hourValue] = String(event.over.id).split(":");
    const dayIndex = Number(dayIndexValue);
    const hour = Number(hourValue);
    const activeData = event.active.data.current as
      | { kind?: "coach"; coachId?: string }
      | { kind?: "booking"; bookingId?: string }
      | undefined;
    if (Number.isNaN(dayIndex) || Number.isNaN(hour)) return;
    const targetDay = visibleTimelineDays[dayIndex];
    if (!targetDay) return;

    if (activeData?.kind === "coach" && activeData.coachId) {
      const coach = coachRoster.find(
        (resource) => resource.id === activeData.coachId,
      );
      if (!coach) return;
      const booking = buildManualBooking(
        coach,
        targetDay,
        hour,
        colors.brand,
      );
      setManualBookings((previous) => [...previous, booking]);
      showFeedback(
        `${coach.name} assigned to ${targetDay.toLocaleDateString(
          "en-US",
          {
            weekday: "short",
          },
        )} ${hour}:00`,
      );
      return;
    }

    if (activeData?.kind === "booking" && activeData.bookingId) {
      const booking = allBookings.find(
        (item) => item.id === activeData.bookingId,
      );
      if (!booking) return;
      const nextDate = toYmd(targetDay);
      if (booking.date === nextDate && booking.startHour === hour) return;
      setBookingOverrides((previous) => ({
        ...previous,
        [booking.id]: {
          date: nextDate,
          startHour: hour,
          startMinute: 0,
        },
      }));
      showFeedback(
        `${booking.resourceName} moved to ${targetDay.toLocaleDateString("en-US", {
          weekday: "short",
        })} ${hour}:00`,
      );
    }
  };

  const [activeCoachId, setActiveCoachId] = useState<string | null>(null);
  const [coachDetailsOpen, setCoachDetailsOpen] = useState(false);

  const handleStaffClick = (coachId: string) => {
    setActiveCoachId(coachId);
    setCoachFilterId(coachId);
    setCoachDetailsOpen(true);
  };

  const handleCoachFocus = (coachId: string) => {
    setCoachFilterId(coachId);
    setActiveCoachId(null);
    setCoachDetailsOpen(false);
  };

  const [activeBlock, setActiveBlock] = useState<Booking | null>(null);
  const [blockDetailOpen, setBlockDetailOpen] = useState(false);

  const handleBlockClick = (block: Booking) => {
    if (block.source === "api") {
      const appointment = coachAppointments.find(
        (record) => record.id === block.id,
      );
      if (appointment) {
        setAppointmentReviewTarget(appointment);
        return;
      }
    }
    setActiveBlock(block);
    setBlockDetailOpen(true);
  };

  const handleBlockSave = (updated: Booking) => {
    setManualBookings((previous) =>
      previous.map((booking) =>
        booking.id === updated.id ? updated : booking,
      ),
    );
    setBlockDetailOpen(false);
    setActiveBlock(null);
  };

  const handleBlockDelete = (id: string) => {
    setManualBookings((previous) =>
      previous.filter((booking) => booking.id !== id),
    );
    setBlockDetailOpen(false);
    setActiveBlock(null);
  };

  const leftRailRef = useRef<HTMLElement | null>(null);
  const rightScrollRef = useRef<HTMLDivElement | null>(null);
  const [leftMaxHeight, setLeftMaxHeight] = useState<number | null>(null);
  const [rightMaxHeight, setRightMaxHeight] = useState<number | null>(null);
  const [coachRailAsRow, setCoachRailAsRow] = useState(false);
  const scheduleRosterMaxHeight = useMemo(
    () => leftMaxHeight ?? 548,
    [leftMaxHeight],
  );
  const scheduleTimelineMaxHeight = useMemo(
    () => rightMaxHeight ?? 548,
    [rightMaxHeight],
  );
  const coachRosterMaxHeight = useMemo(
    () => leftMaxHeight ?? 548,
    [leftMaxHeight],
  );
  const canAnimate = settings.animationLevel !== "none";
  useEffect(() => {
    if (!coachFilterId) return;
    if (coachRoster.some((coach) => coach.id === coachFilterId)) return;
    setCoachFilterId(null);
  }, [coachFilterId, coachRoster]);

  useEffect(() => {
    const recalc = () => {
      const availableWidth =
        window.screen?.availWidth || window.screen?.width || window.innerWidth;
      const viewportWidth = window.outerWidth || window.innerWidth;
      setCoachRailAsRow(
        viewportWidth <= availableWidth * 0.62 || window.innerWidth <= 1180,
      );
      const logoutButton = document.querySelector(
        'button[aria-label="SIGN OUT"]',
      ) as HTMLElement | null;
      if (!logoutButton) return;
      const bottom = logoutButton.getBoundingClientRect().bottom;
      if (leftRailRef.current) {
        setLeftMaxHeight(
          Math.max(
            240,
            Math.floor(
              bottom - leftRailRef.current.getBoundingClientRect().top - 2,
            ),
          ),
        );
      }
      if (rightScrollRef.current) {
        setRightMaxHeight(
          Math.max(
            240,
            Math.floor(
              bottom - rightScrollRef.current.getBoundingClientRect().top - 2,
            ),
          ),
        );
      }
    };

    recalc();
    const resizeObserver = new ResizeObserver(recalc);
    if (leftRailRef.current) resizeObserver.observe(leftRailRef.current);
    if (rightScrollRef.current) resizeObserver.observe(rightScrollRef.current);
    window.addEventListener("resize", recalc);
    return () => {
      resizeObserver.disconnect();
      window.removeEventListener("resize", recalc);
    };
  }, [activeOperationsTab, activeScheduleSurfaceTab]);

  const activeCoach = coachRoster.find((coach) => coach.id === activeCoachId);

  const venueOptions = useMemo(
    () =>
      Array.from(
        new Map([
          ...venues
            .filter(
              (venue) =>
                venue.isActive !== false && venue.isReservable !== false,
            )
            .map(
              (venue) =>
                [
                  String(venue.id),
                  {
                    label: venue.name,
                    value: String(venue.id),
                    hourlyRate: venue.hourlyRate ?? 0,
                  },
                ] as const,
            ),
          ...rawBookings.map(
            (booking) =>
              [
                String(booking.venueId),
                {
                  label: booking.venue?.name ?? `Venue ${booking.venueId}`,
                  value: String(booking.venueId),
                  hourlyRate: booking.venue?.hourlyRate ?? null,
                },
              ] as const,
          ),
        ]).values(),
      ),
    [rawBookings, venues],
  );

  const bookableVenueOptions = useMemo(
    () =>
      venues
        .filter(
          (venue) =>
            venue.isActive !== false && venue.isReservable !== false,
        )
        .map((venue) => ({
          label: venue.name,
          value: String(venue.id),
          hourlyRate: venue.hourlyRate ?? 0,
        })),
    [venues],
  );

  const venueFilterOptions = useMemo(
    () => [{ label: "All venues", value: "all" }, ...venueOptions],
    [venueOptions],
  );
  const selectedVenueFilterLabel = useMemo(
    () =>
      venueFilterOptions.find((option) => option.value === venueFilterId)
        ?.label ?? "this venue",
    [venueFilterId, venueFilterOptions],
  );
  const venueBookingDateLabel =
    bookingDateRange.startDate && bookingDateRange.endDate
      ? `between ${bookingDateRange.startDate} and ${bookingDateRange.endDate}`
      : bookingDateRange.startDate
        ? `from ${bookingDateRange.startDate}`
        : bookingDateRange.endDate
          ? `through ${bookingDateRange.endDate}`
          : "for all dates";

  const handleVenueStartDateSelect = (ymd: string) => {
    if (!ymd) {
      setBookingDateRange((current) => ({
        ...current,
        startDate: undefined,
      }));
      setVenueStartCalendarOpen(false);
      return;
    }

    setBookingDateRange((current) => ({
      ...current,
      startDate: ymd,
      endDate:
        current.endDate && current.endDate < ymd ? ymd : current.endDate,
    }));
  };

  const handleVenueEndDateSelect = (ymd: string) => {
    if (!ymd) {
      setBookingDateRange((current) => ({
        ...current,
        endDate: undefined,
      }));
      setVenueEndCalendarOpen(false);
      return;
    }

    setBookingDateRange((current) => ({
      ...current,
      startDate:
        current.startDate && current.startDate > ymd
          ? ymd
          : current.startDate,
      endDate: ymd,
    }));
  };

  const clearVenueBookingDateRange = () => {
    setBookingDateRange({});
  };

  const filteredVenueBookings = useMemo(
    () =>
      rawBookings.filter((booking) => {
        if (
          venueFilterId !== "all" &&
          String(booking.venueId) !== venueFilterId
        ) {
          return false;
        }
        if (
          venueStatusFilter !== "all" &&
          booking.status !== venueStatusFilter
        ) {
          return false;
        }
        const bookingDate = booking.startTime.slice(0, 10);
        if (
          bookingDateRange.startDate &&
          bookingDate < bookingDateRange.startDate
        ) {
          return false;
        }
        if (bookingDateRange.endDate && bookingDate > bookingDateRange.endDate) {
          return false;
        }
        return true;
      }),
    [
      bookingDateRange.endDate,
      bookingDateRange.startDate,
      rawBookings,
      venueFilterId,
      venueStatusFilter,
    ],
  );

  const venueBookingSummary = useMemo(
    () => ({
      visible: filteredVenueBookings.length,
      pending: filteredVenueBookings.filter(
        (booking) => booking.status === "pending",
      ).length,
      confirmed: filteredVenueBookings.filter(
        (booking) => booking.status === "confirmed",
      ).length,
      activeVenues: new Set(
        filteredVenueBookings.map((booking) => booking.venueId),
      ).size,
    }),
    [filteredVenueBookings],
  );

  useEffect(() => {
    const requestedTab = normalizeOperationsTab(
      searchParams.get("tab"),
      canManageCoaching,
    );
    const requestedScheduleSurface = normalizeScheduleSurfaceTab(
      searchParams.get("schedule_view"),
      canViewVenueBookings,
    );

    setActiveOperationsTab((currentTab) =>
      currentTab === requestedTab ? currentTab : requestedTab,
    );
    setActiveScheduleSurfaceTab((currentTab) =>
      currentTab === requestedScheduleSurface
        ? currentTab
        : requestedScheduleSurface,
    );
  }, [canManageCoaching, canViewVenueBookings, searchParams]);

  useEffect(() => {
    const currentQueryTab = searchParams.get("tab");
    const normalizedTab = normalizeOperationsTab(
      currentQueryTab,
      canManageCoaching,
    );

    if (activeOperationsTab === normalizedTab) return;

    const nextParams = new URLSearchParams(searchParams.toString());
    if (activeOperationsTab === "schedule") {
      nextParams.delete("tab");
    } else {
      nextParams.set("tab", activeOperationsTab);
    }

    const nextQuery = nextParams.toString();
    router.replace(nextQuery ? `${pathname}?${nextQuery}` : pathname, {
      scroll: false,
    });
  }, [activeOperationsTab, canManageCoaching, pathname, router, searchParams]);

  useEffect(() => {
    const currentSurfaceParam = searchParams.get("schedule_view");
    const normalizedSurfaceParam =
      normalizeScheduleSurfaceTab(currentSurfaceParam, canViewVenueBookings);

    if (activeScheduleSurfaceTab === normalizedSurfaceParam) return;

    const nextParams = new URLSearchParams(searchParams.toString());
    if (activeScheduleSurfaceTab === "month-calendar") {
      nextParams.delete("schedule_view");
    } else if (activeScheduleSurfaceTab === "coach-schedule") {
      nextParams.set("schedule_view", "coaches");
    } else {
      nextParams.set("schedule_view", "venues");
    }

    const nextQuery = nextParams.toString();
    router.replace(nextQuery ? `${pathname}?${nextQuery}` : pathname, {
      scroll: false,
    });
  }, [activeScheduleSurfaceTab, canViewVenueBookings, pathname, router, searchParams]);

  const toggleRecurringPlanDay = (day: number) => {
    setRecurringPlanPreview(null);
    setRecurringPlanForm((current) => {
      const exists = current.preferredDays.includes(day);
      const preferredDays = exists
        ? current.preferredDays.filter((value) => value !== day)
        : [...current.preferredDays, day].sort((left, right) => left - right);

      return {
        ...current,
        preferredDays: preferredDays.length > 0 ? preferredDays : [day],
      };
    });
  };

  const toggleRecurringActionDay = (day: number) => {
    setRecurringActionDays((current) => {
      const exists = current.includes(day);
      const next = exists
        ? current.filter((value) => value !== day)
        : [...current, day].sort((left, right) => left - right);
      return next.length > 0 ? next : [day];
    });
  };

  const handlePreviewRecurringPlan = async () => {
    if (recurringPlanInputInvalid) {
      showFeedback(
        "Choose a member, coach, start date today or later, time, and at least one weekday.",
        "danger",
      );
      return;
    }

    try {
      const preview = await previewRecurringPlanMutation.mutateAsync(
        getRecurringInput(recurringPlanForm),
      );
      setRecurringPlanPreview(preview);
      showFeedback(
        preview.conflictCount > 0
          ? `${preview.conflictCount} generated session conflict(s) need review.`
          : `${preview.totalSessions} recurring sessions are clear to confirm.`,
        preview.conflictCount > 0 ? "danger" : "success",
      );
    } catch (error) {
      showFeedback(
        getErrorMessage(error, "Unable to preview recurring coaching plan."),
        "danger",
      );
    }
  };

  const handleConfirmRecurringPlan = async (skipConflicts = false) => {
    if (recurringPlanInputInvalid) {
      showFeedback(
        "Complete the recurring plan details with a start date today or later before confirming.",
        "danger",
      );
      return;
    }
    if (!recurringPlanPreview) {
      showFeedback(
        "Preview the schedule before confirming the plan.",
        "danger",
      );
      return;
    }
    if (recurringPlanPreview.conflictCount > 0 && !skipConflicts) {
      showFeedback(
        "Resolve conflicts first, or confirm while skipping conflicted sessions.",
        "danger",
      );
      return;
    }

    try {
      const result = await createRecurringPlanMutation.mutateAsync(
        getRecurringInput(
          recurringPlanForm,
          skipConflicts ? recurringPreviewConflictOverrides : undefined,
        ),
      );
      showFeedback(
        `Recurring coaching plan created with ${result.sessions.length} session(s).`,
      );
      setRecurringPlanOpen(false);
      setRecurringPlanPreview(null);
      setRecurringPlanForm(createDefaultRecurringPlanForm());
    } catch (error) {
      showFeedback(
        getErrorMessage(error, "Unable to create recurring coaching plan."),
        "danger",
      );
    }
  };

  const handleRecurringSessionReschedule = async () => {
    const appointment = recurringPlanAction?.appointment;
    const planId = appointment?.recurringPlanId;
    if (!appointment || !planId) return;

    try {
      await updateRecurringSessionMutation.mutateAsync({
        input: {
          action: "reschedule",
          coachId: recurringActionCoachId || appointment.coachId,
          newScheduledAt: buildLocalIso(
            recurringActionDate,
            recurringActionTime,
          ),
          reason: recurringActionReason || undefined,
        },
        planId,
        sessionId: appointment.id,
      });
      showFeedback("Recurring session updated.");
      setRecurringPlanAction(null);
      setAppointmentReviewTarget(null);
    } catch (error) {
      showFeedback(
        getErrorMessage(error, "Unable to reschedule recurring session."),
        "danger",
      );
    }
  };

  const handleRecurringSessionSkip = async () => {
    const appointment = recurringPlanAction?.appointment;
    const planId = appointment?.recurringPlanId;
    if (!appointment || !planId) return;

    try {
      await updateRecurringSessionMutation.mutateAsync({
        input: {
          action: "skip",
          reason: recurringActionReason || "Skipped from Gym Operations.",
        },
        planId,
        sessionId: appointment.id,
      });
      showFeedback("Recurring session skipped.");
      setRecurringPlanAction(null);
      setAppointmentReviewTarget(null);
    } catch (error) {
      showFeedback(
        getErrorMessage(error, "Unable to skip recurring session."),
        "danger",
      );
    }
  };

  const handleRecurringFutureUpdate = async () => {
    const appointment = recurringPlanAction?.appointment;
    const planId = appointment?.recurringPlanId;
    if (!appointment || !planId) return;

    try {
      const result = await bulkUpdateRecurringSessionsMutation.mutateAsync({
        input: {
          coachId: recurringActionCoachId || appointment.coachId,
          fromSessionId: appointment.id,
          preferredDays: recurringActionDays,
          preferredTime: recurringActionTime,
        },
        planId,
      });

      if ("canConfirm" in result && result.conflictCount > 0) {
        showFeedback(
          `${result.conflictCount} future recurring session conflict(s) need manual review.`,
          "danger",
        );
        return;
      }

      showFeedback("Future recurring sessions updated.");
      setRecurringPlanAction(null);
      setAppointmentReviewTarget(null);
    } catch (error) {
      showFeedback(
        getErrorMessage(error, "Unable to update future recurring sessions."),
        "danger",
      );
    }
  };

  const handleRecurringPlanCancel = async () => {
    const appointment = recurringPlanAction?.appointment;
    const planId = appointment?.recurringPlanId;
    if (!appointment || !planId) return;

    try {
      await cancelRecurringPlanMutation.mutateAsync({
        planId,
        reason: recurringActionReason || undefined,
      });
      showFeedback("Recurring coaching plan cancelled.");
      setRecurringPlanAction(null);
      setAppointmentReviewTarget(null);
    } catch (error) {
      showFeedback(
        getErrorMessage(error, "Unable to cancel recurring coaching plan."),
        "danger",
      );
    }
  };

  const handleConfirmAppointment = async () => {
    if (!appointmentReviewTarget) return;

    try {
      if (isCoach) {
        await confirmCoachAppointmentMutation.mutateAsync({
          appointmentId: appointmentReviewTarget.id,
          userId: user?.id,
        });
      } else {
        await respondAppointmentMutation.mutateAsync({
          accepted: true,
          appointmentId: appointmentReviewTarget.id,
          coachId: appointmentReviewTarget.coachId,
        });
      }
      showFeedback("Coach appointment confirmed.");
      setAppointmentReviewTarget(null);
    } catch (error) {
      showFeedback(
        getErrorMessage(error, "Unable to confirm coach appointment."),
        "danger",
      );
    }
  };

  const handleRejectAppointment = async (
    appointment: StaffAppointmentRecord,
    value: string,
  ) => {
    try {
      if (isCoach) {
        await declineCoachAppointmentMutation.mutateAsync({
          appointmentId: appointment.id,
          reason: value,
          userId: user?.id,
        });
      } else {
        await respondAppointmentMutation.mutateAsync({
          accepted: false,
          appointmentId: appointment.id,
          coachId: appointment.coachId,
          reason: value,
        });
      }
      showFeedback("Coach appointment rejected.");
      setAppointmentReviewTarget(null);
    } catch (error) {
      showFeedback(
        getErrorMessage(error, "Unable to reject coach appointment."),
        "danger",
      );
    }
  };

  const handleCancelAppointment = async (
    appointment: StaffAppointmentRecord,
    value: string,
  ) => {
    try {
      if (isCoach) {
        await cancelCoachAppointmentMutation.mutateAsync({
          appointmentId: appointment.id,
          cancelReason: value,
          userId: user?.id,
        });
      } else {
        await cancelAppointmentMutation.mutateAsync({
          appointmentId: appointment.id,
          coachId: appointment.coachId,
          reason: value,
        });
      }
      showFeedback("Coach appointment cancelled.");
      setAppointmentReviewTarget(null);
    } catch (error) {
      showFeedback(
        getErrorMessage(error, "Unable to cancel coach appointment."),
        "danger",
      );
    }
  };

  const handleCompleteAppointment = async (
    appointment: StaffAppointmentRecord,
    value:
      | string
      | {
          assessmentReport?: string;
          coachFeedback?: string;
          sessionNotes?: string;
        },
  ) => {
    const payload =
      typeof value === "string"
        ? { sessionNotes: value || undefined }
        : {
            assessmentReport: value.assessmentReport || undefined,
            coachFeedback: value.coachFeedback || undefined,
            sessionNotes: value.sessionNotes || undefined,
          };

    try {
      if (isCoach) {
        await completeCoachAppointmentMutation.mutateAsync({
          appointmentId: appointment.id,
          userId: user?.id,
          ...payload,
        });
      } else {
        await completeAppointmentMutation.mutateAsync({
          appointmentId: appointment.id,
          coachId: appointment.coachId,
          ...payload,
        });
      }
      showFeedback("Coach appointment marked complete.");
      setAppointmentReviewTarget(null);
    } catch (error) {
      showFeedback(
        getErrorMessage(error, "Unable to complete coach appointment."),
        "danger",
      );
    }
  };

  const executeCollectAppointmentInitialPayment = async (
    appointment: StaffAppointmentRecord,
    provider: PaymentCollectionProvider,
    paymentStage: "downpayment" | "full",
  ) => {
    try {
      const result = await payAppointmentInitialMutation.mutateAsync({
        appointmentId: appointment.id,
        paymentStage,
        provider,
        userId: appointment.userId,
      });

      if (provider === "cash" && result.paymentId) {
        showFeedback(
          paymentStage === "full"
            ? "Coach full cash payment recorded for approval."
            : "Coach cash downpayment recorded for approval.",
        );
        await Promise.all([
          queryClient.invalidateQueries({
            queryKey: queryKeys.staffAppointments(),
          }),
          queryClient.invalidateQueries({
            queryKey: queryKeys.membershipReviewPayments(),
          }),
          queryClient.invalidateQueries({
            queryKey: queryKeys.appointments(),
          }),
        ]);
        setAppointmentReviewTarget(null);
        return;
      }

      if (result.checkoutUrl) {
        window.open(result.checkoutUrl, "_blank", "noopener,noreferrer");
        showFeedback("PayMongo coach checkout opened.");
        return;
      }

      showFeedback("Coach payment request updated.");
    } catch (error) {
      showFeedback(
        getErrorMessage(error, "Unable to collect coach payment."),
        "danger",
      );
    }
  };

  const requestCollectAppointmentInitialPayment = (
    appointment: StaffAppointmentRecord,
    provider: PaymentCollectionProvider,
    paymentStage: "downpayment" | "full",
  ) => {
    const stageLabel =
      paymentStage === "full" ? "full payment" : "downpayment";
    const providerLabel = provider === "cash" ? "cash" : "PayMongo";
    setPaymentConfirm({
      kind: "coachInitial",
      appointment,
      provider,
      paymentStage,
      title: "Confirm coach payment",
      message: `Continue with ${providerLabel} ${stageLabel} for this coach appointment?`,
      confirmLabel:
        provider === "cash"
          ? paymentStage === "full"
            ? "RECORD CASH FULL"
            : "RECORD CASH DOWNPAYMENT"
          : "OPEN PAYMONGO",
    });
  };

  const executeApproveAppointmentPayment = async (
    appointment: StaffAppointmentRecord,
    paymentId: string,
  ) => {
    try {
      await verifyPaymentMutation.mutateAsync({
        affectedUserId: appointment.userId,
        paymentId,
        payload: { action: "approve" },
      });
      showFeedback("Coach appointment payment approved.");
      setAppointmentReviewTarget(null);
    } catch (error) {
      showFeedback(
        getErrorMessage(error, "Unable to approve coach payment."),
        "danger",
      );
    }
  };

  const requestApproveAppointmentPayment = (
    appointment: StaffAppointmentRecord,
    paymentId: string,
  ) => {
    const paymentLabel =
      appointment.activePaymentStage === "full"
        ? "full payment"
        : appointment.activePaymentStage === "balance"
          ? "balance payment"
          : "downpayment";
    setPaymentConfirm({
      kind: "coachPaymentApproval",
      appointment,
      paymentId,
      title: "Approve coach payment",
      message: `Approve the submitted ${paymentLabel} for this coach appointment? The session will move forward only after this approval is recorded.`,
      confirmLabel: "APPROVE PAYMENT",
    });
  };

  const executeCollectAppointmentBalance = async (
    appointment: StaffAppointmentRecord,
    provider: PaymentCollectionProvider,
  ) => {
    try {
      const result = await processAppointmentBalanceMutation.mutateAsync({
        appointmentId: appointment.id,
        provider,
        referenceNo:
          provider === "cash" ? `COACH-BAL-${Date.now()}` : undefined,
        userId: appointment.userId,
      });

      if (provider === "cash" && result.paymentId) {
        await verifyPaymentMutation.mutateAsync({
          affectedUserId: appointment.userId,
          paymentId: result.paymentId,
          payload: { action: "approve" },
        });
        showFeedback("Coach appointment balance accepted.");
        setAppointmentReviewTarget(null);
        return;
      }

      if (result.checkoutUrl) {
        window.open(result.checkoutUrl, "_blank", "noopener,noreferrer");
        showFeedback("PayMongo balance checkout opened.");
        return;
      }

      showFeedback("Coach appointment balance request updated.");
    } catch (error) {
      showFeedback(
        getErrorMessage(error, "Unable to collect coach balance."),
        "danger",
      );
    }
  };

  const requestCollectAppointmentBalance = (
    appointment: StaffAppointmentRecord,
    provider: PaymentCollectionProvider,
  ) => {
    const label =
      provider === "cash"
        ? "accept this cash balance"
        : "open PayMongo balance checkout";
    setPaymentConfirm({
      kind: "coachBalance",
      appointment,
      provider,
      title: "Confirm coach balance",
      message: `Continue and ${label}?`,
      confirmLabel:
        provider === "cash" ? "ACCEPT CASH BALANCE" : "OPEN PAYMONGO",
    });
  };

  const handleSaveAppointmentFeedback = async (
    appointment: StaffAppointmentRecord,
    payload: SubmitCoachAppointmentFeedbackPayload,
  ) => {
    try {
      await saveCoachFeedbackMutation.mutateAsync({
        appointmentId: appointment.id,
        payload,
      });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.coachSchedule(user?.id) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.staffAppointments() }),
        queryClient.invalidateQueries({ queryKey: queryKeys.analyticsSnapshot() }),
      ]);
      showFeedback("Coach feedback saved for this session.");
      setAppointmentReviewTarget((current) =>
        current?.id === appointment.id
          ? {
              ...current,
              assessmentReport: payload.assessmentReport ?? current.assessmentReport,
              coachFeedback: payload.coachFeedback,
            }
          : current,
      );
    } catch (error) {
      showFeedback(
        getErrorMessage(error, "Unable to save coach feedback."),
        "danger",
      );
    }
  };

  const handleMarkCoachPayoutPaid = async (
    appointment: StaffAppointmentRecord,
  ) => {
    try {
      await markCoachPayoutPaidMutation.mutateAsync({
        appointmentId: appointment.id,
        coachId: appointment.coachId,
      });
      showFeedback("Coach payout marked paid.");
    } catch (error) {
      showFeedback(
        getErrorMessage(error, "Unable to mark coach payout paid."),
        "danger",
      );
    }
  };

  const executeRecurringCyclePayment = async (
    cycle: RecurringCoachingBillingCycleRecord,
    provider: PaymentCollectionProvider,
  ) => {
    const planId = cycle.recurringPlanId;
    if (!planId) return;

    if (
      cycle.status === "awaiting_verification" &&
      cycle.paymentId &&
      provider === "cash"
    ) {
      try {
        await verifyPaymentMutation.mutateAsync({
          affectedUserId: appointmentReviewTarget?.userId,
          paymentId: cycle.paymentId,
          payload: { action: "approve" },
        });
        showFeedback("Recurring coach payment approved.");
      } catch (error) {
        showFeedback(
          getErrorMessage(error, "Unable to approve recurring coach payment."),
          "danger",
        );
      }
      return;
    }

    try {
      const result = await payRecurringCycleMutation.mutateAsync({
        cycleId: cycle.id,
        input: {
          provider,
          referenceNo:
            provider === "cash" ? `RECUR-COACH-${Date.now()}` : undefined,
        },
        planId,
      });

      if (provider === "cash") {
        await verifyPaymentMutation.mutateAsync({
          affectedUserId: appointmentReviewTarget?.userId,
          paymentId: result.paymentId,
          payload: { action: "approve" },
        });
        showFeedback("Recurring coach cash payment accepted.");
        return;
      }

      if (result.checkoutUrl) {
        window.open(result.checkoutUrl, "_blank", "noopener,noreferrer");
        showFeedback("PayMongo recurring coach checkout opened.");
        return;
      }

      showFeedback("Recurring coach payment request updated.");
    } catch (error) {
      showFeedback(
        getErrorMessage(error, "Unable to process recurring coach payment."),
        "danger",
      );
    }
  };

  const requestRecurringCyclePayment = (
    cycle: RecurringCoachingBillingCycleRecord,
    provider: PaymentCollectionProvider,
  ) => {
    if (
      cycle.status === "awaiting_verification" &&
      cycle.paymentId &&
      provider === "cash"
    ) {
      setPaymentConfirm({
        kind: "recurringCycle",
        cycle,
        provider,
        title: "Approve recurring cash payment",
        message: "Approve this recurring coach cash payment now?",
        confirmLabel: "APPROVE CASH PAYMENT",
      });
      return;
    }

    const label =
      provider === "cash"
        ? "accept this recurring coach cash payment"
        : "open PayMongo for this recurring coach cycle";
    setPaymentConfirm({
      kind: "recurringCycle",
      cycle,
      provider,
      title: "Confirm recurring coach payment",
      message: `Continue and ${label}?`,
      confirmLabel:
        provider === "cash" ? "ACCEPT CASH CYCLE" : "OPEN PAYMONGO",
    });
  };

  const handleSaveAvailability = async (
    slots: Array<{ dayOfWeek: number; endTime: string; startTime: string }>,
  ) => {
    if (!availabilityEditorCoachId) return;

    try {
      await replaceAvailabilityMutation.mutateAsync({
        coachId: availabilityEditorCoachId,
        payload: { slots },
      });
      showFeedback("Coach availability updated.");
      setAvailabilityEditorCoachId(null);
    } catch (error) {
      showFeedback(
        getErrorMessage(error, "Unable to update coach availability."),
        "danger",
      );
    }
  };

  const handleSaveCoachProfile = async (data: Record<string, string>) => {
    if (!profileEditorCoach) return;

    const parsed = coachProfileSchema.safeParse({
      bio: data.bio ?? "",
      specialties: data.specialties ?? "",
      certifications: data.certifications ?? "",
      yearsExperience: "",
      hourlyRate: data.hourlyRate ?? "",
    });

    if (!parsed.success) {
      showFeedback(
        parsed.error.issues[0]?.message ?? "Invalid coach profile details.",
        "danger",
      );
      return;
    }

    const displayName = data.displayName?.trim() ?? "";
    if (!displayName) {
      showFeedback("Coach name is required.", "danger");
      return;
    }

    try {
      const scheduleTypeValue: "full_time" | "part_time" =
        data.scheduleType === "full_time" ? "full_time" : "part_time";
      const payload = {
        bio: parsed.data.bio || undefined,
        specialties: parsed.data.specialties,
        certifications: parsed.data.certifications,
        contactEmail: data.contactEmail?.trim() || null,
        contactPhone: data.contactPhone?.trim() || null,
        displayName,
        hourlyRate: parsed.data.hourlyRate,
        isAvailableForBooking:
          (data.isAvailableForBooking ?? "active") === "active",
        ...(isAdmin
          ? {
              scheduleType: scheduleTypeValue,
            }
          : {}),
      } as const;

      if (isCoach) {
        await updateCoachSelfProfileMutation.mutateAsync({
          coachId: profileEditorCoach.id,
          payload,
          userId: user?.id,
        });
      } else {
        await updateCoachProfileMutation.mutateAsync({
          coachId: profileEditorCoach.id,
          payload,
        });
      }
      showFeedback("Coach profile updated.");
      setProfileEditorCoachId(null);
    } catch (error) {
      showFeedback(
        getErrorMessage(error, "Unable to update coach profile."),
        "danger",
      );
    }
  };

  const handleSetCoachBookingVisibility = async (
    coachId: string,
    isVisibleForBooking: boolean,
  ) => {
    const coach = coachProfiles.find((item) => item.id === coachId);
    if (!coach) return;

    try {
      await updateCoachProfileMutation.mutateAsync({
        coachId: coach.id,
        payload: {
          bio: coach.bio ?? undefined,
          certifications: coach.certifications ?? [],
          hourlyRate: coach.hourlyRate ?? undefined,
          isAvailableForBooking: isVisibleForBooking,
          ...(isAdmin
            ? { scheduleType: coach.scheduleType ?? "part_time" }
            : {}),
          specialties: coach.specialties ?? [],
        },
      });
      showFeedback(
        isVisibleForBooking
          ? "Coach restored to booking visibility."
          : "Coach hidden from booking.",
      );
    } catch (error) {
      showFeedback(
        getErrorMessage(
          error,
          isVisibleForBooking
            ? "Unable to restore coach visibility."
            : "Unable to hide coach from booking.",
        ),
        "danger",
      );
    }
  };

  const handleApproveVenueBooking = async (note: string) => {
    if (!venueReviewTarget) return;

    const result = await confirmBooking(venueReviewTarget.id);
    if (!result.success) {
      showFeedback(
        result.error ?? "Unable to approve venue booking.",
        "danger",
      );
      return;
    }

    showFeedback(
      note
        ? "Venue booking approved and note captured."
        : "Venue booking approved.",
    );
    setVenueReviewTarget(null);
  };

  const executeCollectVenueBalance = async (
    booking: VenueBookingRecord,
    provider: PaymentCollectionProvider,
  ) => {
    try {
      const result = await processBookingBalanceMutation.mutateAsync({
        bookingId: booking.id,
        provider,
        referenceNo:
          provider === "cash" ? `VENUE-BAL-${Date.now()}` : undefined,
      });

      if (provider === "cash" && result.paymentId) {
        await verifyPaymentMutation.mutateAsync({
          affectedUserId: booking.userId,
          paymentId: result.paymentId,
          payload: { action: "approve" },
        });
        showFeedback("Venue booking balance accepted.");
        setVenueReviewTarget(null);
        return;
      }

      if (result.checkoutUrl) {
        window.open(result.checkoutUrl, "_blank", "noopener,noreferrer");
        showFeedback("PayMongo balance checkout opened.");
        return;
      }

      showFeedback("Venue booking balance request updated.");
    } catch (error) {
      showFeedback(
        getErrorMessage(error, "Unable to collect venue balance."),
        "danger",
      );
    }
  };

  const requestCollectVenueBalance = (
    booking: VenueBookingRecord,
    provider: PaymentCollectionProvider,
  ) => {
    const label =
      provider === "cash"
        ? "accept this cash balance"
        : "open PayMongo balance checkout";
    setPaymentConfirm({
      kind: "venueBalance",
      booking,
      provider,
      title: "Confirm venue balance",
      message: `Continue and ${label}?`,
      confirmLabel:
        provider === "cash" ? "ACCEPT CASH BALANCE" : "OPEN PAYMONGO",
    });
  };

  const handleConfirmPaymentAction = async () => {
    if (!paymentConfirm) return;

    try {
      switch (paymentConfirm.kind) {
        case "coachInitial":
          await executeCollectAppointmentInitialPayment(
            paymentConfirm.appointment,
            paymentConfirm.provider,
            paymentConfirm.paymentStage,
          );
          break;
        case "coachBalance":
          await executeCollectAppointmentBalance(
            paymentConfirm.appointment,
            paymentConfirm.provider,
          );
          break;
        case "coachPaymentApproval":
          await executeApproveAppointmentPayment(
            paymentConfirm.appointment,
            paymentConfirm.paymentId,
          );
          break;
        case "recurringCycle":
          await executeRecurringCyclePayment(
            paymentConfirm.cycle,
            paymentConfirm.provider,
          );
          break;
        case "venueBalance":
          await executeCollectVenueBalance(
            paymentConfirm.booking,
            paymentConfirm.provider,
          );
          break;
        default:
          break;
      }
    } finally {
      setPaymentConfirm(null);
    }
  };

  const handleRejectVenueBooking = async (note: string) => {
    if (!venueReviewTarget) return;

    const result = await rejectBooking(venueReviewTarget.id, note || undefined);
    if (!result.success) {
      showFeedback(result.error ?? "Unable to reject venue booking.", "danger");
      return;
    }

    showFeedback("Venue booking rejected.");
    setVenueReviewTarget(null);
  };

  const handleCompleteVenueBooking = async () => {
    if (!venueReviewTarget) return;

    const result = await completeBooking(venueReviewTarget.id);
    if (!result.success) {
      showFeedback(
        result.error ?? "Unable to mark venue booking complete.",
        "danger",
      );
      return;
    }

    showFeedback("Venue booking marked complete.");
    setVenueReviewTarget(null);
  };

  const handleCancelVenueBooking = async (note: string) => {
    if (!venueReviewTarget) return;

    const result = await cancelBooking(venueReviewTarget.id, note || undefined);
    if (!result.success) {
      showFeedback(result.error ?? "Unable to cancel venue booking.", "danger");
      return;
    }

    showFeedback("Venue booking cancelled.");
    setVenueReviewTarget(null);
  };

  const handleNoShowVenueBooking = async () => {
    if (!venueReviewTarget) return;

    const result = await noShowBooking(venueReviewTarget.id);
    if (!result.success) {
      showFeedback(result.error ?? "Unable to mark venue booking no-show.", "danger");
      return;
    }

    showFeedback("Venue booking marked no-show.");
    setVenueReviewTarget(null);
  };

  const handleCreateVenueBooking = async (payload: {
    amenityId: string;
    coachId?: string;
    endsAt: string;
    memberId: string;
    notes?: string;
    paymentStage?: "downpayment" | "full";
    startsAt: string;
  }) => {
    try {
      await createVenueBookingMutation.mutateAsync(payload);
      showFeedback("Venue booking created.");
      setCreateVenueBookingOpen(false);
    } catch (error) {
      showFeedback(
        getErrorMessage(error, "Unable to create venue booking."),
        "danger",
      );
    }
  };

  const handleCreateCoachBooking = async (payload: {
    coachId: string;
    durationMinutes: number;
    memberId: string;
    memberNotes?: string;
    paymentStage?: "downpayment" | "full";
    scheduledAt: string;
  }) => {
    try {
      await createCoachBookingMutation.mutateAsync(payload);
      showFeedback("Coach booking created.");
      setCreateCoachBookingOpen(false);
    } catch (error) {
      showFeedback(
        getErrorMessage(error, "Unable to create coach booking."),
        "danger",
      );
    }
  };

  const handleCreateCoach = async (payload: {
    bio?: string;
    certifications?: string[];
    contactEmail?: string;
    contactPhone?: string;
    displayName: string;
    hourlyRate?: number;
    isAvailableForBooking?: boolean;
    scheduleType?: "full_time" | "part_time";
    specialties?: string[];
  }) => {
    try {
      await createCoachMutation.mutateAsync(payload);
      showFeedback("Coach created.");
      setCreateCoachOpen(false);
    } catch (error) {
      showFeedback(getErrorMessage(error, "Unable to create coach."), "danger");
    }
  };

  return {
    activeBlock, activeCoach, activeCoachId,
    activeOperationsTab, activeScheduleSurfaceTab, allBookings,
    appointmentReviewReadiness, appointmentReviewTarget, appointmentsLoading,
    appointmentStatusFilter, appointmentSummary, availabilityEditorCoach,
    blockDetailOpen, bookableVenueOptions, bulkUpdateRecurringSessionsMutation,
    bookingDateRange,
    calendarOpen, canAnimate, cancelAppointmentMutation,
    cancelRecurringPlanMutation, canManageCoaching, coachAppointments,
    coachDetailsOpen, coachFilterId, coachOptions,
    coachProfiles, coachRailAsRow, coachRoster,
    coachRosterMaxHeight, coachVisibilityScope, colors,
    cancelAppointmentPending, completeAppointmentMutation,
    completeAppointmentPending, createCoachBookingMutation, createCoachBookingOpen,
    createCoachMutation, createCoachOpen, createRecurringPlanMutation,
    createVenueBookingMutation, createVenueBookingOpen, draggingBooking,
    draggingCoach, fadeIn, feedbackModal, filteredStaff,
    filteredVenueBookings, focusedCoachId, focusedCoachScheduleBookings,
    handleApproveVenueBooking, handleBlockClick, handleBlockDelete,
    handleBlockSave, handleCancelAppointment, handleCancelVenueBooking,
    handleCoachFocus, handleCompleteAppointment, handleCompleteVenueBooking,
    handleConfirmAppointment, handleConfirmPaymentAction, handleConfirmRecurringPlan,
    handleCreateCoach, handleCreateCoachBooking, handleCreateVenueBooking,
    handleDragEnd, handleDragStart, handleNoShowVenueBooking,
    handleVenueEndDateSelect, handleVenueStartDateSelect,
    handlePreviewRecurringPlan, handleRecurringFutureUpdate, handleRecurringPlanCancel,
    handleRecurringSessionReschedule, handleRecurringSessionSkip, handleRejectAppointment,
    handleRejectVenueBooking, handleSaveAppointmentFeedback, handleSaveAvailability, handleSaveCoachProfile,
    handleMarkCoachPayoutPaid, handleSetCoachBookingVisibility, handleStaffClick,
    leftRailRef, markCoachPayoutPaidMutation, memberOptions, nextWeek, payAppointmentInitialMutation,
    paymentConfirm, paymentConfirmLoading, payRecurringCycleMutation,
    prevWeek, processAppointmentBalanceMutation, processBookingBalanceMutation,
    profileEditorCoach, recurringActionBusy, recurringActionCoachId,
    recurringActionDate, recurringActionDays, recurringActionReason,
    recurringActionTime, recurringCompletedCount, recurringCreateBusy,
    recurringPlanAction, recurringPlanForm, recurringPlanInputInvalid,
    recurringPlanOpen, recurringPlanPreview, recurringPlanSessions,
    recurringRemainingCount, refreshGymOperationsData, replaceAvailabilityMutation,
    requestApproveAppointmentPayment, requestCollectAppointmentBalance,
    requestCollectAppointmentInitialPayment, requestCollectVenueBalance,
    requestRecurringCyclePayment, respondAppointmentMutation,
    respondAppointmentPending, rightScrollRef,
    rosterBookings, scheduleLoading,
    scheduleRangeMode, scheduleRosterMaxHeight, scheduleTimelineMaxHeight,
    selectedCoachProfile, selectedCoachRoster, selectedVenueFilterLabel,
    venueBookingDateLabel, clearVenueBookingDateRange,
    isAdmin, isCoach,
    sensors, setActiveBlock, setActiveCoachId,
    setActiveOperationsTab, setActiveScheduleSurfaceTab, setAppointmentReviewTarget,
    setAppointmentStatusFilter, setAvailabilityEditorCoachId, setBlockDetailOpen,
    setCalendarOpen, setCoachDetailsOpen, setCoachFilterId,
    setCoachVisibilityScope, setCreateCoachBookingOpen, setCreateCoachOpen,
    setCreateVenueBookingOpen, setFeedbackModal, setPaymentConfirm, setProfileEditorCoachId,
    setRecurringActionCoachId, setRecurringActionDate, setRecurringActionReason,
    setRecurringActionTime, setRecurringPlanAction, setRecurringPlanForm,
    setRecurringPlanOpen, setRecurringPlanPreview,
    setScheduleRangeMode, setSlideKey, setVenueFilterId,
    setVenueEndCalendarOpen, setVenueReviewTarget, setVenueStartCalendarOpen,
    setVenueStatusFilter, setWeekStart,
    slideStyle, themeTransition, toggleRecurringActionDay,
    toggleRecurringPlanDay, updateCoachProfileMutation,
    updateCoachProfilePending, updateRecurringSessionMutation,
    venueBookingSummary, venueEndCalendarOpen, venueFilterId,
    venueFilterOptions, venueReviewTarget, venueStartCalendarOpen,
    venueStatusFilter, verifyPaymentMutation,
    visibleTimelineDays, visibleTimelineHours, weekStart,
  };
}

type GymOperationsPageContextValue = ReturnType<typeof useGymOperationsPageState>;

const GymOperationsPageContext = createContext<GymOperationsPageContextValue | null>(null);

export function GymOperationsPageProvider({ children }: { children: ReactNode }) {
  const value = useGymOperationsPageState();
  return (
    <GymOperationsPageContext.Provider value={value}>
      {children}
    </GymOperationsPageContext.Provider>
  );
}

export function useGymOperationsPage() {
  const context = useContext(GymOperationsPageContext);
  if (!context) {
    throw new Error("useGymOperationsPage must be used within GymOperationsPageProvider");
  }
  return context;
}
