"use client";

import type { Dispatch, SetStateAction } from "react";
import { useMemo } from "react";
import type {
  RecurringCoachingPlanPreviewResult,
  RecurringCoachingPlanRecord,
} from "@fittrack/api-client";

import { FitButton, FitPill, FitSelect, FitText } from "@/components/fit";
import { FitModal } from "@/components/modals";
import {
  getDefaultDateInput,
  type SelectOption,
} from "@/components/schedule/GymOperationsOverlayShared";
import { useTheme } from "@/contexts/ThemeContext";

import {
  RECURRING_DURATION_OPTIONS,
  RECURRING_FREQUENCY_OPTIONS,
  WEEKDAY_OPTIONS,
  formatRecurringDateTime,
  type RecurringPlanFormState,
} from "./SchedulePageShared";

type Props = {
  coachOptions: SelectOption[];
  form: RecurringPlanFormState;
  inputInvalid: boolean;
  isBusy: boolean;
  isCreatePending: boolean;
  isOpen: boolean;
  memberOptions: SelectOption[];
  onClose: () => void;
  onConfirm: (skipConflicts: boolean) => void;
  onPreview: () => void;
  onRepeatLastSchedule: () => void;
  onResetPreview: () => void;
  onToggleDay: (day: number) => void;
  preview: RecurringCoachingPlanPreviewResult | null;
  repeatablePlan: RecurringCoachingPlanRecord | null;
  setForm: Dispatch<SetStateAction<RecurringPlanFormState>>;
};

