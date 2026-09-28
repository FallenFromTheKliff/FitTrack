"use client";

import { useEffect, useMemo, useState, type RefObject } from "react";
import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { Search, UsersRound } from "lucide-react";
import type { StaffAppointmentRecord } from "@fittrack/api-client";
import type { ThemeColors } from "@fittrack/types";

import { FitButton, FitPagination, FitPill, FitSelect, FitText } from "@/components/fit";
import type { Booking, Resource } from "@/data/schedule-constants";
import type { VenueBookingRecord } from "@/contexts/ScheduleContext";
import { useTheme } from "@/contexts/ThemeContext";

import {
  formatAppointmentWindow,
  getAppointmentActionLabel,
  getAppointmentStatusColor,
  getCoachAppointmentPaymentStatus,
  getCoachDisplayName,
  getDisplayInitials,
  getPersonDisplayName,
  getReadableStatus,
  getVenueBookingActionLabel,
  getVenueBookingPaymentStatus,
  getVenueBookingStatusColor,
} from "./operationsUtils";

type CoachAppointmentsTableProps = {
  appointments: StaffAppointmentRecord[];
  colors: ThemeColors;
  onOpenReview: (appointment: StaffAppointmentRecord) => void;
  resetKey?: string;
};

type CoachDirectoryResource = Resource & {
  availabilityCount: number;
  email: string;
  hourlyRate: number | null;
  isActive: boolean;
};

type CoachDirectoryProps = {
  coaches: CoachDirectoryResource[];
  colors: ThemeColors;
  onSelect: (coachId: string) => void;
  onVisibilityChange: (scope: "all" | "visible" | "hidden") => void;
  selectedCoachId: string | null;
  visibilityOptions: Array<{ label: string; value: string }>;
  visibilityScope: "all" | "visible" | "hidden";
};

type VenueBookingsTableProps = {
  bookings: VenueBookingRecord[];
  colors: ThemeColors;
  emptyMessage?: string;
  onOpenReview: (booking: VenueBookingRecord) => void;
  venueStatusById: ReadonlyMap<string, string | null>;
};

type CoachIconRailProps = {
  bookings: Booking[];
  colors: ThemeColors;
  filteredStaff: Resource[];
  draggable?: boolean;
  maxHeight: number | null;
  onStaffPreview?: (staffId: string) => void;
  onStaffClick: (staffId: string) => void;
  orientation?: "column" | "row";
  railRef: RefObject<HTMLElement | null>;
  requireSecondClickToOpen?: boolean;
  selectedStaffId?: string | null;
};

const COACH_APPOINTMENT_GRID =
  "minmax(220px, 1.25fr) minmax(170px, 0.9fr) minmax(210px, 1fr) minmax(100px, 0.42fr)";
const COACH_APPOINTMENT_MIN_WIDTH = 720;
const COACH_APPOINTMENTS_PAGE_SIZE = 5;

