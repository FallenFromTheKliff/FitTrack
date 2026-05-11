"use client";

import { useEffect, useState, type RefObject } from "react";
import { ChevronLeft, ChevronRight, UsersRound } from "lucide-react";
import type { StaffAppointmentRecord } from "@fittrack/api-client";
import type { ThemeColors } from "@fittrack/types";

import { FitButton, FitPill, FitText } from "@/components/fit";
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
};

type VenueBookingsTableProps = {
  bookings: VenueBookingRecord[];
  colors: ThemeColors;
  emptyMessage?: string;
  onOpenReview: (booking: VenueBookingRecord) => void;
};

type CoachIconRailProps = {
  bookings: Booking[];
  colors: ThemeColors;
  filteredStaff: Resource[];
  maxHeight: number | null;
  onStaffClick: (staffId: string) => void;
  orientation?: "column" | "row";
  railRef: RefObject<HTMLElement | null>;
  selectedStaffId?: string | null;
};

export function CoachAppointmentsTable({
  appointments,
  colors,
  onOpenReview,
}: CoachAppointmentsTableProps) {
  const { settings } = useTheme();
  const canAnimate = settings.animationLevel !== "none";
  const resultsHeight = 170;

  if (appointments.length === 0) {
    return (
      <div
        style={{
          minHeight: resultsHeight,
          maxHeight: resultsHeight,
          borderRadius: 18,
          border: `1px solid ${colors.border}`,
          backgroundColor: colors.surface,
          padding: "20px 22px",
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
      style={{
        minHeight: resultsHeight,
        maxHeight: 360,
        borderRadius: 8,
        border: `1px solid ${colors.border}`,
        backgroundColor: colors.surface,
        padding: 10,
        display: "grid",
        gap: 8,
        overflowY: "auto",
      }}
    >
      <div
        style={{
          display: "grid",
          gridTemplateColumns:
            "minmax(220px, 1.25fr) minmax(170px, 0.9fr) minmax(210px, 1fr) minmax(100px, 0.42fr)",
          gap: 10,
          padding: "0 8px 4px",
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
      {appointments.map((appointment) => {
        const memberName = getPersonDisplayName(
          appointment.user?.profile,
          appointment.user?.email,
          "Member",
        );
        const coachName = getCoachDisplayName(appointment.coach, "Coach");
        const { dateLabel, timeLabel } = formatAppointmentWindow(appointment);

        return (
          <div
            key={appointment.id}
            style={{
              display: "grid",
              gridTemplateColumns:
                "minmax(220px, 1.25fr) minmax(170px, 0.9fr) minmax(210px, 1fr) minmax(100px, 0.42fr)",
              gap: 10,
              alignItems: "center",
              minHeight: 58,
              borderRadius: 8,
              border: `1px solid ${colors.border}55`,
              backgroundColor: colors.surfaceRaised,
              padding: "10px 12px",
              transition: canAnimate
                ? "border-color 160ms ease, background-color 160ms ease"
                : "border-color 160ms ease, background-color 160ms ease",
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
              />
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              {appointment.status === "cancelled" || appointment.status === "no_show" ? (
                <FitText excludeGlobalScale style={{ fontSize: 11, color: colors.textMuted }}>
                  Closed
                </FitText>
              ) : (
                <FitButton
                  variant={appointment.status === "pending_coach" ? "primary" : "ghost"}
                  label={getAppointmentActionLabel(getCoachAppointmentPaymentStatus(appointment)).toUpperCase()}
                  onClick={() => onOpenReview(appointment)}
                  style={{
                    minHeight: 30,
                    padding: "6px 14px",
                    borderRadius: 15,
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

export function VenueBookingsTable({
  bookings,
  colors,
  emptyMessage = "No venue bookings match the current filters.",
  onOpenReview,
}: VenueBookingsTableProps) {
  const { settings } = useTheme();
  const canAnimate = settings.animationLevel !== "none";

  if (bookings.length === 0) {
    return (
      <div
        style={{
          minHeight: 170,
          maxHeight: 170,
          borderRadius: 18,
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
      style={{
        minHeight: 170,
        maxHeight: 360,
        borderRadius: 8,
        border: `1px solid ${colors.border}`,
        backgroundColor: colors.surface,
        padding: 10,
        display: "grid",
        gap: 8,
        overflowY: "auto",
      }}
    >
      <div
        style={{
          display: "grid",
          gridTemplateColumns:
            "minmax(220px, 1.2fr) minmax(180px, 0.95fr) minmax(210px, 1fr) minmax(100px, 0.42fr)",
          gap: 10,
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
        const start = new Date(booking.startTime);
        const end = new Date(booking.endTime);
        return (
          <div
            key={booking.id}
            style={{
              display: "grid",
              gridTemplateColumns:
                "minmax(220px, 1.2fr) minmax(180px, 0.95fr) minmax(210px, 1fr) minmax(100px, 0.42fr)",
              gap: 10,
              alignItems: "center",
              minHeight: 58,
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
              <FitText
                excludeGlobalScale
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  color: colors.textPrimary,
                  display: "block",
                }}
              >
                {booking.venue?.name ?? `Venue ${booking.venueId}`}
              </FitText>
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
                {start.toLocaleDateString("en-US", {
                  weekday: "short",
                  month: "short",
                  day: "numeric",
                })}
              </FitText>
              <FitText excludeGlobalScale style={{ fontSize: 10.5, color: colors.textMuted, display: "block" }}>
                {start.toLocaleTimeString([], {
                  hour: "numeric",
                  minute: "2-digit",
                })}{" "}
                -{" "}
                {end.toLocaleTimeString([], {
                  hour: "numeric",
                  minute: "2-digit",
                })}
              </FitText>
              <FitPill
                mode="status"
                label={getReadableStatus(getVenueBookingPaymentStatus(booking)).toUpperCase()}
                color={getVenueBookingStatusColor(booking, colors)}
                fontSize={9}
                fontWeight={700}
                borderOpacity="35"
                bgOpacity="14"
              />
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              {booking.status === "cancelled" ? (
                <FitText excludeGlobalScale style={{ fontSize: 11, color: colors.textMuted }}>
                  Closed
                </FitText>
              ) : (
                <FitButton
                  variant={
                    getVenueBookingActionLabel(getVenueBookingPaymentStatus(booking)) === "Review"
                      ? "primary"
                      : "ghost"
                  }
                  label={getVenueBookingActionLabel(getVenueBookingPaymentStatus(booking)).toUpperCase()}
                  onClick={() => onOpenReview(booking)}
                  style={{
                    minHeight: 30,
                    padding: "6px 14px",
                    borderRadius: 15,
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

export function CoachIconRail({
  bookings,
  colors,
  filteredStaff,
  maxHeight,
  onStaffClick,
  orientation = "column",
  railRef,
  selectedStaffId,
}: CoachIconRailProps) {
  const isRow = orientation === "row";
  const railHeight = isRow ? undefined : maxHeight ?? undefined;
  const coachRailPageSize = isRow ? 8 : 6;
  const [coachRailPage, setCoachRailPage] = useState(1);
  const coachRailTotalPages = Math.max(1, Math.ceil(filteredStaff.length / coachRailPageSize));
  const paginatedStaff = filteredStaff.slice(
    (coachRailPage - 1) * coachRailPageSize,
    coachRailPage * coachRailPageSize,
  );

  useEffect(() => {
    if (coachRailPage <= coachRailTotalPages) return;
    setCoachRailPage(coachRailTotalPages);
  }, [coachRailPage, coachRailTotalPages]);

  return (
    <aside
      ref={railRef}
      className="gym-operations-coach-rail"
      style={{
        height: railHeight,
        minHeight: railHeight,
        borderRadius: 8,
        border: `1px solid ${colors.border}`,
        backgroundColor: colors.surface,
        display: "grid",
        gridTemplateRows: isRow ? "auto" : "auto minmax(0, 1fr) auto",
        gridTemplateColumns: isRow ? "56px minmax(0, 1fr) auto" : undefined,
        overflow: "hidden",
      }}
      aria-label="Coach icon rail"
    >
      <div
        style={{
          minHeight: 56,
          padding: 8,
          borderBottom: `1px solid ${colors.border}`,
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
        style={{
          overflow: "hidden",
          padding: 8,
          display: "grid",
          gap: 8,
          gridAutoFlow: isRow ? "column" : "row",
          gridAutoColumns: isRow ? "72px" : undefined,
          alignContent: "start",
          alignItems: isRow ? "center" : undefined,
        }}
      >
        {paginatedStaff.length ? (
          paginatedStaff.map((staff) => {
            const bookingCount = bookings.filter((booking) => booking.resourceId === staff.id).length;
            const coachMeta = staff as Resource & {
              availabilityCount?: number;
              isActive?: boolean;
            };
            const isSelected = staff.id === selectedStaffId;
            const isVisible = coachMeta.isActive ?? true;
            const tone = !isVisible ? colors.textMuted : bookingCount >= 6 ? colors.warning : colors.brand;

            return (
              <button
                key={staff.id}
                type="button"
                aria-pressed={isSelected}
                title={`${staff.name} - ${bookingCount} booking${bookingCount === 1 ? "" : "s"}`}
                onClick={() => onStaffClick(staff.id)}
                style={{
                  width: 72,
                  minHeight: 62,
                  borderRadius: 8,
                  border: `1px solid ${isSelected ? colors.brand : colors.border}`,
                  backgroundColor: isSelected ? `${colors.brand}14` : colors.surfaceRaised,
                  color: isSelected ? colors.brand : colors.textPrimary,
                  display: "grid",
                  placeItems: "center",
                  gap: 5,
                  padding: "7px 5px",
                  cursor: "pointer",
                  boxShadow: isSelected ? `0 0 0 1px ${colors.brand}22 inset` : "none",
                }}
              >
                <span
                  style={{
                    width: 38,
                    height: 38,
                    borderRadius: 8,
                    border: `1px solid ${isSelected ? `${colors.brand}55` : colors.border}`,
                    backgroundColor: isSelected ? `${colors.brand}18` : colors.surface,
                    display: "grid",
                    placeItems: "center",
                    fontSize: 11,
                    fontWeight: 800,
                    lineHeight: 1,
                  }}
                >
                  {staff.initials ?? staff.name.slice(0, 2).toUpperCase()}
                </span>
                <span
                  aria-hidden
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: 999,
                    backgroundColor: tone,
                    boxShadow: `0 0 0 3px ${tone}18`,
                  }}
                />
              </button>
            );
          })
        ) : (
          <FitText excludeGlobalScale style={{ fontSize: 11, color: colors.textMuted, lineHeight: 1.4 }}>
            No coaches.
          </FitText>
        )}
      </div>
      <div
        style={{
          padding: 8,
          borderTop: isRow ? "none" : `1px solid ${colors.border}`,
          borderLeft: isRow ? `1px solid ${colors.border}` : "none",
          backgroundColor: colors.surfaceRaised,
          display: "grid",
          gridTemplateColumns: isRow ? "26px" : "26px minmax(0, 1fr) 26px",
          gridTemplateRows: isRow ? "26px auto 26px" : undefined,
          alignItems: "center",
          gap: 4,
        }}
      >
        <FitButton
          variant="ghost"
          iconOnly
          icon={ChevronLeft}
          iconSize={14}
          disabled={coachRailPage === 1}
          onClick={() => setCoachRailPage((page) => Math.max(1, page - 1))}
          aria-label="Previous coach page"
          style={{ minHeight: 26, width: 26, borderRadius: 7, padding: 0 }}
        />
        <FitText
          excludeGlobalScale
          style={{
            fontSize: 10,
            fontWeight: 800,
            color: colors.textMuted,
            textAlign: "center",
            writingMode: isRow ? "vertical-rl" : undefined,
          }}
        >
          {coachRailPage}/{coachRailTotalPages}
        </FitText>
        <FitButton
          variant="ghost"
          iconOnly
          icon={ChevronRight}
          iconSize={14}
          disabled={coachRailPage === coachRailTotalPages}
          onClick={() => setCoachRailPage((page) => Math.min(coachRailTotalPages, page + 1))}
          aria-label="Next coach page"
          style={{ minHeight: 26, width: 26, borderRadius: 7, padding: 0 }}
        />
      </div>
    </aside>
  );
}
