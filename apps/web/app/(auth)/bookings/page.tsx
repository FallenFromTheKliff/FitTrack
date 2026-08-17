"use client";

import type { CSSProperties, KeyboardEvent, ReactNode } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CalendarCheck,
  CalendarDays,
  ChevronUp,
  Clock3,
  Filter,
  Info,
  type LucideIcon,
  MessageSquareText,
  Send,
  UserRoundCheck,
} from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  CoachAvailabilityResponse,
  VenueAvailabilityRecord,
} from "@fittrack/api-client";
import {
  ApiClientError,
  getVenueBookingBlockReason,
} from "@fittrack/api-client";
import { formatBookingDate } from "@fittrack/utils";
import { isPaymongoCheckoutEnabled, WEEKDAY_NAMES } from "@fittrack/app-config";
import type { CoachProfileRecord, VenueRecord } from "@fittrack/types";
import {
  activeCoachesQueryOptions,
  appointmentAvailabilityQueryOptions,
  coachAvailabilityQueryOptions,
  enrollRecurringCoachingPlanMutationOptions,
  venueAvailabilityQueryOptions,
} from "@fittrack/query";

import FitButton from "@/components/fit/FitButton";
import { FitPagination, FitSelect } from "@/components/fit";
import FitSearch from "@/components/fit/FitSearch";
import { FitText, FitTextArea } from "@/components/fit/FitText";
import MemberInspectorPanel from "@/components/accounts/MemberInspectorPanel";
import { CalendarModal, ConfirmModal, FitModal } from "@/components/modals";
import {
  EmptyState,
  MemberOnlyScreen,
  MemberPanelHeader,
  MemberText,
} from "@/components/member-only/MemberOnlyPrimitives";
import {
  BOOKING_STATUS_FILTERS,
  MEMBER_BOOKING_SECTIONS,
  formatStatusLabel,
  toMemberAppointment,
  toMemberBookings,
  type BookingSection,
  type BookingStatusFilter,
  type MemberBookingItem,
} from "@/components/member-only/memberOnlyUtils";
import { getStatusTone } from "@/components/member-only/MemberOnlyPageShared";
import { useTheme } from "@/contexts/ThemeContext";
import { webApiClient } from "@/lib/api-client";
import {
  createClientIdempotencyKey,
  getCommerceCheckoutHoldId,
  getCommerceCheckoutUrl,
  rememberCommerceCheckoutHold,
  type CommerceCheckoutAttemptLike,
} from "@/lib/commerce-checkout";
import { useMemberOnlyAccess, useMemberOnlyBookingsData } from "@/hooks/member-only/useMemberOnlyData";

type BookingMode = "find" | "bookings";
type CoachRatingFilter = "all" | "4" | "4.5";
type CoachSkillFilter = "all" | string;
type CoachBookingIntent = "single" | "monthly";
type ComposerPanelMode = "details" | "feedback";
type BookingPanelMode = "details" | "timeline" | "feedback";
type AppointmentSlotOption = {
  durationMin: number;
  label: string;
  startTime: string;
};
type PaymentConfirmationState = {
  message: string;
  title: string;
};
type BookingCancellationConfirmation = {
  bookingId: string;
  bookingTitle: string;
  phase: "confirm" | "reminder";
  error?: string;
};
type ThemeColors = ReturnType<typeof useTheme>["colors"];

const BOOKING_MODE_OPTIONS: ReadonlyArray<{ icon: LucideIcon; label: string; value: BookingMode }> = [
  { icon: UserRoundCheck, label: "Coaches", value: "find" },
  { icon: CalendarCheck, label: "Bookings", value: "bookings" },
];

const COACH_RATING_FILTERS: ReadonlyArray<{ label: string; value: CoachRatingFilter }> = [
  { label: "All Ratings", value: "all" },
  { label: "4.0+", value: "4" },
  { label: "4.5+", value: "4.5" },
];

const COACH_DIRECTORY_PAGE_SIZE = 6;
const BOOKING_RECORDS_PAGE_SIZE = 8;
const BOOKING_TOOLBAR_FILTER_WIDTH = 168;
const BOOKING_TOOLBAR_SEARCH_WIDTH = 278;
const PRODUCT_BOOKING_STATUSES = new Set(["cancelled", "completed", "confirmed", "no_show"]);
const ONE_TIME_DURATION_OPTIONS = [30, 45, 60, 90] as const;

function isVisibleProductBooking(status?: string | null) {
  return PRODUCT_BOOKING_STATUSES.has((status ?? "").toLowerCase());
}

function getBookingCancellationErrorMessage(error: unknown) {
  if (error instanceof ApiClientError && error.message.trim()) {
    return error.message;
  }

  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  return "Unable to cancel this venue booking. Please try again.";
}

const REQUEST_TIME_OPTIONS = Array.from({ length: 16 }, (_, index) => {
  const totalMinutes = 6 * 60 + index * 60;
  const hour = Math.floor(totalMinutes / 60);
  const minute = totalMinutes % 60;
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
});

const BOOKING_INTENT_OPTIONS: ReadonlyArray<{
  description: string;
  icon: LucideIcon;
  label: string;
  sessionCount: number;
  value: CoachBookingIntent;
}> = [
  {
    description: "One focused session with a coach.",
    icon: UserRoundCheck,
    label: "Single Session",
    sessionCount: 1,
    value: "single",
  },
  {
    description: "A fixed monthly offer for active members.",
    icon: CalendarCheck,
    label: "Monthly Coaching",
    sessionCount: 0,
    value: "monthly",
  },
];

function getMonthlyCoachOffer(coach: CoachProfileRecord | null) {
  const rate = Number(coach?.monthlyRate);
  const sessionCount = Number(coach?.monthlySessionCount);
  const durationMinutes = Number(coach?.monthlySessionDurationMinutes);
  const hasValidOffer =
    coach?.monthlyOfferActive === true &&
    Number.isFinite(rate) &&
    rate > 0 &&
    Number.isInteger(sessionCount) &&
    sessionCount > 0 &&
    Number.isInteger(durationMinutes) &&
    durationMinutes > 0;

  return {
    description: coach?.monthlyOfferDescription?.trim() || "Coach-created monthly package.",
    durationMinutes: hasValidOffer ? durationMinutes : null,
    isAvailable: hasValidOffer,
    rate: hasValidOffer ? rate : null,
    sessionCount: hasValidOffer ? sessionCount : null,
  };
}

function getCoachName(coach: CoachProfileRecord) {
  const standaloneName = coach.displayName?.trim();
  if (standaloneName && !standaloneName.includes("@")) return standaloneName;
  return "Coach Profile";
}

function getCoachInitials(coach: CoachProfileRecord) {
  return getCoachName(coach)
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "CP";
}

function getCoachRatingLabel(coach: CoachProfileRecord) {
  if (!coach.averageRating || coach.ratingCount === 0) {
    return "New coach";
  }

  return `${coach.averageRating.toFixed(1)} stars (${coach.ratingCount ?? 0})`;
}

function getCoachRatingBadgeLabel(coach: CoachProfileRecord) {
  if (!coach.averageRating || coach.ratingCount === 0) {
    return "New Coach";
  }

  return `${coach.averageRating.toFixed(1)} stars`;
}

function getCoachRatingValue(coach: CoachProfileRecord) {
  return coach.averageRating ?? 0;
}

function getCoachRatingStat(coach: CoachProfileRecord) {
  return coach.averageRating && coach.ratingCount ? coach.averageRating.toFixed(1) : "New";
}

function getCoachSpecialtySummary(coach: CoachProfileRecord) {
  return coach.specialties?.filter(Boolean).slice(0, 2).join(" / ") || "General coaching";
}

function getCoachRateLabel(coach: CoachProfileRecord) {
  return coach.hourlyRate ? `PHP ${coach.hourlyRate.toLocaleString()} / session` : "Rate confirmed by staff";
}

function getCoachAvailabilityLabel(coach: CoachProfileRecord) {
  const availableSlots = coach.availability?.filter((slot) => slot.isAvailable) ?? [];
  if (availableSlots.length === 0) return "No active availability";
  return `${availableSlots.length} open slot${availableSlots.length === 1 ? "" : "s"}`;
}

function getCoachExperienceLabel(coach: CoachProfileRecord) {
  if (!coach.yearsExperience) return "Experience pending";
  return `${coach.yearsExperience} year${coach.yearsExperience === 1 ? "" : "s"}`;
}

function getCoachScheduleTypeLabel(coach: CoachProfileRecord) {
  if (coach.scheduleType === "full_time") return "Full-Time";
  if (coach.scheduleType === "part_time") return "Part-Time";
  return "Flexible";
}

function formatTimeChoice(value: string) {
  if (!value) return "Select Time";

  const [hourValue, minuteValue = "00"] = value.split(":");
  const hour = Number(hourValue);
  if (Number.isNaN(hour)) return value;

  const period = hour >= 12 ? "PM" : "AM";
  const twelveHour = hour % 12 || 12;
  return `${twelveHour}:${minuteValue.padStart(2, "0")} ${period}`;
}

function formatDateChoice(value: string) {
  return value ? formatBookingDate(value) : "Select Date";
}

function getTodayDateInputValue() {
  const gymNow = new Date(Date.now() + 8 * 60 * 60 * 1000);
  return `${gymNow.getUTCFullYear()}-${String(gymNow.getUTCMonth() + 1).padStart(2, "0")}-${String(gymNow.getUTCDate()).padStart(2, "0")}`;
}

function getMaxBookableDateInputValue() {
  const [year, month, day] = getTodayDateInputValue().split("-").map(Number);
  const maxDate = new Date(Date.UTC(year + 1, month - 1, day));
  return `${maxDate.getUTCFullYear()}-${String(maxDate.getUTCMonth() + 1).padStart(2, "0")}-${String(maxDate.getUTCDate()).padStart(2, "0")}`;
}

function timeToMinutes(value: string) {
  const [hourValue, minuteValue = "0"] = value.split(":");
  return Number(hourValue) * 60 + Number(minuteValue);
}

function parseBookingTimeToMinutes(value?: string) {
  if (!value) return Number.NaN;
  const trimmed = value.trim();
  const match = trimmed.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i);
  if (!match) return timeToMinutes(trimmed);

  let hour = Number(match[1]);
  const minute = Number(match[2]);
  const period = match[3]?.toUpperCase();

  if (period === "PM" && hour < 12) hour += 12;
  if (period === "AM" && hour === 12) hour = 0;

  return hour * 60 + minute;
}

function toGymWallClockIso(date: string, minutes: number) {
  const [year, month, day] = date.split("-").map(Number);
  const hour = Math.floor(minutes / 60);
  const minute = minutes % 60;
  const gymOffsetMinutes = 8 * 60;
  return new Date(Date.UTC(year, month - 1, day, hour, minute) - gymOffsetMinutes * 60 * 1000).toISOString();
}

function isoToGymTimeValue(value: string) {
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) return "";
  const gymTime = new Date(timestamp + 8 * 60 * 60 * 1000);
  return `${String(gymTime.getUTCHours()).padStart(2, "0")}:${String(gymTime.getUTCMinutes()).padStart(2, "0")}`;
}

function isoToGymDateValue(value: string) {
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) return "";
  const gymTime = new Date(timestamp + 8 * 60 * 60 * 1000);
  return `${gymTime.getUTCFullYear()}-${String(gymTime.getUTCMonth() + 1).padStart(2, "0")}-${String(gymTime.getUTCDate()).padStart(2, "0")}`;
}

function getGymCurrentMinutes() {
  const gymNow = new Date(Date.now() + 8 * 60 * 60 * 1000);
  return gymNow.getUTCHours() * 60 + gymNow.getUTCMinutes();
}

function getReservationDurationHours(startTime: string, endTime: string) {
  if (!startTime || !endTime) return 0;
  const duration = (timeToMinutes(endTime) - timeToMinutes(startTime)) / 60;
  return duration > 0 ? Math.round(duration * 100) / 100 : 0;
}

function isFutureGymStart(date: string, startTime: string) {
  if (!date || !startTime) return false;
  return Date.parse(toGymWallClockIso(date, timeToMinutes(startTime))) > Date.now();
}

function isActiveReservationStatus(status: MemberBookingItem["status"]) {
  return !["cancelled", "completed", "no_show"].includes(status);
}

function getBookingRangeMinutes(booking: MemberBookingItem) {
  const [rangeStart, rangeEnd] = booking.time.split(/\s+-\s+/);
  const start = parseBookingTimeToMinutes(booking.startTime ?? rangeStart);
  const end = parseBookingTimeToMinutes(booking.endTime ?? rangeEnd);
  return { end, start };
}

function matchesDay(selectedDate: string, dayValue: number | string) {
  const currentDate = new Date(`${selectedDate}T00:00:00`);
  const dayIndex = currentDate.getDay();
  if (typeof dayValue === "number") return dayValue === dayIndex;
  const normalized = String(dayValue).trim().toLowerCase();
  const numericDay = Number(normalized);
  if (Number.isInteger(numericDay)) return numericDay === dayIndex;
  return WEEKDAY_NAMES[dayIndex] === normalized;
}

function coachCoversReservationWindow(
  coach: CoachProfileRecord,
  selectedDate: string,
  selectedStartTime: string,
  selectedEndTime: string,
) {
  if (!selectedDate || !selectedStartTime || !selectedEndTime) return false;

  const startMinutes = timeToMinutes(selectedStartTime);
  const endMinutes = timeToMinutes(selectedEndTime);
  return (coach.availability ?? []).some(
    (slot) =>
      slot.isAvailable &&
      matchesDay(selectedDate, slot.dayOfWeek) &&
      timeToMinutes(slot.startTime) <= startMinutes &&
      timeToMinutes(slot.endTime) >= endMinutes,
  );
}

function getUpcomingAvailableDates(dayValues: Array<number | string>) {
  const availableDays = new Set<number>();
  dayValues.forEach((dayValue) => {
    if (typeof dayValue === "number") {
      availableDays.add(dayValue);
      return;
    }

    const normalized = String(dayValue).trim().toLowerCase();
    const numericDay = Number(normalized);
    if (Number.isInteger(numericDay)) {
      availableDays.add(numericDay);
      return;
    }

    const weekdayIndex = WEEKDAY_NAMES.findIndex((day) => day === normalized);
    if (weekdayIndex >= 0) {
      availableDays.add(weekdayIndex);
    }
  });

  if (availableDays.size === 0) return [];

  const dates: string[] = [];
  const cursor = new Date(`${getTodayDateInputValue()}T00:00:00`);
  for (let offset = 0; offset < 90; offset += 1) {
    const nextDate = new Date(cursor);
    nextDate.setDate(cursor.getDate() + offset);
    if (availableDays.has(nextDate.getDay())) {
      dates.push(
        `${nextDate.getFullYear()}-${String(nextDate.getMonth() + 1).padStart(2, "0")}-${String(nextDate.getDate()).padStart(2, "0")}`,
      );
    }
  }

  return dates;
}

function formatMoney(value: number) {
  return `PHP ${value.toLocaleString("en-PH", {
    maximumFractionDigits: 2,
    minimumFractionDigits: Number.isInteger(value) ? 0 : 2,
  })}`;
}

function coachMatchesSearch(coach: CoachProfileRecord, query: string) {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return true;

  return [
    getCoachName(coach),
    coach.bio ?? "",
    ...(coach.specialties ?? []),
    ...(coach.certifications ?? []),
  ].some((value) => value.toLowerCase().includes(normalized));
}

function getCoachBadgeTone(coach: CoachProfileRecord, colors: ThemeColors) {
  if (!coach.averageRating || coach.ratingCount === 0) return colors.warning;
  return coach.averageRating >= 4.5 ? colors.success : colors.brand;
}

function directoryBadgeStyle(toneColor: string, colors: ThemeColors, fontSize = 9.5): CSSProperties {
  return {
    backgroundColor: `${toneColor}14`,
    border: `1px solid ${toneColor}55`,
    borderRadius: 6,
    color: toneColor,
    display: "inline-flex",
    fontSize,
    fontWeight: 800,
    justifyContent: "center",
    lineHeight: 1,
    maxWidth: "100%",
    minWidth: 0,
    overflow: "hidden",
    padding: "5px 7px",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    boxShadow: `0 0 0 1px ${colors.surface}66 inset`,
  };
}

