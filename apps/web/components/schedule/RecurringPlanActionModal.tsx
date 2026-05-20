"use client";

import { useMemo } from "react";

import { FitButton, FitSelect, FitText } from "@/components/fit";
import { FitModal } from "@/components/modals";
import type { SelectOption } from "@/components/schedule/GymOperationsOverlayShared";
import { useTheme } from "@/contexts/ThemeContext";

import {
  OperationsMetricCard,
  OperationsMetricGrid,
  WEEKDAY_OPTIONS,
  formatRecurringDateTime,
  type RecurringPlanActionState,
} from "./SchedulePageShared";

type Props = {
  action: RecurringPlanActionState | null;
  coachOptions: SelectOption[];
  completedCount: number;
  isBusy: boolean;
  isBulkUpdatePending: boolean;
  isCancelPending: boolean;
  isSessionUpdatePending: boolean;
  onCancelPlan: () => void;
  onClose: () => void;
  onRescheduleSession: () => void;
  onSkipSession: () => void;
  onToggleFutureDay: (day: number) => void;
  onUpdateFuture: () => void;
  remainingCount: number;
  selectedCoachId: string;
  selectedDate: string;
  selectedDays: number[];
  selectedTime: string;
  note: string;
  setNote: (value: string) => void;
  setSelectedCoachId: (value: string) => void;
  setSelectedDate: (value: string) => void;
  setSelectedTime: (value: string) => void;
};