export function RecurringPlanCreateModal({
  coachOptions,
  form,
  inputInvalid,
  isBusy,
  isCreatePending,
  isOpen,
  memberOptions,
  onClose,
  onConfirm,
  onPreview,
  onRepeatLastSchedule,
  onResetPreview,
  onToggleDay,
  preview,
  repeatablePlan,
  setForm,
}: Props) {
  const { colors } = useTheme();
  const minStartDate = getDefaultDateInput();
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
      width: "100%",
      minHeight: 42,
      borderRadius: 13,
      border: `1px solid ${colors.border}`,
      backgroundColor: colors.surfaceRaised,
      color: colors.textPrimary,
      padding: "9px 11px",
      fontSize: 13,
      fontWeight: 650,
      outline: "none",
    }),
    [colors.border, colors.surfaceRaised, colors.textPrimary],
  );

  const patchForm = (patch: Partial<RecurringPlanFormState>) => {
    onResetPreview();
    setForm((current) => ({ ...current, ...patch }));
  };

  return (
    <FitModal
      isOpen={isOpen}
      onClose={() => {
        if (!isBusy) onClose();
      }}
      closeDisabled={isBusy}
      title="Recurring coaching plan"
      subtitle="Preview generated coaching sessions before saving."
      maxWidth={920}
      overlayStyle={{ padding: 24 }}
      containerStyle={{
        width: "min(920px, calc(100vw - 48px))",
        maxWidth: "calc(100vw - 48px)",
        maxHeight: "calc(100vh - 48px)",
        borderRadius: 8,
      }}
      contentStyle={{
        display: "grid",
        gap: 14,
        maxHeight: "calc(100vh - 180px)",
        overflowY: "auto",
        padding: 20,
      }}
      footer={
        <>
          <FitButton
            variant="ghost"
            label={isBusy ? "PREVIEWING..." : "PREVIEW SCHEDULE"}
            onClick={onPreview}
            disabled={isBusy || inputInvalid}
            style={{
              minHeight: 38,
              borderRadius: 10,
              padding: "8px 14px",
            }}
            textStyle={{ fontSize: 11, fontWeight: 800 }}
          />
          {preview?.conflictCount ? (
            <FitButton
              variant="ghost"
              label="CONFIRM + SKIP CONFLICTS"
              onClick={() => onConfirm(true)}
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
          ) : null}
          <FitButton
            variant="primary"
            label={isCreatePending ? "CREATING..." : "CONFIRM PLAN"}
            onClick={() => onConfirm(false)}
            disabled={isBusy || !preview || preview.conflictCount > 0}
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
      }
    >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)",
            gap: 16,
          }}
        >
          <div style={{ display: "grid", gap: 12 }}>
            <div style={{ display: "grid", gap: 6 }}>
              <FitText excludeGlobalScale style={controlLabelStyle}>
                Member
              </FitText>
              <FitSelect
                value={form.memberId}
                onChange={(event) => patchForm({ memberId: event.target.value })}
                options={memberOptions}
                placeholder="Choose member"
                compact
                fullWidth
              />
            </div>
            <div style={{ display: "grid", gap: 6 }}>
              <FitText excludeGlobalScale style={controlLabelStyle}>
                Coach
              </FitText>
              <FitSelect
                value={form.coachId}
                onChange={(event) => patchForm({ coachId: event.target.value })}
                options={coachOptions}
                placeholder="Choose coach"
                compact
                fullWidth
              />
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 10,
              }}
            >
              <div style={{ display: "grid", gap: 6 }}>
                <FitText excludeGlobalScale style={controlLabelStyle}>
                  Frequency
                </FitText>
                <FitSelect
                  value={form.frequency}
                  onChange={(event) =>
                    patchForm({
                      frequency: event.target.value as RecurringPlanFormState["frequency"],
                      ...(event.target.value === "monthly" ? { durationMonths: 1 } : {}),
                    })
                  }
                  options={RECURRING_FREQUENCY_OPTIONS}
                  compact
                  fullWidth
                />
              </div>
              <div style={{ display: "grid", gap: 6 }}>
                <FitText excludeGlobalScale style={controlLabelStyle}>
                  Duration
                </FitText>
                <FitSelect
                  value={String(form.durationMonths)}
                  onChange={(event) => patchForm({ durationMonths: Number(event.target.value) || 3 })}
                  options={RECURRING_DURATION_OPTIONS}
                  compact
                  fullWidth
                />
              </div>
            </div>
          </div>

          <div style={{ display: "grid", gap: 12 }}>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 10,
              }}
            >
              <div style={{ display: "grid", gap: 6 }}>
                <FitText excludeGlobalScale style={controlLabelStyle}>
                  Start Date
                </FitText>
                <input
                  type="date"
                  min={minStartDate}
                  value={form.startDate}
                  onChange={(event) => patchForm({ startDate: event.target.value })}
                  style={fieldStyle}
                />
              </div>
              <div style={{ display: "grid", gap: 6 }}>
                <FitText excludeGlobalScale style={controlLabelStyle}>
                  Preferred Time
                </FitText>
                <input
                  type="time"
                  value={form.preferredTime}
                  onChange={(event) => patchForm({ preferredTime: event.target.value })}
                  style={fieldStyle}
                />
              </div>
            </div>
            <div style={{ display: "grid", gap: 6 }}>
              <FitText excludeGlobalScale style={controlLabelStyle}>
                Session Duration
              </FitText>
              <input
                type="number"
                min={30}
                max={180}
                step={15}
                value={form.durationMinutes}
                onChange={(event) => patchForm({ durationMinutes: Number(event.target.value) || 60 })}
                style={fieldStyle}
              />
            </div>
            <div style={{ display: "grid", gap: 6 }}>
              <FitText excludeGlobalScale style={controlLabelStyle}>
                Fixed Full Quote (PHP)
              </FitText>
              <input
                type="number"
                min={0}
                step={0.01}
                value={form.quotedAmount || ""}
                onChange={(event) =>
                  patchForm({ quotedAmount: Number(event.target.value) || 0 })
                }
                style={fieldStyle}
              />
              <FitText excludeGlobalScale style={{ fontSize: 11, color: colors.textMuted }}>
                The member pays this quote in full through PayMongo. It is not a credit balance.
              </FitText>
            </div>
            {form.frequency === "monthly" ? (
              <div
                style={{
                  display: "grid",
                  gap: 8,
                  borderTop: `1px solid ${colors.border}`,
                  paddingTop: 12,
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
                  <FitText excludeGlobalScale style={controlLabelStyle}>
                    Actual Session Dates (max 5 per gym week)
                  </FitText>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
                    <FitButton
                      variant="ghost"
                      label="REPEAT LAST SCHEDULE"
                      onClick={onRepeatLastSchedule}
                      disabled={!repeatablePlan || isBusy}
                      style={{ minHeight: 30, padding: "5px 9px", borderRadius: 8 }}
                      textStyle={{ fontSize: 10, fontWeight: 800 }}
                    />
                    <FitButton
                      variant="ghost"
                      label="ADD SESSION"
                      onClick={() =>
                        patchForm({
                          scheduleItems: [
                            ...form.scheduleItems,
                            {
                              date: form.startDate,
                              time: form.preferredTime,
                              durationMinutes: form.durationMinutes,
                            },
                          ],
                        })
                      }
                      disabled={form.scheduleItems.length >= 60}
                      style={{ minHeight: 30, padding: "5px 9px", borderRadius: 8 }}
                      textStyle={{ fontSize: 10, fontWeight: 800 }}
                    />
                  </div>
                </div>
                <FitText excludeGlobalScale style={{ fontSize: 11, color: colors.textMuted }}>
                  {repeatablePlan
                    ? "Repeat copies the latest monthly dates one month forward as an editable prefill. Review it before fresh approval and payment."
                    : "Select a member with a previous monthly plan to enable repeat-last-schedule."}
                </FitText>
                {form.scheduleItems.length === 0 ? (
                  <FitText excludeGlobalScale style={{ fontSize: 11, color: colors.warning }}>
                    Add every actual appointment date and time. No appointment rows are created until payment succeeds.
                  </FitText>
                ) : null}
                {form.scheduleItems.map((item, index) => (
                  <div
                    key={`${index}-${item.date}-${item.time}`}
                    style={{ display: "grid", gridTemplateColumns: "1fr 1fr 92px auto", gap: 8, alignItems: "end" }}
                  >
                    <div style={{ display: "grid", gap: 4 }}>
                      <FitText excludeGlobalScale style={{ fontSize: 10, color: colors.textMuted }}>DATE {index + 1}</FitText>
                      <input
                        type="date"
                        min={minStartDate}
                        value={item.date}
                        onChange={(event) =>
                          patchForm({
                            scheduleItems: form.scheduleItems.map((current, currentIndex) =>
                              currentIndex === index ? { ...current, date: event.target.value } : current,
                            ),
                          })
                        }
                        style={fieldStyle}
                      />
                    </div>
                    <div style={{ display: "grid", gap: 4 }}>
                      <FitText excludeGlobalScale style={{ fontSize: 10, color: colors.textMuted }}>TIME</FitText>
                      <input
                        type="time"
                        value={item.time}
                        onChange={(event) =>
                          patchForm({
                            scheduleItems: form.scheduleItems.map((current, currentIndex) =>
                              currentIndex === index ? { ...current, time: event.target.value } : current,
                            ),
                          })
                        }
                        style={fieldStyle}
                      />
                    </div>
                    <div style={{ display: "grid", gap: 4 }}>
                      <FitText excludeGlobalScale style={{ fontSize: 10, color: colors.textMuted }}>MIN</FitText>
                      <input
                        type="number"
                        min={30}
                        max={180}
                        step={15}
                        value={item.durationMinutes}
                        onChange={(event) =>
                          patchForm({
                            scheduleItems: form.scheduleItems.map((current, currentIndex) =>
                              currentIndex === index
                                ? { ...current, durationMinutes: Number(event.target.value) || 60 }
                                : current,
                            ),
                          })
                        }
                        style={fieldStyle}
                      />
                    </div>
                    <FitButton
                      variant="ghost"
                      label="REMOVE"
                      onClick={() =>
                        patchForm({
                          scheduleItems: form.scheduleItems.filter((_, currentIndex) => currentIndex !== index),
                        })
                      }
                      style={{ minHeight: 42, padding: "8px 9px", borderRadius: 8 }}
                      textStyle={{ fontSize: 10, fontWeight: 800, color: colors.danger }}
                    />
                  </div>
                ))}
              </div>
            ) : null}
            {form.frequency !== "monthly" ? (
              <div style={{ display: "grid", gap: 8 }}>
                <FitText excludeGlobalScale style={controlLabelStyle}>
                  Preferred Days
                </FitText>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {WEEKDAY_OPTIONS.map((day) => {
                    const active = form.preferredDays.includes(day.value);
                    return (
                      <FitButton
                        key={day.value}
                        variant={active ? "primary" : "ghost"}
                        label={day.label}
                        onClick={() => onToggleDay(day.value)}
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
              </div>
            ) : null}
          </div>
        </div>

        <div
          style={{
            display: "grid",
            gap: 10,
            borderTop: `1px solid ${colors.border}`,
            backgroundColor: "transparent",
            paddingTop: 14,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
              flexWrap: "wrap",
            }}
          >
            <FitText
              excludeGlobalScale
              style={{
                fontSize: 15,
                fontWeight: 800,
                color: colors.textPrimary,
              }}
            >
              Schedule preview
            </FitText>
            <FitText excludeGlobalScale style={{ fontSize: 12, color: colors.textMuted }}>
              {preview
                ? `${preview.totalSessions} sessions / ${preview.conflictCount} conflicts`
                : "Preview required before confirm"}
            </FitText>
          </div>
          <div
            style={{
              maxHeight: 220,
              overflowY: "auto",
              display: "grid",
              gap: 8,
            }}
          >
            {preview ? (
              preview.sessions.map((session) => (
                <div
                  key={session.scheduledAt}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "minmax(0, 1fr) auto",
                    gap: 12,
                    alignItems: "center",
                    borderTop: `1px solid ${session.conflict ? `${colors.danger}55` : colors.border}`,
                    backgroundColor: "transparent",
                    padding: "10px 0 0",
                  }}
                >
                  <div style={{ display: "grid", gap: 3 }}>
                    <FitText
                      excludeGlobalScale
                      style={{
                        fontSize: 13,
                        fontWeight: 750,
                        color: colors.textPrimary,
                      }}
                    >
                      {formatRecurringDateTime(session.scheduledAt)}
                    </FitText>
                    <FitText excludeGlobalScale style={{ fontSize: 11, color: colors.textMuted }}>
                      {session.conflict
                        ? session.conflictReasons.join(" / ")
                        : "Coach availability and appointment conflict check passed."}
                    </FitText>
                  </div>
                  <FitPill
                    mode="status"
                    label={session.conflict ? "CONFLICT" : "CLEAR"}
                    color={session.conflict ? colors.danger : colors.success}
                    fontSize={9}
                    fontWeight={800}
                    borderOpacity="28"
                    bgOpacity="12"
                  />
                </div>
              ))
            ) : (
              <FitText
                excludeGlobalScale
                style={{
                  fontSize: 13,
                  color: colors.textMuted,
                  padding: "8px 0",
                }}
              >
                Fill the plan details and generate a preview. No rows are written until you confirm.
              </FitText>
            )}
          </div>
          {preview?.venueConflictsChecked === false ? (
            <FitText excludeGlobalScale style={{ fontSize: 11, color: colors.warning }}>
              Venue conflicts: {preview.venueConflictsNote}
            </FitText>
          ) : null}
        </div>

    </FitModal>
  );
}
