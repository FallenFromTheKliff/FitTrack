"use client";

import type { CSSProperties, KeyboardEvent, ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import {
  CalendarCheck,
  CalendarDays,
  ChevronUp,
  Clock3,
  Filter,
  Info,
  type LucideIcon,
  MessageSquareText,
  Repeat,
  Send,
  Ticket,
  UserRoundCheck,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import type { CoachAvailabilityResponse } from "@fittrack/api-client";
import { expandCoachAvailabilitySlots, formatBookingDate } from "@fittrack/utils";
import { isPaymongoCheckoutEnabled, WEEKDAY_NAMES } from "@fittrack/app-config";
import type { CoachProfileRecord, VenueRecord } from "@fittrack/types";
import { activeCoachesQueryOptions, coachAvailabilityQueryOptions } from "@fittrack/query";

import FitButton from "@/components/fit/FitButton";
import { FitPagination, FitSelect } from "@/components/fit";
import FitSearch from "@/components/fit/FitSearch";
import { FitText, FitTextArea } from "@/components/fit/FitText";
import MemberInspectorPanel from "@/components/accounts/MemberInspectorPanel";
import { CalendarModal, FitModal } from "@/components/modals";
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
import { useMemberOnlyAccess, useMemberOnlyBookingsData } from "@/hooks/member-only/useMemberOnlyData";

type BookingMode = "find" | "bookings";
type CoachRatingFilter = "all" | "4" | "4.5";
type CoachSkillFilter = "all" | string;
type CoachBookingIntent = "single" | "pack" | "recurring";
type ComposerPanelMode = "details" | "feedback";
type BookingPanelMode = "details" | "timeline" | "feedback";
type AppointmentInitialPaymentStage = "downpayment" | "full";
type AppointmentPaymentProvider = "cash" | "paymongo";
type AppointmentSlotOption = {
  durationMin: number;
  label: string;
  startTime: string;
};
type PendingAppointmentPayment = {
  booking: MemberBookingItem;
  provider: AppointmentPaymentProvider;
  stage: AppointmentInitialPaymentStage;
};
type PaymentConfirmationState = {
  message: string;
  title: string;
};
type ReservationPaymentOption = "paymongo_downpayment" | "cash_downpayment" | "cash_full";
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

const REQUEST_TIME_OPTIONS = Array.from({ length: 31 }, (_, index) => {
  const totalMinutes = 6 * 60 + index * 30;
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
    description: "Reserve a small block of sessions.",
    icon: Ticket,
    label: "Multi-Session Pack",
    sessionCount: 3,
    value: "pack",
  },
  {
    description: "Plan a repeated weekly coaching rhythm.",
    icon: Repeat,
    label: "Recurring Plan",
    sessionCount: 4,
    value: "recurring",
  },
];

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
  if (availableSlots.length === 0) return "Availability on request";
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
  const today = new Date();
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
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

function getReservationDurationHours(startTime: string, endTime: string) {
  if (!startTime || !endTime) return 0;
  const duration = (timeToMinutes(endTime) - timeToMinutes(startTime)) / 60;
  return duration > 0 ? Math.round(duration * 100) / 100 : 0;
}

function isFutureLocalStart(date: string, startTime: string) {
  if (!date || !startTime) return false;
  const [year, month, day] = date.split("-").map(Number);
  const [hour, minute] = startTime.split(":").map(Number);
  return new Date(year, month - 1, day, hour, minute).getTime() > Date.now();
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
  const amount = booking.amountDueNow ?? booking.totalAmount ?? booking.price ?? 0;
  return formatMoney(Number(amount));
}

function getBookingScheduleLabel(booking: MemberBookingItem) {
  return `${formatBookingDate(booking.date)} / ${booking.time}`;
}

function isAppointmentPaymentActionable(activeSection: BookingSection, booking: MemberBookingItem | null) {
  if (activeSection !== "appointments" || !booking) return false;
  if (booking.status === "pending_full_payment") {
    return booking.activePaymentStage === "full";
  }

  return (
    booking.status === "pending_payment" ||
    booking.status === "pending_downpayment"
  );
}

function canStartFullAppointmentPayment(activeSection: BookingSection, booking: MemberBookingItem | null) {
  if (activeSection !== "appointments" || !booking) return false;
  return (
    booking.status === "pending_payment" &&
    booking.activePaymentStage !== "downpayment" &&
    Number(booking.totalAmount ?? booking.amountDueNow ?? 0) > 0
  );
}

function getAppointmentPaymentStage(booking: MemberBookingItem | null): AppointmentInitialPaymentStage {
  if (booking?.activePaymentStage === "full") {
    return "full";
  }

  return "downpayment";
}

function getAppointmentPaymentAmount(booking: MemberBookingItem, stage: AppointmentInitialPaymentStage) {
  if (stage === "full") {
    return Number(booking.totalAmount ?? booking.amountDueNow ?? 0);
  }

  return Number(booking.amountDueNow ?? booking.totalAmount ?? 0);
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
        <BookingCompactStatCard label="Amount Due" value={getBookingAmountLabel(booking)} tone="brand" />
      </div>

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
          <BookingDetailLine label="Payment" value={booking.paymentPlan ? booking.paymentPlan.replace(/_/g, " ") : "Standard"} />
          {booking.remainingBalance != null ? (
            <BookingDetailLine label="Balance" value={formatMoney(Number(booking.remainingBalance))} />
          ) : null}
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
              label: activeSection === "appointments" ? "Booking requested" : "Reservation requested",
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
  canPayAppointment,
  canPayAppointmentInFull,
  mode,
  onCancel,
  onPayAppointment,
  onSetActionsOpen,
  onSetMode,
  paymentLoading,
  paymentStage,
}: {
  actionsOpen: boolean;
  canCancel: boolean;
  canPayAppointment: boolean;
  canPayAppointmentInFull: boolean;
  mode: BookingPanelMode;
  onCancel: () => void;
  onPayAppointment: (provider: AppointmentPaymentProvider, stage: AppointmentInitialPaymentStage) => void;
  onSetActionsOpen: (value: boolean) => void;
  onSetMode: (mode: BookingPanelMode) => void;
  paymentLoading: boolean;
  paymentStage: AppointmentInitialPaymentStage;
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
          {canPayAppointment ? (
            <>
              <FitButton
                variant="primary"
                label={paymentStage === "full" ? "PAYMONGO FULL" : "PAYMONGO DOWNPAYMENT"}
                fullWidth
                disabled={paymentLoading}
                loading={paymentLoading}
                loadingLabel="CONFIRMING"
                onClick={() => onPayAppointment("paymongo", paymentStage)}
                style={{ ...compactActionStyle, gridColumn: "1 / -1" }}
                textStyle={compactTextStyle}
              />
              <FitButton
                variant="ghost"
                label={paymentStage === "full" ? "CASH FULL" : "CASH DOWNPAYMENT"}
                fullWidth
                disabled={paymentLoading}
                loading={paymentLoading}
                loadingLabel="SENDING"
                onClick={() => onPayAppointment("cash", paymentStage)}
                style={compactActionStyle}
                textStyle={compactTextStyle}
              />
              {paymentStage !== "full" && canPayAppointmentInFull ? (
                <>
                  <FitButton
                    variant="ghost"
                    label="PAYMONGO FULL"
                    fullWidth
                    disabled={paymentLoading}
                    loading={paymentLoading}
                    loadingLabel="CONFIRMING"
                    onClick={() => onPayAppointment("paymongo", "full")}
                    style={compactActionStyle}
                    textStyle={compactTextStyle}
                  />
                  <FitButton
                    variant="ghost"
                    label="CASH FULL"
                    fullWidth
                    disabled={paymentLoading}
                    loading={paymentLoading}
                    loadingLabel="SENDING"
                    onClick={() => onPayAppointment("cash", "full")}
                    style={compactActionStyle}
                    textStyle={compactTextStyle}
                  />
                </>
              ) : null}
            </>
          ) : null}
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

function RequestFieldButton({
  icon,
  label,
  onClick,
  value,
}: {
  icon: LucideIcon;
  label: string;
  onClick: () => void;
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
        onClick={onClick}
        style={{ minHeight: 44, borderRadius: 8 }}
        textStyle={{ fontSize: 13, fontWeight: 750 }}
      >
        {value}
      </FitButton>
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
  subtitle = "Choose a request window for staff and coach review.",
  title = "Preferred Time",
}: {
  emptyMessage?: string;
  isOpen: boolean;
  onClose: () => void;
  onSelect: (value: string) => void;
  options?: ReadonlyArray<{ disabled?: boolean; label: string; value: string }>;
  selectedTime: string;
  subtitle?: string;
  title?: string;
}) {
  const { colors } = useTheme();
  const timeOptions: ReadonlyArray<{ disabled?: boolean; label: string; value: string }> =
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
            <FitButton
              key={option.value}
              variant={isActive ? "primary" : "ghost"}
              label={option.label}
              disabled={option.disabled}
              onClick={() => {
                onSelect(option.value);
                onClose();
              }}
              style={{
                borderRadius: 8,
                minHeight: 38,
                paddingInline: 10,
                ...(isActive
                  ? {}
                  : {
                      backgroundColor: colors.surfaceRaised,
                      border: `1px solid ${colors.border}`,
                    }),
              }}
              textStyle={{ fontSize: 12, fontWeight: 800 }}
            />
          );
        })}
      </div>
    </FitModal>
  );
}