export function RecurringPlanActionModal({
  action,
  coachOptions,
  completedCount,
  isBusy,
  isBulkUpdatePending,
  isCancelPending,
  isSessionUpdatePending,
  onCancelPlan,
  onClose,
  onRescheduleSession,
  onSkipSession,
  onToggleFutureDay,
  onUpdateFuture,
  remainingCount,
  selectedCoachId,
  selectedDate,
  selectedDays,
  selectedTime,
  note,
  setNote,
  setSelectedCoachId,
  setSelectedDate,
  setSelectedTime,
}: Props) {
  const { colors } = useTheme();
  const controlLabelStyle = useMemo(
    () => ({
      color: colors.textMuted,
      fontSize: 11,
      fontWeight: 800,
      letterSpacing: "0.08em",
      textTransform: "uppercase" as const,
    }),
    [colors.textMuted],
  );
  const fieldStyle = useMemo(
    () => ({
      backgroundColor: colors.surfaceRaised,
      border: `1px solid ${colors.border}`,
      borderRadius: 13,
      color: colors.textPrimary,
      fontSize: 13,
      fontWeight: 650,
      minHeight: 42,
      outline: "none",
      padding: "9px 11px",
      width: "100%",
    }),
    [colors.border, colors.surfaceRaised, colors.textPrimary],
  );

  if (!action) return null;

  return (
    <FitModal
      isOpen={action !== null}
      onClose={() => {
        if (!isBusy) onClose();
      }}
      closeDisabled={isBusy}
      title="Recurring plan action"
      subtitle="Apply one recurring-session change at a time."
      maxWidth={720}
      overlayStyle={{ padding: 24 }}
      containerStyle={{
        width: "min(720px, calc(100vw - 48px))",
        maxWidth: "calc(100vw - 48px)",
        maxHeight: "calc(100vh - 48px)",
        borderRadius: 8,
      }}
      contentStyle={{
        display: "grid",
        gap: 16,
        maxHeight: "calc(100vh - 180px)",
        overflowY: "auto",
        padding: 20,
      }}
      footer={
        action.mode === "single" ? (
          <>
            <FitButton
              variant="ghost"
              label={isSessionUpdatePending ? "SKIPPING..." : "SKIP SESSION"}
              onClick={onSkipSession}
              disabled={isBusy}
              style={{
                minHeight: 38,
                borderRadius: 10,
                padding: "8px 14px",
              }}
              textStyle={{
                fontSize: 11,
                fontWeight: 800,
                color: colors.warning,
              }}
            />
            <FitButton
              variant="primary"
              label={isSessionUpdatePending ? "SAVING..." : "RESCHEDULE SESSION"}
              onClick={onRescheduleSession}
              disabled={isBusy || !selectedDate || !selectedTime}
              style={{
                minHeight: 38,
                borderRadius: 8,
                padding: "8px 14px",
                backgroundColor: colors.brand,
                color: colors.onBrand,
              }}
              textStyle={{ fontSize: 11, fontWeight: 800 }}
            />
          </>
        ) : action.mode === "future" ? (
          <FitButton
            variant="primary"
            label={isBulkUpdatePending ? "UPDATING..." : "UPDATE FUTURE SESSIONS"}
            onClick={onUpdateFuture}
            disabled={isBusy || !selectedTime || selectedDays.length === 0}
            style={{
              minHeight: 38,
              borderRadius: 8,
              padding: "8px 14px",
              backgroundColor: colors.brand,
              color: colors.onBrand,
            }}
            textStyle={{ fontSize: 11, fontWeight: 800 }}
          />
        ) : (
          <FitButton
            variant="danger"
            label={isCancelPending ? "CANCELLING..." : "CANCEL PLAN"}
            onClick={onCancelPlan}
            disabled={isBusy}
            style={{
              minHeight: 38,
              borderRadius: 10,
              padding: "8px 14px",
              borderColor: colors.danger,
            }}
            textStyle={{
              fontSize: 11,
              fontWeight: 800,
              color: colors.danger,
            }}
          />
        )
      }
    >
        <div style={{ display: "grid", gap: 6 }}>
          <FitText
            excludeGlobalScale
            style={{
              fontSize: 11,
              fontWeight: 800,
              letterSpacing: "0.08em",
              color: colors.brand,
            }}
          >
            RECURRING PLAN ACTION
          </FitText>
          <FitText
            excludeGlobalScale
            style={{
              fontSize: 24,
              fontWeight: 850,
              color: colors.textPrimary,
              lineHeight: 1.12,
            }}
          >
            {action.mode === "single"
              ? "Edit this generated session only"
              : action.mode === "future"
                ? "Update this and all future sessions"
                : "Cancel this recurring coaching plan"}
          </FitText>
          <FitText
            excludeGlobalScale
            style={{
              fontSize: 13,
              color: colors.textMuted,
              lineHeight: 1.45,
            }}
          >
            Current session: {formatRecurringDateTime(action.appointment.scheduledAt)}
          </FitText>
        </div>

        {action.mode === "cancel" ? (
          <div
            style={{
              borderRadius: 18,
              border: `1px solid ${colors.border}`,
              backgroundColor: colors.surfaceRaised,
              padding: 16,
              display: "grid",
              gap: 10,
            }}
          >
            <OperationsMetricGrid columns={2}>
              <OperationsMetricCard colors={colors} label="Completed Sessions" value={completedCount} tone={colors.success} />
              <OperationsMetricCard colors={colors} label="Future Sessions" value={remainingCount} tone={colors.warning} />
            </OperationsMetricGrid>
            <FitText excludeGlobalScale style={{ fontSize: 12, color: colors.textMuted }}>
              Cancelling preserves completed sessions and cancels only future non-completed sessions.
            </FitText>
          </div>
        ) : (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: action.mode === "single" ? "1fr 1fr" : "1fr",
              gap: 12,
            }}
          >
            {action.mode === "single" ? (
              <div style={{ display: "grid", gap: 6 }}>
                <FitText excludeGlobalScale style={controlLabelStyle}>
                  New Date
                </FitText>
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(event) => setSelectedDate(event.target.value)}
                  style={fieldStyle}
                />
              </div>
            ) : null}
            <div style={{ display: "grid", gap: 6 }}>
              <FitText excludeGlobalScale style={controlLabelStyle}>
                New Time
              </FitText>
              <input
                type="time"
                value={selectedTime}
                onChange={(event) => setSelectedTime(event.target.value)}
                style={fieldStyle}
              />
            </div>
            <div style={{ display: "grid", gap: 6 }}>
              <FitText excludeGlobalScale style={controlLabelStyle}>
                Coach
              </FitText>
              <FitSelect
                value={selectedCoachId}
                onChange={(event) => setSelectedCoachId(event.target.value)}
                options={coachOptions}
                compact
                fullWidth
              />
            </div>
            {action.mode === "future" ? (
              <div style={{ display: "grid", gap: 8 }}>
                <FitText excludeGlobalScale style={controlLabelStyle}>
                  Future Weekdays
                </FitText>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {WEEKDAY_OPTIONS.map((day) => {
                    const active = selectedDays.includes(day.value);
                    return (
                      <FitButton
                        key={day.value}
                        variant={active ? "primary" : "ghost"}
                        label={day.label}
                        onClick={() => onToggleFutureDay(day.value)}
                        style={{
                          minHeight: 34,
                          minWidth: 48,
                          borderRadius: 12,
                          padding: "7px 10px",
                        }}
                        textStyle={{ fontSize: 11, fontWeight: 800 }}
                      />
                    );
                  })}
                </div>
                <FitText excludeGlobalScale style={{ fontSize: 12, color: colors.textMuted }}>
                  Affects {remainingCount || "the remaining"} future session(s), starting from the selected appointment.
                </FitText>
              </div>
            ) : null}
          </div>
        )}

        <div style={{ display: "grid", gap: 6 }}>
          <FitText excludeGlobalScale style={controlLabelStyle}>
            Reason / Notes
          </FitText>
          <textarea
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder="Optional audit note..."
            rows={3}
            style={{
              ...fieldStyle,
              resize: "vertical",
              lineHeight: 1.45,
            }}
          />
        </div>

    </FitModal>
  );
}
