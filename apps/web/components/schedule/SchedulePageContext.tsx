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
import { type DragEndEvent, type DragStartEvent } from "@dnd-kit/core";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  RecurringCoachingPlanPreviewResult,
  StaffAppointmentRecord,
  SubmitCoachAppointmentFeedbackPayload,
} from "@fittrack/api-client";
import { getVenueBookingBlockReason } from "@fittrack/api-client";
import type {
  CoachProfileRecord,
  CreateUserCoachProfileInput,
  MemberRecord,
  TrainingPlanSummaryRecord,
} from "@fittrack/types";
import {
  bulkUpdateRecurringCoachingSessionsMutationOptions,
  cancelStaffAppointmentMutationOptions,
  cancelStaffVenueBookingForMaintenanceMutationOptions,
  cancelAppointmentMutationOptions,
  cancelRecurringCoachingPlanMutationOptions,
  coachScheduleQueryOptions,
  coachSelfProfileQueryOptions,
  coachVenueWorkQueryOptions,
  completeCoachAppointmentMutationOptions,
  completeStaffAppointmentMutationOptions,
  createStaffAppointmentMutationOptions,
  createStaffBookingMutationOptions,
  createUserMutationOptions,
  fitnessClientPlansQueryOptions,
  markCoachPayoutPaidMutationOptions,
  createRecurringCoachingPlanMutationOptions,
  createRecurringCoachingCashEnrollmentMutationOptions,
  previewRecurringCoachingPlanMutationOptions,
  recurringCoachingPlanSessionsQueryOptions,
  replaceStaffCoachAvailabilityMutationOptions,
  rescheduleStaffVenueBookingForMaintenanceMutationOptions,
  queryKeys,
  staffAppointmentsQueryOptions,
  staffCoachesQueryOptions,
  staffUsersQueryOptions,
  updateCoachProfileMutationOptions,
  updateRecurringCoachingSessionMutationOptions,
  updateStaffCoachProfileMutationOptions,
  operationalVenuesQueryOptions,
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
  getRecurringPlanSelectionIssue,
  summarizeRecurringPlanSelection,
} from "@fittrack/app-core";
import {
  getPersonDisplayName,
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
  type RecurringPlanActionState,
  type RecurringPlanFormState,
  type ScheduleRangeMode,
  type ScheduleSurfaceTab,
  type VenueStateFilter,
} from "./SchedulePageShared";
import {
  addDays,
  buildManualBooking,
  getWeekStart,
  mapCoachesToRoster,
} from "@/app/(auth)/schedule/helpers";

const PRODUCT_BOOKING_STATUSES = new Set([
  "confirmed",
  "completed",
  "cancelled",
  "no_show",
]);

