"use client";
import type { MotionStyle } from "framer-motion";
import { motion } from "framer-motion";
import { CSS } from "@dnd-kit/utilities";
import { useDraggable, useDroppable } from "@dnd-kit/core";
import type { ThemeColors } from "@fittrack/types";
import { toYmd } from "@fittrack/utils";
import type { Booking } from "@/data/schedule-constants";
import { useTheme } from "@/contexts/ThemeContext";

import { FitText } from "@/components/fit/FitText";
import FitButton from "@/components/fit/FitButton";

const WEEK_DAYS_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const CELL_HEIGHT = 46;
const HOUR_COL_WIDTH = 60;

function formatTimeLabel(hour: number, minute = 0) {
  const suffix = hour >= 12 ? "PM" : "AM";
  const displayHour = hour % 12 === 0 ? 12 : hour % 12;
  return `${displayHour.toString().padStart(2, "0")}:${minute.toString().padStart(2, "0")}${suffix}`;
}

function formatBookingWindow(booking: Booking) {
  const startMinutes = booking.startHour * 60 + booking.startMinute;
  const endMinutes = startMinutes + booking.durationMin;
  const endHour = Math.floor(endMinutes / 60) % 24;
  const endMinute = endMinutes % 60;
  return `${formatTimeLabel(booking.startHour, booking.startMinute)} - ${formatTimeLabel(endHour, endMinute)}`;
}

type Props = {
  weekDays: Date[];
  hours: number[];
  bookings: Booking[];
  slideStyle: MotionStyle;
  isLoading: boolean;
  colors: ThemeColors;
  allowDrag?: boolean;
  height?: number;
  onBlockClick: (booking: Booking) => void;
};

function DropCell({
  id,
  children,
  isToday,
  colors,
  cellHeight,
}: {
  id: string;
  children?: React.ReactNode;
  isToday: boolean;
  colors: ThemeColors;
  cellHeight: number;
}) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <div
      ref={setNodeRef}
      style={{
        height: cellHeight,
        boxSizing: "border-box",
        borderBottom: `1px solid ${colors.border}`,
        borderRight: `1px solid ${colors.border}`,
        backgroundColor: isOver
          ? `${colors.brand}22`
          : isToday
            ? `${colors.brand}08`
            : "transparent",
        position: "relative",
        transition: "background-color 0.12s ease",
      }}
    >
      {children}
    </div>
  );
}

function BookingNode({
  booking,
  colors,
  bookingMutedTextColor,
  bookingTextColor,
  cellHeight,
  allowDrag,
  onBlockClick,
}: {
  booking: Booking;
  colors: ThemeColors;
  bookingMutedTextColor: string;
  bookingTextColor: string;
  cellHeight: number;
  allowDrag: boolean;
  onBlockClick: (booking: Booking) => void;
}) {
  const { settings } = useTheme();
  const canAnimate = settings.animationLevel !== "none";
  const fullMotion = settings.animationLevel === "full";
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({
      id: `booking:${booking.id}`,
      data: {
        kind: "booking",
        bookingId: booking.id,
      },
      disabled: !allowDrag,
    });

  return (
    <FitButton
      buttonRef={setNodeRef}
      variant="primary"
      onClick={() => onBlockClick(booking)}
      {...(allowDrag ? listeners : {})}
      {...(allowDrag ? attributes : {})}
      style={{
        position: "absolute",
        top: 6,
        left: 6,
        width: "calc(100% - 12px)",
        maxWidth: "calc(100% - 12px)",
        borderRadius: 6,
        backgroundColor: booking.color ?? colors.brand,
        border: "none",
        padding: "5px 7px",
        textAlign: "left",
        zIndex: 2,
        boxShadow: isDragging
          ? "0 10px 24px rgba(0,0,0,0.22)"
          : "0 2px 8px rgba(0,0,0,0.2)",
        alignItems: "flex-start",
        cursor: allowDrag ? (isDragging ? "grabbing" : "grab") : "pointer",
        touchAction: allowDrag ? "none" : "auto",
        opacity: isDragging ? 0.56 : 1,
        transform: CSS.Translate.toString(transform),
        minHeight: Math.max(34, (booking.durationMin / 60) * cellHeight - 8),
        transition: canAnimate
          ? "box-shadow 160ms ease, opacity 160ms ease, filter 160ms ease"
          : "box-shadow 160ms ease, opacity 160ms ease",
      }}
      onMouseDown={(event) => {
        if (!canAnimate || isDragging) return;
        event.currentTarget.style.filter = fullMotion
          ? "brightness(0.98)"
          : "brightness(0.99)";
      }}
      onMouseUp={(event) => {
        if (!canAnimate || isDragging) return;
        event.currentTarget.style.filter = "none";
      }}
    >
      <FitText
        excludeGlobalScale
        style={{
          fontSize: 13,
          fontWeight: 800,
          color: bookingTextColor,
          display: "block",
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
        }}
      >
        1 Session
      </FitText>
      <FitText
        excludeGlobalScale
        style={{
          fontSize: 11,
          color: bookingMutedTextColor,
          display: "block",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
          marginTop: 2,
        }}
      >
        {formatBookingWindow(booking)}
      </FitText>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 4,
          marginTop: 6,
          minHeight: 13,
        }}
      >
        <span
          style={{
            minWidth: 18,
            height: 18,
            borderRadius: 4,
            backgroundColor: "rgba(255,255,255,0.16)",
            color: bookingTextColor,
            display: "inline-grid",
            placeItems: "center",
            fontSize: 10,
            fontWeight: 800,
            lineHeight: 1,
          }}
        >
          {booking.resourceName
            .split(/\s+/)
            .filter(Boolean)
            .slice(0, 2)
            .map((part) => part.charAt(0))
            .join("")
            .toUpperCase()}
        </span>
      </div>
      {booking.venueLabel && (
        <FitText
          excludeGlobalScale
          style={{
            fontSize: 10.5,
            fontWeight: 700,
            color: bookingMutedTextColor,
            display: "block",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            marginTop: 8,
            textTransform: "uppercase",
          }}
        >
          {booking.venueLabel}
        </FitText>
      )}
    </FitButton>
  );
}

