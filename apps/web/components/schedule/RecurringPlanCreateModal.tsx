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
  monthlyOffer: {
    description: string | null;
    durationMinutes: number;
    isConfigured: boolean;
    rate: number;
    sessionCount: number;
  };
  onClose: () => void;
  onConfirm: (skipConflicts: boolean) => void;
  onPreview: () => void;
  onRepeatLastSchedule: () => void;
  onResetPreview: () => void;
  preview: RecurringCoachingPlanPreviewResult | null;
  repeatablePlan: RecurringCoachingPlanRecord | null;
  scheduleIssue: string | null;
  setForm: Dispatch<SetStateAction<RecurringPlanFormState>>;
  trainingPlanOptions: SelectOption[];
  trainingPlansLoading: boolean;
};

export function RecurringPlanCreateModal({
  coachOptions,
  form,
  inputInvalid,
  isBusy,
  isCreatePending,
  isOpen,
  memberOptions,
  monthlyOffer,
  onClose,
  onConfirm,
  onPreview,
  onRepeatLastSchedule,
  onResetPreview,
  preview,
  repeatablePlan,
  scheduleIssue,
  setForm,
  trainingPlanOptions,
  trainingPlansLoading,
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
      title="Monthly coaching plan"
      subtitle="Set the exact month, attach the coach workout split, then preview conflicts."
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
          gridTemplateColumns:
            "repeat(auto-fit, minmax(min(100%, 320px), 1fr))",
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
              onChange={(event) =>
                patchForm({
                  memberId: event.target.value,
                  scheduleItems: [],
                  trainingPlanId: "",
                })
              }
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
              disabled
            />
          </div>
          <div style={{ display: "grid", gap: 6 }}>
            <FitText excludeGlobalScale style={controlLabelStyle}>
              Coach Workout Plan
            </FitText>
            <FitSelect
              value={form.trainingPlanId}
              onChange={(event) =>
                patchForm({ trainingPlanId: event.target.value })
              }
              options={trainingPlanOptions}
              placeholder={
                trainingPlansLoading
                  ? "Loading coach plans..."
                  : "Choose the client workout plan"
              }
              compact
              fullWidth
              disabled={trainingPlansLoading || !form.memberId}
            />
            {!trainingPlansLoading &&
            form.memberId &&
            trainingPlanOptions.length === 0 ? (
              <FitText
                excludeGlobalScale
                style={{ fontSize: 11, color: colors.danger }}
              >
                Assign a coach workout plan to this client before creating the
                month.
              </FitText>
            ) : null}
          </div>
          <div
            style={{
              display: "grid",
              gap: 5,
              borderTop: `1px solid ${colors.border}`,
              paddingTop: 10,
            }}
          >
            <FitText excludeGlobalScale style={controlLabelStyle}>
              Active Monthly Offer
            </FitText>
            <FitText
              excludeGlobalScale
              style={{
                fontSize: 13,
                color: colors.textPrimary,
                fontWeight: 800,
              }}
            >
              {monthlyOffer.isConfigured
                ? `PHP ${monthlyOffer.rate.toLocaleString("en-PH")} · ${monthlyOffer.sessionCount} sessions · ${monthlyOffer.durationMinutes} min each`
                : "Monthly offer is not configured"}
            </FitText>
            <FitText
              excludeGlobalScale
              style={{ fontSize: 11, color: colors.textMuted }}
            >
              {monthlyOffer.description ||
                "Admin or staff must configure this coach offer first."}
            </FitText>
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
                readOnly
                aria-readonly="true"
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
                onChange={(event) =>
                  patchForm({ preferredTime: event.target.value })
                }
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
              value={form.durationMinutes}
              readOnly
              aria-readonly="true"
              style={fieldStyle}
            />
          </div>
          <div style={{ display: "grid", gap: 6 }}>
            <FitText excludeGlobalScale style={controlLabelStyle}>
              Fixed Full Quote (PHP)
            </FitText>
            <input
              type="number"
              value={form.quotedAmount || ""}
              readOnly
              aria-readonly="true"
              style={fieldStyle}
            />
            <FitText
              excludeGlobalScale
              style={{ fontSize: 11, color: colors.textMuted }}
            >
              The member pays this quote in full through PayMongo. It is not a
              credit balance.
            </FitText>
          </div>
          <div
            style={{
              display: "grid",
              gap: 8,
              borderTop: `1px solid ${colors.border}`,
              paddingTop: 12,
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: 10,
                alignItems: "center",
              }}
            >
              <FitText excludeGlobalScale style={controlLabelStyle}>
                Actual Session Dates (max 5 per gym week)
              </FitText>
              <div
                style={{
                  display: "flex",
                  gap: 8,
                  flexWrap: "wrap",
                  justifyContent: "flex-end",
                }}
              >
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
                  disabled={
                    !monthlyOffer.isConfigured ||
                    form.scheduleItems.length >= monthlyOffer.sessionCount
                  }
                  style={{ minHeight: 30, padding: "5px 9px", borderRadius: 8 }}
                  textStyle={{ fontSize: 10, fontWeight: 800 }}
                />
              </div>
            </div>
            <FitText
              excludeGlobalScale
              style={{ fontSize: 11, color: colors.textMuted }}
            >
              {repeatablePlan
                ? "Repeat copies the latest monthly dates one month forward as an editable prefill. Review it before fresh approval and payment."
                : "Select a member with a previous monthly plan to enable repeat-last-schedule."}
            </FitText>
            {form.scheduleItems.length === 0 ? (
              <FitText
                excludeGlobalScale
                style={{ fontSize: 11, color: colors.warning }}
              >
                Add every actual appointment date and time. No appointment rows
                are created until payment succeeds.
              </FitText>
            ) : null}
            {scheduleIssue && form.scheduleItems.length > 0 ? (
              <FitText
                excludeGlobalScale
                style={{ fontSize: 11, color: colors.danger }}
              >
                {scheduleIssue}
              </FitText>
            ) : null}
            {form.scheduleItems.map((item, index) => (
              <div
                key={`${index}-${item.date}-${item.time}`}
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr 92px auto",
                  gap: 8,
                  alignItems: "end",
                }}
              >
                <div style={{ display: "grid", gap: 4 }}>
                  <FitText
                    excludeGlobalScale
                    style={{ fontSize: 10, color: colors.textMuted }}
                  >
                    DATE {index + 1}
                  </FitText>
                  <input
                    type="date"
                    min={minStartDate}
                    value={item.date}
                    onChange={(event) =>
                      patchForm({
                        ...(index === 0
                          ? { startDate: event.target.value }
                          : {}),
                        scheduleItems: form.scheduleItems.map(
                          (current, currentIndex) =>
                            currentIndex === index
                              ? { ...current, date: event.target.value }
                              : current,
                        ),
                      })
                    }
                    style={fieldStyle}
                  />
                </div>
                <div style={{ display: "grid", gap: 4 }}>
                  <FitText
                    excludeGlobalScale
                    style={{ fontSize: 10, color: colors.textMuted }}
                  >
                    TIME
                  </FitText>
                  <input
                    type="time"
                    value={item.time}
                    onChange={(event) =>
                      patchForm({
                        scheduleItems: form.scheduleItems.map(
                          (current, currentIndex) =>
                            currentIndex === index
                              ? { ...current, time: event.target.value }
                              : current,
                        ),
                      })
                    }
                    style={fieldStyle}
                  />
                </div>
                <div style={{ display: "grid", gap: 4 }}>
                  <FitText
                    excludeGlobalScale
                    style={{ fontSize: 10, color: colors.textMuted }}
                  >
                    MIN
                  </FitText>
                  <input
                    type="number"
                    value={item.durationMinutes}
                    readOnly
                    aria-readonly="true"
                    style={fieldStyle}
                  />
                </div>
                <FitButton
                  variant="ghost"
                  label="REMOVE"
                  onClick={() =>
                    patchForm({
                      scheduleItems: form.scheduleItems.filter(
                        (_, currentIndex) => currentIndex !== index,
                      ),
                    })
                  }
                  style={{ minHeight: 42, padding: "8px 9px", borderRadius: 8 }}
                  textStyle={{
                    fontSize: 10,
                    fontWeight: 800,
                    color: colors.danger,
                  }}
                />
              </div>
            ))}
          </div>
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
          <FitText
            excludeGlobalScale
            style={{ fontSize: 12, color: colors.textMuted }}
          >
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
                  <FitText
                    excludeGlobalScale
                    style={{ fontSize: 11, color: colors.textMuted }}
                  >
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
              Fill the plan details and generate a preview. No rows are written
              until you confirm.
            </FitText>
          )}
        </div>
        {preview?.venueConflictsChecked === false ? (
          <FitText
            excludeGlobalScale
            style={{ fontSize: 11, color: colors.warning }}
          >
            Venue conflicts: {preview.venueConflictsNote}
          </FitText>
        ) : null}
      </div>
    </FitModal>
  );
}