export function CoachDirectory({
  coaches,
  colors,
  onSelect,
  onVisibilityChange,
  selectedCoachId,
  visibilityOptions,
  visibilityScope,
}: CoachDirectoryProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const normalizedQuery = searchQuery.trim().toLowerCase();
  const visibleCoaches = useMemo(
    () =>
      coaches.filter((coach) => {
        const matchesVisibility =
          visibilityScope === "all" ||
          (visibilityScope === "visible" && coach.isActive) ||
          (visibilityScope === "hidden" && !coach.isActive);
        const matchesQuery =
          normalizedQuery.length === 0 ||
          `${coach.name} ${coach.email}`.toLowerCase().includes(normalizedQuery);
        return matchesVisibility && matchesQuery;
      }),
    [coaches, normalizedQuery, visibilityScope],
  );

  return (
    <aside
      aria-label="Coach directory"
      data-option-count={coaches.length}
      data-ui="gym-operations-coach-directory"
      style={{
        alignSelf: "start",
        backgroundColor: colors.surface,
        border: `1px solid ${colors.border}`,
        borderRadius: 8,
        display: "grid",
        gap: 12,
        minHeight: 0,
        padding: 12,
      }}
    >
      <div
        style={{
          alignItems: "center",
          display: "flex",
          gap: 10,
          justifyContent: "space-between",
        }}
      >
        <div style={{ display: "grid", gap: 2 }}>
          <FitText
            excludeGlobalScale
            style={{ color: colors.textPrimary, fontSize: 14, fontWeight: 800 }}
          >
            Coach directory
          </FitText>
          <FitText
            data-ui="gym-operations-coach-count"
            excludeGlobalScale
            style={{ color: colors.textMuted, fontSize: 11 }}
          >
            {coaches.length} total · {visibleCoaches.length} shown
          </FitText>
        </div>
        <FitPill
          bgOpacity="12"
          borderOpacity="28"
          color={colors.brand}
          fontSize={9}
          fontWeight={800}
          label={`${coaches.filter((coach) => coach.isActive).length} VISIBLE`}
          mode="status"
          style={{ borderRadius: 6 }}
        />
      </div>

      <label
        style={{
          alignItems: "center",
          backgroundColor: colors.surfaceRaised,
          border: `1px solid ${colors.border}`,
          borderRadius: 7,
          display: "flex",
          gap: 8,
          minHeight: 38,
          padding: "0 10px",
        }}
      >
        <Search aria-hidden size={14} color={colors.textMuted} />
        <input
          aria-label="Search coaches"
          data-search
          onChange={(event) => setSearchQuery(event.target.value)}
          placeholder="Search name or email"
          type="search"
          value={searchQuery}
          style={{
            background: "transparent",
            border: 0,
            color: colors.textPrimary,
            font: "inherit",
            fontSize: 12,
            minWidth: 0,
            outline: "none",
            width: "100%",
          }}
        />
      </label>

      <FitSelect
        aria-label="Coach visibility filter"
        compact
        fullWidth
        onChange={(event) =>
          onVisibilityChange(
            event.target.value as "all" | "visible" | "hidden",
          )
        }
        options={visibilityOptions}
        style={{ borderRadius: 7, minHeight: 38 }}
        value={visibilityScope}
      />

      <div
        aria-label="Available coaches"
        data-ui="gym-operations-coach-directory-list"
        role="listbox"
        style={{
          display: "grid",
          gap: 6,
          maxHeight: "min(58vh, 620px)",
          minHeight: 0,
          overflowY: "auto",
          paddingRight: 3,
          scrollbarGutter: "stable",
        }}
      >
        {visibleCoaches.length > 0 ? (
          visibleCoaches.map((coach) => {
            const isSelected = coach.id === selectedCoachId;
            return (
              <button
                aria-selected={isSelected}
                data-component-option
                key={coach.id}
                onClick={() => onSelect(coach.id)}
                role="option"
                type="button"
                style={{
                  alignItems: "center",
                  backgroundColor: isSelected
                    ? `${colors.brand}16`
                    : colors.surfaceRaised,
                  border: `1px solid ${
                    isSelected ? `${colors.brand}55` : colors.border
                  }`,
                  borderRadius: 7,
                  color: colors.textPrimary,
                  cursor: "pointer",
                  display: "grid",
                  font: "inherit",
                  gap: 9,
                  gridTemplateColumns: "34px minmax(0, 1fr) auto",
                  minHeight: 58,
                  padding: "8px 9px",
                  textAlign: "left",
                  width: "100%",
                }}
              >
                <span
                  aria-hidden
                  style={{
                    alignItems: "center",
                    backgroundColor: isSelected
                      ? colors.brand
                      : `${colors.brand}18`,
                    borderRadius: 7,
                    color: isSelected ? colors.onBrand : colors.brand,
                    display: "flex",
                    fontSize: 10,
                    fontWeight: 800,
                    height: 34,
                    justifyContent: "center",
                    width: 34,
                  }}
                >
                  {coach.initials || getDisplayInitials(coach.name)}
                </span>
                <span style={{ display: "grid", gap: 3, minWidth: 0 }}>
                  <span
                    style={{
                      fontSize: 12,
                      fontWeight: 750,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {coach.name}
                  </span>
                  <span
                    style={{
                      color: colors.textMuted,
                      fontSize: 10.5,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {coach.availabilityCount} weekly slots
                    {coach.hourlyRate != null
                      ? ` · PHP ${coach.hourlyRate.toLocaleString("en-PH")}/hr`
                      : ""}
                  </span>
                </span>
                <span
                  style={{
                    color: coach.isActive ? colors.success : colors.textMuted,
                    fontSize: 9,
                    fontWeight: 800,
                    letterSpacing: "0.04em",
                  }}
                >
                  {coach.isActive ? "VISIBLE" : "HIDDEN"}
                </span>
              </button>
            );
          })
        ) : (
          <div
            style={{
              border: `1px dashed ${colors.border}`,
              borderRadius: 7,
              color: colors.textMuted,
              fontSize: 12,
              padding: "18px 12px",
              textAlign: "center",
            }}
          >
            No coaches match this search.
          </div>
        )}
      </div>
    </aside>
  );
}
const VENUE_BOOKING_GRID =
  "minmax(220px, 1.2fr) minmax(180px, 0.95fr) minmax(210px, 1fr) minmax(100px, 0.42fr)";
const VENUE_BOOKING_MIN_WIDTH = 740;
const COACH_VENUE_WORK_GRID =
  "minmax(190px, 1fr) minmax(180px, 0.9fr) minmax(210px, 1fr) minmax(170px, 0.75fr) minmax(110px, 0.5fr)";
const COACH_VENUE_WORK_MIN_WIDTH = 900;

export function CoachAppointmentsTable({
  appointments,
  colors,
  onOpenReview,
  resetKey,
}: CoachAppointmentsTableProps) {
  const { settings } = useTheme();
  const canAnimate = settings.animationLevel !== "none";
  const rowMinHeight = 76;
  const [currentPage, setCurrentPage] = useState(1);
  const totalPages = Math.max(
    1,
    Math.ceil(appointments.length / COACH_APPOINTMENTS_PAGE_SIZE),
  );
  const pageStart = (currentPage - 1) * COACH_APPOINTMENTS_PAGE_SIZE;
  const visibleAppointments = appointments.slice(
    pageStart,
    pageStart + COACH_APPOINTMENTS_PAGE_SIZE,
  );

  useEffect(() => {
    setCurrentPage(1);
  }, [resetKey]);

  useEffect(() => {
    setCurrentPage((page) => Math.min(page, totalPages));
  }, [totalPages]);

  if (appointments.length === 0) {
    return (
      <div
        style={{
          minHeight: 170,
          width: "100%",
          borderRadius: 8,
          border: `1px dashed ${colors.border}`,
          backgroundColor: colors.surfaceRaised,
          padding: "18px 20px",
          display: "flex",
          alignItems: "center",
        }}
      >
        <FitText excludeGlobalScale style={{ fontSize: 14, color: colors.textMuted }}>
          No coach appointments match the current filters.
        </FitText>
      </div>
    );
  }

  return (
    <div
      data-ui="gym-operations-appointments-collection"
      style={{ display: "grid", gap: 12, minWidth: 0 }}
    >
      <div
        data-ui="gym-operations-appointments-table-viewport"
        style={{
          width: "100%",
          maxWidth: "100%",
          maxHeight: "clamp(300px, calc(100dvh - 460px), 430px)",
          minHeight: 0,
          display: "grid",
          gridTemplateRows: `34px repeat(${visibleAppointments.length}, minmax(${rowMinHeight}px, 1fr))`,
          borderTop: `1px solid ${colors.border}`,
          borderBottom: `1px solid ${colors.border}`,
          overflowX: "auto",
          overflowY: "auto",
          scrollbarGutter: "stable",
          WebkitOverflowScrolling: "touch",
        }}
      >
        <div
          style={{
            backgroundColor: colors.surface,
            position: "sticky",
            top: 0,
            zIndex: 2,
            display: "grid",
            gridTemplateColumns: COACH_APPOINTMENT_GRID,
            gap: 10,
            alignItems: "center",
            borderBottom: `1px solid ${colors.border}`,
            minWidth: COACH_APPOINTMENT_MIN_WIDTH,
            padding: "0 2px",
          }}
        >
          {["MEMBER", "COACH", "SCHEDULE", "ACTION"].map((label) => (
            <FitText
              excludeGlobalScale
              key={label}
              style={{
                fontSize: 10,
                fontWeight: 700,
                color: colors.textMuted,
                letterSpacing: "0.08em",
              }}
            >
              {label}
            </FitText>
          ))}
        </div>
        {visibleAppointments.map((appointment, index) => {
        const memberName = getPersonDisplayName(
          appointment.user?.profile,
          appointment.user?.email,
          "Member",
        );
        const coachName = getCoachDisplayName(appointment.coach, "Coach");
        const { dateLabel, timeLabel } = formatAppointmentWindow(appointment);
        const appointmentActionLabel = getAppointmentActionLabel(
          getCoachAppointmentPaymentStatus(appointment),
        );

        return (
          <div
            key={appointment.id}
            style={{
              display: "grid",
              gridTemplateColumns: COACH_APPOINTMENT_GRID,
              gap: 10,
              alignItems: "center",
              minHeight: rowMinHeight,
              minWidth: COACH_APPOINTMENT_MIN_WIDTH,
              borderBottom:
                index === visibleAppointments.length - 1
                  ? "none"
                  : `1px solid ${colors.border}80`,
              padding: "10px 2px",
              transition: canAnimate
                ? "background-color 160ms ease"
                : "background-color 160ms ease",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                minWidth: 0,
              }}
            >
              <div
                style={{
                  width: 24,
                  height: 24,
                  borderRadius: 999,
                  backgroundColor: `${colors.brand}18`,
                  border: `1px solid ${colors.brand}24`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                <FitText excludeGlobalScale style={{ fontSize: 10, fontWeight: 700, color: colors.brand }}>
                  {getDisplayInitials(memberName)}
                </FitText>
              </div>
              <div style={{ minWidth: 0, display: "grid", gap: 2 }}>
                <FitText
                  excludeGlobalScale
                  style={{
                    fontSize: 12,
                    fontWeight: 700,
                    color: colors.textPrimary,
                    display: "block",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {memberName}
                </FitText>
                <FitText
                  excludeGlobalScale
                  style={{
                    fontSize: 10.5,
                    color: appointment.recurringPlanId ? colors.brand : colors.textMuted,
                    display: "block",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {appointment.recurringPlanId ? "Recurring coaching plan" : (appointment.user?.email ?? "No email recorded")}
                </FitText>
              </div>
            </div>

            <div style={{ minWidth: 0, display: "grid", gap: 2 }}>
              <FitText
                excludeGlobalScale
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  color: colors.textPrimary,
                  display: "block",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {coachName}
              </FitText>
              <FitText excludeGlobalScale style={{ fontSize: 10.5, color: colors.textMuted }}>
                {appointment.coach?.hourlyRate != null
                  ? `PHP ${appointment.coach.hourlyRate.toLocaleString("en-PH")}/hr`
                  : "Rate not set"}
              </FitText>
            </div>

            <div style={{ minWidth: 0, display: "grid", gap: 5 }}>
              <FitText
                excludeGlobalScale
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  color: colors.textPrimary,
                }}
              >
                {dateLabel}
              </FitText>
              <FitText excludeGlobalScale style={{ fontSize: 10.5, color: colors.textMuted, display: "block" }}>
                {timeLabel} - {appointment.duration} mins
              </FitText>
              <FitPill
                mode="status"
                label={getReadableStatus(getCoachAppointmentPaymentStatus(appointment)).toUpperCase()}
                color={getAppointmentStatusColor(getCoachAppointmentPaymentStatus(appointment), colors)}
                fontSize={9}
                fontWeight={700}
                borderOpacity="35"
                bgOpacity="14"
                style={{ borderRadius: 6 }}
              />
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              {appointment.status === "cancelled" || appointment.status === "no_show" ? (
                <FitButton
                  variant="ghost"
                  data-ui="gym-operations-review-appointment"
                  label="CLOSED"
                  aria-label={`Open closed appointment for ${memberName} with ${coachName} on ${dateLabel} at ${timeLabel}`}
                  onClick={() => onOpenReview(appointment)}
                  style={{
                    minHeight: 30,
                    padding: "6px 14px",
                    borderRadius: 8,
                  }}
                  textStyle={{ fontSize: 11, fontWeight: 700 }}
                />
              ) : (
                <FitButton
                  variant="ghost"
                  data-ui="gym-operations-review-appointment"
                  label={appointmentActionLabel.toUpperCase()}
                  aria-label={`${appointmentActionLabel} appointment for ${memberName} with ${coachName} on ${dateLabel} at ${timeLabel}`}
                  onClick={() => onOpenReview(appointment)}
                  style={{
                    minHeight: 30,
                    padding: "6px 14px",
                    borderRadius: 8,
                  }}
                  textStyle={{ fontSize: 11, fontWeight: 700 }}
                />
              )}
            </div>
          </div>
        );
        })}
      </div>
      <div
        style={{
          alignItems: "center",
          display: "flex",
          flexWrap: "wrap",
          gap: 12,
          justifyContent: "space-between",
        }}
      >
        <FitText
          data-ui="gym-operations-appointments-page-location"
          excludeGlobalScale
          style={{ color: colors.textMuted, fontSize: 11.5 }}
        >
          {pageStart + 1}–
          {Math.min(
            pageStart + COACH_APPOINTMENTS_PAGE_SIZE,
            appointments.length,
          )}{" "}
          of {appointments.length} appointments
        </FitText>
        <div data-ui="gym-operations-appointments-pagination">
          <FitPagination
            ariaLabel="Coach appointments pagination"
            currentPage={currentPage}
            maxVisiblePages={5}
            onPageChange={setCurrentPage}
            totalPages={totalPages}
          />
        </div>
      </div>
    </div>
  );
}

export function CoachVenueWorkTable({
  bookings,
  colors,
  onOpenReview,
}: {
  bookings: VenueBookingRecord[];
  colors: ThemeColors;
  onOpenReview: (booking: VenueBookingRecord) => void;
}) {
  if (bookings.length === 0) {
    return (
      <div
        style={{
          alignItems: "center",
          backgroundColor: colors.surfaceRaised,
          border: `1px dashed ${colors.border}`,
          borderRadius: 8,
          display: "flex",
          minHeight: 110,
          padding: "16px 18px",
        }}
      >
        <FitText excludeGlobalScale style={{ color: colors.textMuted, fontSize: 13 }}>
          No paid venue coach add-ons match this week and filter.
        </FitText>
      </div>
    );
  }

  return (
    <div
      data-ui="coach-venue-work-table"
      style={{
        borderBottom: `1px solid ${colors.border}`,
        borderTop: `1px solid ${colors.border}`,
        maxHeight: 360,
        overflow: "auto",
      }}
    >
      <div
        style={{
          backgroundColor: colors.surface,
          display: "grid",
          gap: 10,
          gridTemplateColumns: COACH_VENUE_WORK_GRID,
          minHeight: 34,
          minWidth: COACH_VENUE_WORK_MIN_WIDTH,
          padding: "0 4px",
          position: "sticky",
          top: 0,
          zIndex: 1,
        }}
      >
        {["MEMBER", "PRODUCT", "SCHEDULE", "PRICING", "ACTION"].map((label) => (
          <FitText
            excludeGlobalScale
            key={label}
            style={{
              alignSelf: "center",
              color: colors.textMuted,
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: "0.08em",
            }}
          >
            {label}
          </FitText>
        ))}
      </div>
      {bookings.map((booking) => {
        const memberName = getPersonDisplayName(
          booking.user?.profile,
          booking.user?.email,
          "Member",
        );
        const start = new Date(booking.startTime);
        const end = new Date(booking.endTime);
        return (
          <div
            key={booking.id}
            style={{
              alignItems: "center",
              borderTop: `1px solid ${colors.border}80`,
              display: "grid",
              gap: 10,
              gridTemplateColumns: COACH_VENUE_WORK_GRID,
              minHeight: 72,
              minWidth: COACH_VENUE_WORK_MIN_WIDTH,
              padding: "9px 4px",
            }}
          >
            <div style={{ display: "grid", gap: 3, minWidth: 0 }}>
              <FitText excludeGlobalScale style={{ color: colors.textPrimary, fontSize: 12, fontWeight: 700 }}>
                {memberName}
              </FitText>
              <FitText excludeGlobalScale style={{ color: colors.textMuted, fontSize: 10.5 }}>
                {booking.user?.email ?? "No email recorded"}
              </FitText>
            </div>
            <div style={{ display: "grid", gap: 3, minWidth: 0 }}>
              <FitText excludeGlobalScale style={{ color: colors.textPrimary, fontSize: 12, fontWeight: 700 }}>
                Venue + coach add-on
              </FitText>
              <FitText excludeGlobalScale style={{ color: colors.textMuted, fontSize: 10.5 }}>
                {booking.venue?.name ?? "Venue"}
              </FitText>
            </div>
            <div style={{ display: "grid", gap: 3 }}>
              <FitText excludeGlobalScale style={{ color: colors.textPrimary, fontSize: 12, fontWeight: 700 }}>
                {start.toLocaleDateString("en-PH", { day: "numeric", month: "short", weekday: "short" })}
              </FitText>
              <FitText excludeGlobalScale style={{ color: colors.textMuted, fontSize: 10.5 }}>
                {start.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })} - {end.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
              </FitText>
            </div>
            <div style={{ display: "grid", gap: 3 }}>
              <FitText excludeGlobalScale style={{ color: colors.textPrimary, fontSize: 12, fontWeight: 700 }}>
                Coach PHP {(booking.coachAmount ?? 0).toLocaleString("en-PH")}
              </FitText>
              <FitText excludeGlobalScale style={{ color: colors.textMuted, fontSize: 10.5 }}>
                Venue PHP {(booking.venueAmount ?? 0).toLocaleString("en-PH")}
              </FitText>
            </div>
            <div style={{ alignItems: "flex-start", display: "grid", gap: 6 }}>
              <FitPill
                bgOpacity="14"
                borderOpacity="35"
                color={getAppointmentStatusColor(booking.status, colors)}
                fontSize={9}
                fontWeight={700}
                label={getReadableStatus(booking.status ?? "confirmed").toUpperCase()}
                mode="status"
                style={{ borderRadius: 6 }}
              />
              <FitButton
                aria-label={`Open venue coach add-on for ${memberName}`}
                label={booking.status === "confirmed" ? "MANAGE" : "VIEW"}
                onClick={() => onOpenReview(booking)}
                style={{ borderRadius: 7, minHeight: 28, padding: "5px 10px" }}
                textStyle={{ fontSize: 10, fontWeight: 700 }}
                variant="ghost"
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function VenueBookingsTable({
  bookings,
  colors,
  emptyMessage = "No venue bookings match the current filters.",
  onOpenReview,
  venueStatusById,
}: VenueBookingsTableProps) {
  const { settings } = useTheme();
  const canAnimate = settings.animationLevel !== "none";

  if (bookings.length === 0) {
    return (
      <div
        style={{
          minHeight: 170,
          maxHeight: 170,
          borderRadius: 8,
          border: `1px solid ${colors.border}`,
          backgroundColor: colors.surface,
          padding: "20px 22px",
          display: "flex",
          alignItems: "center",
        }}
      >
        <FitText excludeGlobalScale style={{ fontSize: 14, color: colors.textMuted }}>
          {emptyMessage}
        </FitText>
      </div>
    );
  }

  return (
    <div
      data-ui="gym-operations-venue-table"
      style={{
        minHeight: 170,
        maxHeight: "clamp(360px, 52dvh, 520px)",
        maxWidth: "100%",
        borderRadius: 8,
        border: `1px solid ${colors.border}`,
        backgroundColor: colors.surface,
        padding: 10,
        display: "grid",
        gap: 8,
        overflowX: "auto",
        overflowY: "auto",
        WebkitOverflowScrolling: "touch",
      }}
    >
      <div
        style={{
          display: "grid",
          gridTemplateColumns: VENUE_BOOKING_GRID,
          gap: 10,
          minWidth: VENUE_BOOKING_MIN_WIDTH,
          padding: "0 8px 4px",
        }}
      >
        {["MEMBER", "VENUE", "SCHEDULE", "ACTION"].map((label) => (
          <FitText
            key={label}
            excludeGlobalScale
            style={{
              fontSize: 10,
              fontWeight: 700,
              color: colors.textMuted,
              letterSpacing: "0.08em",
            }}
          >
            {label}
          </FitText>
        ))}
      </div>

      {bookings.map((booking) => {
        const memberName = getPersonDisplayName(
          booking.user?.profile,
          booking.user?.email,
          "Member",
        );
        const venueName = booking.venue?.name ?? `Venue ${booking.venueId}`;
        const start = new Date(booking.startTime);
        const end = new Date(booking.endTime);
        const isVenueUnderMaintenance =
          (venueStatusById.get(String(booking.venueId)) ?? "available") ===
          "maintenance";
        const needsMaintenanceResolution =
          isVenueUnderMaintenance &&
          booking.status === "confirmed" &&
          start.getTime() > Date.now();
        const venueActionLabel = getVenueBookingActionLabel(
          getVenueBookingPaymentStatus(booking),
        );
        const venueDateLabel = start.toLocaleDateString("en-US", {
          weekday: "short",
          month: "short",
          day: "numeric",
        });
        const venueTimeLabel = `${start.toLocaleTimeString([], {
          hour: "numeric",
          minute: "2-digit",
        })} - ${end.toLocaleTimeString([], {
          hour: "numeric",
          minute: "2-digit",
        })}`;
        return (
          <div
            key={booking.id}
            style={{
              display: "grid",
              gridTemplateColumns: VENUE_BOOKING_GRID,
              gap: 10,
              alignItems: "center",
              minHeight: 82,
              minWidth: VENUE_BOOKING_MIN_WIDTH,
              borderRadius: 8,
              border: `1px solid ${colors.border}55`,
              backgroundColor: colors.surfaceRaised,
              padding: "10px 12px",
              transition: canAnimate
                ? "border-color 160ms ease, background-color 160ms ease"
                : "border-color 160ms ease, background-color 160ms ease",
            }}
          >
            <div style={{ minWidth: 0, display: "grid", gap: 5 }}>
              <FitText
                excludeGlobalScale
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  color: colors.textPrimary,
                  display: "block",
                }}
              >
                {memberName}
              </FitText>
              <FitText excludeGlobalScale style={{ fontSize: 10.5, color: colors.textMuted, display: "block" }}>
                {booking.user?.email ?? "No email recorded"}
              </FitText>
            </div>
            <div style={{ minWidth: 0, display: "grid", gap: 2 }}>
              <div style={{ alignItems: "center", display: "flex", flexWrap: "wrap", gap: 5 }}>
                <FitText
                  excludeGlobalScale
                  style={{
                    fontSize: 12,
                    fontWeight: 700,
                    color: colors.textPrimary,
                    display: "block",
                  }}
                >
                  {venueName}
                </FitText>
                {isVenueUnderMaintenance ? (
                  <FitPill
                    bgOpacity="14"
                    borderOpacity="35"
                    color={colors.warning}
                    fontSize={8}
                    fontWeight={800}
                    label="UNDER MAINTENANCE"
                    mode="status"
                    style={{ borderRadius: 6 }}
                  />
                ) : null}
                {needsMaintenanceResolution ? (
                  <FitPill
                    bgOpacity="14"
                    borderOpacity="35"
                    color={colors.warning}
                    fontSize={8}
                    fontWeight={800}
                    label="NEEDS RESOLUTION"
                    mode="status"
                    style={{ borderRadius: 6 }}
                  />
                ) : null}
              </div>
              <FitText excludeGlobalScale style={{ fontSize: 10.5, color: colors.textMuted, display: "block" }}>
                {booking.purpose?.trim() || "General venue use"}
              </FitText>
            </div>
            <div style={{ minWidth: 0, display: "grid", gap: 5 }}>
              <FitText
                excludeGlobalScale
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  color: colors.textPrimary,
                  display: "block",
                }}
              >
                {venueDateLabel}
              </FitText>
              <FitText excludeGlobalScale style={{ fontSize: 10.5, color: colors.textMuted, display: "block" }}>
                {venueTimeLabel}
              </FitText>
              <FitPill
                mode="status"
                label={getReadableStatus(getVenueBookingPaymentStatus(booking)).toUpperCase()}
                color={getVenueBookingStatusColor(booking, colors)}
                fontSize={9}
                fontWeight={700}
                borderOpacity="35"
                bgOpacity="14"
                style={{ borderRadius: 6 }}
              />
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              {booking.status === "cancelled" ? (
                <FitText excludeGlobalScale style={{ fontSize: 11, color: colors.textMuted }}>
                  Closed
                </FitText>
              ) : (
                <FitButton
                  variant={venueActionLabel === "Open" ? "primary" : "ghost"}
                  data-ui="gym-operations-review-venue-booking"
                  label={venueActionLabel.toUpperCase()}
                  aria-label={`${venueActionLabel} venue booking for ${memberName} at ${venueName} on ${venueDateLabel}, ${venueTimeLabel}`}
                  onClick={() => onOpenReview(booking)}
                  style={{
                    minHeight: 30,
                    padding: "6px 14px",
                    borderRadius: 8,
                  }}
                  textStyle={{ fontSize: 11, fontWeight: 700 }}
                />
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function CoachRailButton({
  bookingCount,
  colors,
  draggable,
  isSelected,
  isVisible,
  onPress,
  showClickHint,
  staff,
  tone,
}: {
  bookingCount: number;
  colors: ThemeColors;
  draggable: boolean;
  isSelected: boolean;
  isVisible: boolean;
  onPress: () => void;
  showClickHint: boolean;
  staff: Resource;
  tone: string;
}) {
  const tileSize = 58;
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({
      id: `coach:${staff.id}`,
      data: {
        kind: "coach",
        coachId: staff.id,
      },
      disabled: !draggable,
    });

  return (
    <button
      ref={setNodeRef}
      type="button"
      title={`${staff.name} - ${bookingCount} booking${bookingCount === 1 ? "" : "s"}`}
      onClick={onPress}
      {...(draggable ? listeners : {})}
      {...(draggable ? attributes : {})}
      aria-label={`${staff.name}, ${bookingCount} booking${
        bookingCount === 1 ? "" : "s"
      }${isVisible ? "" : ", hidden from member booking"}${
        isSelected ? ", selected" : ""
      }`}
      aria-pressed={isSelected}
      style={{
        width: tileSize,
        height: tileSize,
        border: "none",
        backgroundColor: "transparent",
        color: isSelected ? colors.brand : colors.textPrimary,
        display: "grid",
        placeItems: "center",
        padding: 0,
        cursor: draggable ? (isDragging ? "grabbing" : "grab") : "pointer",
        opacity: isDragging ? 0.55 : 1,
        position: "relative",
        touchAction: draggable ? "none" : "auto",
        transform: CSS.Translate.toString(transform),
      }}
    >
      <span
        style={{
          position: "absolute",
          top: 5,
          right: 5,
          width: 9,
          height: 9,
          borderRadius: 999,
          backgroundColor: tone,
          border: `2px solid ${isSelected ? `${colors.brand}18` : colors.surface}`,
          boxShadow: `0 0 0 3px ${tone}18`,
          zIndex: 2,
        }}
        aria-hidden
      />
      <span
        style={{
          width: tileSize,
          height: tileSize,
          borderRadius: 8,
          border: `1px solid ${isSelected ? `${colors.brand}55` : colors.border}`,
          backgroundColor: isSelected ? `${colors.brand}18` : colors.surface,
          boxShadow: isSelected ? `0 0 0 1px ${colors.brand}22 inset` : "none",
          display: "grid",
          placeItems: "center",
          fontSize: 12,
          fontWeight: 800,
          lineHeight: 1,
        }}
      >
        {staff.initials ?? staff.name.slice(0, 2).toUpperCase()}
      </span>
      {showClickHint ? (
        <span
          style={{
            position: "absolute",
            left: "calc(100% + 8px)",
            top: "50%",
            transform: "translateY(-50%)",
            width: 82,
            borderRadius: 6,
            border: `1px solid ${colors.brand}33`,
            backgroundColor: colors.surface,
            color: colors.brand,
            display: "grid",
            fontSize: 8,
            fontWeight: 800,
            lineHeight: 1.05,
            padding: "3px 2px",
            textAlign: "center",
            zIndex: 4,
          }}
        >
          Click Again to View
        </span>
      ) : null}
      {!isVisible ? (
        <span className="sr-only">Hidden from booking</span>
      ) : null}
    </button>
  );
}

export function CoachIconRail({
  bookings,
  colors,
  draggable = false,
  filteredStaff,
  maxHeight,
  onStaffPreview,
  onStaffClick,
  orientation = "column",
  railRef,
  requireSecondClickToOpen = false,
  selectedStaffId,
}: CoachIconRailProps) {
  const isRow = orientation === "row";
  const railHeight = isRow ? undefined : maxHeight ?? undefined;
  const [pendingViewStaffId, setPendingViewStaffId] = useState<string | null>(null);

  useEffect(() => {
    if (!pendingViewStaffId) return;
    const timeout = window.setTimeout(() => setPendingViewStaffId(null), 2200);
    return () => window.clearTimeout(timeout);
  }, [pendingViewStaffId]);

  const handleStaffPress = (staffId: string) => {
    if (!requireSecondClickToOpen) {
      onStaffClick(staffId);
      return;
    }

    if (pendingViewStaffId === staffId) {
      setPendingViewStaffId(null);
      onStaffClick(staffId);
      return;
    }

    setPendingViewStaffId(staffId);
    onStaffPreview?.(staffId);
  };

  return (
    <aside
      ref={railRef}
      className="gym-operations-coach-rail"
      data-ui="gym-operations-coach-selection"
      style={{
        height: railHeight,
        minHeight: railHeight,
        borderRadius: 8,
        border: `1px solid ${colors.border}`,
        backgroundColor: colors.surface,
        display: "grid",
        gridTemplateRows: isRow ? "auto" : "56px minmax(0, 1fr)",
        gridTemplateColumns: isRow ? "56px minmax(0, 1fr)" : undefined,
        overflow: "hidden",
      }}
      aria-label="Coach icon rail"
    >
      <div
        style={{
          minHeight: 56,
          padding: 8,
          borderBottom: isRow ? "none" : `1px solid ${colors.border}`,
          borderRight: isRow ? `1px solid ${colors.border}` : "none",
          backgroundColor: colors.surfaceRaised,
          display: "grid",
          placeItems: "center",
        }}
      >
        <div
          style={{
            width: 38,
            height: 38,
            borderRadius: 8,
            border: `1px solid ${colors.border}`,
            backgroundColor: colors.surface,
            color: colors.textMuted,
            display: "grid",
            placeItems: "center",
          }}
          aria-hidden
        >
          <UsersRound size={17} strokeWidth={2.2} />
        </div>
      </div>
      <div
        className="gym-operations-coach-rail-list"
        style={{
          overflowX: isRow ? "auto" : "hidden",
          overflowY: isRow ? "hidden" : "auto",
          padding: 8,
          display: "grid",
          gap: 10,
          justifyItems: "center",
          gridAutoFlow: isRow ? "column" : "row",
          gridAutoColumns: isRow ? "58px" : undefined,
          alignContent: "start",
          alignItems: isRow ? "center" : undefined,
        }}
      >
        {filteredStaff.length ? (
          filteredStaff.map((staff) => {
            const bookingCount = bookings.filter((booking) => booking.resourceId === staff.id).length;
            const coachMeta = staff as Resource & {
              availabilityCount?: number;
              isActive?: boolean;
            };
            const isSelected = staff.id === selectedStaffId;
            const isVisible = coachMeta.isActive ?? true;
            const tone = !isVisible ? colors.textMuted : bookingCount >= 6 ? colors.warning : colors.brand;

            return (
              <CoachRailButton
                key={staff.id}
                bookingCount={bookingCount}
                colors={colors}
                draggable={draggable}
                isSelected={isSelected}
                isVisible={isVisible}
                onPress={() => handleStaffPress(staff.id)}
                showClickHint={pendingViewStaffId === staff.id}
                staff={staff}
                tone={tone}
              />
            );
          })
        ) : (
          <FitText excludeGlobalScale style={{ fontSize: 11, color: colors.textMuted, lineHeight: 1.4 }}>
            No coaches.
          </FitText>
        )}
      </div>
    </aside>
  );
}