export default function WeeklyTimeline({
  weekDays,
  hours,
  bookings,
  slideStyle,
  isLoading,
  colors,
  allowDrag = true,
  height,
  onBlockClick,
}: Props) {
  const today = toYmd(new Date());
  const bookingTextColor = colors.onBrand ?? colors.surface;
  const bookingMutedTextColor = `${bookingTextColor}CC`;
  const dayCount = Math.max(1, weekDays.length);
  const timelineColumns = `${HOUR_COL_WIDTH}px repeat(${dayCount}, minmax(0, 1fr))`;
  const headerHeight = 42;
  const cellHeight =
    height && hours.length
      ? Math.max(CELL_HEIGHT, Math.floor((height - headerHeight) / hours.length))
      : CELL_HEIGHT;

  return (
    <motion.div style={{ ...slideStyle, height: height ?? undefined }}>
      <div
        style={{
          backgroundColor: colors.surface,
          border: `1px solid ${colors.border}`,
          borderRadius: 8,
          overflow: "hidden",
          height: height ?? undefined,
        }}
      >
        <div
          style={{
            display: "grid",
            width: "100%",
            gridTemplateColumns: timelineColumns,
            borderBottom: `1px solid ${colors.border}`,
          }}
        >
          <div style={{ height: headerHeight, borderRight: `1px solid ${colors.border}` }} />
          {weekDays.map((day, i) => {
            const ymd = toYmd(day);
            const isToday = ymd === today;
            return (
              <div
                key={i}
                style={{
                  height: headerHeight,
                  boxSizing: "border-box",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  borderRight:
                    i < dayCount - 1 ? `1px solid ${colors.border}` : "none",
                  backgroundColor: isToday
                    ? `${colors.brand}14`
                    : "transparent",
                }}
              >
                <FitText
                  excludeGlobalScale
                  style={{
                    fontSize: 9,
                    color: colors.textMuted,
                    fontWeight: 800,
                    textTransform: "uppercase",
                  }}
                >
                  {WEEK_DAYS_SHORT[day.getDay()]}
                </FitText>
                <FitText
                  excludeGlobalScale
                  style={{
                    fontSize: 12,
                    fontWeight: isToday ? 800 : 700,
                    color: isToday ? colors.brand : colors.textPrimary,
                    lineHeight: 1.05,
                  }}
                >
                  {day.getDate()}
                </FitText>
              </div>
            );
          })}
        </div>
        {isLoading ? (
          <div style={{ padding: 32, textAlign: "center" as const }}>
            <FitText style={{ fontSize: 14, color: colors.textMuted }}>
              Loading schedule...
            </FitText>
          </div>
        ) : (
          hours.map((hour) => (
            <div
              key={hour}
              style={{
                display: "grid",
                width: "100%",
                gridTemplateColumns: timelineColumns,
              }}
            >
              <div
                style={{
                  height: cellHeight,
                  boxSizing: "border-box",
                  display: "flex",
                  alignItems: "flex-start",
                  justifyContent: "flex-end",
                  paddingRight: 8,
                  paddingTop: 6,
                  borderRight: `1px solid ${colors.border}`,
                  borderBottom: `1px solid ${colors.border}`,
                }}
              >
                <FitText
                  excludeGlobalScale
                  style={{
                    fontSize: 9,
                    color: colors.textMuted,
                    fontWeight: 700,
                  }}
                >
                  {formatTimeLabel(hour)}
                </FitText>
              </div>
              {weekDays.map((day, dayIdx) => {
                const ymd = toYmd(day);
                const isToday = ymd === today;
                const cellBookings = bookings.filter((b) => {
                  if (!b.date || b.date !== ymd) return false;
                  return b.startHour === hour;
                });
                return (
                  <DropCell
                    key={dayIdx}
                    id={`${dayIdx}:${hour}`}
                    isToday={isToday}
                    colors={colors}
                    cellHeight={cellHeight}
                  >
                    {cellBookings.map((b) => (
                      <BookingNode
                        key={b.id}
                        booking={b}
                        colors={colors}
                        bookingMutedTextColor={bookingMutedTextColor}
                        bookingTextColor={bookingTextColor}
                        cellHeight={cellHeight}
                        allowDrag={allowDrag}
                        onBlockClick={onBlockClick}
                      />
                    ))}
                  </DropCell>
                );
              })}
            </div>
          ))
        )}
      </div>
    </motion.div>
  );
}
