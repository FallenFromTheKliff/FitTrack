"use client";

import { useEffect, useState, type RefObject } from "react";
import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { ChevronDown, ChevronLeft, ChevronRight, ChevronUp, UsersRound } from "lucide-react";
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
const VENUE_BOOKING_GRID =
  "minmax(220px, 1.2fr) minmax(180px, 0.95fr) minmax(210px, 1fr) minmax(100px, 0.42fr)";
const VENUE_BOOKING_MIN_WIDTH = 740;

export function CoachAppointmentsTable({
  appointments,
  colors,
  onOpenReview,
}: CoachAppointmentsTableProps) {
  const { settings } = useTheme();
  const canAnimate = settings.animationLevel !== "none";
  const rowMinHeight = 58;

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
      style={{
        width: "100%",
        maxWidth: "100%",
        height: "100%",
        minHeight: Math.max(170, appointments.length * rowMinHeight + 34),
        display: "grid",
        gridTemplateRows: `34px repeat(${appointments.length}, minmax(${rowMinHeight}px, 1fr))`,
        borderTop: `1px solid ${colors.border}`,
        borderBottom: `1px solid ${colors.border}`,
        overflowX: "auto",
        overflowY: "hidden",
        WebkitOverflowScrolling: "touch",
      }}
    >
      <div
        style={{
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
      {appointments.map((appointment, index) => {
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
              gridTemplateColumns: COACH_APPOINTMENT_GRID,
              gap: 10,
              alignItems: "center",
              minHeight: rowMinHeight,
              minWidth: COACH_APPOINTMENT_MIN_WIDTH,
              borderBottom:
                index === appointments.length - 1
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
                  label="CLOSED"
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
                  variant={appointment.status === "pending_coach" ? "primary" : "ghost"}
                  label={getAppointmentActionLabel(getCoachAppointmentPaymentStatus(appointment)).toUpperCase()}
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
      style={{
        minHeight: 170,
        maxHeight: 360,
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
        const start = new Date(booking.startTime);
        const end = new Date(booking.endTime);
        return (
          <div
            key={booking.id}
            style={{
              display: "grid",
              gridTemplateColumns: VENUE_BOOKING_GRID,
              gap: 10,
              alignItems: "center",
              minHeight: 58,
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
  const coachRailPageSize = isRow ? 8 : 6;
  const [coachRailPage, setCoachRailPage] = useState(1);
  const [pendingViewStaffId, setPendingViewStaffId] = useState<string | null>(null);
  const coachRailTotalPages = Math.max(1, Math.ceil(filteredStaff.length / coachRailPageSize));
  const showCoachRailPagination = coachRailTotalPages > 1;
  const coachRailPageNumbers = Array.from(
    { length: coachRailTotalPages },
    (_, index) => index + 1,
  );
  const paginatedStaff = filteredStaff.slice(
    (coachRailPage - 1) * coachRailPageSize,
    coachRailPage * coachRailPageSize,
  );
  const paginationArrowStyle = {
    minHeight: 36,
    minWidth: 36,
    width: 36,
    height: 36,
    borderRadius: 8,
    padding: 0,
  };
  const paginationPageStyle = (isActive: boolean) => ({
    minHeight: 36,
    minWidth: 36,
    width: 36,
    height: 36,
    borderRadius: 8,
    padding: 0,
    border: `1px solid ${isActive ? `${colors.brand}55` : colors.border}`,
    backgroundColor: isActive ? `${colors.brand}18` : colors.surfaceRaised,
    color: isActive ? colors.brand : colors.textSecondary,
  });

  useEffect(() => {
    if (coachRailPage <= coachRailTotalPages) return;
    setCoachRailPage(coachRailTotalPages);
  }, [coachRailPage, coachRailTotalPages]);

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
      style={{
        height: railHeight,
        minHeight: railHeight,
        borderRadius: 8,
        border: `1px solid ${colors.border}`,
        backgroundColor: colors.surface,
        display: "grid",
        gridTemplateRows: isRow
          ? showCoachRailPagination
            ? "auto auto"
            : "auto"
          : showCoachRailPagination
            ? "56px minmax(0, 1fr) auto"
            : "56px minmax(0, 1fr)",
        gridTemplateColumns: isRow ? "56px minmax(0, 1fr)" : undefined,
        overflow: "visible",
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
      {showCoachRailPagination ? (
        <div
          className="gym-operations-coach-rail-pagination"
          style={{
            padding: 8,
            gridColumn: isRow ? "1 / -1" : undefined,
            borderTop: isRow ? `1px solid ${colors.border}` : `1px solid ${colors.border}`,
            borderLeft: "none",
            borderBottom: "none",
            backgroundColor: colors.surfaceRaised,
            display: "flex",
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            gap: 6,
          }}
        >
          <FitButton
            variant="ghost"
            iconOnly
            icon={isRow ? ChevronLeft : ChevronUp}
            iconSize={15}
            disabled={coachRailPage === 1}
            onClick={() => setCoachRailPage((page) => Math.max(1, page - 1))}
            aria-label="Previous coach page"
            style={paginationArrowStyle}
          />
          <div
            style={{
              display: "flex",
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              gap: 6,
            }}
          >
            {coachRailPageNumbers.map((page) => {
              const isActive = page === coachRailPage;
              return (
                <button
                  key={page}
                  type="button"
                  aria-current={isActive ? "page" : undefined}
                  aria-label={`Go to coach page ${page}`}
                  onClick={() => setCoachRailPage(page)}
                  className="fit-pagination-button"
                  style={paginationPageStyle(isActive)}
                >
                  <FitText
                    as="span"
                    excludeGlobalScale
                    style={{
                      color: "inherit",
                      fontSize: 12,
                      fontWeight: isActive ? 800 : 700,
                    }}
                  >
                    {page}
                  </FitText>
                </button>
              );
            })}
          </div>
          <FitButton
            variant="ghost"
            iconOnly
            icon={isRow ? ChevronRight : ChevronDown}
            iconSize={15}
            disabled={coachRailPage === coachRailTotalPages}
            onClick={() => setCoachRailPage((page) => Math.min(coachRailTotalPages, page + 1))}
            aria-label="Next coach page"
            style={paginationArrowStyle}
          />
        </div>
      ) : null}
    </aside>
  );
}
