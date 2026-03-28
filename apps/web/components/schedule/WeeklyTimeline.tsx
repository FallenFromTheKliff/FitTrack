"use client";
import type { MotionStyle } from "framer-motion";
import { motion } from "framer-motion";
import { useDroppable } from "@dnd-kit/core";
import type { ThemeColors } from "@fittrack/types";
import { toYmd } from "@fittrack/utils";
import type { Booking } from "@/data/schedule-constants";

import { FitText } from "@/components/fit/FitText";
import FitButton from "@/components/fit/FitButton";

const WEEK_DAYS_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const CELL_HEIGHT = 52;
const HOUR_COL_WIDTH = 52;

type Props = {
  weekDays: Date[];
  hours: number[];
  bookings: Booking[];
  slideStyle: MotionStyle;
  isLoading: boolean;
  colors: ThemeColors;
  onBlockClick: (booking: Booking) => void;
};

function DropCell({ id, children, isToday, colors }: { id: string; children?: React.ReactNode; isToday: boolean; colors: ThemeColors }) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <div
      ref={setNodeRef}
      style={{
        height: CELL_HEIGHT,
        boxSizing: "border-box",
        borderBottom: `1px solid ${colors.border}`,
        borderRight: `1px solid ${colors.border}`,
        backgroundColor: isOver
          ? `${colors.brand}22`
          : isToday
            ? `${colors.brand}08`
            : "transparent",
        position: "relative",
        transition: "background-color 0.12s ease"
      }}
    >
      {children}
    </div>
  );
}

export default function WeeklyTimeline({ weekDays, hours, bookings, slideStyle, isLoading, colors, onBlockClick }: Props) {
  const today = toYmd(new Date());
  const bookingTextColor = colors.onBrand ?? colors.surface;
  const bookingMutedTextColor = `${bookingTextColor}CC`;
  const timelineColumns = `${HOUR_COL_WIDTH}px repeat(7, minmax(0, 1fr))`;

  return (
    <motion.div style={slideStyle}>
      <div style={{
        backgroundColor: colors.surface,
        border: `1px solid ${colors.border}`,
        borderRadius: 12,
        overflow: "hidden"
      }}>
        <div style={{ display: "grid", width: "100%", gridTemplateColumns: timelineColumns, borderBottom: `1px solid ${colors.border}` }}>
          <div style={{ height: 44, borderRight: `1px solid ${colors.border}` }} />
          {weekDays.map((day, i) => {
            const ymd = toYmd(day);
            const isToday = ymd === today;
            return (
              <div key={i} style={{
                height: 44,
                boxSizing: "border-box",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                borderRight: i < 6 ? `1px solid ${colors.border}` : "none",
                backgroundColor: isToday ? `${colors.brand}14` : "transparent"
              }}>
                <FitText style={{ fontSize: 11, color: colors.textMuted, fontWeight: 600 }}>{WEEK_DAYS_SHORT[day.getDay()]}</FitText>
                <FitText style={{ fontSize: 16, fontWeight: isToday ? 700 : 500, color: isToday ? colors.brand : colors.textPrimary, lineHeight: 1.1 }}>
                  {day.getDate()}
                </FitText>
              </div>
            );
          })}
        </div>
        {isLoading ? (
          <div style={{ padding: 32, textAlign: "center" as const }}>
            <FitText style={{ fontSize: 14, color: colors.textMuted }}>Loading schedule...</FitText>
          </div>
        ) : (
          hours.map((hour) => (
            <div key={hour} style={{ display: "grid", width: "100%", gridTemplateColumns: timelineColumns }}>
              <div style={{
                height: CELL_HEIGHT,
                boxSizing: "border-box",
                display: "flex",
                alignItems: "flex-start",
                justifyContent: "flex-end",
                paddingRight: 8,
                paddingTop: 6,
                borderRight: `1px solid ${colors.border}`,
                borderBottom: `1px solid ${colors.border}`
              }}>
                <FitText style={{ fontSize: 11, color: colors.textMuted, fontWeight: 600 }}>{hour}:00</FitText>
              </div>
              {weekDays.map((day, dayIdx) => {
                const ymd = toYmd(day);
                const isToday = ymd === today;
                const cellBookings = bookings.filter((b) => {
                  if (!b.date || b.date !== ymd) return false;
                  return b.startHour === hour;
                });
                return (
                  <DropCell key={dayIdx} id={`${dayIdx}:${hour}`} isToday={isToday} colors={colors}>
                    {cellBookings.map((b) => (
                      <FitButton
                        key={b.id}
                        variant="primary"
                        onClick={() => onBlockClick(b)}
                        style={{
                          position: "absolute",
                          top: 3,
                          left: 3,
                          right: 3,
                          borderRadius: 6,
                          backgroundColor: b.color ?? colors.brand,
                          border: "none",
                          padding: "4px 7px",
                          textAlign: "left",
                          zIndex: 2,
                          minHeight: 36,
                          boxShadow: "0 2px 8px rgba(0,0,0,0.2)",
                          alignItems: "flex-start"
                        }}
                      >
                        <FitText style={{ fontSize: 11, fontWeight: 700, color: bookingTextColor, display: "block", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                          {b.resourceName}
                        </FitText>
                        {b.venueLabel && (
                          <FitText style={{ fontSize: 10, color: bookingMutedTextColor, display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {b.venueLabel}
                          </FitText>
                        )}
                        <FitText style={{ fontSize: 10, color: bookingMutedTextColor, display: "block" }}>
                          {b.durationMin}min
                        </FitText>
                      </FitButton>
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