type CoachAppointmentSubmitInput = {
  bookingIntent: CoachBookingIntent;
  bookingNotes: string;
  preferredDate: string;
  selectedSlot: AppointmentSlotOption;
};

function RequestCoachModal({
  bookingDraftState,
  bookingIntent,
  bookingNotes,
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
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [requestError, setRequestError] = useState("");
  const [timePickerOpen, setTimePickerOpen] = useState(false);
  const availabilityQuery = useQuery({
    ...coachAvailabilityQueryOptions<CoachAvailabilityResponse>(
      webApiClient,
      selectedCoach ? String(selectedCoach.id) : undefined,
    ),
    enabled: isOpen && !!selectedCoach,
  });
  const bookedCoachDateSet = useMemo(
    () => new Set(availabilityQuery.data?.bookedDates ?? []),
    [availabilityQuery.data?.bookedDates],
  );
  const isSelectedCoachDateBooked = preferredDate ? bookedCoachDateSet.has(preferredDate) : false;
  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const availableSlots = useMemo<AppointmentSlotOption[]>(() => {
    if (!availabilityQuery.data?.availability || !preferredDate || isSelectedCoachDateBooked) return [];
    return expandCoachAvailabilitySlots(
      availabilityQuery.data.availability,
      availabilityQuery.data.scheduleType,
    )
      .filter(
        (slot) =>
          slot.isAvailable !== false &&
          matchesDay(preferredDate, slot.dayOfWeek) &&
          (preferredDate !== getTodayDateInputValue() || timeToMinutes(slot.startTime) > currentMinutes),
      )
      .map((slot) => ({
        durationMin: slot.durationMinutes,
        label: `${formatTimeChoice(slot.startTime)} / ${Math.max(1, Math.round(slot.durationMinutes / 60))} hr`,
        startTime: slot.startTime,
      }));
  }, [availabilityQuery.data, currentMinutes, isSelectedCoachDateBooked, preferredDate]);
  const highlightedCoachDates = useMemo(
    () =>
      getUpcomingAvailableDates(
        availabilityQuery.data?.availability
          ?.filter((slot) => slot.isAvailable)
          .map((slot) => slot.dayOfWeek) ?? [],
      ),
    [availabilityQuery.data?.availability],
  );
  const selectedSlot = availableSlots.find((slot) => slot.startTime === preferredTime) ?? null;
  const selectedIntent = BOOKING_INTENT_OPTIONS.find((option) => option.value === bookingIntent) ?? BOOKING_INTENT_OPTIONS[0];
  const selectedCoachRate = Number(selectedCoach?.hourlyRate);
  const hasValidCoachRate = Number.isFinite(selectedCoachRate) && selectedCoachRate > 0;
  const appointmentTotal = selectedSlot && hasValidCoachRate
    ? Math.round(selectedCoachRate * (selectedSlot.durationMin / 60) * 100) / 100
    : 0;
  const appointmentDownpayment = Math.round(appointmentTotal * 0.3 * 100) / 100;
  const appointmentBalance = Math.max(0, Math.round((appointmentTotal - appointmentDownpayment) * 100) / 100);
  const canSubmit = Boolean(selectedCoach && preferredDate && selectedSlot && hasValidCoachRate) && !isSelectedCoachDateBooked && !isSubmitting;
  const availabilityStatus = !selectedCoach
    ? "Select a coach to load live availability."
    : availabilityQuery.isPending
      ? "Loading live availability for this coach."
      : availabilityQuery.isError
        ? availabilityQuery.error instanceof Error
          ? availabilityQuery.error.message
          : "Unable to load live availability for this coach."
        : isSelectedCoachDateBooked
          ? `${getCoachName(selectedCoach)} already has a booking on ${formatBookingDate(preferredDate)}. Pick another day.`
          : availableSlots.length === 0
            ? `No active slots are available on ${formatDateChoice(preferredDate)}.`
            : !hasValidCoachRate
              ? "This coach has no active hourly rate yet. Staff must update the coach profile before members can book."
              : `${availableSlots.length} available slot${availableSlots.length === 1 ? "" : "s"} on ${formatDateChoice(preferredDate)}.`;

  useEffect(() => {
    setRequestError("");
  }, [bookingIntent, preferredDate, preferredTime, selectedCoach?.id]);

  if (!selectedCoach) {
    return null;
  }

  const handleSubmit = async () => {
    if (!selectedSlot) {
      setRequestError("Choose a live available coach slot before booking.");
      return;
    }
    if (!hasValidCoachRate) {
      setRequestError("This coach does not have a valid session rate yet.");
      return;
    }

    try {
      setRequestError("");
      await onSubmit({
        bookingIntent,
        bookingNotes,
        preferredDate,
        selectedSlot,
      });
    } catch (error: unknown) {
      setRequestError(error instanceof Error ? error.message : "Unable to book this coach appointment.");
    }
  };

  return (
    <>
      <FitModal
        isOpen={isOpen}
        onClose={onClose}
        title="Book a Trainer"
        subtitle="Create a coach appointment request from live availability. Payment unlocks after the coach accepts."
        icon={Send}
        maxWidth={720}
        footer={
          <>
            <FitButton variant="ghost" label="Cancel" onClick={onClose} disabled={isSubmitting} style={{ flex: 1 }} />
            <FitButton
              variant="primary"
              label={isSubmitting ? "Sending..." : "Send Request"}
              onClick={() => void handleSubmit()}
              disabled={!canSubmit}
              loading={isSubmitting}
              loadingLabel="Sending..."
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
              {BOOKING_INTENT_OPTIONS.map((option) => (
                <FitButton
                  key={option.value}
                  variant="card"
                  active={bookingIntent === option.value}
                  icon={option.icon}
                  onClick={() => setBookingIntent(option.value)}
                  style={{ borderRadius: 8, minHeight: 82, padding: 10 }}
                >
                  <span style={{ display: "grid", gap: 4, minWidth: 0 }}>
                    <span style={{ fontSize: 12.5, fontWeight: 850 }}>{option.label}</span>
                    <span style={{ color: colors.textMuted, fontSize: 11.5, lineHeight: 1.35 }}>{option.description}</span>
                  </span>
                </FitButton>
              ))}
            </div>
          </ComposerSection>

          <div className="bookings-request-datetime-grid">
            <RequestFieldButton
              icon={CalendarDays}
              label="Preferred Date"
              value={formatDateChoice(preferredDate)}
              onClick={() => setDatePickerOpen(true)}
            />
            <RequestFieldButton
              icon={Clock3}
              label="Preferred Time"
              value={selectedSlot?.label ?? formatTimeChoice(preferredTime)}
              onClick={() => setTimePickerOpen(true)}
            />
          </div>

          <div
            style={{
              borderTop: `1px solid ${colors.border}`,
              paddingTop: 10,
            }}
          >
            <MemberText variant="muted">{availabilityStatus}</MemberText>
          </div>

          <div style={{ display: "grid", gap: 8, minWidth: 0 }}>
            <MemberText variant="brand">Notes</MemberText>
            <FitTextArea
              id="coach-booking-request-notes"
              name="coachBookingRequestNotes"
              aria-label="Coach booking request notes"
              value={bookingNotes}
              onChange={(event) => setBookingNotes(event.target.value)}
              placeholder="Goals, injuries, preferred cadence, or questions for this coach."
              rows={4}
              maxLength={1000}
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
            <MemberText variant="brand">Appointment Summary</MemberText>
            <MemberText variant="subtitle">
              {selectedIntent.label} with {getCoachName(selectedCoach)}
              {preferredDate ? ` on ${formatDateChoice(preferredDate)}` : ""}{selectedSlot ? ` at ${selectedSlot.label}` : ""}.
            </MemberText>
            <MemberText variant="muted">
              {!selectedSlot
                ? "Choose a live available slot before booking this trainer."
                : !hasValidCoachRate
                  ? "This coach needs a valid hourly rate before members can request the appointment."
                  : `Estimated total: ${formatMoney(appointmentTotal)}. After coach acceptance, booking details will offer PayMongo or cash payment for the ${formatMoney(appointmentDownpayment)} downpayment or full payment. Remaining balance on split payment: ${formatMoney(appointmentBalance)}.`}
            </MemberText>
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
      <CalendarModal
        highlightedDates={highlightedCoachDates}
        isOpen={datePickerOpen}
        minDate={getTodayDateInputValue()}
        selectedDate={preferredDate}
        onClose={() => setDatePickerOpen(false)}
        onSelect={(dateYmd) => {
          setPreferredDate(dateYmd);
          setPreferredTime("");
          if (dateYmd) {
            setDatePickerOpen(false);
          }
        }}
      />
      <TimePickerModal
        emptyMessage="No live coach slots are available for the selected day."
        isOpen={timePickerOpen}
        options={availableSlots.map((slot) => ({ label: slot.label, value: slot.startTime }))}
        selectedTime={preferredTime}
        subtitle="Choose one live availability slot for this coach."
        title="Coach Time"
        onClose={() => setTimePickerOpen(false)}
        onSelect={setPreferredTime}
      />
    </>
  );
}

type ReservationSubmitInput = {
  date: string;
  payload: {
    durationHours: number;
    paymentStage?: "downpayment" | "full";
    provider?: "cash" | "paymongo";
    purpose?: string;
    startTime: string;
    venueId: string | number;
  };
  userId?: string;
  venueId: string | number;
};

type ReservationSubmitResult = {
  checkout_url?: string | null;
};

function MemberReservationModal({
  existingReservations,
  isOpen,
  isSubmitting,
  onBookTrainer,
  onClose,
  onSubmit,
  userId,
  venues,
}: {
  existingReservations: MemberBookingItem[];
  isOpen: boolean;
  isSubmitting: boolean;
  onBookTrainer: () => void;
  onClose: () => void;
  onSubmit: (input: ReservationSubmitInput) => Promise<ReservationSubmitResult | void>;
  userId?: string;
  venues: VenueRecord[];
}) {
  const { colors } = useTheme();
  const canUsePaymongo = isPaymongoCheckoutEnabled();
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [errorText, setErrorText] = useState("");
  const [endTime, setEndTime] = useState("");
  const [paymentOption, setPaymentOption] = useState<ReservationPaymentOption>(
    canUsePaymongo ? "paymongo_downpayment" : "cash_downpayment",
  );
  const [paymentConfirmation, setPaymentConfirmation] = useState<PaymentConfirmationState | null>(null);
  const [reservationDate, setReservationDate] = useState(getTodayDateInputValue());
  const [reservationNotes, setReservationNotes] = useState("");
  const [selectedVenueId, setSelectedVenueId] = useState("");
  const [startTime, setStartTime] = useState("");
  const [successText, setSuccessText] = useState("");
  const [timePickerOpen, setTimePickerOpen] = useState(false);
  const [timeTarget, setTimeTarget] = useState<"start" | "end">("start");
  const reservableVenues = useMemo(
    () => venues.filter((venue) => venue.isReservable !== false),
    [venues],
  );
  const selectedVenue =
    reservableVenues.find((venue) => String(venue.id) === selectedVenueId) ?? reservableVenues[0] ?? null;
  const durationHours = getReservationDurationHours(startTime, endTime);
  const minimumHours = selectedVenue?.minimumHours ?? 1;
  const venueRate = Number(selectedVenue?.hourlyRate ?? 0);
  const totalAmount = Math.round(venueRate * durationHours * 100) / 100;
  const downpaymentAmount = Math.round(totalAmount * 0.3 * 100) / 100;
  const remainingBalance = Math.max(0, Math.round((totalAmount - downpaymentAmount) * 100) / 100);
  const hasPricedDuration = durationHours > 0;
  const isFreeReservation = hasPricedDuration && totalAmount <= 0;
  const paymentProvider = paymentOption === "paymongo_downpayment" ? "paymongo" : "cash";
  const paymentStage = paymentOption === "cash_full" ? "full" : "downpayment";
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
  const overlapErrorText = hasActiveOverlap ? "You already have a booking in this time window." : "";
  const canSubmit =
    Boolean(selectedVenue && reservationDate && startTime && endTime) &&
    durationHours >= minimumHours &&
    isFutureLocalStart(reservationDate, startTime) &&
    !hasActiveOverlap &&
    !isSubmitting;

  useEffect(() => {
    if (!isOpen) return;
    setErrorText("");
    setSuccessText("");
    setPaymentConfirmation(null);
    if (!selectedVenueId && reservableVenues[0]) {
      setSelectedVenueId(String(reservableVenues[0].id));
    }
  }, [isOpen, reservableVenues, selectedVenueId]);

  const submitReservation = async () => {
    if (!selectedVenue) {
      setErrorText("Choose a reservable venue first.");
      return;
    }
    if (!reservationDate || !startTime || !endTime) {
      setErrorText("Choose a date, start time, and end time.");
      return;
    }
    if (!isFutureLocalStart(reservationDate, startTime)) {
      setErrorText("Same-day reservations must use a future start time.");
      return;
    }
    if (durationHours < minimumHours) {
      setErrorText(`This venue requires at least ${minimumHours} hour${minimumHours === 1 ? "" : "s"}.`);
      return;
    }

    setErrorText("");
    setSuccessText("");

    try {
      const result = await onSubmit({
        date: reservationDate,
        payload: {
          durationHours,
          paymentStage: isFreeReservation ? undefined : paymentStage,
          provider: isFreeReservation ? undefined : paymentProvider,
          purpose: reservationNotes.trim() || undefined,
          startTime: toGymWallClockIso(reservationDate, timeToMinutes(startTime)),
          venueId: selectedVenue.id,
        },
        userId,
        venueId: selectedVenue.id,
      });

      if (result?.checkout_url) {
        setPaymentConfirmation({
          title: "Payment confirmed",
          message: `Testing PayMongo downpayment of ${formatMoney(downpaymentAmount)} was confirmed for ${selectedVenue.name} on ${formatBookingDate(reservationDate)} at ${formatTimeChoice(startTime)}. You remain in Bookings while front desk verification updates the reservation status. Remaining balance: ${formatMoney(remainingBalance)}.`,
        });
        setStartTime("");
        setEndTime("");
        setReservationNotes("");
        return;
      }

      setSuccessText(
        isFreeReservation
          ? `${selectedVenue.name} is now reserved for ${formatBookingDate(reservationDate)}.`
          : paymentOption === "cash_full"
            ? `Cash payment submitted for ${formatMoney(totalAmount)}. Staff will verify it before the reservation is treated as fully paid.`
            : `Downpayment submitted for ${formatMoney(downpaymentAmount)}. The remaining ${formatMoney(remainingBalance)} stays due on or after the booking date.`,
      );
      setStartTime("");
      setEndTime("");
      setReservationNotes("");
    } catch (error: unknown) {
      setErrorText(error instanceof Error ? error.message : "Reservation failed. Please try again.");
    }
  };

  const closePaymentConfirmation = () => {
    setPaymentConfirmation(null);
    onClose();
  };

  return (
    <>
      <FitModal
        isOpen={isOpen}
        onClose={paymentConfirmation ? closePaymentConfirmation : onClose}
        title={paymentConfirmation?.title ?? "Make a Reservation"}
        subtitle={
          paymentConfirmation
            ? "Frontend testing payment recorded without leaving the member booking flow."
            : "Create a venue reservation from the same backend-backed booking flow used by the mobile app."
        }
        icon={CalendarCheck}
        maxWidth={760}
        footer={
          paymentConfirmation ? (
            <FitButton
              variant="primary"
              label="Stay in Bookings"
              onClick={closePaymentConfirmation}
              style={{ flex: 1 }}
            />
          ) : (
            <>
              <FitButton variant="ghost" label="Cancel" onClick={onClose} disabled={isSubmitting} style={{ flex: 1 }} />
              <FitButton
                variant="primary"
                label={
                  isSubmitting
                    ? "Submitting..."
                    : isFreeReservation
                      ? "Confirm Reservation"
                      : paymentOption === "paymongo_downpayment"
                        ? "Confirm Payment"
                        : paymentOption === "cash_full"
                          ? "Submit Full Payment"
                          : "Submit Downpayment"
                }
                onClick={() => void submitReservation()}
                disabled={!canSubmit}
                style={{ flex: 1 }}
              />
            </>
          )
        }
      >
        {paymentConfirmation ? (
          <div style={{ display: "grid", gap: 12 }}>
            <MemberText variant="subtitle">{paymentConfirmation.message}</MemberText>
            <MemberText variant="muted">
              The booking record remains database-backed; refresh or reopen Bookings if staff verification changes the status.
            </MemberText>
          </div>
        ) : (
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

            {reservableVenues.length === 0 ? (
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
              </div>
            ) : (
              <>
                <div style={{ display: "grid", gap: 8 }}>
                  <MemberText variant="brand">Venue</MemberText>
                  <FitSelect
                    aria-label={`Reservation venue: ${selectedVenue?.name ?? "Select venue"}`}
                    fullWidth
                    value={selectedVenue ? String(selectedVenue.id) : selectedVenueId}
                    onChange={(event) => setSelectedVenueId(event.currentTarget.value)}
                    options={reservableVenues.map((venue) => ({
                      label: `${venue.name} / ${venue.hourlyRate ? `${formatMoney(venue.hourlyRate)}/hr` : "No hourly rate"}`,
                      value: String(venue.id),
                    }))}
                  />
                </div>

                <div className="bookings-request-datetime-grid">
                  <RequestFieldButton
                    icon={CalendarDays}
                    label="Date"
                    value={formatDateChoice(reservationDate)}
                    onClick={() => setDatePickerOpen(true)}
                  />
                  <RequestFieldButton
                    icon={Clock3}
                    label="Start Time"
                    value={formatTimeChoice(startTime)}
                    onClick={() => {
                      setTimeTarget("start");
                      setTimePickerOpen(true);
                    }}
                  />
                  <RequestFieldButton
                    icon={Clock3}
                    label="End Time"
                    value={formatTimeChoice(endTime)}
                    onClick={() => {
                      setTimeTarget("end");
                      setTimePickerOpen(true);
                    }}
                  />
                </div>

                <div style={{ display: "grid", gap: 8 }}>
                  <MemberText variant="brand">Payment Option</MemberText>
                  <div className="bookings-request-intent-grid">
                    {[
                      {
                        body: canUsePaymongo ? "Confirm a testing downpayment in-app." : "PayMongo is currently disabled.",
                        disabled: !canUsePaymongo || isFreeReservation,
                        label: "PayMongo Downpayment",
                        value: "paymongo_downpayment" as const,
                      },
                      {
                        body: "Submit a cash downpayment for staff verification.",
                        disabled: isFreeReservation,
                        label: "Cash Downpayment",
                        value: "cash_downpayment" as const,
                      },
                      {
                        body: "Submit full cash payment for staff verification.",
                        disabled: isFreeReservation,
                        label: "Cash Full Payment",
                        value: "cash_full" as const,
                      },
                    ].map((option) => (
                      <FitButton
                        key={option.value}
                        variant="card"
                        active={paymentOption === option.value}
                        disabled={option.disabled}
                        onClick={() => setPaymentOption(option.value)}
                        style={{ borderRadius: 8, minHeight: 78, padding: 10 }}
                      >
                        <span style={{ display: "grid", gap: 4, minWidth: 0 }}>
                          <span style={{ fontSize: 12.5, fontWeight: 850 }}>{option.label}</span>
                          <span style={{ color: colors.textMuted, fontSize: 11.5, lineHeight: 1.35 }}>{option.body}</span>
                        </span>
                      </FitButton>
                    ))}
                  </div>
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
                    {!hasPricedDuration
                      ? "Choose a time range to calculate the reservation price and payment split."
                      : isFreeReservation
                        ? "No checkout is required for this reservation."
                        : paymentOption === "cash_full"
                          ? "Staff verification is required before full cash payment is treated as paid."
                          : `Confirm now ${formatMoney(downpaymentAmount)}. Remaining balance: ${formatMoney(remainingBalance)}.`}
                  </MemberText>
                </div>
              </>
            )}

            {errorText ? <FitText style={{ color: colors.danger, fontSize: 12.5, fontWeight: 750 }}>{errorText}</FitText> : null}
            {overlapErrorText ? <FitText style={{ color: colors.danger, fontSize: 12.5, fontWeight: 750 }}>{overlapErrorText}</FitText> : null}
            {successText ? <FitText style={{ color: colors.success, fontSize: 12.5, fontWeight: 750 }}>{successText}</FitText> : null}
          </div>
        )}
      </FitModal>
      <CalendarModal
        highlightedDates={[]}
        isOpen={datePickerOpen}
        minDate={getTodayDateInputValue()}
        selectedDate={reservationDate}
        onClose={() => setDatePickerOpen(false)}
        onSelect={(dateYmd) => {
          setReservationDate(dateYmd);
          if (dateYmd) setDatePickerOpen(false);
        }}
      />
      <TimePickerModal
        isOpen={timePickerOpen}
        selectedTime={timeTarget === "start" ? startTime : endTime}
        subtitle={
          timeTarget === "start"
            ? "Choose when this venue reservation should begin."
            : "Choose when this venue reservation should end."
        }
        title={timeTarget === "start" ? "Start Time" : "End Time"}
        onClose={() => setTimePickerOpen(false)}
        onSelect={(value) => {
          if (timeTarget === "start") {
            setStartTime(value);
            setEndTime("");
            return;
          }
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
        grid-template-columns: repeat(3, minmax(0, 1fr));
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

export default function BookingsPage() {
  const { colors } = useTheme();
  const { user } = useMemberOnlyAccess("Bookings");
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
  const [isCompactBookingLayout, setIsCompactBookingLayout] = useState(false);
  const [mobileComposerOpen, setMobileComposerOpen] = useState(false);
  const [mobileBookingDetailsOpen, setMobileBookingDetailsOpen] = useState(false);
  const [reservationModalOpen, setReservationModalOpen] = useState(false);
  const [bookingPage, setBookingPage] = useState(1);
  const [pendingAppointmentPayment, setPendingAppointmentPayment] = useState<PendingAppointmentPayment | null>(null);
  const [paymentConfirmation, setPaymentConfirmation] = useState<PaymentConfirmationState | null>(null);
  const [reviewComment, setReviewComment] = useState("");
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewState, setReviewState] = useState<{
    text: string;
    tone: "danger" | "success";
  } | null>(null);
  const data = useMemberOnlyBookingsData(user?.id);
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
  const reservations = useMemo(() => toMemberBookings(data.bookingsQuery.data ?? [], data.venuesQuery.data ?? []), [data.bookingsQuery.data, data.venuesQuery.data]);
  const appointments = useMemo(() => (data.appointmentsQuery.data ?? []).map(toMemberAppointment), [data.appointmentsQuery.data]);
  const activeItems = activeSection === "bookings" ? reservations : appointments;
  const filtered = activeItems.filter((booking) => {
    const matchesStatus =
      statusFilter === "all" ||
      (statusFilter === "pending"
        ? booking.status.includes("pending")
        : booking.status === statusFilter);
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
  const isLoading = data.bookingsQuery.isPending || data.appointmentsQuery.isPending;
  const canReviewCoach =
    activeSection === "appointments" &&
    selected?.status === "completed" &&
    typeof selected.coachId === "string" &&
    selected.coachId.length > 0;
  const canPaySelectedAppointment = isAppointmentPaymentActionable(activeSection, selected);
  const canPaySelectedAppointmentInFull = canStartFullAppointmentPayment(activeSection, selected);
  const selectedAppointmentPaymentStage = getAppointmentPaymentStage(selected);

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

    const selectedIntentOption =
      BOOKING_INTENT_OPTIONS.find((option) => option.value === input.bookingIntent) ?? BOOKING_INTENT_OPTIONS[0];
    const hourlyRate = Number(selectedCoach.hourlyRate ?? 0);
    const hasValidCoachRate = Number.isFinite(hourlyRate) && hourlyRate > 0;
    if (!hasValidCoachRate) {
      throw new Error("This coach does not have a valid session rate yet.");
    }

    const totalAmount = Number.isFinite(hourlyRate)
      ? Math.round(hourlyRate * (input.selectedSlot.durationMin / 60) * 100) / 100
      : 0;
    const downpaymentAmount = Math.round(totalAmount * 0.3 * 100) / 100;

    await data.createAppointmentMutation.mutateAsync({
      payload: {
        bookingMode: input.bookingIntent,
        coachId: String(selectedCoach.id),
        duration: input.selectedSlot.durationMin,
        notes: input.bookingNotes.trim() || undefined,
        scheduledAt: toGymWallClockIso(input.preferredDate, timeToMinutes(input.selectedSlot.startTime)),
        sessionCount: selectedIntentOption.sessionCount,
      },
      userId: user?.id,
    });

    const scheduleLabel = `${formatDateChoice(input.preferredDate)} at ${input.selectedSlot.label}`;
    setBookingDraftState(
      `${selectedIntentOption.label} request sent to ${getCoachName(selectedCoach)} for ${scheduleLabel}. Estimated total: ${formatMoney(totalAmount)}. Payment options unlock after coach acceptance; downpayment estimate: ${formatMoney(downpaymentAmount)}.`,
    );
    setBookingMode("bookings");
    setActiveSection("appointments");
    setSelectedBooking(null);
    setComposerActionsOpen(false);
    setRequestModalOpen(false);
    setPreferredTime("");
    setBookingNotes("");
  };

  const handleCancelSelectedBooking = () => {
    if (!selected) return;

    if (activeSection === "bookings") {
      void data.cancelBookingMutation.mutateAsync({
        bookingId: selected.id,
        cancelReason: "Cancelled from the member web portal.",
        userId: user?.id,
      });
      return;
    }

    void data.cancelAppointmentMutation.mutateAsync({
      appointmentId: selected.id,
      cancelReason: "Cancelled from the member web portal.",
      userId: user?.id,
    });
  };

  const handleConfirmAppointmentPayment = async () => {
    if (!pendingAppointmentPayment) return;

    const payment = pendingAppointmentPayment;

    await data.payAppointmentMutation.mutateAsync({
      appointmentId: pendingAppointmentPayment.booking.id,
      paymentStage: pendingAppointmentPayment.stage,
      provider: pendingAppointmentPayment.provider,
      userId: user?.id,
    });

    setPendingAppointmentPayment(null);
    setPaymentConfirmation({
      title: payment.provider === "paymongo" ? "Payment confirmed" : "Cash payment submitted",
      message:
        payment.provider === "paymongo"
          ? `Testing ${payment.stage === "full" ? "full payment" : "downpayment"} of ${formatMoney(getAppointmentPaymentAmount(payment.booking, payment.stage))} was confirmed for ${payment.booking.resourceName}. You remain in Bookings while front desk verification updates the appointment status.`
          : `Cash ${payment.stage === "full" ? "full payment" : "downpayment"} of ${formatMoney(getAppointmentPaymentAmount(payment.booking, payment.stage))} was submitted for ${payment.booking.resourceName}. Staff will verify it before the appointment status changes.`,
    });
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

          <div className="bookings-composer-rail" style={{ alignSelf: "stretch", display: "grid", height: "100%", minHeight: 0 }}>
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
              isSubmitting={data.createAppointmentMutation.isPending}
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

          <div className="bookings-composer-rail" style={{ alignSelf: "stretch", display: "grid", height: "100%", minHeight: 0 }}>
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
                    canPayAppointment={canPaySelectedAppointment}
                    canPayAppointmentInFull={canPaySelectedAppointmentInFull}
                    mode={bookingPanelMode}
                    onCancel={handleCancelSelectedBooking}
                    onPayAppointment={(provider, stage) => {
                      setPendingAppointmentPayment({ booking: selected, provider, stage });
                    }}
                    onSetActionsOpen={setBookingActionsOpen}
                    onSetMode={setBookingPanelMode}
                    paymentLoading={data.payAppointmentMutation.isPending}
                    paymentStage={selectedAppointmentPaymentStage}
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
              canPayAppointment={canPaySelectedAppointment}
              canPayAppointmentInFull={canPaySelectedAppointmentInFull}
              mode={bookingPanelMode}
              onCancel={handleCancelSelectedBooking}
              onPayAppointment={(provider, stage) => {
                setPendingAppointmentPayment({ booking: selected, provider, stage });
              }}
              onSetActionsOpen={setBookingActionsOpen}
              onSetMode={setBookingPanelMode}
              paymentLoading={data.payAppointmentMutation.isPending}
              paymentStage={selectedAppointmentPaymentStage}
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
        />
      </FitModal>
      <FitModal
        isOpen={pendingAppointmentPayment != null}
        onClose={() => {
          if (!data.payAppointmentMutation.isPending) {
            setPendingAppointmentPayment(null);
          }
        }}
        title={pendingAppointmentPayment?.provider === "paymongo" ? "Confirm PayMongo payment?" : "Submit cash payment?"}
        subtitle="Coach appointment payment"
        icon={CalendarCheck}
        maxWidth={460}
        footer={
          <>
            <FitButton
              variant="ghost"
              label="Cancel"
              disabled={data.payAppointmentMutation.isPending}
              onClick={() => setPendingAppointmentPayment(null)}
              style={{ flex: 1 }}
            />
            <FitButton
              variant="primary"
              label={pendingAppointmentPayment?.provider === "paymongo" ? "Confirm Payment" : "Submit"}
              loading={data.payAppointmentMutation.isPending}
              loadingLabel={pendingAppointmentPayment?.provider === "paymongo" ? "Confirming..." : "Submitting..."}
              onClick={() => void handleConfirmAppointmentPayment()}
              style={{ flex: 1 }}
            />
          </>
        }
      >
        {pendingAppointmentPayment ? (
          <div style={{ display: "grid", gap: 10 }}>
            <MemberText variant="subtitle">
              {pendingAppointmentPayment.provider === "paymongo" ? "Confirm the testing PayMongo payment" : "Submit a cash payment request"} for the{" "}
              {pendingAppointmentPayment.stage === "full" ? "full payment" : "downpayment"} on{" "}
              {pendingAppointmentPayment.booking.resourceName}.
            </MemberText>
            <MemberText variant="brand">
              Amount: {formatMoney(getAppointmentPaymentAmount(pendingAppointmentPayment.booking, pendingAppointmentPayment.stage))}
            </MemberText>
            <MemberText variant="muted">
              {pendingAppointmentPayment.stage === "full"
                ? "No remaining balance should be due after the full payment is confirmed."
                : "The remaining balance stays due after this payment is verified."}
            </MemberText>
          </div>
        ) : null}
      </FitModal>
      <FitModal
        isOpen={paymentConfirmation != null}
        onClose={() => setPaymentConfirmation(null)}
        title={paymentConfirmation?.title ?? "Payment updated"}
        subtitle="Member booking payment"
        icon={CalendarCheck}
        maxWidth={460}
        footer={
          <FitButton
            variant="primary"
            label="Stay in Bookings"
            onClick={() => setPaymentConfirmation(null)}
            style={{ flex: 1 }}
          />
        }
      >
        {paymentConfirmation ? (
          <div style={{ display: "grid", gap: 10 }}>
            <MemberText variant="subtitle">{paymentConfirmation.message}</MemberText>
            <MemberText variant="muted">
              The booking record remains database-backed; refresh or reopen Bookings if staff verification changes the status.
            </MemberText>
          </div>
        ) : null}
      </FitModal>
      <MemberReservationModal
        existingReservations={reservations}
        isOpen={reservationModalOpen}
        isSubmitting={data.createBookingMutation.isPending}
        onBookTrainer={handleBookTrainer}
        onClose={() => setReservationModalOpen(false)}
        onSubmit={(input) => data.createBookingMutation.mutateAsync(input)}
        userId={user?.id}
        venues={data.venuesQuery.data ?? []}
      />
      <BookingsPageStyles colors={colors} />
    </MemberOnlyScreen>
  );
}