function appointmentMatchesMemberSearch(
  appointment: StaffAppointmentRecord,
  normalizedSearch: string,
) {
  if (!normalizedSearch) return true;
  const memberName = getPersonDisplayName(
    appointment.user.profile,
    appointment.user.email,
    "Member",
  );
  return `${memberName} ${appointment.user.email ?? ""}`
    .toLowerCase()
    .includes(normalizedSearch);
}

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
  const [coachBookingFeedback, setCoachBookingFeedback] = useState<
    string | null
  >(null);
  const isAdmin = user?.role === "ADMIN";
  const isCoach = user?.role === "COACH";
  const canManageGymOperations = isAdmin || user?.role === "STAFF";
  const canManageCoaching = canManageGymOperations || isCoach;
  const canViewVenueBookings = canManageGymOperations;
  const {
    cancelBooking,
    completeBooking,
    noShowBooking,
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

  useEffect(() => {
    if (!coachBookingFeedback) return;

    const timeoutId = window.setTimeout(
      () => setCoachBookingFeedback(null),
      5000,
    );
    return () => window.clearTimeout(timeoutId);
  }, [coachBookingFeedback]);

  const refreshGymOperationsData = async () => {
    const keys = [
      queryKeys.adminBookings(),
      queryKeys.staffAppointments(),
      queryKeys.staffBookings(),
      queryKeys.staffBookings("all"),
      queryKeys.staffCoaches(),
      queryKeys.staffUsers(),
      queryKeys.recurringCoachingPlanSessions(),
      queryKeys.coachVenueWork(user?.id),
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
    showFeedback(
      isCoach ? "Sessions refreshed." : "Gym Operations data refreshed.",
    );
  };

  const [weekStart, setWeekStart] = useState(() => getWeekStart(new Date()));
  const [slideKey, setSlideKey] = useState(0);
  const [slideDir, setSlideDir] = useState<"left" | "right">("right");
  const [calendarOpen, setCalendarOpen] = useState(false);
  const activeOperationsTab = normalizeOperationsTab(
    searchParams.get("tab"),
    canManageGymOperations,
  );
  const activeScheduleSurfaceTab = normalizeScheduleSurfaceTab(
    searchParams.get("schedule_view"),
    canViewVenueBookings,
  );
  const replaceGymOperationsQuery = (
    key: "tab" | "schedule_view",
    value: string | null,
  ) => {
    const nextParams = new URLSearchParams(searchParams.toString());
    if (value === null) nextParams.delete(key);
    else nextParams.set(key, value);

    const nextQuery = nextParams.toString();
    if (nextQuery === searchParams.toString()) return;
    router.replace(nextQuery ? `${pathname}?${nextQuery}` : pathname, {
      scroll: false,
    });
  };
  const setActiveOperationsTab = (nextTab: GymOperationsTab) => {
    replaceGymOperationsQuery("tab", nextTab === "schedule" ? null : nextTab);
  };
  const setActiveScheduleSurfaceTab = (nextTab: ScheduleSurfaceTab) => {
    replaceGymOperationsQuery(
      "schedule_view",
      nextTab === "month-calendar"
        ? null
        : nextTab === "coach-schedule"
          ? "coaches"
          : "venues",
    );
  };
  const [scheduleRangeMode, setScheduleRangeMode] =
    useState<ScheduleRangeMode>("weekly");
  const { style: slideStyle } = usePowerSlide(slideKey, slideDir);

  const prevWeek = () => {
    setSlideDir("left");
    setSlideKey((key) => key + 1);
    setWeekStart((date) =>
      addDays(date, scheduleRangeMode === "weekly" ? -7 : -1),
    );
  };

  const nextWeek = () => {
    setSlideDir("right");
    setSlideKey((key) => key + 1);
    setWeekStart((date) =>
      addDays(date, scheduleRangeMode === "weekly" ? 7 : 1),
    );
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
  const [appointmentMemberSearch, setAppointmentMemberSearch] = useState("");
  const [venueFilterId, setVenueFilterId] = useState("all");
  const [venueStatusFilter, setVenueStatusFilter] = useState("all");
  const [venueStateFilter, setVenueStateFilter] =
    useState<VenueStateFilter>("all");
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
  const [recurringPlanPreviewStale, setRecurringPlanPreviewStale] =
    useState(false);
  const [recurringPlanAction, setRecurringPlanAction] =
    useState<RecurringPlanActionState | null>(null);
  const [recurringActionDate, setRecurringActionDate] = useState("");
  const [recurringActionTime, setRecurringActionTime] = useState("09:00");
  const [recurringActionCoachId, setRecurringActionCoachId] = useState("");
  const [recurringActionDays, setRecurringActionDays] = useState<number[]>([]);
  const [recurringActionReason, setRecurringActionReason] = useState("");

  const { data: staffCoachProfiles = [] } = useQuery({
    ...staffCoachesQueryOptions(webApiClient),
    enabled: canViewVenueBookings,
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
    enabled: canManageCoaching && !isCoach,
    staleTime: 60_000,
  });
  const {
    data: venues = [],
    error: venuesError,
    isLoading: venuesLoading,
    refetch: refetchVenues,
  } = useQuery({
    ...operationalVenuesQueryOptions(webApiClient),
    enabled: canViewVenueBookings,
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
      ...(appointmentStatusFilter !== "all"
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
    enabled: canViewVenueBookings,
    staleTime: 30_000,
  });
  const { data: rosterAppointmentResult = EMPTY_APPOINTMENT_RESULT } = useQuery(
    {
      ...staffAppointmentsQueryOptions<StaffAppointmentRecord>(
        webApiClient,
        rosterAppointmentFilters,
      ),
      enabled: canViewVenueBookings,
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
  const { data: coachVenueWorkResult, isLoading: coachVenueWorkLoading } =
    useQuery({
      ...coachVenueWorkQueryOptions(webApiClient, user?.id, {
        limit: 100,
        page: 1,
        startDate: toYmd(visibleTimelineDays[0] ?? weekStart),
        endDate: toYmd(
          visibleTimelineDays[visibleTimelineDays.length - 1] ?? weekStart,
        ),
      }),
      enabled: isCoach && Boolean(user?.id),
      staleTime: 30_000,
    });
  const normalizedAppointmentMemberSearch = appointmentMemberSearch
    .trim()
    .toLowerCase();
  const appointmentRows = useMemo(
    () =>
      (isCoach ? coachScheduleAppointments : appointmentResult.data).filter(
        (appointment) =>
          PRODUCT_BOOKING_STATUSES.has(
            (appointment.status ?? "").toLowerCase(),
          ) &&
          (appointmentStatusFilter === "all" ||
            (appointment.status ?? "").toLowerCase() ===
              appointmentStatusFilter.toLowerCase()) &&
          appointmentMatchesMemberSearch(
            appointment,
            normalizedAppointmentMemberSearch,
          ),
      ),
    [
      appointmentResult.data,
      appointmentStatusFilter,
      coachScheduleAppointments,
      isCoach,
      normalizedAppointmentMemberSearch,
    ],
  );
  const rosterAppointmentRows = useMemo(
    () =>
      (isCoach
        ? coachScheduleAppointments
        : rosterAppointmentResult.data
      ).filter(
        (appointment) =>
          PRODUCT_BOOKING_STATUSES.has(
            (appointment.status ?? "").toLowerCase(),
          ) &&
          (!isCoach ||
            ((appointmentStatusFilter === "all" ||
              (appointment.status ?? "").toLowerCase() ===
                appointmentStatusFilter.toLowerCase()) &&
              appointmentMatchesMemberSearch(
                appointment,
                normalizedAppointmentMemberSearch,
              ))),
      ),
    [
      appointmentStatusFilter,
      coachScheduleAppointments,
      isCoach,
      normalizedAppointmentMemberSearch,
      rosterAppointmentResult.data,
    ],
  );
  const coachVenueWork = useMemo(
    () =>
      (coachVenueWorkResult?.data ?? []).filter((booking) => {
        const status = (booking.status ?? "").toLowerCase();
        if (!PRODUCT_BOOKING_STATUSES.has(status)) return false;
        if (
          appointmentStatusFilter !== "all" &&
          status !== appointmentStatusFilter.toLowerCase()
        ) {
          return false;
        }
        if (!normalizedAppointmentMemberSearch) return true;
        const memberName = getPersonDisplayName(
          booking.user?.profile,
          booking.user?.email,
          "Member",
        );
        return `${memberName} ${booking.user?.email ?? ""}`
          .toLowerCase()
          .includes(normalizedAppointmentMemberSearch);
      }) as VenueBookingRecord[],
    [
      appointmentStatusFilter,
      coachVenueWorkResult?.data,
      normalizedAppointmentMemberSearch,
    ],
  );
  const appointmentsLoading = isCoach
    ? coachScheduleLoading
    : staffAppointmentsLoading;

  const replaceAvailabilityMutation = useMutation(
    replaceStaffCoachAvailabilityMutationOptions(webApiClient, queryClient),
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
    }) =>
      webApiClient.coaches.submitAppointmentFeedback(appointmentId, payload),
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
  const rescheduleVenueBookingMutation = useMutation(
    rescheduleStaffVenueBookingForMaintenanceMutationOptions(
      webApiClient,
      queryClient,
    ),
  );
  const cancelVenueBookingForMaintenanceMutation = useMutation(
    cancelStaffVenueBookingForMaintenanceMutationOptions(
      webApiClient,
      queryClient,
    ),
  );
  const createRecurringCashEnrollmentMutation = useMutation(
    createRecurringCoachingCashEnrollmentMutationOptions(
      webApiClient,
      queryClient,
    ),
  );
  const createCoachMutation = useMutation(
    createUserMutationOptions(webApiClient, queryClient),
  );
  const previewRecurringPlanMutation = useMutation(
    previewRecurringCoachingPlanMutationOptions(webApiClient),
  );
  const createRecurringPlanMutation = useMutation(
    createRecurringCoachingPlanMutationOptions(webApiClient, queryClient),
  );
  const recurringCreateInFlightRef = useRef(false);
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
  const markCoachPayoutPaidMutation = useMutation(
    markCoachPayoutPaidMutationOptions(webApiClient, queryClient),
  );
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
          monthlyOfferActive: coach.monthlyOfferActive,
          monthlyOfferDescription: coach.monthlyOfferDescription,
          monthlyRate: coach.monthlyRate,
          monthlySessionCount: coach.monthlySessionCount,
          monthlySessionDurationMinutes: coach.monthlySessionDurationMinutes,
          value: coach.id,
        })),
    [coachRoster],
  );
  const memberOptions = useMemo(() => {
    if (isCoach) {
      const unique = new Map<string, { label: string; value: string }>();
      appointmentRows.forEach((appointment) => {
        const label = getPersonDisplayName(
          appointment.user.profile,
          appointment.user.email,
          "Member",
        );
        unique.set(appointment.userId, { label, value: appointment.userId });
      });
      return [...unique.values()];
    }

    return (staffUsers as MemberRecord[])
      .filter(isBookableOperationsMember)
      .map((member) => {
        const label = getPersonDisplayName(
          member.profile,
          member.email,
          "Member",
        );
        return { label, value: member.id };
      });
  }, [appointmentRows, isCoach, staffUsers]);
  const recurringCoachOffer = useMemo(
    () =>
      coachProfiles.find(
        (coach) => String(coach.id) === recurringPlanForm.coachId,
      ) ?? null,
    [coachProfiles, recurringPlanForm.coachId],
  );
  const {
    data: recurringTrainingPlanResult,
    isLoading: recurringPlansLoading,
  } = useQuery({
    ...fitnessClientPlansQueryOptions(
      webApiClient,
      user?.id,
      recurringPlanForm.memberId || undefined,
      { limit: 50, page: 1 },
    ),
    enabled:
      isCoach &&
      recurringPlanOpen &&
      Boolean(user?.id) &&
      Boolean(recurringPlanForm.memberId),
    staleTime: 30_000,
  });
  const recurringTrainingPlanOptions = useMemo(
    () =>
      ((recurringTrainingPlanResult?.data ?? []) as TrainingPlanSummaryRecord[])
        .filter(
          (plan) =>
            plan.coachId === user?.id && plan.source === "coach_assigned",
        )
        .map((plan) => ({
          label: `${plan.title}${plan.isActive ? " · Active" : ""}`,
          value: plan.id,
        })),
    [recurringTrainingPlanResult?.data, user?.id],
  );
  const coachAppointments = useMemo(() => appointmentRows, [appointmentRows]);
  const activeRecurringPlanId =
    recurringPlanAction?.appointment.recurringPlanId ??
    appointmentReviewTarget?.recurringPlanId ??
    null;
  const { data: recurringPlanSessions } = useQuery({
    ...recurringCoachingPlanSessionsQueryOptions(
      webApiClient,
      activeRecurringPlanId ?? "pending",
    ),
    enabled: (isAdmin || isCoach) && Boolean(activeRecurringPlanId),
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
  const recurringMonthlyRate = Number(recurringCoachOffer?.monthlyRate);
  const recurringMonthlySessionCount = Number(
    recurringCoachOffer?.monthlySessionCount,
  );
  const recurringMonthlyDuration = Number(
    recurringCoachOffer?.monthlySessionDurationMinutes,
  );
  const recurringMonthlyOfferConfigured =
    recurringCoachOffer?.monthlyOfferActive === true &&
    Number.isFinite(recurringMonthlyRate) &&
    recurringMonthlyRate > 0 &&
    Number.isInteger(recurringMonthlySessionCount) &&
    recurringMonthlySessionCount > 0 &&
    Number.isInteger(recurringMonthlyDuration) &&
    recurringMonthlyDuration >= 30 &&
    recurringMonthlyDuration <= 180;

  useEffect(() => {
    if (!isCoach || !recurringPlanOpen || !coachSelfProfile) return;
    const offerRate = Number(coachSelfProfile.monthlyRate);
    const offerDuration = Number(
      coachSelfProfile.monthlySessionDurationMinutes,
    );
    setRecurringPlanForm((current) => {
      const duration =
        Number.isInteger(offerDuration) && offerDuration > 0
          ? offerDuration
          : current.durationMinutes;
      return {
        ...current,
        coachId: String(coachSelfProfile.id),
        durationMinutes: duration,
        durationMonths: 1,
        frequency: "monthly",
        quotedAmount:
          Number.isFinite(offerRate) && offerRate > 0
            ? offerRate
            : current.quotedAmount,
      };
    });
  }, [coachSelfProfile, isCoach, recurringPlanOpen]);

  useEffect(() => {
    if (!recurringPlanOpen || recurringTrainingPlanOptions.length === 0) return;
    setRecurringPlanForm((current) => {
      if (
        recurringTrainingPlanOptions.some(
          (option) => option.value === current.trainingPlanId,
        )
      ) {
        return current;
      }
      return {
        ...current,
        trainingPlanId: recurringTrainingPlanOptions[0].value,
      };
    });
  }, [recurringPlanOpen, recurringTrainingPlanOptions]);

  const recurringPlanMinStartDate = getDefaultDateInput();
  const recurringPlanStartDateInvalid =
    !recurringPlanForm.startDate ||
    recurringPlanForm.startDate < recurringPlanMinStartDate;
  const recurringSelectionSummary = summarizeRecurringPlanSelection(
    recurringPlanPreview,
    recurringPlanForm.selectedCandidateIndexes,
  );
  const recurringScheduleIssue = recurringPlanPreview
    ? getRecurringPlanSelectionIssue(
        recurringPlanPreview,
        recurringPlanForm.selectedCandidateIndexes,
        recurringPlanPreviewStale,
      )
    : null;
  const recurringPlanInputInvalid =
    !isCoach ||
    recurringPlanForm.frequency !== "monthly" ||
    !recurringPlanForm.memberId ||
    !recurringPlanForm.coachId ||
    !recurringPlanForm.trainingPlanId ||
    recurringPlanStartDateInvalid ||
    !recurringPlanForm.preferredTime ||
    !recurringMonthlyOfferConfigured ||
    recurringPlanForm.quotedAmount !== recurringMonthlyRate ||
    recurringPlanForm.durationMinutes !== recurringMonthlyDuration;
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
              appointment.status === "confirmed",
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
      const booking = buildManualBooking(coach, targetDay, hour, colors.brand);
      setManualBookings((previous) => [...previous, booking]);
      showFeedback(
        `${coach.name} assigned to ${targetDay.toLocaleDateString("en-US", {
          weekday: "short",
        })} ${hour}:00`,
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
        `${booking.resourceName} moved to ${targetDay.toLocaleDateString(
          "en-US",
          {
            weekday: "short",
          },
        )} ${hour}:00`,
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
      venues.map((venue) => ({
        label: venue.name,
        value: String(venue.id),
        hourlyRate: venue.hourlyRate ?? 0,
      })),
    [venues],
  );

  const bookableVenueOptions = useMemo(
    () =>
      venues.map((venue) => {
        const unavailableReason = getVenueBookingBlockReason(venue);
        return {
          disabled: Boolean(unavailableReason),
          label: unavailableReason
            ? `${venue.name} — ${unavailableReason}`
            : venue.name,
          value: String(venue.id),
          hourlyRate: venue.hourlyRate ?? 0,
          unavailableReason,
        };
      }),
    [venues],
  );

  const venueStatusById = useMemo(
    () =>
      new Map(
        venues.map((venue) => [
          String(venue.id),
          venue.status ?? "available",
        ]),
      ),
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
      endDate: current.endDate && current.endDate < ymd ? ymd : current.endDate,
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
        current.startDate && current.startDate > ymd ? ymd : current.startDate,
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
          !PRODUCT_BOOKING_STATUSES.has((booking.status ?? "").toLowerCase())
        ) {
          return false;
        }
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
        const venueState =
          venueStatusById.get(String(booking.venueId)) ?? "available";
        if (
          venueStateFilter !== "all" &&
          venueState !== venueStateFilter
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
        if (
          bookingDateRange.endDate &&
          bookingDate > bookingDateRange.endDate
        ) {
          return false;
        }
        return true;
      }),
    [
      bookingDateRange.endDate,
      bookingDateRange.startDate,
      rawBookings,
      venueFilterId,
      venueStatusById,
      venueStatusFilter,
      venueStateFilter,
    ],
  );

  const venueBookingSummary = useMemo(
    () => ({
      visible: filteredVenueBookings.length,
      confirmed: filteredVenueBookings.filter(
        (booking) => booking.status === "confirmed",
      ).length,
      venuesInResults: new Set(
        filteredVenueBookings.map((booking) => booking.venueId),
      ).size,
      maintenanceVenues: new Set(
        filteredVenueBookings
          .filter(
            (booking) =>
              (venueStatusById.get(String(booking.venueId)) ?? "available") ===
              "maintenance",
          )
          .map((booking) => booking.venueId),
      ).size,
    }),
    [filteredVenueBookings, venueStatusById],
  );

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
        "Choose a member, client workout program, start date today or later, and time.",
        "danger",
      );
      return;
    }

    try {
      const preview = await previewRecurringPlanMutation.mutateAsync(
        getRecurringInput(recurringPlanForm),
      );
      setRecurringPlanPreview(preview);
      setRecurringPlanPreviewStale(false);
      setRecurringPlanForm((current) => ({
        ...current,
        selectedCandidateIndexes: preview.sessions
          .filter((session) => session.selected)
          .map((session) => session.candidateIndex),
      }));
      showFeedback(
        preview.conflictCount > 0
          ? `${preview.conflictCount} generated session conflict(s) need review.`
          : `${preview.selectedSessionCount} of ${preview.purchasedSessionCount} package session(s) selected.`,
        preview.conflictCount > 0 ? "danger" : "success",
      );
    } catch (error) {
      showFeedback(
        getErrorMessage(error, "Unable to preview recurring coaching plan."),
        "danger",
      );
    }
  };

  const handleConfirmRecurringPlan = async () => {
    if (
      recurringCreateInFlightRef.current ||
      createRecurringPlanMutation.isPending
    ) {
      return;
    }
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
    if (!recurringSelectionSummary.canConfirm || recurringPlanPreviewStale) {
      showFeedback(
        recurringScheduleIssue ??
          "Resolve the generated schedule selection before confirming.",
        "danger",
      );
      return;
    }

    recurringCreateInFlightRef.current = true;
    try {
      const result = await createRecurringPlanMutation.mutateAsync(
        getRecurringInput(recurringPlanForm),
      );
      showFeedback(
        result.sessions.length > 0
          ? `Recurring coaching plan activated with ${result.sessions.length} session(s).`
          : "Plan saved. No sessions were generated for the selected schedule.",
      );
      setRecurringPlanOpen(false);
      setRecurringPlanPreview(null);
      setRecurringPlanPreviewStale(false);
      setRecurringPlanForm(createDefaultRecurringPlanForm());
    } catch (error) {
      showFeedback(
        getErrorMessage(error, "Unable to create recurring coaching plan."),
        "danger",
      );
    } finally {
      recurringCreateInFlightRef.current = false;
    }
  };

  const toggleRecurringPlanCandidate = (candidateIndex: number) => {
    if (!recurringPlanPreview) return;
    const requiredSessionCount = Math.min(
      recurringPlanPreview.purchasedSessionCount,
      recurringPlanPreview.eligibleSessionCount,
    );
    setRecurringPlanForm((current) => {
      const selected = current.selectedCandidateIndexes;
      const isSelected = selected.includes(candidateIndex);
      if (!isSelected && selected.length >= requiredSessionCount) {
        return current;
      }
      return {
        ...current,
        selectedCandidateIndexes: isSelected
          ? selected.filter((index) => index !== candidateIndex)
          : [...selected, candidateIndex].sort((left, right) => left - right),
      };
    });
    setRecurringPlanPreviewStale(true);
  };

  const resetRecurringPlanPreview = () => {
    setRecurringPlanPreview(null);
    setRecurringPlanPreviewStale(false);
    setRecurringPlanForm((current) => ({
      ...current,
      selectedCandidateIndexes: [],
    }));
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
        queryClient.invalidateQueries({
          queryKey: queryKeys.coachSchedule(user?.id),
        }),
        queryClient.invalidateQueries({
          queryKey: queryKeys.staffAppointments(),
        }),
        queryClient.invalidateQueries({
          queryKey: queryKeys.analyticsSnapshot(),
        }),
      ]);
      showFeedback("Coach feedback saved for this session.");
      setAppointmentReviewTarget((current) =>
        current?.id === appointment.id
          ? {
              ...current,
              assessmentReport:
                payload.assessmentReport ?? current.assessmentReport,
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

    const monthlyOfferActive =
      (data.monthlyOfferActive ?? "inactive") === "active";
    const monthlyRate = Number(data.monthlyRate ?? 0);
    const monthlySessionCount = Number(data.monthlySessionCount ?? 0);
    const monthlySessionDurationMinutes = Number(
      data.monthlySessionDurationMinutes ?? 60,
    );
    if (
      !isCoach &&
      monthlyOfferActive &&
      (!Number.isFinite(monthlyRate) ||
        monthlyRate <= 0 ||
        !Number.isInteger(monthlySessionCount) ||
        monthlySessionCount < 1 ||
        !Number.isInteger(monthlySessionDurationMinutes) ||
        monthlySessionDurationMinutes < 30 ||
        monthlySessionDurationMinutes > 180)
    ) {
      showFeedback(
        "An active monthly offer needs a positive full price, included session count, and a 30-180 minute duration.",
        "danger",
      );
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
        ...(!isCoach
          ? {
              monthlyOfferActive,
              monthlyOfferDescription:
                data.monthlyOfferDescription?.trim() || null,
              monthlyRate,
              monthlySessionCount,
              monthlySessionDurationMinutes,
            }
          : {}),
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
      showFeedback(
        result.error ?? "Unable to mark venue booking no-show.",
        "danger",
      );
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
    paymentStage?: "full";
    startsAt: string;
  }) => {
    try {
      await createVenueBookingMutation.mutateAsync(payload);
      showFeedback("Venue booking created.");
      setCreateVenueBookingOpen(false);
      return { success: true as const };
    } catch (error) {
      const message = getErrorMessage(error, "Unable to create venue booking.");
      showFeedback(message, "danger");
      return { error: message, success: false as const };
    }
  };

  const handleRescheduleVenueBookingForMaintenance = async (payload: {
    amenityId: string;
    endsAt: string;
    note?: string;
    startsAt: string;
  }) => {
    if (!venueReviewTarget) {
      return {
        error: "Select a venue booking first.",
        success: false as const,
      };
    }
    try {
      await rescheduleVenueBookingMutation.mutateAsync({
        bookingId: venueReviewTarget.id,
        payload,
      });
      showFeedback(
        "Maintenance-affected booking rescheduled. Payment was preserved.",
      );
      setVenueReviewTarget(null);
      return { success: true as const };
    } catch (error) {
      return {
        error: getErrorMessage(error, "Unable to reschedule this booking."),
        success: false as const,
      };
    }
  };

  const handleCancelVenueBookingForMaintenance = async (note?: string) => {
    if (!venueReviewTarget) {
      return {
        error: "Select a venue booking first.",
        success: false as const,
      };
    }
    try {
      await cancelVenueBookingForMaintenanceMutation.mutateAsync({
        bookingId: venueReviewTarget.id,
        note,
      });
      showFeedback("Booking cancelled by operations for venue maintenance.");
      setVenueReviewTarget(null);
      return { success: true as const };
    } catch (error) {
      return {
        error: getErrorMessage(
          error,
          "Unable to cancel this booking for maintenance.",
        ),
        success: false as const,
      };
    }
  };

  const handleCreateCoachBooking = async (payload: {
    bookingMode: "monthly" | "single";
    coachId: string;
    durationMinutes?: number;
    idempotencyKey: string;
    memberId: string;
    memberNotes?: string;
    paymentStage?: "full";
    referenceNo?: string;
    scheduledAt?: string;
    startDate?: string;
  }) => {
    setCoachBookingFeedback(null);
    try {
      if (payload.bookingMode === "monthly") {
        if (!payload.startDate) throw new Error("Choose a monthly start date.");
        await createRecurringCashEnrollmentMutation.mutateAsync({
          coachId: payload.coachId,
          idempotencyKey: payload.idempotencyKey,
          memberId: payload.memberId,
          ...(payload.referenceNo ? { referenceNo: payload.referenceNo } : {}),
          startDate: payload.startDate,
        });
      } else {
        if (!payload.scheduledAt || !payload.durationMinutes) {
          throw new Error("Choose an exact live coach slot.");
        }
        await createCoachBookingMutation.mutateAsync({
          coachId: payload.coachId,
          durationMinutes: payload.durationMinutes,
          idempotencyKey: payload.idempotencyKey,
          memberId: payload.memberId,
          ...(payload.memberNotes ? { memberNotes: payload.memberNotes } : {}),
          paymentStage: "full",
          scheduledAt: payload.scheduledAt,
        });
      }
      setCreateCoachBookingOpen(false);
      setCoachBookingFeedback(
        payload.bookingMode === "monthly"
          ? "Monthly coaching enrolled and paid in full by cash."
          : "Coach session created and paid in full by cash.",
      );
    } catch (error) {
      showFeedback(
        getErrorMessage(error, "Unable to create coach booking."),
        "danger",
      );
      throw error;
    }
  };

  const handleCreateCoach = async (payload: {
    email: string;
    firstName: string;
    lastName: string;
    password: string;
    coachProfile?: CreateUserCoachProfileInput;
    phone_no?: string;
  }) => {
    try {
      await createCoachMutation.mutateAsync({
        email: payload.email,
        firstName: payload.firstName,
        lastName: payload.lastName,
        password: payload.password,
        coachProfile: payload.coachProfile,
        phone_no: payload.phone_no,
        role: "coach",
      });
      await queryClient.invalidateQueries({
        queryKey: queryKeys.staffCoaches(),
      });
      showFeedback("Coach account and profile created.");
      setCreateCoachOpen(false);
    } catch (error) {
      showFeedback(getErrorMessage(error, "Unable to create coach."), "danger");
    }
  };

  return {
    activeBlock,
    activeCoach,
    activeCoachId,
    activeOperationsTab,
    activeScheduleSurfaceTab,
    allBookings,
    appointmentReviewReadiness,
    appointmentReviewTarget,
    appointmentsLoading,
    appointmentMemberSearch,
    appointmentStatusFilter,
    appointmentSummary,
    availabilityEditorCoach,
    blockDetailOpen,
    bookableVenueOptions,
    bulkUpdateRecurringSessionsMutation,
    bookingDateRange,
    calendarOpen,
    canAnimate,
    cancelAppointmentMutation,
    cancelRecurringPlanMutation,
    cancelVenueBookingForMaintenanceMutation,
    canManageCoaching,
    canManageGymOperations,
    canViewVenueBookings,
    coachAppointments,
    coachBookingFeedback,
    coachDetailsOpen,
    coachFilterId,
    coachOptions,
    coachProfiles,
    coachRailAsRow,
    coachRoster,
    coachRosterMaxHeight,
    coachVisibilityScope,
    coachVenueWork,
    coachVenueWorkLoading,
    colors,
    cancelAppointmentPending,
    completeAppointmentMutation,
    completeAppointmentPending,
    createCoachBookingMutation,
    createRecurringCashEnrollmentMutation,
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
    handleBlockClick,
    handleBlockDelete,
    handleBlockSave,
    handleCancelAppointment,
    handleCancelVenueBooking,
    handleCancelVenueBookingForMaintenance,
    handleCoachFocus,
    handleCompleteAppointment,
    handleCompleteVenueBooking,
    handleConfirmRecurringPlan,
    handleCreateCoach,
    handleCreateCoachBooking,
    handleCreateVenueBooking,
    handleDragEnd,
    handleDragStart,
    handleNoShowVenueBooking,
    handleRescheduleVenueBookingForMaintenance,
    handleVenueEndDateSelect,
    handleVenueStartDateSelect,
    handlePreviewRecurringPlan,
    handleRecurringFutureUpdate,
    handleRecurringPlanCancel,
    handleRecurringSessionReschedule,
    handleRecurringSessionSkip,
    handleSaveAppointmentFeedback,
    handleSaveAvailability,
    handleSaveCoachProfile,
    handleMarkCoachPayoutPaid,
    handleSetCoachBookingVisibility,
    handleStaffClick,
    leftRailRef,
    markCoachPayoutPaidMutation,
    memberOptions,
    nextWeek,
    prevWeek,
    profileEditorCoach,
    recurringActionBusy,
    recurringActionCoachId,
    recurringActionDate,
    recurringActionDays,
    recurringActionReason,
    recurringActionTime,
    recurringCompletedCount,
    recurringCreateBusy,
    recurringCoachOffer,
    recurringMonthlyOfferConfigured,
    recurringMonthlyRate,
    recurringMonthlySessionCount,
    recurringMonthlyDuration,
    recurringPlansLoading,
    recurringPlanAction,
    recurringPlanForm,
    recurringPlanInputInvalid,
    recurringPlanOpen,
    recurringPlanPreview,
    recurringPlanPreviewStale,
    resetRecurringPlanPreview,
    recurringPlanSessions,
    recurringScheduleIssue,
    recurringTrainingPlanOptions,
    recurringRemainingCount,
    refetchVenues,
    refreshGymOperationsData,
    replaceAvailabilityMutation,
    rescheduleVenueBookingMutation,
    rightScrollRef,
    rosterBookings,
    scheduleLoading,
    scheduleRangeMode,
    scheduleRosterMaxHeight,
    scheduleTimelineMaxHeight,
    selectedCoachProfile,
    selectedCoachRoster,
    selectedVenueFilterLabel,
    venueBookingDateLabel,
    clearVenueBookingDateRange,
    isAdmin,
    isCoach,
    sensors,
    setActiveBlock,
    setActiveCoachId,
    setActiveOperationsTab,
    setActiveScheduleSurfaceTab,
    setAppointmentReviewTarget,
    setAppointmentMemberSearch,
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
    setVenueStateFilter,
    setVenueStatusFilter,
    setWeekStart,
    slideStyle,
    themeTransition,
    toggleRecurringActionDay,
    toggleRecurringPlanCandidate,
    updateCoachProfileMutation,
    updateCoachProfilePending,
    updateRecurringSessionMutation,
    venueBookingSummary,
    venuesLoadFailed: Boolean(venuesError),
    venuesLoading,
    venueEndCalendarOpen,
    venueFilterId,
    venueFilterOptions,
    venueReviewTarget,
    venueStartCalendarOpen,
    venueStateFilter,
    venueStatusFilter,
    venueStatusById,
    visibleTimelineDays,
    visibleTimelineHours,
    weekStart,
  };
}

type GymOperationsPageContextValue = ReturnType<
  typeof useGymOperationsPageState
>;

const GymOperationsPageContext =
  createContext<GymOperationsPageContextValue | null>(null);

export function GymOperationsPageProvider({
  children,
}: {
  children: ReactNode;
}) {
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
    throw new Error(
      "useGymOperationsPage must be used within GymOperationsPageProvider",
    );
  }
  return context;
}