function CoachGridCard({
  coach,
  colors,
}: {
  coach: CoachProfileRecord;
  colors: ThemeColors;
}) {
  const ratingTone = getCoachBadgeTone(coach, colors);

  return (
    <div
      className="members-grid-card bookings-coach-grid-card"
      style={{
        alignContent: "space-between",
        backgroundColor: colors.surfaceRaised,
        border: `1px solid ${colors.border}`,
        borderRadius: 8,
        boxShadow: "none",
        display: "grid",
        gap: 9,
        gridTemplateRows: "46px 42px auto auto 38px",
        justifyItems: "center",
        minHeight: 218,
        minWidth: 0,
        padding: "15px 10px",
        textAlign: "center",
      }}
    >
      <div
        style={{
          alignItems: "center",
          backgroundColor: colors.surface,
          border: `1px solid ${colors.border}`,
          borderRadius: 8,
          color: colors.brand,
          display: "flex",
          height: 46,
          justifyContent: "center",
          overflow: "hidden",
          width: 46,
        }}
      >
        <FitText
          style={{
            color: colors.brand,
            fontSize: 15,
            fontWeight: 850,
            letterSpacing: "0.03em",
          }}
        >
          {getCoachInitials(coach)}
        </FitText>
      </div>
      <div style={{ display: "grid", gap: 2, minWidth: 0, width: "100%" }}>
        <FitText
          style={{
            color: colors.textPrimary,
            fontSize: 13.5,
            fontWeight: 850,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {getCoachName(coach)}
        </FitText>
        <FitText
          style={{
            color: colors.textSecondary,
            fontSize: 10.5,
            fontWeight: 500,
            letterSpacing: "0.02em",
            textTransform: "uppercase",
          }}
        >
          Coach
        </FitText>
      </div>
      <div style={{ display: "grid", gap: 4, justifyItems: "center", minWidth: 0, width: "100%" }}>
        <FitText
          style={{
            color: colors.textMuted,
            fontSize: 9.5,
            fontWeight: 700,
            letterSpacing: "0.04em",
            textTransform: "uppercase",
          }}
        >
          Rating
        </FitText>
        <span style={directoryBadgeStyle(ratingTone, colors, 10)}>{getCoachRatingBadgeLabel(coach)}</span>
      </div>
      <div style={{ display: "grid", gap: 4, justifyItems: "center", minWidth: 0, width: "100%" }}>
        <FitText
          style={{
            color: colors.textMuted,
            fontSize: 9.5,
            fontWeight: 700,
            letterSpacing: "0.04em",
            textTransform: "uppercase",
          }}
        >
          Rate
        </FitText>
        <FitText
          style={{
            color: colors.textSecondary,
            fontSize: 11,
            fontWeight: 650,
            lineHeight: 1.25,
            maxWidth: "100%",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {getCoachRateLabel(coach)}
        </FitText>
      </div>
      <div style={{ display: "grid", gap: 2, minWidth: 0 }}>
        <FitText
          style={{
            color: colors.textMuted,
            fontSize: 10,
            fontWeight: 800,
            letterSpacing: "0.04em",
          }}
        >
          Availability
        </FitText>
        <FitText
          style={{
            color: colors.textSecondary,
            fontSize: 11,
            fontWeight: 500,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {getCoachAvailabilityLabel(coach)}
        </FitText>
      </div>
    </div>
  );
}

function BookingModeSwitch({
  onChange,
  value,
}: {
  onChange: (value: BookingMode) => void;
  value: BookingMode;
}) {
  return (
    <div
      className="bookings-mode-switch"
      role="tablist"
      aria-label="Bookings view"
      style={{
        display: "inline-flex",
        flexWrap: "nowrap",
        gap: 8,
        justifyContent: "flex-start",
      }}
    >
      {BOOKING_MODE_OPTIONS.map((option) => (
        <FitButton
          key={option.value}
          variant="chip"
          active={option.value === value}
          icon={option.icon}
          iconSize={14}
          label={option.label}
          onClick={() => onChange(option.value)}
          role="tab"
          aria-selected={option.value === value}
          style={{ minHeight: 33, borderRadius: 6, flex: "0 0 108px", justifyContent: "center" }}
          textStyle={{ fontSize: 12, fontWeight: 800 }}
        />
      ))}
    </div>
  );
}

function BookingQuickActions({
  disabled,
  onBookTrainer,
  onMakeReservation,
}: {
  disabled?: boolean;
  onBookTrainer: () => void;
  onMakeReservation: () => void;
}) {
  return (
    <div
      className="bookings-quick-actions"
      style={{
        alignItems: "center",
        display: "flex",
        flexWrap: "wrap",
        gap: 8,
        justifyContent: "flex-start",
      }}
    >
      <FitButton
        variant="primary"
        icon={CalendarCheck}
        iconSize={14}
        label="Make a Reservation"
        disabled={disabled}
        onClick={onMakeReservation}
        style={{ minHeight: 34, borderRadius: 6 }}
        textStyle={{ fontSize: 12, fontWeight: 850 }}
      />
      <FitButton
        variant="ghost"
        icon={UserRoundCheck}
        iconSize={14}
        label="Book a Trainer"
        disabled={disabled}
        onClick={onBookTrainer}
        style={{ minHeight: 34, borderRadius: 6 }}
        textStyle={{ fontSize: 12, fontWeight: 800 }}
      />
    </div>
  );
}

function CoachDiscoveryPanel({
  coaches,
  currentPage,
  error,
  loading,
  modeSwitch,
  onPageChange,
  onRatingFilterChange,
  onSearchChange,
  onSelectCoach,
  onSkillFilterChange,
  primaryActions,
  ratingFilter,
  searchQuery,
  selectedCoachId,
  skillFilter,
  skillOptions,
  totalFilteredCount,
  totalPages,
}: {
  coaches: CoachProfileRecord[];
  currentPage: number;
  error: boolean;
  loading: boolean;
  modeSwitch: ReactNode;
  onPageChange: (page: number) => void;
  onRatingFilterChange: (value: CoachRatingFilter) => void;
  onSearchChange: (value: string) => void;
  onSelectCoach: (coachId: string) => void;
  onSkillFilterChange: (value: CoachSkillFilter) => void;
  primaryActions?: ReactNode;
  ratingFilter: CoachRatingFilter;
  searchQuery: string;
  selectedCoachId?: string | null;
  skillFilter: CoachSkillFilter;
  skillOptions: Array<{ label: string; value: CoachSkillFilter }>;
  totalFilteredCount: number;
  totalPages: number;
}) {
  const { colors } = useTheme();
  const pageStart = totalFilteredCount === 0 ? 0 : (currentPage - 1) * COACH_DIRECTORY_PAGE_SIZE + 1;
  const pageEnd = totalFilteredCount === 0
    ? 0
    : Math.min(totalFilteredCount, currentPage * COACH_DIRECTORY_PAGE_SIZE);
  const selectedSkillLabel =
    skillOptions.find((option) => option.value === skillFilter)?.label ??
    skillFilter;
  const selectedRatingLabel =
    COACH_RATING_FILTERS.find((option) => option.value === ratingFilter)?.label ??
    ratingFilter;

  const handleCardKeyDown = (event: KeyboardEvent<HTMLDivElement>, coachId: string) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    onSelectCoach(coachId);
  };

  return (
    <section
      aria-label="Coach Discovery"
      className="members-directory-panel bookings-coach-directory"
      data-bookings-coach-directory
      style={{
        backgroundColor: `${colors.surface}f2`,
        border: `1px solid ${colors.border}`,
        borderRadius: 8,
        boxShadow: "none",
        display: "grid",
        gap: 0,
        gridTemplateRows: "auto minmax(0, 1fr) auto",
        height: "100%",
        minHeight: 0,
        overflow: "hidden",
        padding: 0,
      }}
    >
      <div
        className="members-directory-panel__top"
        style={{
          backgroundColor: `${colors.surfaceRaised}f5`,
          border: "none",
          borderBottom: `1px solid ${colors.border}`,
          borderRadius: 0,
          padding: "14px 12px",
        }}
      >
        <div
          className="members-directory-toolbar bookings-coach-toolbar"
          style={{
            alignItems: "center",
            display: "flex",
            flexWrap: "nowrap",
            gap: 10,
            justifyContent: "space-between",
            minHeight: 40,
          }}
        >
          <div
            className="members-directory-toolbar-left"
            style={{
              alignItems: "center",
              display: "flex",
              flex: `0 1 ${BOOKING_TOOLBAR_SEARCH_WIDTH}px`,
              gap: 8,
              minWidth: 0,
            }}
          >
            <div
              className="members-directory-search"
              style={{
                flex: `0 1 ${BOOKING_TOOLBAR_SEARCH_WIDTH}px`,
                maxWidth: BOOKING_TOOLBAR_SEARCH_WIDTH,
                minWidth: 190,
              }}
            >
              <FitSearch
                ariaLabel="Search coaches by name, skill, or certification"
                value={searchQuery}
                onChangeText={onSearchChange}
                placeholder="Search coaches..."
              />
            </div>
          </div>
          <div
            className="members-directory-toolbar-right"
            style={{
              alignItems: "center",
              display: "flex",
              flex: "1 1 360px",
              flexWrap: "nowrap",
              gap: 8,
              justifyContent: "flex-end",
              marginLeft: "auto",
              minWidth: 0,
            }}
          >
            {modeSwitch}
            <div
              className="members-toolbar-filters"
              style={{
                alignItems: "center",
                display: "grid",
                flex: "0 0 auto",
                gap: 6,
                gridTemplateColumns: `14px ${BOOKING_TOOLBAR_FILTER_WIDTH}px`,
                minWidth: 0,
              }}
            >
              <Filter size={14} color={colors.textMuted} strokeWidth={2} />
              <FitSelect
                compact
                fullWidth
                aria-label={`Filter coaches by skill: ${selectedSkillLabel}`}
                name="coachSkillFilter"
                value={skillFilter}
                options={skillOptions.map((option) => ({ label: option.label, value: option.value }))}
                onChange={(event) => onSkillFilterChange(event.currentTarget.value)}
                style={{
                  borderRadius: 8,
                  fontSize: 12,
                  height: 38,
                  minWidth: 0,
                  paddingLeft: 8,
                  paddingRight: 22,
                  width: "100%",
                }}
              />
            </div>
            <div
              className="members-toolbar-status-filter"
              style={{
                alignItems: "center",
                display: "grid",
                flex: "0 0 auto",
                gap: 6,
                gridTemplateColumns: `14px ${BOOKING_TOOLBAR_FILTER_WIDTH}px`,
                minWidth: 0,
              }}
            >
              <Filter size={14} color={colors.textMuted} strokeWidth={2} />
              <FitSelect
                compact
                fullWidth
                aria-label={`Filter coaches by rating: ${selectedRatingLabel}`}
                name="coachRatingFilter"
                value={ratingFilter}
                options={COACH_RATING_FILTERS.map((option) => ({ label: option.label, value: option.value }))}
                onChange={(event) => onRatingFilterChange(event.currentTarget.value as CoachRatingFilter)}
                style={{
                  borderRadius: 8,
                  fontSize: 12,
                  height: 38,
                  minWidth: 0,
                  paddingLeft: 8,
                  paddingRight: 22,
                  width: "100%",
                }}
              />
            </div>
          </div>
        </div>
        {primaryActions ? (
          <div
            className="bookings-records-primary-actions"
            style={{
              borderTop: `1px solid ${colors.border}`,
              marginTop: 12,
              paddingTop: 12,
            }}
          >
            {primaryActions}
          </div>
        ) : null}
      </div>

      <div
        className="members-directory-panel__middle"
        style={{
          background: colors.surface,
          border: "none",
          borderRadius: 0,
          display: "grid",
          minHeight: 0,
          padding: 0,
        }}
      >
        {loading ? (
          <div
            className="members-directory-panel__view-enter"
            style={{
              backgroundColor: `${colors.surface}e8`,
              border: `1px solid ${colors.border}`,
              borderRadius: 0,
              padding: 18,
            }}
          >
            <FitText style={{ color: colors.textSecondary, fontSize: 13 }}>
              Loading coaches...
            </FitText>
          </div>
        ) : error ? (
          <div
            className="members-directory-panel__view-enter"
            style={{
              backgroundColor: `${colors.surface}d8`,
              border: `1px dashed ${colors.border}`,
              borderRadius: 8,
              margin: 12,
              padding: 18,
            }}
          >
            <FitText style={{ color: colors.textSecondary, fontSize: 13, lineHeight: 1.6 }}>
              Coaches are unavailable right now.
            </FitText>
          </div>
        ) : coaches.length > 0 ? (
          <div className="members-directory-panel__grid members-directory-panel__view-enter bookings-coach-grid">
            {coaches.map((coach) => {
              const isSelected = coach.id === selectedCoachId;

              return (
                <div
                  key={coach.id}
                  role="button"
                  tabIndex={0}
                  aria-pressed={isSelected}
                  className={
                    isSelected
                      ? "members-directory-panel__grid-card members-directory-panel__grid-card-active"
                      : "members-directory-panel__grid-card"
                  }
                  onClick={() => onSelectCoach(coach.id)}
                  onKeyDown={(event) => handleCardKeyDown(event, coach.id)}
                  style={{ cursor: "pointer" }}
                >
                  <CoachGridCard coach={coach} colors={colors} />
                </div>
              );
            })}
          </div>
        ) : (
          <div
            className="members-directory-panel__view-enter"
            style={{
              backgroundColor: `${colors.surface}d8`,
              border: `1px dashed ${colors.border}`,
              borderRadius: 8,
              margin: 12,
              padding: 18,
            }}
          >
            <FitText style={{ color: colors.textSecondary, fontSize: 13, lineHeight: 1.6 }}>
              No coaches match the current filters.
            </FitText>
          </div>
        )}
      </div>

      {!loading ? (
        <div
          className="members-directory-panel__bottom"
          style={{
            backgroundColor: `${colors.surfaceRaised}f5`,
            border: "none",
            borderRadius: 0,
            borderTop: `1px solid ${colors.border}`,
            padding: "10px 12px",
          }}
        >
          <div
            className="members-directory-panel__footer"
            style={{
              alignItems: "center",
              display: "flex",
              flexWrap: "wrap",
              gap: 8,
              justifyContent: "space-between",
            }}
          >
            <FitText style={{ color: colors.textSecondary, fontSize: 11.5 }}>
              Showing {pageStart} - {pageEnd} of {totalFilteredCount}
            </FitText>
            <FitPagination
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={onPageChange}
              ariaLabel="Coach discovery pagination"
              showSinglePage
            />
          </div>
        </div>
      ) : null}
    </section>
  );
}

function ComposerSection({
  children,
  title,
}: {
  children: ReactNode;
  title: string;
}) {
  const { colors } = useTheme();

  return (
    <div
      style={{
        backgroundColor: colors.surfaceRaised,
        border: `1px solid ${colors.border}`,
        borderRadius: 8,
        display: "grid",
        gap: 10,
        padding: 12,
      }}
    >
      <FitText
        style={{
          color: colors.brand,
          fontSize: 11,
          fontWeight: 850,
          letterSpacing: "0.04em",
          textTransform: "uppercase",
        }}
      >
        {title}
      </FitText>
      {children}
    </div>
  );
}

function ComposerDetailTile({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  const { colors } = useTheme();

  return (
    <div
      style={{
        backgroundColor: colors.surfaceRaised,
        border: `1px solid ${colors.border}`,
        borderRadius: 8,
        display: "grid",
        gridTemplateColumns: "minmax(0, 1fr)",
        gridTemplateRows: "auto auto",
        gap: 4,
        minWidth: 0,
        minHeight: 58,
        padding: "9px 10px",
        width: "100%",
      }}
    >
      <FitText
        excludeGlobalScale
        style={{
          color: colors.textMuted,
          fontSize: 9.25,
          fontWeight: 800,
          letterSpacing: "0.04em",
          textTransform: "uppercase",
        }}
      >
        {label}
      </FitText>
      <FitText
        style={{
          color: colors.textPrimary,
          fontSize: 12.5,
          fontWeight: 750,
          lineHeight: 1.3,
          overflowWrap: "anywhere",
        }}
      >
        {value}
      </FitText>
    </div>
  );
}

function CoachDetailsContent({ coach }: { coach: CoachProfileRecord }) {
  const detailRows = [
    { label: "Specialties", value: coach.specialties?.filter(Boolean).join(", ") || "General coaching" },
    { label: "Certifications", value: coach.certifications?.filter(Boolean).join(", ") || "Not listed" },
    { label: "Availability", value: getCoachAvailabilityLabel(coach) },
    { label: "Contact", value: coach.contactEmail || coach.contactPhone || "Staff coordinated" },
  ];

  return (
    <>
      <div
        className="bookings-coach-stat-grid"
        style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(2, minmax(0, 1fr))", minWidth: 0, width: "100%" }}
      >
        <ComposerDetailTile label="Rating" value={getCoachRatingStat(coach)} />
        <ComposerDetailTile label="Rate" value={getCoachRateLabel(coach)} />
        <ComposerDetailTile label="Experience" value={getCoachExperienceLabel(coach)} />
        <ComposerDetailTile label="Schedule" value={getCoachScheduleTypeLabel(coach)} />
      </div>
      <ComposerSection title="Coach Details">
        <div className="bookings-coach-detail-lines" style={{ display: "grid", gap: 10, minWidth: 0, width: "100%" }}>
          <MemberText variant="subtitle">{coach.bio?.trim() || "No coach bio has been added yet."}</MemberText>
          <div style={{ display: "grid", gap: 8, minWidth: 0, width: "100%" }}>
            {detailRows.map((row) => (
              <BookingDetailLine key={row.label} label={row.label} value={row.value} />
            ))}
          </div>
        </div>
      </ComposerSection>
    </>
  );
}

function RecentFeedbackContent({ coach }: { coach: CoachProfileRecord }) {
  const { colors } = useTheme();
  const reviews = coach.recentReviews ?? [];

  return (
    <ComposerSection title="Recent Feedback">
      {reviews.length ? (
        <div style={{ display: "grid", gap: 10 }}>
          {reviews.slice(0, 4).map((review) => (
            <div
              key={review.id}
              style={{
                backgroundColor: colors.surface,
                border: `1px solid ${colors.border}`,
                borderRadius: 8,
                display: "grid",
                gap: 7,
                padding: 12,
              }}
            >
              <div style={{ alignItems: "center", display: "flex", gap: 8, justifyContent: "space-between" }}>
                <FitText style={{ color: colors.textPrimary, fontSize: 12.5, fontWeight: 850 }}>
                  {review.rating} stars
                </FitText>
                <FitText style={{ color: colors.textMuted, fontSize: 11, fontWeight: 700 }}>
                  {review.reviewerName}
                </FitText>
              </div>
              <MemberText variant="subtitle">
                {review.comment?.trim() || "Member left a rating without a note."}
              </MemberText>
            </div>
          ))}
        </div>
      ) : (
        <div
          style={{
            backgroundColor: colors.surface,
            border: `1px dashed ${colors.border}`,
            borderRadius: 8,
            padding: 14,
          }}
        >
          <MemberText variant="subtitle">Member reviews will appear here after completed sessions.</MemberText>
        </div>
      )}
    </ComposerSection>
  );
}

function getToneColor(tone: ReturnType<typeof getStatusTone>, colors: ThemeColors) {
  if (tone === "danger") return colors.danger;
  if (tone === "success") return colors.success;
  if (tone === "warning") return colors.warning;
  if (tone === "muted") return colors.textMuted;
  return colors.brand;
}

function getBookingInitials(booking: MemberBookingItem) {
  return booking.resourceName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "BK";
}

function getBookingKindLabel(booking: MemberBookingItem, activeSection: BookingSection) {
  if (activeSection === "appointments") {
    return booking.bookingType === "recurring" ? "Recurring" : "One-time";
  }

  return booking.resourceType ? booking.resourceType.replace(/_/g, " ") : "Reservation";
}

function getBookingAmountLabel(booking: MemberBookingItem) {
  const amount = booking.totalAmount ?? booking.price ?? 0;
  return formatMoney(Number(amount));
}

function getBookingScheduleLabel(booking: MemberBookingItem) {
  return `${formatBookingDate(booking.date)} / ${booking.time}`;
}

function BookingStatusBadge({
  colors,
  status,
}: {
  colors: ThemeColors;
  status: string;
}) {
  const tone = getToneColor(getStatusTone(status), colors);

  return (
    <span
      style={{
        backgroundColor: `${tone}14`,
        border: `1px solid ${tone}55`,
        borderRadius: 6,
        display: "inline-grid",
        justifyItems: "center",
        minWidth: 64,
        padding: "4px 9px",
        textAlign: "center",
      }}
    >
      <FitText
        as="span"
        excludeGlobalScale
        style={{
          color: tone,
          fontSize: 9.5,
          fontWeight: 600,
          lineHeight: 1.08,
        }}
      >
        {formatStatusLabel(status)}
      </FitText>
    </span>
  );
}

function BookingDetailLine({
  label,
  value,
}: {
  label: string;
  value: ReactNode;
}) {
  const { colors } = useTheme();

  return (
    <div
      style={{
        alignItems: "baseline",
        display: "grid",
        gap: 10,
        gridTemplateColumns: "112px minmax(0, 1fr)",
        minWidth: 0,
        width: "100%",
      }}
    >
      <FitText
        excludeGlobalScale
        style={{
          color: colors.textMuted,
          fontSize: 9.5,
          fontWeight: 850,
          letterSpacing: "0.04em",
          textTransform: "uppercase",
        }}
      >
        {label}
      </FitText>
      {typeof value === "string" ? (
        <FitText
          style={{
            color: colors.textSecondary,
            fontSize: 12.25,
            fontWeight: 500,
            lineHeight: 1.32,
            overflowWrap: "anywhere",
          }}
        >
          {value}
        </FitText>
      ) : (
        value
      )}
    </div>
  );
}

function BookingCompactStatCard({
  label,
  tone,
  value,
}: {
  label: string;
  tone: ReturnType<typeof getStatusTone>;
  value: string;
}) {
  const { colors } = useTheme();
  const toneColor = getToneColor(tone, colors);

  return (
    <div
      style={{
        backgroundColor: colors.surfaceRaised,
        border: `1px solid ${colors.border}`,
        borderRadius: 8,
        display: "grid",
        gap: 3,
        minWidth: 0,
        padding: "8px 10px",
      }}
    >
      <FitText
        excludeGlobalScale
        style={{
          color: colors.textMuted,
          fontSize: 9,
          fontWeight: 800,
          letterSpacing: "0.04em",
          textTransform: "uppercase",
        }}
      >
        {label}
      </FitText>
      <FitText
        style={{
          color: toneColor,
          fontSize: 12,
          fontWeight: 750,
          lineHeight: 1.18,
          overflowWrap: "anywhere",
        }}
      >
        {value}
      </FitText>
    </div>
  );
}

function BookingsFilterSelect<TValue extends string>({
  ariaLabel,
  name,
  onChange,
  options,
  value,
  width = 150,
}: {
  ariaLabel: string;
  name: string;
  onChange: (value: TValue) => void;
  options: Array<{ label: string; value: TValue }>;
  value: TValue;
  width?: number;
}) {
  const { colors } = useTheme();
  const selectedLabel =
    options.find((option) => option.value === value)?.label ?? value;

  return (
    <div
      className="members-toolbar-filters"
      style={{
        alignItems: "center",
        display: "grid",
        flex: "0 0 auto",
        gap: 6,
        gridTemplateColumns: `14px ${width}px`,
        minWidth: 0,
      }}
    >
      <Filter size={14} color={colors.textMuted} strokeWidth={2} />
      <FitSelect
        compact
        fullWidth
        aria-label={`${ariaLabel}: ${selectedLabel}`}
        name={name}
        value={value}
        options={options.map((option) => ({ label: option.label, value: option.value }))}
        onChange={(event) => onChange(event.currentTarget.value as TValue)}
        style={{
          borderRadius: 8,
          fontSize: 12,
          height: 38,
          minWidth: 0,
          paddingLeft: 8,
          paddingRight: 22,
          width: "100%",
        }}
      />
    </div>
  );
}

function BookingsRecordsPanel({
  activeSection,
  currentPage,
  isLoading,
  modeSwitch,
  onPageChange,
  onSearchChange,
  onSectionChange,
  onSelectBooking,
  onStatusFilterChange,
  primaryActions,
  rows,
  searchQuery,
  selectedBookingId,
  statusFilter,
  totalFilteredCount,
  totalPages,
}: {
  activeSection: BookingSection;
  currentPage: number;
  isLoading: boolean;
  modeSwitch: ReactNode;
  onPageChange: (page: number) => void;
  onSearchChange: (value: string) => void;
  onSectionChange: (value: BookingSection) => void;
  onSelectBooking: (booking: MemberBookingItem) => void;
  onStatusFilterChange: (value: BookingStatusFilter) => void;
  primaryActions?: ReactNode;
  rows: MemberBookingItem[];
  searchQuery: string;
  selectedBookingId?: string;
  statusFilter: BookingStatusFilter;
  totalFilteredCount: number;
  totalPages: number;
}) {
  const { colors } = useTheme();
  const pageStart = totalFilteredCount === 0 ? 0 : (currentPage - 1) * BOOKING_RECORDS_PAGE_SIZE + 1;
  const pageEnd = totalFilteredCount === 0
    ? 0
    : Math.min(totalFilteredCount, currentPage * BOOKING_RECORDS_PAGE_SIZE);
  const gridTemplateColumns = "minmax(220px, 1.45fr) minmax(104px, 0.65fr) minmax(152px, 0.85fr) minmax(96px, 0.56fr) minmax(94px, 0.5fr)";
  const tableColumns = [
    { heading: "Booking", key: "booking" },
    { heading: "Type", key: "type" },
    { heading: "Schedule", key: "schedule" },
    { heading: "Status", key: "status" },
    { heading: "Due", key: "due" },
  ];

  const handleRowKeyDown = (event: KeyboardEvent<HTMLDivElement>, booking: MemberBookingItem) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    onSelectBooking(booking);
  };

  return (
    <section
      aria-label="Bookings"
      className="members-directory-panel bookings-records-panel"
      style={{
        backgroundColor: `${colors.surface}f2`,
        border: `1px solid ${colors.border}`,
        borderRadius: 8,
        display: "grid",
        gap: 0,
        gridTemplateRows: "auto minmax(0, 1fr) auto",
        height: "100%",
        minHeight: 0,
        overflow: "hidden",
      }}
    >
      <div
        className="members-directory-panel__top"
        style={{
          backgroundColor: `${colors.surfaceRaised}f5`,
          borderBottom: `1px solid ${colors.border}`,
          padding: "14px 12px",
        }}
      >
        <div
          className="members-directory-toolbar bookings-records-toolbar"
          style={{
            alignItems: "center",
            display: "flex",
            flexWrap: "nowrap",
            gap: 10,
            justifyContent: "space-between",
            minHeight: 40,
            minWidth: 0,
          }}
        >
          <div
            className="members-directory-search"
            style={{
              flex: `0 1 ${BOOKING_TOOLBAR_SEARCH_WIDTH}px`,
              maxWidth: BOOKING_TOOLBAR_SEARCH_WIDTH,
              minWidth: 190,
            }}
          >
            <FitSearch
              ariaLabel="Search bookings"
              value={searchQuery}
              onChangeText={onSearchChange}
              placeholder="Search bookings"
            />
          </div>
          <div
            className="members-directory-toolbar-right"
            style={{
              alignItems: "center",
              display: "flex",
              flex: "1 1 420px",
              flexWrap: "nowrap",
              gap: 8,
              justifyContent: "flex-end",
              minWidth: 0,
            }}
          >
            {modeSwitch}
            <BookingsFilterSelect
              ariaLabel="Filter booking type"
              name="bookingSection"
              value={activeSection}
              options={MEMBER_BOOKING_SECTIONS}
              onChange={onSectionChange}
              width={BOOKING_TOOLBAR_FILTER_WIDTH}
            />
            <BookingsFilterSelect
              ariaLabel="Filter booking status"
              name="bookingStatus"
              value={statusFilter}
              options={[...BOOKING_STATUS_FILTERS]}
              onChange={onStatusFilterChange}
              width={BOOKING_TOOLBAR_FILTER_WIDTH}
            />
          </div>
        </div>
        {primaryActions ? (
          <div
            className="bookings-records-primary-actions"
            style={{
              borderTop: `1px solid ${colors.border}`,
              marginTop: 12,
              paddingTop: 12,
            }}
          >
            {primaryActions}
          </div>
        ) : null}
      </div>

      <div className="members-directory-panel__middle bookings-records-table" style={{ display: "grid", minHeight: 0 }}>
        {isLoading ? (
          <div className="members-directory-panel__view-enter" style={{ padding: 18 }}>
            <FitText style={{ color: colors.textSecondary, fontSize: 13 }}>Loading bookings...</FitText>
          </div>
        ) : rows.length === 0 ? (
          <div
            className="members-directory-panel__view-enter"
            style={{
              backgroundColor: `${colors.surface}d8`,
              border: `1px dashed ${colors.border}`,
              borderRadius: 8,
              margin: 12,
              padding: 18,
            }}
          >
            <FitText style={{ color: colors.textSecondary, fontSize: 13, lineHeight: 1.6 }}>
              No bookings match the current search and filters.
            </FitText>
          </div>
        ) : (
          <div
            className="members-directory-panel__list members-directory-panel__view-enter"
            style={{ display: "grid", gridTemplateRows: "auto minmax(0, 1fr)", height: "100%", minHeight: 0 }}
          >
            <div
              className="members-directory-panel__table-head"
              style={{
                backgroundColor: `${colors.surfaceRaised}bd`,
                borderBottom: `1px solid ${colors.border}`,
                display: "grid",
                gap: 12,
                gridTemplateColumns,
                padding: "7px 12px 8px",
              }}
            >
              {tableColumns.map((column) => (
                <FitText
                  key={column.key}
                  style={{
                    color: colors.textMuted,
                    fontSize: 10.5,
                    fontWeight: 700,
                    justifySelf: column.key === "status" ? "center" : undefined,
                    letterSpacing: "0.05em",
                    textAlign: column.key === "status" ? "center" : undefined,
                  }}
                >
                  {column.heading}
                </FitText>
              ))}
            </div>
            <div className="members-directory-panel__rows" style={{ alignContent: "start", display: "grid", minHeight: 0, overflowY: "auto" }}>
              {rows.map((booking, index) => {
                const isActive = selectedBookingId === booking.id;

                return (
                  <div
                    key={booking.id}
                    role="button"
                    tabIndex={0}
                    aria-pressed={isActive}
                    className={isActive ? "members-directory-panel__row members-directory-panel__row-active" : "members-directory-panel__row"}
                    data-row-index={index + 1}
                    onClick={() => onSelectBooking(booking)}
                    onKeyDown={(event) => handleRowKeyDown(event, booking)}
                    style={{
                      alignItems: "center",
                      backgroundColor: isActive ? `${colors.brand}12` : "transparent",
                      border: "none",
                      borderBottom: `1px solid ${colors.border}`,
                      borderRadius: 0,
                      boxShadow: isActive ? `3px 0 0 ${colors.brand} inset` : "none",
                      cursor: "pointer",
                      display: "grid",
                      gap: 12,
                      gridTemplateColumns,
                      minHeight: 44,
                      outline: "none",
                      padding: "7px 12px",
                    }}
                  >
                    <div className="members-directory-panel__identity" style={{ alignItems: "center", display: "flex", gap: 10, minWidth: 0 }}>
                      <div
                        className="members-directory-panel__identity-avatar"
                        style={{
                          alignItems: "center",
                          backgroundColor: colors.surfaceRaised,
                          border: `1px solid ${colors.border}`,
                          borderRadius: 8,
                          color: colors.brand,
                          display: "flex",
                          flexShrink: 0,
                          height: 34,
                          justifyContent: "center",
                          width: 34,
                        }}
                      >
                        <FitText style={{ color: colors.brand, fontSize: 11.5, fontWeight: 850 }}>
                          {getBookingInitials(booking)}
                        </FitText>
                      </div>
                      <div className="members-directory-panel__identity-copy" style={{ display: "grid", gap: 2, minWidth: 0 }}>
                        <FitText
                          className="members-directory-panel__primary-text"
                          style={{
                            color: colors.textPrimary,
                            fontSize: 13,
                            fontWeight: 800,
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {booking.resourceName}
                        </FitText>
                        <FitText
                          className="members-directory-panel__secondary-text"
                          style={{
                            color: colors.textSecondary,
                            fontSize: 11,
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {booking.participantLabel ?? (activeSection === "appointments" ? "Coach" : "Venue")} {booking.participantName ? `/ ${booking.participantName}` : ""}
                        </FitText>
                      </div>
                    </div>
                    <FitText style={{ color: colors.textSecondary, fontSize: 12, fontWeight: 500, textTransform: "capitalize" }}>
                      {getBookingKindLabel(booking, activeSection)}
                    </FitText>
                    <FitText style={{ color: colors.textSecondary, fontSize: 12, fontWeight: 500 }}>
                      {getBookingScheduleLabel(booking)}
                    </FitText>
                    <div style={{ justifySelf: "center", textAlign: "center" }}>
                      <BookingStatusBadge colors={colors} status={booking.status} />
                    </div>
                    <FitText style={{ color: colors.textSecondary, fontSize: 12, fontWeight: 600, textAlign: "right" }}>
                      {getBookingAmountLabel(booking)}
                    </FitText>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {!isLoading ? (
        <div
          className="members-directory-panel__bottom"
          style={{
            backgroundColor: `${colors.surfaceRaised}f5`,
            border: "none",
            borderRadius: 0,
            borderTop: `1px solid ${colors.border}`,
            padding: "10px 12px",
          }}
        >
          <div
            className="members-directory-panel__footer"
            style={{
              alignItems: "center",
              display: "flex",
              flexWrap: "wrap",
              gap: 8,
              justifyContent: "space-between",
            }}
          >
            <FitText style={{ color: colors.textSecondary, fontSize: 11.5 }}>
              Showing {pageStart} - {pageEnd} of {totalFilteredCount}
            </FitText>
            <FitPagination
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={onPageChange}
              ariaLabel="Bookings pagination"
              showSinglePage
            />
          </div>
        </div>
      ) : null}
    </section>
  );
}

function BookingInspectorContent({
  activeSection,
  booking,
  canReviewCoach,
  mode,
  onReviewStateChange,
  onReviewSubmit,
  reviewComment,
  reviewRating,
  reviewState,
  setReviewComment,
  setReviewRating,
  submitPending,
  venueUnderMaintenance = false,
}: {
  activeSection: BookingSection;
  booking: MemberBookingItem | null;
  canReviewCoach: boolean;
  mode: BookingPanelMode;
  onReviewStateChange: (value: { text: string; tone: "danger" | "success" } | null) => void;
  onReviewSubmit: () => void;
  reviewComment: string;
  reviewRating: number;
  reviewState: { text: string; tone: "danger" | "success" } | null;
  setReviewComment: (value: string) => void;
  setReviewRating: (value: number) => void;
  submitPending: boolean;
  venueUnderMaintenance?: boolean;
}) {
  const { colors } = useTheme();

  if (!booking) {
    return <EmptyState icon={CalendarCheck} title="Select a record" hint="Booking details will appear here." />;
  }

  return (
    <div className="bookings-inspector-body">
      <MemberPanelHeader
        eyebrow={activeSection === "bookings" ? "Reservation" : "Appointment"}
        title={booking.detailTitle ?? booking.resourceName}
        action={<BookingStatusBadge colors={colors} status={booking.status} />}
      />
      <FitText style={{ color: colors.textSecondary, fontSize: 12.5, fontWeight: 500, lineHeight: 1.45 }}>
        {booking.detailSubtitle ?? getBookingScheduleLabel(booking)}
      </FitText>
      <div style={{ display: "grid", gap: 8, gridTemplateColumns: "1fr", minWidth: 0 }}>
        <BookingCompactStatCard
          label="Status"
          value={formatStatusLabel(booking.status)}
          tone={getStatusTone(booking.status)}
        />
        <BookingCompactStatCard label="Total price" value={getBookingAmountLabel(booking)} tone="brand" />
      </div>

      {activeSection === "bookings" && venueUnderMaintenance ? (
        <div
          style={{
            backgroundColor: `${colors.warning}12`,
            border: `1px solid ${colors.warning}45`,
            borderRadius: 8,
            padding: "10px 12px",
          }}
        >
          <FitText
            style={{
              color: colors.warning,
              fontSize: 12,
              fontWeight: 700,
              lineHeight: 1.45,
            }}
          >
            This venue is currently under maintenance. Your booking remains confirmed until staff reschedules or resolves it.
          </FitText>
        </div>
      ) : null}

      {mode === "details" ? (
        <div
          style={{
            border: `1px solid ${colors.border}`,
            borderRadius: 8,
            backgroundColor: colors.surface,
            display: "grid",
            gap: 11,
            padding: "12px 14px",
          }}
        >
          <MemberText variant="brand">Booking Details</MemberText>
          <BookingDetailLine label="Resource" value={booking.resourceName} />
          <BookingDetailLine label="Type" value={getBookingKindLabel(booking, activeSection)} />
          <BookingDetailLine label="Schedule" value={getBookingScheduleLabel(booking)} />
          <BookingDetailLine label="Participant" value={booking.participantName ?? booking.participantLabel ?? "Member"} />
          <BookingDetailLine label="Price" value={getBookingAmountLabel(booking)} />
        </div>
      ) : null}

      {mode === "timeline" ? (
        <div
          style={{
            border: `1px solid ${colors.border}`,
            borderRadius: 8,
            backgroundColor: colors.surface,
            display: "grid",
            gap: 10,
            padding: 12,
          }}
        >
          <MemberText variant="brand">Session Timeline</MemberText>
          {[
            {
              label: activeSection === "appointments" ? "Paid booking created" : "Reservation created",
              meta: getBookingScheduleLabel(booking),
              tone: colors.textMuted,
            },
            {
              label: formatStatusLabel(booking.status),
              meta: activeSection === "appointments"
                ? booking.bookingType === "recurring" ? "Recurring plan session" : "One-time coaching session"
                : "Venue reservation",
              tone: colors.brand,
            },
            ...(booking.status === "completed"
              ? [
                  {
                    label: "Session completed",
                    meta: "Coach report and member review unlock after completion.",
                    tone: colors.success,
                  },
                ]
              : []),
          ].map((item, index, items) => (
            <div key={`${item.label}-${index}`} style={{ display: "grid", gap: 10, gridTemplateColumns: "18px 1fr" }}>
              <div style={{ alignItems: "center", display: "flex", flexDirection: "column" }}>
                <span
                  style={{
                    backgroundColor: item.tone,
                    borderRadius: 999,
                    display: "block",
                    height: 10,
                    marginTop: 4,
                    width: 10,
                  }}
                />
                {index < items.length - 1 ? (
                  <span style={{ borderLeft: `1px dotted ${colors.border}`, flex: 1, minHeight: 24 }} />
                ) : null}
              </div>
              <div style={{ display: "grid", gap: 2, paddingBottom: 10 }}>
                <FitText style={{ color: colors.textPrimary, fontSize: 12.25, fontWeight: 750 }}>{item.label}</FitText>
                <FitText style={{ color: colors.textSecondary, fontSize: 12, fontWeight: 500 }}>{item.meta}</FitText>
              </div>
            </div>
          ))}
        </div>
      ) : null}

      {mode === "feedback" ? (
        <div
          style={{
            border: `1px solid ${colors.border}`,
            borderRadius: 8,
            backgroundColor: colors.surface,
            display: "grid",
            gap: 12,
            padding: 12,
          }}
        >
          <MemberText variant="brand">Coach Feedback</MemberText>
          {canReviewCoach ? (
            <>
              <FitText style={{ color: colors.textSecondary, fontSize: 12.25, fontWeight: 500, lineHeight: 1.35 }}>
                Share how this completed session went so staff and the coaching team can review it.
              </FitText>
              <div style={{ display: "grid", gap: 8 }}>
                <FitText style={{ color: colors.textMuted, fontSize: 11.5, fontWeight: 700 }}>Session Rating</FitText>
                <div style={{ display: "grid", gap: 8, gridTemplateColumns: "repeat(5, minmax(0, 1fr))" }}>
                  {[1, 2, 3, 4, 5].map((value) => (
                    <FitButton
                      key={value}
                      variant={reviewRating === value ? "primary" : "ghost"}
                      label={`${value}`}
                      onClick={() => setReviewRating(value)}
                      style={{ minHeight: 34, borderRadius: 8 }}
                    />
                  ))}
                </div>
              </div>
              <FitTextArea
                value={reviewComment}
                onChange={(event) => {
                  setReviewComment(event.target.value);
                  if (reviewState) {
                    onReviewStateChange(null);
                  }
                }}
                placeholder="What stood out about the coaching, pace, or guidance?"
                rows={4}
                maxLength={1000}
                disabled={submitPending}
              />
              {reviewState ? (
                <FitText
                  style={{
                    color: reviewState.tone === "success" ? colors.success : colors.danger,
                    fontSize: 13,
                    fontWeight: 600,
                  }}
                >
                  {reviewState.text}
                </FitText>
              ) : null}
              <div style={{ display: "grid", gap: 8, gridTemplateColumns: "repeat(2, minmax(0, 1fr))" }}>
                <FitButton
                  variant="ghost"
                  label="Clear"
                  disabled={submitPending && !reviewComment}
                  onClick={() => {
                    setReviewComment("");
                    setReviewRating(5);
                    onReviewStateChange(null);
                  }}
                />
                <FitButton
                  variant="primary"
                  label="Submit Feedback"
                  loading={submitPending}
                  loadingLabel="Submitting Feedback"
                  onClick={onReviewSubmit}
                />
              </div>
            </>
          ) : (
            <FitText style={{ color: colors.textSecondary, fontSize: 12.25, fontWeight: 500, lineHeight: 1.35 }}>
              Coach feedback is available after a completed coaching appointment.
            </FitText>
          )}
        </div>
      ) : null}
    </div>
  );
}

function ComposerActionFooter({
  actionsOpen,
  mode,
  onOpenRequest,
  onSetActionsOpen,
  onSetMode,
}: {
  actionsOpen: boolean;
  mode: ComposerPanelMode;
  onOpenRequest: () => void;
  onSetActionsOpen: (value: boolean) => void;
  onSetMode: (mode: ComposerPanelMode) => void;
}) {
  const { colors } = useTheme();
  const compactActionStyle: CSSProperties = {
    minHeight: 36,
    paddingInline: 8,
    borderRadius: 8,
  };
  const compactTextStyle: CSSProperties = {
    fontSize: 10.75,
    fontWeight: 800,
    lineHeight: 1.1,
    textAlign: "center",
  };

  return (
    <div style={{ display: "grid", gap: 8 }}>
      <div
        aria-hidden={!actionsOpen}
        style={{
          display: "grid",
          gap: 8,
          maxHeight: actionsOpen ? 180 : 0,
          opacity: actionsOpen ? 1 : 0,
          overflowX: "hidden",
          overflowY: "hidden",
          pointerEvents: actionsOpen ? "auto" : "none",
          transform: actionsOpen ? "translateY(0)" : "translateY(12px)",
          transformOrigin: "bottom center",
          transition: `max-height 240ms ease, opacity 180ms ease, transform 240ms ease, visibility 0ms linear ${
            actionsOpen ? "0ms" : "240ms"
          }`,
          visibility: actionsOpen ? "visible" : "hidden",
        }}
      >
        <div style={{ display: "grid", gap: 8, gridTemplateColumns: "repeat(2, minmax(0, 1fr))" }}>
          <FitButton
            variant="ghost"
            label="COACH DETAILS"
            icon={Info}
            iconSize={13}
            fullWidth
            active={mode === "details"}
            onClick={() => onSetMode("details")}
            style={{
              ...compactActionStyle,
              border: `1px solid ${mode === "details" ? `${colors.brand}55` : colors.border}`,
              backgroundColor: mode === "details" ? `${colors.brand}12` : colors.surface,
            }}
            textStyle={{ ...compactTextStyle, color: mode === "details" ? colors.brand : colors.textPrimary }}
          />
          <FitButton
            variant="ghost"
            label="RECENT FEEDBACK"
            icon={MessageSquareText}
            iconSize={13}
            fullWidth
            active={mode === "feedback"}
            onClick={() => onSetMode("feedback")}
            style={{
              ...compactActionStyle,
              border: `1px solid ${mode === "feedback" ? `${colors.brand}55` : colors.border}`,
              backgroundColor: mode === "feedback" ? `${colors.brand}12` : colors.surface,
            }}
            textStyle={{ ...compactTextStyle, color: mode === "feedback" ? colors.brand : colors.textPrimary }}
          />
          <FitButton
            variant="primary"
            label="BOOK TRAINER"
            icon={Send}
            iconSize={13}
            fullWidth
            onClick={onOpenRequest}
            style={{ ...compactActionStyle, gridColumn: "1 / -1" }}
            textStyle={compactTextStyle}
          />
        </div>
      </div>
      <FitButton
        variant="ghost"
        aria-expanded={actionsOpen}
        onClick={() => onSetActionsOpen(!actionsOpen)}
        style={{
          backgroundColor: actionsOpen ? `${colors.brand}12` : colors.surface,
          border: `1px solid ${actionsOpen ? colors.brand : colors.border}`,
          borderRadius: 8,
          color: colors.brand,
          minHeight: 44,
        }}
        textStyle={{ color: colors.brand, fontWeight: 850, letterSpacing: "0.04em" }}
      >
        <span style={{ alignItems: "center", display: "inline-flex", gap: 8, justifyContent: "center" }}>
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

function BookingInspectorActionFooter({
  actionsOpen,
  canCancel,
  mode,
  onCancel,
  onSetActionsOpen,
  onSetMode,
}: {
  actionsOpen: boolean;
  canCancel: boolean;
  mode: BookingPanelMode;
  onCancel: () => void;
  onSetActionsOpen: (value: boolean) => void;
  onSetMode: (mode: BookingPanelMode) => void;
}) {
  const { colors } = useTheme();
  const compactActionStyle: CSSProperties = {
    minHeight: 36,
    paddingInline: 8,
    borderRadius: 8,
  };
  const compactTextStyle: CSSProperties = {
    fontSize: 10.75,
    fontWeight: 800,
    lineHeight: 1.1,
    textAlign: "center",
  };
  const panelActions: Array<{
    icon: LucideIcon;
    label: string;
    value: BookingPanelMode;
  }> = [
    { icon: Info, label: "DETAILS", value: "details" },
    { icon: CalendarDays, label: "SESSION TIMELINE", value: "timeline" },
    { icon: MessageSquareText, label: "COACH FEEDBACK", value: "feedback" },
  ];

  return (
    <div style={{ display: "grid", gap: 8 }}>
      <div
        aria-hidden={!actionsOpen}
        style={{
          display: "grid",
          gap: 8,
          maxHeight: actionsOpen ? 360 : 0,
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
        <div style={{ display: "grid", gap: 8, gridTemplateColumns: "repeat(2, minmax(0, 1fr))" }}>
          {panelActions.map((action) => (
            <FitButton
              key={action.value}
              variant="ghost"
              label={action.label}
              icon={action.icon}
              iconSize={13}
              fullWidth
              active={mode === action.value}
              onClick={() => onSetMode(action.value)}
              style={{
                ...compactActionStyle,
                gridColumn: action.value === "feedback" ? "1 / -1" : undefined,
                border: `1px solid ${mode === action.value ? `${colors.brand}55` : colors.border}`,
                backgroundColor: mode === action.value ? `${colors.brand}12` : colors.surface,
              }}
              textStyle={{ ...compactTextStyle, color: mode === action.value ? colors.brand : colors.textPrimary }}
            />
          ))}
          {canCancel ? (
            <FitButton
              variant="danger"
              label="CANCEL BOOKING"
              fullWidth
              onClick={onCancel}
              style={{ ...compactActionStyle, gridColumn: "1 / -1" }}
              textStyle={compactTextStyle}
            />
          ) : null}
        </div>
      </div>
      <FitButton
        variant="ghost"
        aria-expanded={actionsOpen}
        onClick={() => onSetActionsOpen(!actionsOpen)}
        style={{
          backgroundColor: actionsOpen ? `${colors.brand}12` : colors.surface,
          border: `1px solid ${actionsOpen ? colors.brand : colors.border}`,
          borderRadius: 8,
          color: colors.brand,
          minHeight: 44,
        }}
        textStyle={{ color: colors.brand, fontWeight: 850, letterSpacing: "0.04em" }}
      >
        <span style={{ alignItems: "center", display: "inline-flex", gap: 8, justifyContent: "center" }}>
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

function InlineValidationMessage({ message }: { message?: string | null }) {
  const { colors } = useTheme();
  if (!message) return null;

  return (
    <div aria-live="polite">
      <FitText style={{ color: colors.danger, fontSize: 11.5, fontWeight: 750, lineHeight: 1.4 }}>
        {message}
      </FitText>
    </div>
  );
}

function RequestFieldButton({
  icon,
  label,
  onClick,
  validationMessage,
  value,
}: {
  icon: LucideIcon;
  label: string;
  onClick: () => void;
  validationMessage?: string | null;
  value: string;
}) {
  return (
    <div style={{ display: "grid", gap: 8, minWidth: 0 }}>
      <MemberText variant="brand">{label}</MemberText>
      <FitButton
        variant="field"
        icon={icon}
        showTrailing
        fullWidth
        aria-label={`${label}: ${value}`}
        aria-invalid={Boolean(validationMessage)}
        onClick={onClick}
        style={{ minHeight: 44, borderRadius: 8 }}
        textStyle={{ fontSize: 13, fontWeight: 750 }}
      >
        {value}
      </FitButton>
      <InlineValidationMessage message={validationMessage} />
    </div>
  );
}

function TimePickerModal({
  emptyMessage = "No time options are currently available.",
  isOpen,
  onClose,
  onSelect,
  options,
  selectedTime,
  subtitle = "Choose a live booking window.",
  title = "Preferred Time",
}: {
  emptyMessage?: string;
  isOpen: boolean;
  onClose: () => void;
  onSelect: (value: string) => void;
  options?: ReadonlyArray<{ description?: string; disabled?: boolean; label: string; value: string }>;
  selectedTime: string;
  subtitle?: string;
  title?: string;
}) {
  const { colors } = useTheme();
  const timeOptions: ReadonlyArray<{ description?: string; disabled?: boolean; label: string; value: string }> =
    options ?? REQUEST_TIME_OPTIONS.map((time) => ({ label: formatTimeChoice(time), value: time }));

  return (
    <FitModal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      subtitle={subtitle}
      icon={Clock3}
      maxWidth={460}
      noScroll
      footer={
        <FitButton
          variant="ghost"
          label="Clear Time"
          onClick={() => {
            onSelect("");
            onClose();
          }}
          style={{ flex: 1 }}
        />
      }
    >
      <div className="bookings-time-picker-grid">
        {timeOptions.length === 0 ? (
          <FitText style={{ color: colors.textSecondary, fontSize: 12.5, lineHeight: 1.45 }}>
            {emptyMessage}
          </FitText>
        ) : timeOptions.map((option) => {
          const isActive = option.value === selectedTime;

          return (
            <button
              key={option.value}
              disabled={option.disabled}
              onClick={() => {
                onSelect(option.value);
                onClose();
              }}
              style={{
                alignItems: "flex-start",
                appearance: "none",
                background: isActive ? colors.brand : colors.surfaceRaised,
                border: `1px solid ${isActive ? colors.brand : colors.border}`,
                borderRadius: 8,
                color: isActive ? colors.surface : colors.textPrimary,
                cursor: option.disabled ? "not-allowed" : "pointer",
                display: "grid",
                gap: 3,
                minHeight: 56,
                opacity: option.disabled ? 0.5 : 1,
                padding: "10px 12px",
                textAlign: "left",
                width: "100%",
              }}
            >
              <span style={{ fontSize: 13, fontWeight: 850, lineHeight: 1.2 }}>{option.label}</span>
              {option.description ? (
                <span style={{ color: isActive ? `${colors.surface}CC` : colors.textSecondary, fontSize: 11.5, lineHeight: 1.35 }}>
                  {option.description}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
    </FitModal>
  );
}

type CoachAppointmentSubmitInput =
  | {
      bookingIntent: "single";
      bookingNotes: string;
      preferredDate: string;
      selectedSlot: AppointmentSlotOption;
    }
  | {
      bookingIntent: "monthly";
      preferredDate: string;
    };

type CoachValidationField = "checkout" | "date" | "duration" | "intent" | "slot";
type VenueValidationField = "checkout" | "coach" | "date" | "end" | "pricing" | "start" | "venue";

function RequestCoachModal({
  bookingDraftState,
  bookingIntent,
  bookingNotes,
  hasMemberCardAccess,
  isSubmitting,
  isOpen,
  onClose,
  onSubmit,
  preferredDate,
  preferredTime,
  selectedCoach,
  setBookingIntent,
  setBookingNotes,
  setPreferredDate,
  setPreferredTime,
}: {
  bookingDraftState: string | null;
  bookingIntent: CoachBookingIntent;
  bookingNotes: string;
  hasMemberCardAccess: boolean;
  isSubmitting: boolean;
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (input: CoachAppointmentSubmitInput) => Promise<void>;
  preferredDate: string;
  preferredTime: string;
  selectedCoach: CoachProfileRecord | null;
  setBookingIntent: (value: CoachBookingIntent) => void;
  setBookingNotes: (value: string) => void;
  setPreferredDate: (value: string) => void;
  setPreferredTime: (value: string) => void;
}) {
  const { colors } = useTheme();
  const canUsePaymongo = isPaymongoCheckoutEnabled();
  const [checkoutReview, setCheckoutReview] = useState<PaymentConfirmationState | null>(null);
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [requestError, setRequestError] = useState("");
  const [reviewAttempted, setReviewAttempted] = useState(false);
  const [selectedDuration, setSelectedDuration] = useState<number>(60);
  const [submitFieldErrors, setSubmitFieldErrors] = useState<Partial<Record<CoachValidationField, string>>>({});
  const [timePickerOpen, setTimePickerOpen] = useState(false);
  const [touchedFields, setTouchedFields] = useState<Partial<Record<CoachValidationField, boolean>>>({});
  const scheduleQuery = useQuery({
    ...coachAvailabilityQueryOptions<CoachAvailabilityResponse>(
      webApiClient,
      selectedCoach ? String(selectedCoach.id) : undefined,
    ),
    enabled: isOpen && bookingIntent === "single" && !!selectedCoach,
  });
  const exactAvailabilityQuery = useQuery({
    ...appointmentAvailabilityQueryOptions(
      webApiClient,
      selectedCoach ? String(selectedCoach.id) : undefined,
      preferredDate,
      selectedDuration,
    ),
    enabled:
      isOpen &&
      bookingIntent === "single" &&
      !!selectedCoach &&
      !!preferredDate &&
      selectedDuration > 0,
  });
  const monthlyOffer = useMemo(() => getMonthlyCoachOffer(selectedCoach), [selectedCoach]);
  const availableIntentOptions = useMemo(
    () => BOOKING_INTENT_OPTIONS.filter((option) => option.value !== "monthly" || monthlyOffer.isAvailable),
    [monthlyOffer.isAvailable],
  );
  const currentMinutes = getGymCurrentMinutes();
  const availableSlots = useMemo<AppointmentSlotOption[]>(() => {
    if (bookingIntent !== "single" || !preferredDate) return [];
    const uniqueSlots = new Map<string, AppointmentSlotOption>();
    (exactAvailabilityQuery.data ?? [])
      .filter(
        (slot) =>
          slot.available &&
          slot.durationMinutes === selectedDuration &&
          isoToGymDateValue(slot.startAt) === preferredDate,
      )
      .forEach((slot) => {
        const startTime = isoToGymTimeValue(slot.startAt);
        if (
          !startTime ||
          (preferredDate === getTodayDateInputValue() && timeToMinutes(startTime) <= currentMinutes)
        ) {
          return;
        }
        uniqueSlots.set(startTime, {
          durationMin: slot.durationMinutes,
          label: `${formatTimeChoice(startTime)} / ${slot.durationMinutes} min`,
          startTime,
        });
      });
    return Array.from(uniqueSlots.values()).sort(
      (left, right) => timeToMinutes(left.startTime) - timeToMinutes(right.startTime),
    );
  }, [bookingIntent, currentMinutes, exactAvailabilityQuery.data, preferredDate, selectedDuration]);
  const highlightedCoachDates = useMemo(
    () =>
      getUpcomingAvailableDates(
        scheduleQuery.data?.availability
          ?.filter((slot) => slot.isAvailable)
          .map((slot) => slot.dayOfWeek) ?? [],
      ),
    [scheduleQuery.data?.availability],
  );
  const selectedSlot = availableSlots.find((slot) => slot.startTime === preferredTime) ?? null;
  const selectedIntent = BOOKING_INTENT_OPTIONS.find((option) => option.value === bookingIntent) ?? BOOKING_INTENT_OPTIONS[0];
  const selectedCoachRate = Number(selectedCoach?.hourlyRate);
  const hasValidCoachRate = Number.isFinite(selectedCoachRate) && selectedCoachRate > 0;
  const appointmentTotal = selectedSlot && hasValidCoachRate
    ? Math.round(selectedCoachRate * (selectedSlot.durationMin / 60) * 100) / 100
    : 0;
  const canSubmit =
    bookingIntent === "monthly"
      ? Boolean(selectedCoach && preferredDate && monthlyOffer.isAvailable && hasMemberCardAccess && canUsePaymongo) && !isSubmitting
      : Boolean(selectedCoach && preferredDate && selectedSlot && hasValidCoachRate && canUsePaymongo) && !isSubmitting;
  const availabilityStatus =
    bookingIntent === "monthly"
      ? monthlyOffer.isAvailable && hasMemberCardAccess
        ? `${monthlyOffer.sessionCount} sessions of ${monthlyOffer.durationMinutes} minutes for ${formatMoney(monthlyOffer.rate ?? 0)}. The coach authors the schedule after full payment.`
        : ""
      : !selectedCoach
        ? "Select a coach to load exact live availability."
        : exactAvailabilityQuery.isPending
          ? `Checking exact ${selectedDuration}-minute slots for ${formatDateChoice(preferredDate)} in gym time (UTC+8).`
          : exactAvailabilityQuery.isError
            ? ""
            : availableSlots.length === 0
              ? ""
              : !hasValidCoachRate
                ? ""
                : `${availableSlots.length} exact ${selectedDuration}-minute slot${availableSlots.length === 1 ? "" : "s"} available on ${formatDateChoice(preferredDate)} in gym time (UTC+8).`;

  const shouldShowValidation = (field: CoachValidationField) => reviewAttempted || touchedFields[field] === true;
  const intentValidationMessage = shouldShowValidation("intent")
    ? submitFieldErrors.intent ??
      (bookingIntent === "monthly" && !monthlyOffer.isAvailable
        ? "This coach does not currently offer an eligible monthly package."
        : bookingIntent === "monthly" && !hasMemberCardAccess
          ? "Active membership access is required for monthly coaching."
          : null)
    : null;
  const dateValidationMessage = shouldShowValidation("date")
    ? submitFieldErrors.date ?? (!preferredDate ? "Choose a booking date." : null)
    : null;
  const durationValidationMessage = shouldShowValidation("duration") && bookingIntent === "single"
    ? submitFieldErrors.duration ??
      (!ONE_TIME_DURATION_OPTIONS.includes(selectedDuration as (typeof ONE_TIME_DURATION_OPTIONS)[number])
        ? "Choose a supported session duration."
        : null)
    : null;
  const slotValidationMessage = shouldShowValidation("slot") && bookingIntent === "single"
    ? submitFieldErrors.slot ??
      (exactAvailabilityQuery.isPending
        ? "Wait for exact live availability to finish loading."
        : exactAvailabilityQuery.isError
          ? exactAvailabilityQuery.error instanceof Error
            ? exactAvailabilityQuery.error.message
            : "Exact coach availability could not be loaded."
          : availableSlots.length === 0
            ? `No exact ${selectedDuration}-minute slot is available on ${formatDateChoice(preferredDate)} in gym time (UTC+8).`
            : !selectedSlot
              ? "Choose one exact live slot."
              : null)
    : null;
  const checkoutValidationMessage = shouldShowValidation("checkout")
    ? submitFieldErrors.checkout ??
      (!canUsePaymongo
        ? "PayMongo checkout is unavailable right now."
        : bookingIntent === "single" && !hasValidCoachRate
          ? "This coach needs a valid hourly price before checkout."
          : null)
    : null;

  const touchValidationField = (field: CoachValidationField) => {
    setTouchedFields((current) => ({ ...current, [field]: true }));
  };

  const clearSubmitFieldErrors = (...fields: CoachValidationField[]) => {
    setSubmitFieldErrors((current) => {
      if (!fields.some((field) => current[field])) return current;
      const next = { ...current };
      fields.forEach((field) => delete next[field]);
      return next;
    });
    setRequestError("");
  };

  useEffect(() => {
    setRequestError("");
    setSubmitFieldErrors({});
    setCheckoutReview(null);
  }, [bookingIntent, preferredDate, preferredTime, selectedCoach?.id, selectedDuration]);

  useEffect(() => {
    if (isOpen) return;
    setReviewAttempted(false);
    setSubmitFieldErrors({});
    setTouchedFields({});
  }, [isOpen]);

  useEffect(() => {
    if (bookingIntent === "monthly" && !monthlyOffer.isAvailable) {
      setBookingIntent("single");
    }
  }, [bookingIntent, monthlyOffer.isAvailable, setBookingIntent]);

  useEffect(() => {
    if (
      bookingIntent === "single" &&
      preferredTime &&
      !exactAvailabilityQuery.isPending &&
      !availableSlots.some((slot) => slot.startTime === preferredTime)
    ) {
      setPreferredTime("");
    }
  }, [
    availableSlots,
    bookingIntent,
    exactAvailabilityQuery.isPending,
    preferredTime,
    setPreferredTime,
  ]);

  if (!selectedCoach) {
    return null;
  }

  const handleClose = () => {
    if (isSubmitting) return;
    setCheckoutReview(null);
    setRequestError("");
    setReviewAttempted(false);
    setSubmitFieldErrors({});
    setTouchedFields({});
    onClose();
  };

  const handleReview = () => {
    setReviewAttempted(true);
    setRequestError("");
    setSubmitFieldErrors({});
    if (!canSubmit) return;

    if (bookingIntent === "monthly") {
      setCheckoutReview({
        title: "Review monthly checkout",
        message: `Pay ${formatMoney(monthlyOffer.rate ?? 0)} for ${monthlyOffer.sessionCount} ${monthlyOffer.durationMinutes}-minute sessions with ${getCoachName(selectedCoach)}. The coach prepares the schedule after full payment succeeds.`,
      });
      return;
    }

    if (!selectedSlot) return;
    setCheckoutReview({
      title: "Review session checkout",
      message: `Pay ${formatMoney(appointmentTotal)} for ${getCoachName(selectedCoach)} on ${formatDateChoice(preferredDate)} at ${selectedSlot.label}. The session is confirmed only after full payment succeeds.`,
    });
  };

  const handleSubmit = async () => {
    if (!checkoutReview || isSubmitting) return;

    try {
      setRequestError("");
      if (bookingIntent === "monthly") {
        await onSubmit({ bookingIntent: "monthly", preferredDate });
      } else {
        if (!selectedSlot || !hasValidCoachRate) {
          throw new Error("The selected exact slot or coach price is no longer available.");
        }
        await onSubmit({
          bookingIntent: "single",
          bookingNotes,
          preferredDate,
          selectedSlot,
        });
      }
    } catch (error: unknown) {
      setCheckoutReview(null);
      setReviewAttempted(true);
      const message = error instanceof Error ? error.message : "Unable to start coach checkout.";
      const normalized = message.toLowerCase();
      const field: CoachValidationField | null =
        /membership|member eligible|monthly offer|monthly coaching/.test(normalized)
          ? "intent"
          : /duration/.test(normalized)
            ? "duration"
            : /date/.test(normalized)
              ? "date"
              : /availability|slot|schedule|conflict/.test(normalized)
                ? "slot"
                : /checkout|paymongo|payment|hold|price|rate|coach/.test(normalized)
                  ? "checkout"
                  : null;
      if (field) {
        setSubmitFieldErrors({ [field]: message });
        setRequestError("");
      } else {
        setSubmitFieldErrors({});
        setRequestError(message);
      }
    }
  };

  return (
    <>
      <FitModal
        isOpen={isOpen && checkoutReview == null}
        onClose={handleClose}
        title="Book a Trainer"
        subtitle="Choose a live coaching option, review the total, then continue to secure full payment."
        icon={CalendarCheck}
        maxWidth={720}
        footer={
          <>
            <FitButton variant="ghost" label="Cancel" onClick={handleClose} disabled={isSubmitting} style={{ flex: 1 }} />
            <FitButton
              variant="primary"
              label="Review Checkout"
              onClick={handleReview}
              disabled={isSubmitting}
              style={{ flex: 1 }}
            />
          </>
        }
      >
        <div style={{ display: "grid", gap: 14 }}>
          <div
            style={{
              display: "grid",
              gap: 10,
              paddingBottom: 12,
              borderBottom: `1px solid ${colors.border}`,
            }}
          >
            <div style={{ alignItems: "center", display: "flex", gap: 12, minWidth: 0 }}>
              <div
                style={{
                  alignItems: "center",
                  backgroundColor: colors.surface,
                  border: `1px solid ${colors.border}`,
                  borderRadius: 8,
                  color: colors.brand,
                  display: "flex",
                  flexShrink: 0,
                  height: 44,
                  justifyContent: "center",
                  width: 44,
                }}
              >
                <FitText style={{ color: colors.brand, fontSize: 14, fontWeight: 850 }}>
                  {getCoachInitials(selectedCoach)}
                </FitText>
              </div>
              <div style={{ display: "grid", gap: 3, minWidth: 0 }}>
                <FitText style={{ color: colors.textPrimary, fontSize: 15, fontWeight: 850 }}>
                  {getCoachName(selectedCoach)}
                </FitText>
                <FitText style={{ color: colors.textMuted, fontSize: 12.5 }}>
                  {getCoachSpecialtySummary(selectedCoach)} / {getCoachRateLabel(selectedCoach)}
                </FitText>
              </div>
            </div>
          </div>

          <ComposerSection title="Session Intent">
            <div className="bookings-request-intent-grid">
              {availableIntentOptions.map((option) => (
                <FitButton
                  key={option.value}
                  variant="card"
                  active={bookingIntent === option.value}
                  icon={option.icon}
                  onClick={() => {
                    touchValidationField("intent");
                    clearSubmitFieldErrors("intent", "checkout");
                    setBookingIntent(option.value);
                    setPreferredTime("");
                  }}
                  style={{ borderRadius: 8, minHeight: 82, padding: 10 }}
                >
                  <span style={{ display: "grid", gap: 4, minWidth: 0 }}>
                    <span style={{ fontSize: 12.5, fontWeight: 850 }}>{option.label}</span>
                    <span style={{ color: colors.textMuted, fontSize: 11.5, lineHeight: 1.35 }}>
                      {option.value === "monthly" && !hasMemberCardAccess
                        ? "Active membership access is required."
                        : option.description}
                    </span>
                  </span>
                </FitButton>
              ))}
            </div>
            <InlineValidationMessage message={intentValidationMessage} />
          </ComposerSection>

          {bookingIntent === "single" ? (
            <ComposerSection title="Session Duration">
              <div style={{ display: "grid", gap: 8, gridTemplateColumns: "repeat(4, minmax(0, 1fr))" }}>
                {ONE_TIME_DURATION_OPTIONS.map((duration) => (
                  <FitButton
                    key={duration}
                    variant="card"
                    active={selectedDuration === duration}
                    label={`${duration} min`}
                    onClick={() => {
                      touchValidationField("duration");
                      clearSubmitFieldErrors("duration", "slot", "checkout");
                      setSelectedDuration(duration);
                      setPreferredTime("");
                    }}
                    style={{ borderRadius: 8, minHeight: 44, paddingInline: 8 }}
                  />
                ))}
              </div>
              <InlineValidationMessage message={durationValidationMessage} />
            </ComposerSection>
          ) : null}

          <div className="bookings-request-datetime-grid">
            <RequestFieldButton
              icon={CalendarDays}
              label={bookingIntent === "monthly" ? "Monthly Start Date" : "Session Date"}
              value={formatDateChoice(preferredDate)}
              validationMessage={dateValidationMessage}
              onClick={() => {
                touchValidationField("date");
                setDatePickerOpen(true);
              }}
            />
            {bookingIntent === "single" ? (
              <RequestFieldButton
                icon={Clock3}
                label="Exact Start Time"
                value={selectedSlot?.label ?? formatTimeChoice(preferredTime)}
                validationMessage={slotValidationMessage}
                onClick={() => {
                  touchValidationField("slot");
                  setTimePickerOpen(true);
                }}
              />
            ) : null}
          </div>

          {availabilityStatus ? (
            <div
              style={{
                borderTop: `1px solid ${colors.border}`,
                paddingTop: 10,
              }}
            >
              <MemberText variant="muted">{availabilityStatus}</MemberText>
            </div>
          ) : null}

          {bookingIntent === "single" ? (
            <div style={{ display: "grid", gap: 8, minWidth: 0 }}>
              <MemberText variant="brand">Session Notes</MemberText>
              <FitTextArea
                id="coach-booking-notes"
                name="coachBookingNotes"
                aria-label="Coach booking notes"
                value={bookingNotes}
                onChange={(event) => setBookingNotes(event.target.value)}
                placeholder="Goals, injuries, or context for this coaching session."
                rows={4}
                maxLength={1000}
              />
            </div>
          ) : null}

          <div
            style={{
              display: "grid",
              gap: 6,
              borderTop: `1px solid ${colors.border}`,
              paddingTop: 12,
            }}
          >
            <MemberText variant="brand">Appointment Summary</MemberText>
            <MemberText variant="subtitle">
              {selectedIntent.label} with {getCoachName(selectedCoach)}
              {preferredDate ? ` on ${formatDateChoice(preferredDate)}` : ""}{selectedSlot ? ` at ${selectedSlot.label}` : ""}.
            </MemberText>
            <MemberText variant="muted">
              {bookingIntent === "monthly"
                ? `Full monthly price: ${formatMoney(monthlyOffer.rate ?? 0)}. ${monthlyOffer.description} Checkout does not activate the plan until payment succeeds.`
                : !selectedSlot
                  ? "Choose one exact live slot before reviewing checkout."
                  : !hasValidCoachRate
                    ? "This coach needs a valid hourly price before checkout."
                    : `Full session price: ${formatMoney(appointmentTotal)}. PayMongo opens after review; the appointment becomes confirmed only after payment succeeds.`}
            </MemberText>
            <InlineValidationMessage message={checkoutValidationMessage} />
          </div>

          {requestError ? (
            <FitText style={{ color: colors.danger, fontSize: 13, fontWeight: 750 }}>
              {requestError}
            </FitText>
          ) : null}

          {bookingDraftState ? (
            <FitText style={{ color: colors.success, fontSize: 13, fontWeight: 750 }}>
              {bookingDraftState}
            </FitText>
          ) : null}
        </div>
      </FitModal>
      <FitModal
        isOpen={isOpen && checkoutReview != null}
        onClose={() => {
          if (!isSubmitting) setCheckoutReview(null);
        }}
        title={checkoutReview?.title ?? "Review checkout"}
        subtitle="Confirm these details before FitTrack creates the checkout."
        icon={CalendarCheck}
        maxWidth={520}
        footer={
          <>
            <FitButton
              variant="ghost"
              label="Back"
              disabled={isSubmitting}
              onClick={() => setCheckoutReview(null)}
              style={{ flex: 1 }}
            />
            <FitButton
              variant="primary"
              label="Confirm & Open PayMongo"
              loading={isSubmitting}
              loadingLabel="Opening Checkout..."
              onClick={() => void handleSubmit()}
              style={{ flex: 1 }}
            />
          </>
        }
      >
        <div style={{ display: "grid", gap: 10 }}>
          <MemberText variant="subtitle">{checkoutReview?.message ?? "Review the checkout details."}</MemberText>
          <MemberText variant="muted">
            No coaching booking becomes active until PayMongo confirms full payment.
          </MemberText>
        </div>
      </FitModal>
      <CalendarModal
        highlightedDates={highlightedCoachDates}
        isOpen={datePickerOpen}
        maxDate={getMaxBookableDateInputValue()}
        minDate={getTodayDateInputValue()}
        selectedDate={preferredDate}
        onClose={() => setDatePickerOpen(false)}
        onSelect={(dateYmd) => {
          touchValidationField("date");
          clearSubmitFieldErrors("date", "slot", "checkout");
          setPreferredDate(dateYmd);
          setPreferredTime("");
          if (dateYmd) {
            setDatePickerOpen(false);
          }
        }}
      />
      <TimePickerModal
        emptyMessage={`No exact ${selectedDuration}-minute coach slots are available for the selected day.`}
        isOpen={timePickerOpen}
        options={availableSlots.map((slot) => ({
          description: `${slot.durationMin}-minute exact slot`,
          label: formatTimeChoice(slot.startTime),
          value: slot.startTime,
        }))}
        selectedTime={preferredTime}
        subtitle={`Choose one canonical ${selectedDuration}-minute slot in gym time (UTC+8).`}
        title="Exact Coach Time"
        onClose={() => setTimePickerOpen(false)}
        onSelect={(value) => {
          touchValidationField("slot");
          clearSubmitFieldErrors("slot", "checkout");
          setPreferredTime(value);
        }}
      />
    </>
  );
}

type ReservationSubmitInput = {
  date: string;
  payload: {
    coachId?: string;
    durationHours: number;
    idempotencyKey?: string;
    paymentStage?: "full";
    provider?: "paymongo";
    purpose?: string;
    startTime: string;
    venueId: string | number;
  };
  userId?: string;
  venueId: string | number;
};

type ReservationSubmitResult = CommerceCheckoutAttemptLike;

function MemberReservationModal({
  coaches,
  coachesError,
  coachesLoading,
  existingReservations,
  hasMemberCardAccess,
  isOpen,
  isSubmitting,
  onBookTrainer,
  onClose,
  onRetryCoaches,
  onRetryVenues,
  onSubmit,
  userId,
  venues,
  venuesError,
  venuesLoading,
}: {
  coaches: CoachProfileRecord[];
  coachesError?: string | null;
  coachesLoading: boolean;
  existingReservations: MemberBookingItem[];
  hasMemberCardAccess: boolean;
  isOpen: boolean;
  isSubmitting: boolean;
  onBookTrainer: () => void;
  onClose: () => void;
  onRetryCoaches: () => void;
  onRetryVenues: () => void;
  onSubmit: (input: ReservationSubmitInput) => Promise<ReservationSubmitResult | void>;
  userId?: string;
  venues: VenueRecord[];
  venuesError?: string | null;
  venuesLoading: boolean;
}) {
  const { colors } = useTheme();
  const canUsePaymongo = isPaymongoCheckoutEnabled();
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [coachPickerOpen, setCoachPickerOpen] = useState(false);
  const [errorText, setErrorText] = useState("");
  const [endTime, setEndTime] = useState("");
  const [reservationReview, setReservationReview] = useState<PaymentConfirmationState | null>(null);
  const [reservationDate, setReservationDate] = useState(getTodayDateInputValue());
  const [reservationNotes, setReservationNotes] = useState("");
  const [reviewAttempted, setReviewAttempted] = useState(false);
  const [selectedCoachId, setSelectedCoachId] = useState("");
  const [selectedVenueId, setSelectedVenueId] = useState("");
  const [startTime, setStartTime] = useState("");
  const [submitFieldErrors, setSubmitFieldErrors] = useState<Partial<Record<VenueValidationField, string>>>({});
  const [timePickerOpen, setTimePickerOpen] = useState(false);
  const [timeTarget, setTimeTarget] = useState<"start" | "end">("start");
  const [touchedFields, setTouchedFields] = useState<Partial<Record<VenueValidationField, boolean>>>({});
  const [venuePickerOpen, setVenuePickerOpen] = useState(false);
  const pickerVenues = useMemo(
    () =>
      venues.filter(
        (venue) =>
          venue.isActive !== false &&
          venue.isMapped !== false &&
          venue.isReservable === true,
      ),
    [venues],
  );
  const selectedVenue =
    pickerVenues.find((venue) => String(venue.id) === selectedVenueId) ?? null;
  const selectedVenueBlockReason = selectedVenue
    ? getVenueBookingBlockReason(selectedVenue)
    : null;
  const minimumHours = Math.max(1, Number(selectedVenue?.minimumHours ?? 1));
  const venueAvailabilityQuery = useQuery({
    ...venueAvailabilityQueryOptions<VenueAvailabilityRecord>(
      webApiClient,
      selectedVenue?.id,
      reservationDate,
    ),
    enabled:
      isOpen &&
      !!selectedVenue &&
      !selectedVenueBlockReason &&
      !!reservationDate,
    staleTime: 15_000,
  });
  const liveVenueSlots = useMemo(
    () =>
      (venueAvailabilityQuery.data ?? [])
        .filter(
          (slot) =>
            isoToGymDateValue(slot.startTime) === reservationDate &&
            Date.parse(slot.endTime) > Date.parse(slot.startTime),
        )
        .sort((left, right) => Date.parse(left.startTime) - Date.parse(right.startTime)),
    [reservationDate, venueAvailabilityQuery.data],
  );
  const startSlotOptions = useMemo(() => {
    const options = new Map<string, { description: string; label: string; value: string }>();
    liveVenueSlots.forEach((slot, startIndex) => {
      const startValue = isoToGymTimeValue(slot.startTime);
      const endValue = isoToGymTimeValue(slot.endTime);
      if (
        slot.status !== "available" ||
        !startValue ||
        !endValue ||
        (reservationDate === getTodayDateInputValue() && timeToMinutes(startValue) <= getGymCurrentMinutes())
      ) {
        return;
      }

      const startMs = Date.parse(slot.startTime);
      let expectedStart = startMs;
      let coversMinimum = false;
      for (let index = startIndex; index < liveVenueSlots.length; index += 1) {
        const candidate = liveVenueSlots[index];
        if (candidate.status !== "available" || Date.parse(candidate.startTime) !== expectedStart) break;
        const candidateEnd = Date.parse(candidate.endTime);
        if (candidateEnd - startMs >= minimumHours * 60 * 60 * 1000) {
          coversMinimum = true;
          break;
        }
        expectedStart = candidateEnd;
      }
      if (!coversMinimum) return;
      options.set(startValue, {
        description: `First live block ends ${formatTimeChoice(endValue)}`,
        label: formatTimeChoice(startValue),
        value: startValue,
      });
    });
    return Array.from(options.values()).sort(
      (left, right) => timeToMinutes(left.value) - timeToMinutes(right.value),
    );
  }, [liveVenueSlots, minimumHours, reservationDate]);
  const endSlotOptions = useMemo(() => {
    if (!startTime) return [];
    const startIndex = liveVenueSlots.findIndex(
      (slot) => slot.status === "available" && isoToGymTimeValue(slot.startTime) === startTime,
    );
    if (startIndex < 0) return [];

    const options: Array<{ description: string; label: string; value: string }> = [];
    let expectedStart = Date.parse(liveVenueSlots[startIndex].startTime);
    for (let index = startIndex; index < liveVenueSlots.length; index += 1) {
      const slot = liveVenueSlots[index];
      const slotStart = Date.parse(slot.startTime);
      if (slot.status !== "available" || slotStart !== expectedStart) break;
      const endValue = isoToGymTimeValue(slot.endTime);
      if (!endValue || timeToMinutes(endValue) <= timeToMinutes(startTime)) break;
      const durationHours =
        (Date.parse(slot.endTime) - Date.parse(liveVenueSlots[startIndex].startTime)) /
        (60 * 60 * 1000);
      if (durationHours < minimumHours) {
        expectedStart = Date.parse(slot.endTime);
        continue;
      }
      options.push({
        description: `${getReservationDurationHours(startTime, endValue)} hr total`,
        label: formatTimeChoice(endValue),
        value: endValue,
      });
      expectedStart = Date.parse(slot.endTime);
    }
    return options;
  }, [liveVenueSlots, minimumHours, startTime]);
  const availableCoachAddOns = useMemo(
    () =>
      coaches.filter((coach) =>
        coachCoversReservationWindow(coach, reservationDate, startTime, endTime),
      ),
    [coaches, endTime, reservationDate, startTime],
  );
  const selectedCoachRecord =
    coaches.find((coach) => String(coach.id) === selectedCoachId) ?? null;
  const selectedCoach =
    availableCoachAddOns.find((coach) => String(coach.id) === selectedCoachId) ?? null;
  const venuePickerOptions = useMemo<BookingPickerOption[]>(
    () =>
      pickerVenues.map((venue) => {
        const blockReason = getVenueBookingBlockReason(venue);
        return {
          disabled: Boolean(blockReason),
          searchText: venue.name,
          subtitle:
            venue.status === "maintenance"
              ? "Under maintenance — unavailable for new bookings"
              : blockReason ??
                (venue.hourlyRate
                  ? `${formatMoney(venue.hourlyRate)} per hour`
                  : "No checkout rate is configured"),
          title: venue.name,
          value: String(venue.id),
        };
      }),
    [pickerVenues],
  );
  const coachPickerOptions = useMemo<BookingPickerOption[]>(
    () => [
      {
        searchText: "without coach venue only",
        subtitle: "Reserve only the venue.",
        title: "No coach add-on",
        value: "",
      },
      ...(selectedCoachId && !selectedCoach && selectedCoachRecord
        ? [
            {
              disabled: true,
              searchText: getCoachName(selectedCoachRecord),
              subtitle: "Unavailable for this exact venue window",
              title: getCoachName(selectedCoachRecord),
              value: selectedCoachId,
            },
          ]
        : []),
      ...availableCoachAddOns.map((coach) => ({
        searchText: [getCoachName(coach), ...(coach.specialties ?? [])].join(" "),
        subtitle: coach.hourlyRate
          ? `${getCoachSpecialtySummary(coach)} · ${formatMoney(coach.hourlyRate)} per hour`
          : `${getCoachSpecialtySummary(coach)} · Rate pending`,
        title: getCoachName(coach),
        value: String(coach.id),
      })),
    ],
    [availableCoachAddOns, selectedCoach, selectedCoachId, selectedCoachRecord],
  );
  const durationHours = getReservationDurationHours(startTime, endTime);
  const venueRate = Number(selectedVenue?.hourlyRate ?? 0);
  const coachRate = Number(selectedCoach?.hourlyRate ?? 0);
  const hasValidVenueRate = Number.isFinite(venueRate) && venueRate > 0;
  const hasValidCoachRate = !selectedCoach || (Number.isFinite(coachRate) && coachRate > 0);
  const venueAmount = Math.round(venueRate * durationHours * 100) / 100;
  const coachAmount = Math.round(coachRate * durationHours * 100) / 100;
  const totalAmount = Math.round((venueAmount + coachAmount) * 100) / 100;
  const hasPricedDuration = durationHours > 0;
  const hasValidPricing = hasPricedDuration && hasValidVenueRate && hasValidCoachRate && totalAmount > 0;
  const paymentProvider = "paymongo" as const;
  const paymentStage = "full" as const;
  const hasActiveOverlap = useMemo(() => {
    if (!selectedVenue || !reservationDate || !startTime || !endTime) return false;

    const candidateStart = timeToMinutes(startTime);
    const candidateEnd = timeToMinutes(endTime);
    if (!Number.isFinite(candidateStart) || !Number.isFinite(candidateEnd) || candidateEnd <= candidateStart) return false;

    return existingReservations.some((booking) => {
      if (!isActiveReservationStatus(booking.status)) return false;
      if (booking.date !== reservationDate) return false;
      const sameVenue =
        String(booking.resourceId) === String(selectedVenue.id) ||
        booking.resourceName === selectedVenue.name;
      if (!sameVenue) return false;

      const existingRange = getBookingRangeMinutes(booking);
      if (!Number.isFinite(existingRange.start) || !Number.isFinite(existingRange.end)) return false;

      return candidateStart < existingRange.end && candidateEnd > existingRange.start;
    });
  }, [endTime, existingReservations, reservationDate, selectedVenue, startTime]);
  const hasContinuousRange = endSlotOptions.some((option) => option.value === endTime);
  const venueAvailabilityStatus = venueAvailabilityQuery.isPending
    ? "Loading canonical venue availability."
    : venueAvailabilityQuery.isError
      ? ""
      : startSlotOptions.length === 0
        ? ""
        : startTime && endSlotOptions.length === 0
          ? ""
          : `${startSlotOptions.length} live start time${startSlotOptions.length === 1 ? "" : "s"} available. End times stop at the first unavailable slot.`;
  const canSubmit =
    Boolean(selectedVenue && reservationDate && startTime && endTime) &&
    !selectedVenueBlockReason &&
    durationHours >= minimumHours &&
    isFutureGymStart(reservationDate, startTime) &&
    !venueAvailabilityQuery.isPending &&
    !venueAvailabilityQuery.isError &&
    hasContinuousRange &&
    hasValidPricing &&
    canUsePaymongo &&
    (!selectedCoachId || !!selectedCoach) &&
    !hasActiveOverlap &&
    !isSubmitting;
  const shouldShowValidation = (field: VenueValidationField) => reviewAttempted || touchedFields[field] === true;
  const venueValidationMessage = shouldShowValidation("venue")
    ? submitFieldErrors.venue ??
      (selectedVenueBlockReason ??
        (!selectedVenue ? "Choose a reservable venue." : null))
    : null;
  const dateValidationMessage = shouldShowValidation("date")
    ? submitFieldErrors.date ??
      (!reservationDate
        ? "Choose a reservation date."
        : venueAvailabilityQuery.isError
          ? venueAvailabilityQuery.error instanceof Error
            ? venueAvailabilityQuery.error.message
            : "Live venue availability could not be loaded for this date."
          : null)
    : null;
  const startValidationMessage = shouldShowValidation("start")
    ? submitFieldErrors.start ??
      (!selectedVenue || !reservationDate || venueAvailabilityQuery.isError
        ? null
        : venueAvailabilityQuery.isPending
          ? "Wait for live venue availability to finish loading."
          : !startTime
            ? startSlotOptions.length === 0
              ? `No future venue start time is available on ${formatDateChoice(reservationDate)}.`
              : "Choose a live venue start time."
            : !isFutureGymStart(reservationDate, startTime)
              ? "Choose a future start time in gym time (UTC+8)."
              : null)
    : null;
  const endValidationMessage = shouldShowValidation("end")
    ? submitFieldErrors.end ??
      (!startTime
        ? "Choose a start time before the end time."
        : !endTime
          ? endSlotOptions.length === 0
            ? "No continuous available range follows this start time."
            : "Choose an end time from the continuous range."
          : !hasContinuousRange
            ? "This end time is outside the continuous live range."
            : durationHours < minimumHours
              ? `This venue requires at least ${minimumHours} hour${minimumHours === 1 ? "" : "s"}.`
              : hasActiveOverlap
                ? "You already have a booking in this time window."
                : null)
    : null;
  const pricingValidationMessage = (reviewAttempted || touchedFields.end === true)
    ? submitFieldErrors.pricing ??
      (!hasPricedDuration
        ? null
        : !hasValidVenueRate
          ? "This venue has invalid or zero hourly pricing. Choose another venue."
          : !hasValidCoachRate
            ? "The selected coach has invalid or zero hourly pricing. Remove or replace the add-on."
            : totalAmount <= 0
              ? "The checkout total must be greater than zero."
              : null)
    : null;
  const coachValidationMessage = shouldShowValidation("coach")
    ? submitFieldErrors.coach ??
      (selectedCoachId && startTime && endTime && !selectedCoach
        ? `${selectedCoachRecord ? getCoachName(selectedCoachRecord) : "The selected coach"} does not cover this exact venue window. Choose another coach, correct the time range, or remove the add-on.`
        : null)
    : null;
  const checkoutValidationMessage = shouldShowValidation("checkout")
    ? submitFieldErrors.checkout ?? (!canUsePaymongo ? "PayMongo checkout is unavailable right now." : null)
    : null;

  const touchValidationField = (field: VenueValidationField) => {
    setTouchedFields((current) => ({ ...current, [field]: true }));
  };

  const clearSubmitFieldErrors = (...fields: VenueValidationField[]) => {
    setSubmitFieldErrors((current) => {
      if (!fields.some((field) => current[field])) return current;
      const next = { ...current };
      fields.forEach((field) => delete next[field]);
      return next;
    });
    setErrorText("");
  };

  const resetReservationDraft = useCallback(() => {
    setDatePickerOpen(false);
    setCoachPickerOpen(false);
    setErrorText("");
    setEndTime("");
    setReservationReview(null);
    setReservationDate(getTodayDateInputValue());
    setReservationNotes("");
    setReviewAttempted(false);
    setSelectedCoachId("");
    setSelectedVenueId("");
    setStartTime("");
    setSubmitFieldErrors({});
    setTimePickerOpen(false);
    setTimeTarget("start");
    setTouchedFields({});
    setVenuePickerOpen(false);
  }, []);

  useEffect(() => {
    if (!isOpen) {
      resetReservationDraft();
      return;
    }
    setErrorText("");
    setReservationReview(null);
  }, [isOpen, resetReservationDraft]);

  useEffect(() => {
    setErrorText("");
    setSubmitFieldErrors({});
    setReservationReview(null);
  }, [endTime, reservationDate, selectedCoachId, selectedVenueId, startTime]);

  const validateReservation = () => {
    setReviewAttempted(true);
    setErrorText("");
    setSubmitFieldErrors({});
    return canSubmit;
  };

  const handleReviewReservation = () => {
    if (!validateReservation() || !selectedVenue) return;
    setReservationReview({
      title: "Review venue checkout",
      message: `Pay ${formatMoney(totalAmount)} for ${selectedVenue.name} on ${formatDateChoice(reservationDate)} from ${formatTimeChoice(startTime)} to ${formatTimeChoice(endTime)}${selectedCoach ? ` with ${getCoachName(selectedCoach)} added` : ""}. The reservation is confirmed only after full payment succeeds.`,
    });
  };

  const submitReservation = async () => {
    if (!reservationReview) return;
    if (!validateReservation() || !selectedVenue) {
      setReservationReview(null);
      return;
    }

    setErrorText("");

    try {
      const result = await onSubmit({
        date: reservationDate,
        payload: {
          coachId: selectedCoach ? String(selectedCoach.id) : undefined,
          durationHours,
          paymentStage,
          provider: paymentProvider,
          purpose: reservationNotes.trim() || undefined,
          startTime: toGymWallClockIso(reservationDate, timeToMinutes(startTime)),
          venueId: selectedVenue.id,
        },
        userId,
        venueId: selectedVenue.id,
      });

      if (!getCommerceCheckoutUrl(result ?? undefined)) {
        throw new Error("PayMongo did not return a checkout link. No reservation was activated.");
      }
    } catch (error: unknown) {
      setReservationReview(null);
      setReviewAttempted(true);
      const message = error instanceof Error ? error.message : "Reservation failed. Please try again.";
      const normalized = message.toLowerCase();
      const field: VenueValidationField | null =
        /membership|subscription|membership card|member-only/.test(normalized)
          ? "venue"
          : /checkout|paymongo|payment|hold/.test(normalized)
            ? "checkout"
            : /coach/.test(normalized)
              ? "coach"
              : /price|pricing|amount|rate|total/.test(normalized)
                ? "pricing"
                : /duration|minimum|continuous|end time|overlap|conflict/.test(normalized)
                  ? "end"
                  : /start time|future/.test(normalized)
                    ? "start"
                    : /date/.test(normalized)
                      ? "date"
                      : /amenity|venue|reservable/.test(normalized)
                        ? "venue"
                        : null;
      if (field) {
        setSubmitFieldErrors({ [field]: message });
        setErrorText("");
      } else {
        setSubmitFieldErrors({});
        setErrorText(message);
      }
    }
  };

  const handleClose = () => {
    if (isSubmitting) return;
    resetReservationDraft();
    onClose();
  };

  return (
    <>
      <FitModal
        isOpen={isOpen && reservationReview == null && !coachPickerOpen && !venuePickerOpen}
        onClose={handleClose}
        title="Make a Reservation"
        subtitle="Choose a canonical live range, review the total, then continue to secure full payment."
        icon={CalendarCheck}
        maxWidth={760}
        footer={
          <>
            <FitButton variant="ghost" label="Cancel" onClick={handleClose} disabled={isSubmitting} style={{ flex: 1 }} />
            <FitButton
              variant="primary"
              label={canUsePaymongo ? "Review Checkout" : "PayMongo Unavailable"}
              onClick={handleReviewReservation}
              disabled={isSubmitting}
              style={{ flex: 1 }}
            />
          </>
        }
      >
          <div style={{ display: "grid", gap: 14 }}>
            <div
              style={{
                display: "grid",
                gap: 12,
                paddingBottom: 12,
                borderBottom: `1px solid ${colors.border}`,
              }}
            >
              <div style={{ alignItems: "center", display: "flex", gap: 10, justifyContent: "space-between" }}>
                <div style={{ display: "grid", gap: 3 }}>
                  <MemberText variant="brand">Reservation Type</MemberText>
                  <MemberText variant="muted">Reserve a facility now, or switch to trainer booking.</MemberText>
                </div>
                <FitButton
                  variant="ghost"
                  icon={UserRoundCheck}
                  iconSize={14}
                  label="Book a Trainer"
                  onClick={onBookTrainer}
                  disabled={isSubmitting}
                />
              </div>
            </div>

            {!venuesLoading && !venuesError && pickerVenues.length === 0 ? (
              <div
                style={{
                  border: `1px dashed ${colors.border}`,
                  borderRadius: 8,
                  padding: 14,
                }}
              >
                <MemberText variant="subtitle">
                  No reservable venues are currently available from the database.
                </MemberText>
                <InlineValidationMessage message={venueValidationMessage} />
              </div>
            ) : (
              <>
                <div style={{ display: "grid", gap: 8 }}>
                  <MemberText variant="brand">Venue</MemberText>
                  <FitButton
                    variant="field"
                    icon={CalendarDays}
                    showTrailing
                    fullWidth
                    aria-label={`Reservation venue: ${selectedVenue?.name ?? "Select venue"}`}
                    aria-invalid={Boolean(venueValidationMessage)}
                    onClick={() => {
                      touchValidationField("venue");
                      setVenuePickerOpen(true);
                    }}
                    style={{ minHeight: 44, borderRadius: 8 }}
                  >
                    {selectedVenue
                      ? `${selectedVenue.name} · ${selectedVenue.hourlyRate ? `${formatMoney(selectedVenue.hourlyRate)}/hr` : "Rate unavailable"}`
                      : venuesLoading
                        ? "Loading venues..."
                        : venuesError
                          ? "Venue list unavailable"
                          : "Search and select a venue"}
                  </FitButton>
                  <InlineValidationMessage message={venueValidationMessage} />
                </div>

                <div style={{ display: "grid", gap: 8 }}>
                  <MemberText variant="brand">Coach Add-on</MemberText>
                  <FitButton
                    variant="field"
                    icon={UserRoundCheck}
                    showTrailing
                    fullWidth
                    aria-label="Optional coach add-on"
                    aria-invalid={Boolean(coachValidationMessage)}
                    onClick={() => {
                      touchValidationField("coach");
                      setCoachPickerOpen(true);
                    }}
                    style={{ minHeight: 44, borderRadius: 8 }}
                  >
                    {selectedCoach
                      ? `${getCoachName(selectedCoach)} · ${coachRate > 0 ? `${formatMoney(coachRate)}/hr` : "Rate pending"}`
                      : coachesLoading
                        ? "Loading coaches..."
                        : coachesError
                          ? "Coach list unavailable"
                          : "No coach add-on"}
                  </FitButton>
                  <InlineValidationMessage message={coachValidationMessage} />
                  <MemberText variant="muted">
                    {!startTime || !endTime
                      ? "Choose a continuous venue window first. Coach options appear only when their schedule covers it."
                      : availableCoachAddOns.length === 0
                        ? "No coach currently covers this exact venue window. You can continue without an add-on."
                        : `${availableCoachAddOns.length} coach${availableCoachAddOns.length === 1 ? "" : "es"} cover this exact window. The selected coach ID is preserved through checkout.`}
                  </MemberText>
                </div>

                <div className="bookings-request-datetime-grid">
                  <RequestFieldButton
                    icon={CalendarDays}
                    label="Date"
                    value={formatDateChoice(reservationDate)}
                    validationMessage={dateValidationMessage}
                    onClick={() => {
                      touchValidationField("date");
                      setDatePickerOpen(true);
                    }}
                  />
                  <RequestFieldButton
                    icon={Clock3}
                    label="Start Time"
                    value={formatTimeChoice(startTime)}
                    validationMessage={startValidationMessage}
                    onClick={() => {
                      touchValidationField("start");
                      setTimeTarget("start");
                      setTimePickerOpen(true);
                    }}
                  />
                  <RequestFieldButton
                    icon={Clock3}
                    label="End Time"
                    value={formatTimeChoice(endTime)}
                    validationMessage={endValidationMessage}
                    onClick={() => {
                      touchValidationField("end");
                      setTimeTarget("end");
                      setTimePickerOpen(true);
                    }}
                  />
                </div>

                {venueAvailabilityStatus ? (
                  <div style={{ borderTop: `1px solid ${colors.border}`, paddingTop: 10 }}>
                    <MemberText variant="muted">{venueAvailabilityStatus}</MemberText>
                  </div>
                ) : null}

                <div style={{ display: "grid", gap: 8 }}>
                  <MemberText variant="brand">Payment</MemberText>
                  <FitButton
                    variant="card"
                    disabled={!canUsePaymongo || !hasValidPricing}
                    aria-invalid={Boolean(pricingValidationMessage || checkoutValidationMessage)}
                    style={{ borderRadius: 8, minHeight: 78, padding: 10, textAlign: "left" }}
                  >
                    <span style={{ display: "grid", gap: 4, minWidth: 0 }}>
                      <span style={{ fontSize: 12.5, fontWeight: 850 }}>PayMongo Full Payment</span>
                      <span style={{ color: colors.textMuted, fontSize: 11.5, lineHeight: 1.35 }}>
                        {canUsePaymongo
                          ? `Pay the full ${formatMoney(totalAmount)} after reviewing the venue, range, and optional coach.`
                          : "PayMongo is unavailable. Cash bookings are created by the cashier only."}
                      </span>
                    </span>
                  </FitButton>
                  <InlineValidationMessage message={pricingValidationMessage} />
                  <InlineValidationMessage message={checkoutValidationMessage} />
                  <MemberText variant="muted">
                    {hasMemberCardAccess
                      ? "Member-only venue access is verified by the booking service; public venues remain available."
                      : "You do not have active membership access. Public venues remain available; a member-only venue will return a clear restriction before checkout opens."}
                  </MemberText>
                </div>

                <div style={{ display: "grid", gap: 8 }}>
                  <MemberText variant="brand">Notes</MemberText>
                  <FitTextArea
                    id="venue-reservation-notes"
                    name="venueReservationNotes"
                    aria-label="Venue reservation notes"
                    value={reservationNotes}
                    onChange={(event) => setReservationNotes(event.target.value)}
                    placeholder="Purpose, preferred setup, or staff notes."
                    rows={3}
                    maxLength={700}
                  />
                </div>

                <div
                  style={{
                    display: "grid",
                    gap: 6,
                    borderTop: `1px solid ${colors.border}`,
                    paddingTop: 12,
                  }}
                >
                  <MemberText variant="brand">Reservation Summary</MemberText>
                  <MemberText variant="subtitle">
                    {selectedVenue?.name ?? "Selected venue"} / {durationHours > 0 ? `${durationHours} hr` : "select time range"} /{" "}
                    {formatMoney(totalAmount)}
                  </MemberText>
                  <MemberText variant="muted">
                    {hasValidPricing
                      ? `Full payment of ${formatMoney(totalAmount)} is required through PayMongo before confirmation.`
                      : "Complete a valid live range to preview the final checkout total."}
                  </MemberText>
                </div>
              </>
            )}

            {errorText ? <FitText style={{ color: colors.danger, fontSize: 12.5, fontWeight: 750 }}>{errorText}</FitText> : null}
          </div>
      </FitModal>
      <FitModal
        isOpen={isOpen && reservationReview != null}
        onClose={() => {
          if (!isSubmitting) setReservationReview(null);
        }}
        title={reservationReview?.title ?? "Review venue checkout"}
        subtitle="Confirm these details before FitTrack creates the reservation checkout."
        icon={CalendarCheck}
        maxWidth={540}
        footer={
          <>
            <FitButton
              variant="ghost"
              label="Back"
              disabled={isSubmitting}
              onClick={() => setReservationReview(null)}
              style={{ flex: 1 }}
            />
            <FitButton
              variant="primary"
              label="Confirm & Open PayMongo"
              loading={isSubmitting}
              loadingLabel="Opening Checkout..."
              onClick={() => void submitReservation()}
              style={{ flex: 1 }}
            />
          </>
        }
      >
        <div style={{ display: "grid", gap: 10 }}>
          <MemberText variant="subtitle">{reservationReview?.message ?? "Review the reservation details."}</MemberText>
          <MemberText variant="muted">
            No reservation becomes active until PayMongo confirms full payment.
          </MemberText>
        </div>
      </FitModal>
      <SearchableBookingPickerModal
        emptyMessage="No reservable venues match this search."
        errorMessage={venuesError}
        isLoading={venuesLoading}
        isOpen={venuePickerOpen}
        onClose={() => setVenuePickerOpen(false)}
        onRetry={onRetryVenues}
        onSelect={(value) => {
          touchValidationField("venue");
          clearSubmitFieldErrors("venue", "date", "start", "end", "pricing", "coach", "checkout");
          setSelectedVenueId(value);
          setStartTime("");
          setEndTime("");
          setSelectedCoachId("");
        }}
        options={venuePickerOptions}
        searchPlaceholder="Search venues"
        selectedValue={selectedVenueId}
        subtitle="Choose a live venue with its current checkout rate."
        title="Select a Venue"
      />
      <SearchableBookingPickerModal
        emptyMessage={
          startTime && endTime
            ? "No coach add-ons cover this exact venue window."
            : "Choose the venue date and time first to see matching coaches."
        }
        errorMessage={coachesError}
        isLoading={coachesLoading}
        isOpen={coachPickerOpen}
        onClose={() => setCoachPickerOpen(false)}
        onRetry={onRetryCoaches}
        onSelect={(value) => {
          touchValidationField("coach");
          clearSubmitFieldErrors("coach", "pricing", "checkout");
          setSelectedCoachId(value);
        }}
        options={coachPickerOptions}
        searchPlaceholder="Search coaches or specialties"
        selectedValue={selectedCoachId}
        subtitle="Optional coaches are filtered to the exact venue window."
        title="Coach Add-on"
      />
      <CalendarModal
        highlightedDates={startSlotOptions.length > 0 ? [reservationDate] : []}
        isOpen={datePickerOpen}
        maxDate={getMaxBookableDateInputValue()}
        minDate={getTodayDateInputValue()}
        selectedDate={reservationDate}
        onClose={() => setDatePickerOpen(false)}
        onSelect={(dateYmd) => {
          touchValidationField("date");
          clearSubmitFieldErrors("date", "start", "end", "coach", "pricing", "checkout");
          setReservationDate(dateYmd);
          setStartTime("");
          setEndTime("");
          if (dateYmd) setDatePickerOpen(false);
        }}
      />
      <TimePickerModal
        emptyMessage={
          timeTarget === "start"
            ? "No future live start times are available for this venue and date."
            : "No continuous end time is available after this start. Choose another start time."
        }
        isOpen={timePickerOpen}
        options={timeTarget === "start" ? startSlotOptions : endSlotOptions}
        selectedTime={timeTarget === "start" ? startTime : endTime}
        subtitle={
          timeTarget === "start"
            ? "Choose a canonical live venue start in gym time (UTC+8)."
            : "Choose an end from the uninterrupted available range."
        }
        title={timeTarget === "start" ? "Start Time" : "End Time"}
        onClose={() => setTimePickerOpen(false)}
        onSelect={(value) => {
          if (timeTarget === "start") {
            touchValidationField("start");
            clearSubmitFieldErrors("start", "end", "coach", "pricing", "checkout");
            setStartTime(value);
            setEndTime("");
            return;
          }
          touchValidationField("end");
          clearSubmitFieldErrors("end", "coach", "pricing", "checkout");
          setEndTime(value);
        }}
      />
    </>
  );
}

function BookingsPageStyles({ colors }: { colors: ThemeColors }) {
  return (
    <style>{`
      @keyframes bookings-directory-view-enter {
        0% {
          opacity: 0;
          transform: translateY(10px);
        }

        100% {
          opacity: 1;
          transform: translateY(0);
        }
      }

      .bookings-directory-stage {
        min-width: 0;
      }

      .bookings-coach-directory,
      .bookings-records-panel,
      .bookings-composer-rail,
      .bookings-composer-rail .member-inspector-panel {
        height: 100%;
        min-height: 0;
      }

      .bookings-coach-directory .members-directory-panel__view-enter {
        animation: bookings-directory-view-enter 180ms cubic-bezier(0.2, 0.8, 0.2, 1) both;
      }

      .bookings-records-panel .members-directory-panel__view-enter {
        animation: bookings-directory-view-enter 180ms cubic-bezier(0.2, 0.8, 0.2, 1) both;
      }

      .bookings-records-panel .members-directory-panel__row {
        transition: background-color 120ms ease, box-shadow 120ms ease;
      }

      .bookings-records-panel .members-directory-panel__row:hover {
        background-color: ${colors.brand}0d !important;
        box-shadow: 3px 0 0 ${colors.brand}66 inset;
      }

      .bookings-records-panel .members-directory-panel__row:focus-visible {
        outline: 2px solid ${colors.brand}35;
        outline-offset: 2px;
      }

      .bookings-records-panel .members-directory-panel__row-active .members-directory-panel__primary-text {
        font-weight: 850 !important;
      }

      .bookings-records-panel .members-directory-panel__row-active .members-directory-panel__secondary-text {
        color: ${colors.textPrimary} !important;
        opacity: 0.94;
      }

      .bookings-records-panel .members-directory-panel__cell,
      .bookings-records-panel .members-directory-panel__identity,
      .bookings-records-panel .members-directory-panel__identity-copy {
        min-width: 0;
      }

      .bookings-records-table {
        overflow-x: auto;
        overflow-y: hidden;
      }

      .bookings-records-panel .members-directory-panel__table-head,
      .bookings-records-panel .members-directory-panel__row {
        min-width: 720px;
      }

      .bookings-coach-grid {
        align-content: start;
        display: grid;
        gap: 8px 10px;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        min-height: 0;
        padding: 10px;
      }

      .bookings-coach-directory .members-directory-panel__grid-card {
        cursor: pointer;
        outline: none;
        transition: filter 140ms ease;
      }

      .bookings-coach-directory .members-directory-panel__grid-card:hover {
        filter: brightness(1.02);
      }

      .bookings-coach-directory .members-directory-panel__grid-card:hover > .members-grid-card {
        border-color: ${colors.brand}44 !important;
        box-shadow: 0 12px 24px rgba(0, 0, 0, 0.11) !important;
      }

      .bookings-coach-directory .members-directory-panel__grid-card-active > .members-grid-card {
        border-color: ${colors.brand}66 !important;
        box-shadow: 0 0 0 1px ${colors.brand}22 inset, 0 16px 30px rgba(0, 0, 0, 0.14) !important;
      }

      .bookings-coach-directory .members-directory-panel__grid-card:focus-visible > .members-grid-card {
        outline: 2px solid ${colors.brand}35;
        outline-offset: 2px;
      }

      .bookings-composer-body {
        align-content: start;
        display: grid;
        gap: 12px;
        justify-items: stretch;
        min-height: 0;
        overflow: visible;
      }

      .bookings-composer-body > *,
      .bookings-inspector-body > * {
        width: 100%;
      }

      .bookings-inspector-body {
        align-content: start;
        display: grid;
        gap: 14px;
        justify-items: stretch;
        min-height: 0;
        overflow: visible;
      }

      .bookings-composer-rail .member-inspector-panel__body {
        overflow: hidden !important;
        scrollbar-gutter: stable both-edges;
      }

      .bookings-request-intent-grid {
        display: grid;
        gap: 10px;
        grid-template-columns: repeat(3, minmax(0, 1fr));
      }

      .bookings-request-datetime-grid {
        display: grid;
        gap: 10px;
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }

      .bookings-time-picker-grid {
        display: grid;
        gap: 8px;
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }

      @media (max-width: 1259px) {
        .bookings-directory-stage {
          grid-template-columns: 1fr !important;
          height: auto !important;
          min-height: 0 !important;
        }

        .bookings-composer-rail {
          display: none !important;
          min-height: 0 !important;
        }

        .bookings-composer-rail .member-inspector-panel {
          height: auto !important;
          min-height: 0 !important;
        }
      }

      @media (max-width: 980px) {
        .bookings-coach-grid {
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }
      }

      @media (max-width: 860px) {
        .bookings-coach-toolbar {
          align-items: stretch !important;
          flex-wrap: wrap !important;
        }

        .bookings-coach-toolbar .members-directory-search,
        .bookings-coach-toolbar .members-directory-toolbar-left,
        .bookings-coach-toolbar .members-directory-toolbar-right,
        .bookings-coach-toolbar .members-toolbar-filters,
        .bookings-coach-toolbar .members-toolbar-status-filter {
          width: 100% !important;
          max-width: none !important;
        }

        .bookings-coach-toolbar .members-directory-toolbar-right {
          flex-wrap: wrap !important;
          justify-content: flex-start !important;
        }

        .bookings-records-toolbar > * {
          width: 100%;
          max-width: none;
        }

        .bookings-records-toolbar {
          flex-wrap: wrap !important;
        }

        .bookings-records-toolbar .members-directory-toolbar-right {
          flex-wrap: wrap !important;
          justify-content: flex-start !important;
        }
      }

      @media (max-width: 640px) {
        .bookings-coach-grid {
          grid-template-columns: 1fr;
        }

        .bookings-request-datetime-grid,
        .bookings-request-intent-grid,
        .bookings-time-picker-grid {
          grid-template-columns: 1fr;
        }

        .bookings-coach-directory .members-directory-panel__footer {
          align-items: flex-start !important;
        }

        .bookings-mode-switch {
          width: 100%;
        }
      }

      @media (prefers-reduced-motion: reduce) {
        .bookings-coach-directory .members-directory-panel__view-enter,
        .bookings-coach-directory .members-directory-panel__grid-card,
        .bookings-records-panel .members-directory-panel__view-enter,
        .bookings-records-panel .members-directory-panel__row {
          animation: none !important;
          transition: none !important;
        }
      }
    `}</style>
  );
}



type BookingPickerOption = {
  disabled?: boolean;
  searchText?: string;
  subtitle?: string;
  title: string;
  value: string;
};

function SearchableBookingPickerModal({
  emptyMessage,
  errorMessage,
  isLoading,
  isOpen,
  onClose,
  onRetry,
  onSelect,
  options,
  searchPlaceholder,
  selectedValue,
  subtitle,
  title,
}: {
  emptyMessage: string;
  errorMessage?: string | null;
  isLoading?: boolean;
  isOpen: boolean;
  onClose: () => void;
  onRetry?: () => void;
  onSelect: (value: string) => void;
  options: BookingPickerOption[];
  searchPlaceholder: string;
  selectedValue: string;
  subtitle: string;
  title: string;
}) {
  const { colors } = useTheme();
  const [query, setQuery] = useState("");
  const filteredOptions = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return options;
    return options.filter((option) =>
      [option.title, option.subtitle, option.searchText]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(normalized)),
    );
  }, [options, query]);

  useEffect(() => {
    if (!isOpen) setQuery("");
  }, [isOpen]);

  return (
    <FitModal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      subtitle={subtitle}
      icon={Filter}
      maxWidth={560}
      noScroll
      footer={<FitButton variant="ghost" label="Close" onClick={onClose} style={{ flex: 1 }} />}
    >
      <div style={{ display: "grid", gap: 12, minHeight: 0 }}>
        <FitSearch
          ariaLabel={searchPlaceholder}
          placeholder={searchPlaceholder}
          value={query}
          onChangeText={setQuery}
          compact
        />
        {isLoading ? (
          <MemberText variant="muted">Loading live options...</MemberText>
        ) : errorMessage ? (
          <div style={{ border: `1px dashed ${colors.border}`, borderRadius: 8, display: "grid", gap: 10, padding: 14 }}>
            <InlineValidationMessage message={errorMessage} />
            {onRetry ? <FitButton variant="ghost" label="Retry" onClick={onRetry} /> : null}
          </div>
        ) : filteredOptions.length === 0 ? (
          <div style={{ border: `1px dashed ${colors.border}`, borderRadius: 8, padding: 14 }}>
            <MemberText variant="muted">{emptyMessage}</MemberText>
          </div>
        ) : (
          <div style={{ display: "grid", gap: 8, maxHeight: 360, minHeight: 0, overflowY: "auto", paddingRight: 4 }}>
            {filteredOptions.map((option) => {
              const selected = option.value === selectedValue;
              return (
                <button
                  key={option.value || "none"}
                  type="button"
                  disabled={option.disabled}
                  aria-pressed={selected}
                  onClick={() => {
                    onSelect(option.value);
                    onClose();
                  }}
                  style={{
                    appearance: "none",
                    background: selected ? `${colors.brand}14` : colors.surfaceRaised,
                    border: `1px solid ${selected ? colors.brand : colors.border}`,
                    borderRadius: 8,
                    color: colors.textPrimary,
                    cursor: option.disabled ? "not-allowed" : "pointer",
                    display: "grid",
                    gap: 4,
                    opacity: option.disabled ? 0.5 : 1,
                    padding: "12px 14px",
                    textAlign: "left",
                    width: "100%",
                  }}
                >
                  <span style={{ fontSize: 13, fontWeight: 850 }}>{option.title}</span>
                  {option.subtitle ? (
                    <span style={{ color: colors.textSecondary, fontSize: 11.5, lineHeight: 1.4 }}>{option.subtitle}</span>
                  ) : null}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </FitModal>
  );
}

export default function BookingsPage() {
  const { colors } = useTheme();
  const queryClient = useQueryClient();
  const { hasMemberCardAccess, user } = useMemberOnlyAccess("Bookings");
  const [bookingMode, setBookingMode] = useState<BookingMode>("bookings");
  const [searchQuery, setSearchQuery] = useState("");
  const [activeSection, setActiveSection] = useState<BookingSection>("bookings");
  const [statusFilter, setStatusFilter] = useState<BookingStatusFilter>("all");
  const [selectedBooking, setSelectedBooking] = useState<MemberBookingItem | null>(null);
  const [coachSearchQuery, setCoachSearchQuery] = useState("");
  const [coachSkillFilter, setCoachSkillFilter] = useState<CoachSkillFilter>("all");
  const [coachRatingFilter, setCoachRatingFilter] = useState<CoachRatingFilter>("all");
  const [coachPage, setCoachPage] = useState(1);
  const [selectedCoachId, setSelectedCoachId] = useState<string | null>(null);
  const [bookingIntent, setBookingIntent] = useState<CoachBookingIntent>("single");
  const [preferredDate, setPreferredDate] = useState(getTodayDateInputValue());
  const [preferredTime, setPreferredTime] = useState("");
  const [bookingNotes, setBookingNotes] = useState("");
  const [bookingDraftState, setBookingDraftState] = useState<string | null>(null);
  const [composerActionsOpen, setComposerActionsOpen] = useState(false);
  const [composerPanelMode, setComposerPanelMode] = useState<ComposerPanelMode>("details");
  const [requestModalOpen, setRequestModalOpen] = useState(false);
  const [bookingActionsOpen, setBookingActionsOpen] = useState(false);
  const [bookingPanelMode, setBookingPanelMode] = useState<BookingPanelMode>("details");
  const [cancelConfirmation, setCancelConfirmation] = useState<BookingCancellationConfirmation | null>(null);
  const [isCompactBookingLayout, setIsCompactBookingLayout] = useState(false);
  const [mobileComposerOpen, setMobileComposerOpen] = useState(false);
  const [mobileBookingDetailsOpen, setMobileBookingDetailsOpen] = useState(false);
  const [reservationModalOpen, setReservationModalOpen] = useState(false);
  const [bookingPage, setBookingPage] = useState(1);
  const [reviewComment, setReviewComment] = useState("");
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewState, setReviewState] = useState<{
    text: string;
    tone: "danger" | "success";
  } | null>(null);
  const data = useMemberOnlyBookingsData(user?.id);
  const enrollRecurringCoachingMutation = useMutation(
    enrollRecurringCoachingPlanMutationOptions(webApiClient, queryClient),
  );
  const coachFilters = useMemo(
    () => ({
      ...(coachSkillFilter !== "all" ? { specialization: coachSkillFilter } : {}),
      ...(coachRatingFilter !== "all" ? { minRating: Number(coachRatingFilter) } : {}),
    }),
    [coachRatingFilter, coachSkillFilter],
  );
  const coachesQuery = useQuery({
    ...activeCoachesQueryOptions<CoachProfileRecord>(webApiClient, coachFilters),
    enabled: !!user?.id,
  });
  const coaches = useMemo(() => coachesQuery.data ?? [], [coachesQuery.data]);
  const coachSkillOptions = useMemo(() => {
    const values = new Set<string>();
    if (coachSkillFilter !== "all") {
      values.add(coachSkillFilter);
    }
    coaches.forEach((coach) => {
      coach.specialties?.forEach((specialty) => {
        const trimmed = specialty.trim();
        if (trimmed) values.add(trimmed);
      });
    });

    return [
      { label: "All Skills", value: "all" },
      ...Array.from(values)
        .sort((a, b) => a.localeCompare(b))
        .map((specialty) => ({ label: specialty, value: specialty })),
    ];
  }, [coachSkillFilter, coaches]);
  const filteredCoaches = useMemo(() => {
    const minRating = coachRatingFilter === "all" ? 0 : Number(coachRatingFilter);
    return coaches.filter((coach) => {
      const matchesSearch = coachMatchesSearch(coach, coachSearchQuery);
      const matchesSkill =
        coachSkillFilter === "all" ||
        coach.specialties?.some((specialty) => specialty.toLowerCase() === coachSkillFilter.toLowerCase());
      const matchesRating = getCoachRatingValue(coach) >= minRating || (minRating === 0 && coach.ratingCount === 0);
      return matchesSearch && matchesSkill && matchesRating;
    });
  }, [coachRatingFilter, coachSearchQuery, coachSkillFilter, coaches]);
  const coachTotalPages = Math.max(1, Math.ceil(filteredCoaches.length / COACH_DIRECTORY_PAGE_SIZE));
  const normalizedCoachPage = Math.min(coachPage, coachTotalPages);
  const paginatedCoaches = useMemo(
    () =>
      filteredCoaches.slice(
        (normalizedCoachPage - 1) * COACH_DIRECTORY_PAGE_SIZE,
        normalizedCoachPage * COACH_DIRECTORY_PAGE_SIZE,
      ),
    [filteredCoaches, normalizedCoachPage],
  );
  const selectedCoach = filteredCoaches.find((coach) => coach.id === selectedCoachId) ?? filteredCoaches[0] ?? null;
  const reservations = useMemo(
    () =>
      toMemberBookings(
        (data.bookingsQuery.data ?? []).filter((record) => isVisibleProductBooking(record.status)),
        data.venuesQuery.data ?? [],
      ),
    [data.bookingsQuery.data, data.venuesQuery.data],
  );
  const appointments = useMemo(
    () =>
      (data.appointmentsQuery.data ?? [])
        .filter(
          (record) => isVisibleProductBooking(record.status),
        )
        .map(toMemberAppointment),
    [data.appointmentsQuery.data],
  );
  const activeItems = activeSection === "bookings" ? reservations : appointments;
  const filtered = activeItems.filter((booking) => {
    const matchesStatus =
      statusFilter === "all" ||
      booking.status === statusFilter;
    const query = searchQuery.trim().toLowerCase();
    const matchesSearch =
      !query ||
      booking.resourceName.toLowerCase().includes(query) ||
      (booking.participantName ?? "").toLowerCase().includes(query);
    return matchesStatus && matchesSearch;
  });
  const bookingTotalPages = Math.max(1, Math.ceil(filtered.length / BOOKING_RECORDS_PAGE_SIZE));
  const normalizedBookingPage = Math.min(bookingPage, bookingTotalPages);
  const paginatedBookings = useMemo(
    () =>
      filtered.slice(
        (normalizedBookingPage - 1) * BOOKING_RECORDS_PAGE_SIZE,
        normalizedBookingPage * BOOKING_RECORDS_PAGE_SIZE,
      ),
    [filtered, normalizedBookingPage],
  );
  const selected = filtered.find((booking) => booking.id === selectedBooking?.id) ?? filtered[0] ?? null;
  const selectedVenueUnderMaintenance = Boolean(
    activeSection === "bookings" &&
      selected &&
      data.venuesQuery.data?.some(
        (venue) =>
          String(venue.id) === String(selected.resourceId) &&
          venue.status === "maintenance",
      ),
  );
  const isLoading = data.bookingsQuery.isPending || data.appointmentsQuery.isPending;
  const canReviewCoach =
    activeSection === "appointments" &&
    selected?.status === "completed" &&
    typeof selected.coachId === "string" &&
    selected.coachId.length > 0;
  useEffect(() => {
    const mediaQuery = window.matchMedia("(max-width: 1259px)");
    const update = () => setIsCompactBookingLayout(mediaQuery.matches);

    update();

    if (typeof mediaQuery.addEventListener === "function") {
      mediaQuery.addEventListener("change", update);
      return () => mediaQuery.removeEventListener("change", update);
    }

    mediaQuery.addListener(update);
    return () => mediaQuery.removeListener(update);
  }, []);

  useEffect(() => {
    if (isCompactBookingLayout) return;
    setMobileComposerOpen(false);
    setMobileBookingDetailsOpen(false);
  }, [isCompactBookingLayout]);

  useEffect(() => {
    setReviewComment("");
    setReviewRating(5);
    setReviewState(null);
    setBookingActionsOpen(false);
    setBookingPanelMode("details");
  }, [selected?.id]);

  useEffect(() => {
    setBookingDraftState(null);
  }, [bookingIntent, selectedCoach?.id]);

  useEffect(() => {
    setComposerActionsOpen(false);
    setComposerPanelMode("details");
    setRequestModalOpen(false);
  }, [selectedCoach?.id]);

  useEffect(() => {
    setCoachPage(1);
  }, [coachRatingFilter, coachSearchQuery, coachSkillFilter]);

  useEffect(() => {
    setBookingPage(1);
  }, [activeSection, searchQuery, statusFilter]);

  useEffect(() => {
    setMobileBookingDetailsOpen(false);
  }, [activeSection]);

  useEffect(() => {
    if (coachPage !== normalizedCoachPage) {
      setCoachPage(normalizedCoachPage);
    }
  }, [coachPage, normalizedCoachPage]);

  useEffect(() => {
    if (bookingPage !== normalizedBookingPage) {
      setBookingPage(normalizedBookingPage);
    }
  }, [bookingPage, normalizedBookingPage]);

  const handlePrepareBookingRequest = async (input: CoachAppointmentSubmitInput) => {
    if (!selectedCoach) return;

    if (input.bookingIntent === "monthly") {
      const monthlyOffer = getMonthlyCoachOffer(selectedCoach);
      if (!hasMemberCardAccess) {
        throw new Error("Active membership access is required for monthly coaching.");
      }
      if (!monthlyOffer.isAvailable) {
        throw new Error("This coach no longer has an active monthly offer.");
      }

      const checkoutAttempt = await enrollRecurringCoachingMutation.mutateAsync({
        coachId: String(selectedCoach.id),
        idempotencyKey: createClientIdempotencyKey(),
        startDate: input.preferredDate,
      });
      const checkoutUrl = getCommerceCheckoutUrl(checkoutAttempt);
      if (!checkoutUrl || !getCommerceCheckoutHoldId(checkoutAttempt)) {
        throw new Error("PayMongo did not return a monthly checkout link. No coaching plan was activated.");
      }
      rememberCommerceCheckoutHold(checkoutAttempt);
      window.location.assign(checkoutUrl);
      return;
    }

    const checkoutAttempt = await data.createAppointmentMutation.mutateAsync({
      payload: {
        bookingMode: "single",
        coachId: String(selectedCoach.id),
        duration: input.selectedSlot.durationMin,
        idempotencyKey: createClientIdempotencyKey(),
        notes: input.bookingNotes.trim() || undefined,
        scheduledAt: toGymWallClockIso(input.preferredDate, timeToMinutes(input.selectedSlot.startTime)),
        sessionCount: 1,
      },
      userId: user?.id,
    });

    const checkoutUrl = getCommerceCheckoutUrl(checkoutAttempt);
    if (!checkoutUrl || !getCommerceCheckoutHoldId(checkoutAttempt)) {
      throw new Error("PayMongo did not return a checkout link. The appointment was not activated.");
    }

    rememberCommerceCheckoutHold(checkoutAttempt);
    window.location.assign(checkoutUrl);
  };

  const handleCancelSelectedBooking = () => {
    if (!selected) return;

    if (activeSection === "bookings") {
      setCancelConfirmation({
        bookingId: selected.id,
        bookingTitle: selected.detailTitle ?? selected.resourceName,
        phase: "confirm",
      });
      return;
    }

    void data.cancelAppointmentMutation.mutateAsync({
      appointmentId: selected.id,
      cancelReason: "Cancelled from the member web portal.",
      userId: user?.id,
    });
  };

  const confirmSelectedBookingCancellation = async () => {
    if (!cancelConfirmation) return;

    try {
      await data.cancelBookingMutation.mutateAsync({
        bookingId: cancelConfirmation.bookingId,
        cancelReason: "Cancelled from the member web portal.",
        userId: user?.id,
      });
      setCancelConfirmation(null);
    } catch (error) {
      setCancelConfirmation((current) =>
        current && current.bookingId === cancelConfirmation.bookingId
          ? {
              ...current,
              error: getBookingCancellationErrorMessage(error),
              phase: "reminder",
            }
          : current,
      );
    }
  };

  const handleCreateReservation = async (input: ReservationSubmitInput) => {
    const checkoutAttempt = await data.createBookingMutation.mutateAsync({
      date: input.date,
      payload: {
        ...input.payload,
        idempotencyKey: createClientIdempotencyKey(),
      },
      userId: input.userId,
      venueId: input.venueId,
    });
    const checkoutUrl = getCommerceCheckoutUrl(checkoutAttempt);
    if (!checkoutUrl || !getCommerceCheckoutHoldId(checkoutAttempt)) {
      throw new Error("PayMongo did not return a venue checkout link. No reservation was activated.");
    }
    rememberCommerceCheckoutHold(checkoutAttempt);
    window.location.assign(checkoutUrl);
    return checkoutAttempt;
  };

  const handleCoachReviewSubmit = async () => {
    if (!selected?.coachId) return;

    const trimmedComment = reviewComment.trim();
    if (!trimmedComment) {
      setReviewState({
        text: "Add a short note before submitting coach feedback.",
        tone: "danger",
      });
      return;
    }

    try {
      await data.submitCoachReviewMutation.mutateAsync({
        coachId: selected.coachId,
        payload: {
          appointmentId: selected.id,
          comment: trimmedComment,
          rating: reviewRating,
        },
        userId: user?.id,
      });
      setReviewComment("");
      setReviewState({
        text: "Coach feedback submitted for this completed session.",
        tone: "success",
      });
    } catch {
      setReviewState({
        text: "Coach feedback could not be submitted right now.",
        tone: "danger",
      });
    }
  };

  const handleBookTrainer = () => {
    setReservationModalOpen(false);
    setBookingMode("find");
  };

  return (
    <MemberOnlyScreen>
      {bookingMode === "find" ? (
        <div
          className="bookings-directory-stage"
          style={{
            alignItems: "stretch",
            backgroundColor: "transparent",
            border: "none",
            borderRadius: 8,
            display: "grid",
            gap: 12,
            gridTemplateColumns: "minmax(0, 1fr) minmax(284px, 0.36fr)",
            height: "100%",
            marginRight: 0,
            minHeight: 0,
            padding: 0,
            width: "100%",
          }}
        >
          <CoachDiscoveryPanel
            coaches={paginatedCoaches}
            currentPage={normalizedCoachPage}
            error={coachesQuery.isError}
            loading={coachesQuery.isPending}
            modeSwitch={<BookingModeSwitch value={bookingMode} onChange={setBookingMode} />}
            onPageChange={setCoachPage}
            onRatingFilterChange={setCoachRatingFilter}
            onSearchChange={setCoachSearchQuery}
            onSelectCoach={(coachId) => {
              setSelectedCoachId(coachId);
              if (isCompactBookingLayout) setMobileComposerOpen(true);
            }}
            onSkillFilterChange={setCoachSkillFilter}
            primaryActions={
              <BookingQuickActions
                disabled={data.venuesQuery.isPending}
                onBookTrainer={handleBookTrainer}
                onMakeReservation={() => {
                  setActiveSection("bookings");
                  setReservationModalOpen(true);
                }}
              />
            }
            ratingFilter={coachRatingFilter}
            searchQuery={coachSearchQuery}
            selectedCoachId={selectedCoach?.id}
            skillFilter={coachSkillFilter}
            skillOptions={coachSkillOptions}
            totalFilteredCount={filteredCoaches.length}
            totalPages={coachTotalPages}
          />

          <div className="bookings-composer-rail" style={{ alignSelf: "stretch", display: "grid", gap: 12, height: "100%", minHeight: 0 }}>
            <MemberInspectorPanel
              ariaLabel="Booking Composer"
              footer={
                selectedCoach ? (
                  <ComposerActionFooter
                    actionsOpen={composerActionsOpen}
                    mode={composerPanelMode}
                    onOpenRequest={() => {
                      setBookingDraftState(null);
                      setRequestModalOpen(true);
                    }}
                    onSetActionsOpen={setComposerActionsOpen}
                    onSetMode={setComposerPanelMode}
                  />
                ) : undefined
              }
            >
              {selectedCoach ? (
                <div className="bookings-composer-body">
                  <div
                    style={{
                      display: "grid",
                      gap: 8,
                      justifyItems: "center",
                      padding: "0 0 4px",
                      textAlign: "center",
                    }}
                  >
                    <div
                      style={{
                        alignItems: "center",
                        backgroundColor: colors.surfaceRaised,
                        border: `1px solid ${colors.border}`,
                        borderRadius: 8,
                        color: colors.brand,
                        display: "flex",
                        height: 74,
                        justifyContent: "center",
                        overflow: "hidden",
                        width: 74,
                      }}
                    >
                      <FitText style={{ fontSize: 24, fontWeight: 850, letterSpacing: "0.04em" }}>
                        {getCoachInitials(selectedCoach)}
                      </FitText>
                    </div>
                    <div style={{ display: "grid", gap: 4, justifyItems: "center", minWidth: 0 }}>
                      <FitText
                        style={{
                          color: colors.textPrimary,
                          fontSize: 16,
                          fontWeight: 850,
                          lineHeight: 1.22,
                          overflowWrap: "anywhere",
                        }}
                      >
                        {getCoachName(selectedCoach)}
                      </FitText>
                      <FitText
                        style={{
                          color: colors.textSecondary,
                          fontSize: 12,
                          fontWeight: 600,
                          lineHeight: 1.28,
                          overflowWrap: "anywhere",
                        }}
                      >
                        {getCoachSpecialtySummary(selectedCoach)}
                      </FitText>
                    </div>
                    <span style={directoryBadgeStyle(getCoachBadgeTone(selectedCoach, colors), colors, 10)}>
                      {getCoachRatingLabel(selectedCoach)}
                    </span>
                    {composerPanelMode === "details" ? (
                      <MemberText variant="subtitle">
                        {selectedCoach.bio?.trim() || "Coach profile details are available for member review."}
                      </MemberText>
                    ) : null}
                  </div>

                  {bookingDraftState ? (
                    <FitText style={{ color: colors.success, fontSize: 12.5, fontWeight: 750, lineHeight: 1.35 }}>
                      {bookingDraftState}
                    </FitText>
                  ) : null}

                  {composerPanelMode === "details" ? (
                    <CoachDetailsContent coach={selectedCoach} />
                  ) : (
                    <RecentFeedbackContent coach={selectedCoach} />
                  )}
                </div>
              ) : (
                <EmptyState icon={UserRoundCheck} title="Select a coach" hint="Coach details and booking intent controls will appear here." />
              )}
            </MemberInspectorPanel>
            <RequestCoachModal
              bookingDraftState={bookingDraftState}
              bookingIntent={bookingIntent}
              bookingNotes={bookingNotes}
              hasMemberCardAccess={hasMemberCardAccess}
              isSubmitting={
                data.createAppointmentMutation.isPending ||
                enrollRecurringCoachingMutation.isPending
              }
              isOpen={requestModalOpen}
              onClose={() => setRequestModalOpen(false)}
              onSubmit={handlePrepareBookingRequest}
              preferredDate={preferredDate}
              preferredTime={preferredTime}
              selectedCoach={selectedCoach}
              setBookingIntent={setBookingIntent}
              setBookingNotes={setBookingNotes}
              setPreferredDate={setPreferredDate}
              setPreferredTime={setPreferredTime}
            />
          </div>
        </div>
      ) : (
        <div
          className="bookings-directory-stage"
          style={{
            alignItems: "stretch",
            backgroundColor: "transparent",
            border: "none",
            borderRadius: 8,
            display: "grid",
            gap: 12,
            gridTemplateColumns: "minmax(0, 1fr) minmax(284px, 0.36fr)",
            height: "100%",
            marginRight: 0,
            minHeight: 0,
            padding: 0,
            width: "100%",
          }}
        >
          <BookingsRecordsPanel
            activeSection={activeSection}
            currentPage={normalizedBookingPage}
            isLoading={isLoading}
            modeSwitch={<BookingModeSwitch value={bookingMode} onChange={setBookingMode} />}
            onPageChange={setBookingPage}
            onSearchChange={setSearchQuery}
            onSectionChange={setActiveSection}
            onSelectBooking={(booking) => {
              setSelectedBooking(booking);
              if (isCompactBookingLayout) setMobileBookingDetailsOpen(true);
            }}
            onStatusFilterChange={setStatusFilter}
            primaryActions={
              <BookingQuickActions
                disabled={data.venuesQuery.isPending}
                onBookTrainer={handleBookTrainer}
                onMakeReservation={() => {
                  setActiveSection("bookings");
                  setReservationModalOpen(true);
                }}
              />
            }
            rows={paginatedBookings}
            searchQuery={searchQuery}
            selectedBookingId={selected?.id}
            statusFilter={statusFilter}
            totalFilteredCount={filtered.length}
            totalPages={bookingTotalPages}
          />

          <div className="bookings-composer-rail" style={{ alignSelf: "stretch", display: "grid", gap: 12, height: "100%", minHeight: 0 }}>
            <MemberInspectorPanel
              ariaLabel="Booking Details"
              footer={
                selected ? (
                  <BookingInspectorActionFooter
                    actionsOpen={bookingActionsOpen}
                    canCancel={
                      (selected.status === "confirmed" || selected.status === "pending") &&
                      !data.cancelBookingMutation.isPending &&
                      !data.cancelAppointmentMutation.isPending
                    }
                    mode={bookingPanelMode}
                    onCancel={handleCancelSelectedBooking}
                    onSetActionsOpen={setBookingActionsOpen}
                    onSetMode={setBookingPanelMode}
                  />
                ) : undefined
              }
            >
              <BookingInspectorContent
                activeSection={activeSection}
                booking={selected}
                canReviewCoach={canReviewCoach}
                mode={bookingPanelMode}
                onReviewStateChange={setReviewState}
                onReviewSubmit={() => void handleCoachReviewSubmit()}
                reviewComment={reviewComment}
                reviewRating={reviewRating}
                reviewState={reviewState}
                setReviewComment={setReviewComment}
                setReviewRating={setReviewRating}
                submitPending={data.submitCoachReviewMutation.isPending}
                venueUnderMaintenance={selectedVenueUnderMaintenance}
              />
            </MemberInspectorPanel>
          </div>
        </div>
      )}
      <FitModal
        isOpen={
          bookingMode === "find" &&
          isCompactBookingLayout &&
          mobileComposerOpen &&
          Boolean(selectedCoach)
        }
        onClose={() => setMobileComposerOpen(false)}
        title={selectedCoach ? getCoachName(selectedCoach) : "Coach details"}
        subtitle={selectedCoach ? getCoachSpecialtySummary(selectedCoach) : "Booking composer"}
        icon={UserRoundCheck}
        maxWidth={560}
        closeAriaLabel="Close coach details"
        footer={
          selectedCoach ? (
            <ComposerActionFooter
              actionsOpen={composerActionsOpen}
              mode={composerPanelMode}
              onOpenRequest={() => {
                setBookingDraftState(null);
                setRequestModalOpen(true);
              }}
              onSetActionsOpen={setComposerActionsOpen}
              onSetMode={setComposerPanelMode}
            />
          ) : undefined
        }
      >
        {selectedCoach ? (
          <div className="bookings-composer-body">
            <div
              style={{
                display: "grid",
                gap: 8,
                justifyItems: "center",
                padding: "0 0 4px",
                textAlign: "center",
              }}
            >
              <div
                style={{
                  alignItems: "center",
                  backgroundColor: colors.surfaceRaised,
                  border: `1px solid ${colors.border}`,
                  borderRadius: 8,
                  color: colors.brand,
                  display: "flex",
                  height: 74,
                  justifyContent: "center",
                  overflow: "hidden",
                  width: 74,
                }}
              >
                <FitText style={{ fontSize: 24, fontWeight: 850, letterSpacing: "0.04em" }}>
                  {getCoachInitials(selectedCoach)}
                </FitText>
              </div>
              <span style={directoryBadgeStyle(getCoachBadgeTone(selectedCoach, colors), colors, 10)}>
                {getCoachRatingLabel(selectedCoach)}
              </span>
              {composerPanelMode === "details" ? (
                <MemberText variant="subtitle">
                  {selectedCoach.bio?.trim() || "Coach profile details are available for member review."}
                </MemberText>
              ) : null}
            </div>
            {bookingDraftState ? (
              <FitText style={{ color: colors.success, fontSize: 12.5, fontWeight: 750, lineHeight: 1.35 }}>
                {bookingDraftState}
              </FitText>
            ) : null}
            {composerPanelMode === "details" ? (
              <CoachDetailsContent coach={selectedCoach} />
            ) : (
              <RecentFeedbackContent coach={selectedCoach} />
            )}
          </div>
        ) : null}
      </FitModal>
      <FitModal
        isOpen={
          bookingMode === "bookings" &&
          isCompactBookingLayout &&
          mobileBookingDetailsOpen &&
          Boolean(selected)
        }
        onClose={() => setMobileBookingDetailsOpen(false)}
        title={selected?.detailTitle ?? selected?.resourceName ?? "Booking details"}
        subtitle={selected ? getBookingScheduleLabel(selected) : "Reservation details"}
        icon={CalendarCheck}
        maxWidth={560}
        closeAriaLabel="Close booking details"
        footer={
          selected ? (
            <BookingInspectorActionFooter
              actionsOpen={bookingActionsOpen}
              canCancel={
                (selected.status === "confirmed" || selected.status === "pending") &&
                !data.cancelBookingMutation.isPending &&
                !data.cancelAppointmentMutation.isPending
              }
              mode={bookingPanelMode}
              onCancel={handleCancelSelectedBooking}
              onSetActionsOpen={setBookingActionsOpen}
              onSetMode={setBookingPanelMode}
            />
          ) : undefined
        }
      >
        <BookingInspectorContent
          activeSection={activeSection}
          booking={selected}
          canReviewCoach={canReviewCoach}
          mode={bookingPanelMode}
          onReviewStateChange={setReviewState}
          onReviewSubmit={() => void handleCoachReviewSubmit()}
          reviewComment={reviewComment}
          reviewRating={reviewRating}
          reviewState={reviewState}
          setReviewComment={setReviewComment}
          setReviewRating={setReviewRating}
          submitPending={data.submitCoachReviewMutation.isPending}
          venueUnderMaintenance={selectedVenueUnderMaintenance}
        />
      </FitModal>
      <MemberReservationModal
        coaches={coaches}
        coachesError={coachesQuery.isError ? "Unable to load live coach profiles." : null}
        coachesLoading={coachesQuery.isPending}
        existingReservations={reservations}
        hasMemberCardAccess={hasMemberCardAccess}
        isOpen={reservationModalOpen}
        isSubmitting={data.createBookingMutation.isPending}
        onBookTrainer={handleBookTrainer}
        onClose={() => setReservationModalOpen(false)}
        onRetryCoaches={() => {
          void coachesQuery.refetch();
        }}
        onRetryVenues={() => {
          void data.venuesQuery.refetch();
        }}
        onSubmit={handleCreateReservation}
        userId={user?.id}
        venues={data.venuesQuery.data ?? []}
        venuesError={data.venuesQuery.isError ? "Unable to load reservable venues." : null}
        venuesLoading={data.venuesQuery.isPending}
      />
      <ConfirmModal
        isOpen={Boolean(cancelConfirmation)}
        title={
          cancelConfirmation?.phase === "reminder"
            ? "Venue booking reminder"
            : "Cancel venue booking?"
        }
        message={
          cancelConfirmation?.phase === "reminder"
            ? `${cancelConfirmation.error ?? "This venue booking cannot be cancelled yet."} Your booking remains active.`
            : `Cancel ${cancelConfirmation?.bookingTitle ?? "this venue booking"}? This action cannot be undone.`
        }
        confirmLabel={cancelConfirmation?.phase === "reminder" ? "CLOSE" : "CANCEL BOOKING"}
        loadingLabel="CANCELLING"
        hideCancel={cancelConfirmation?.phase === "reminder"}
        isDanger={cancelConfirmation?.phase !== "reminder"}
        isLoading={
          cancelConfirmation?.phase !== "reminder" &&
          data.cancelBookingMutation.isPending
        }
        onConfirm={() => {
          if (cancelConfirmation?.phase === "reminder") {
            setCancelConfirmation(null);
            return;
          }
          void confirmSelectedBookingCancellation();
        }}
        onCancel={() => setCancelConfirmation(null)}
      />
      <BookingsPageStyles colors={colors} />
    </MemberOnlyScreen>
  );
}
