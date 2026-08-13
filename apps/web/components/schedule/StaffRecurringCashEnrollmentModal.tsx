"use client";

import { useEffect, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { FitButton, FitSelect, FitText, FitTextInput } from "@/components/fit";
import { FitModal } from "@/components/modals";
import {
  getDefaultDateInput,
  type SelectOption,
} from "@/components/schedule/GymOperationsOverlayShared";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { createClientIdempotencyKey } from "@/lib/commerce-checkout";
import { webApiClient } from "@/lib/api-client";
import { createRecurringCoachingCashEnrollmentMutationOptions } from "@fittrack/query";

type StaffRecurringCashEnrollmentModalProps = {
  coachOptions: SelectOption[];
  isOpen: boolean;
  memberOptions: SelectOption[];
  onClose: () => void;
};

function getErrorMessage(error: unknown) {
  return error instanceof Error && error.message.trim()
    ? error.message
    : "The recurring enrollment could not be recorded.";
}

export default function StaffRecurringCashEnrollmentModal({
  coachOptions,
  isOpen,
  memberOptions,
  onClose,
}: StaffRecurringCashEnrollmentModalProps) {
  const { user } = useAuth();
  const { colors } = useTheme();
  const queryClient = useQueryClient();
  const canManage = user?.role === "ADMIN" || user?.role === "STAFF";
  const [coachId, setCoachId] = useState("");
  const [memberId, setMemberId] = useState("");
  const [startDate, setStartDate] = useState(getDefaultDateInput());
  const [referenceNo, setReferenceNo] = useState("");
  const [inlineError, setInlineError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const idempotencyKeyRef = useRef<string | null>(null);
  const enrollmentMutation = useMutation(
    createRecurringCoachingCashEnrollmentMutationOptions(
      webApiClient,
      queryClient,
    ),
  );

  useEffect(() => {
    if (!isOpen) return;
    setCoachId("");
    setMemberId("");
    setStartDate(getDefaultDateInput());
    setReferenceNo("");
    setInlineError(null);
    setSuccessMessage(null);
    idempotencyKeyRef.current = createClientIdempotencyKey();
  }, [isOpen]);

  if (!canManage) return null;

  const isBusy = enrollmentMutation.isPending;
  const patchField = (update: () => void) => {
    setInlineError(null);
    setSuccessMessage(null);
    update();
  };

  const handleSubmit = async () => {
    if (!coachId || !memberId || !startDate || !referenceNo.trim()) {
      setInlineError(
        "Choose a coach, choose a member, set the start date, and enter the cash reference.",
      );
      return;
    }

    setInlineError(null);
    setSuccessMessage(null);
    const idempotencyKey =
      idempotencyKeyRef.current ?? createClientIdempotencyKey();
    idempotencyKeyRef.current = idempotencyKey;

    try {
      await enrollmentMutation.mutateAsync({
        coachId,
        idempotencyKey,
        memberId,
        referenceNo: referenceNo.trim(),
        startDate,
      });
      setSuccessMessage(
        "Full cash payment recorded. The recurring plan is now enrolled.",
      );
    } catch (error) {
      setInlineError(getErrorMessage(error));
    }
  };

  return (
    <FitModal
      isOpen={isOpen}
      onClose={() => {
        if (!isBusy) onClose();
      }}
      closeDisabled={isBusy}
      title="Staff recurring cash enrollment"
      subtitle="Record the full cash payment and start the recurring coaching plan."
      maxWidth={620}
      overlayStyle={{ padding: 20 }}
      containerStyle={{
        width: "min(620px, calc(100vw - 40px))",
        maxWidth: "calc(100vw - 40px)",
        maxHeight: "calc(100vh - 40px)",
        borderRadius: 8,
      }}
      contentStyle={{
        display: "grid",
        gap: 14,
        maxHeight: "calc(100vh - 172px)",
        overflowY: "auto",
        padding: 18,
      }}
      footer={
        <>
          <FitButton
            variant="ghost"
            label="CANCEL"
            onClick={onClose}
            disabled={isBusy}
            style={{ minHeight: 38, borderRadius: 8, padding: "8px 14px" }}
            textStyle={{ fontSize: 11, fontWeight: 800 }}
          />
          <FitButton
            variant="primary"
            label={isBusy ? "RECORDING..." : "RECORD FULL CASH"}
            onClick={() => void handleSubmit()}
            disabled={isBusy || Boolean(successMessage)}
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
          gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 240px), 1fr))",
          gap: 12,
          minWidth: 0,
        }}
      >
        <label style={{ display: "grid", gap: 6, minWidth: 0 }}>
          <FitText as="span" style={{ fontSize: 10, fontWeight: 800, color: colors.textMuted }}>
            Coach
          </FitText>
          <FitSelect
            value={coachId}
            onChange={(event) => patchField(() => setCoachId(event.target.value))}
            options={coachOptions}
            placeholder="Choose coach"
            compact
            fullWidth
            disabled={isBusy || coachOptions.length === 0}
          />
        </label>
        <label style={{ display: "grid", gap: 6, minWidth: 0 }}>
          <FitText as="span" style={{ fontSize: 10, fontWeight: 800, color: colors.textMuted }}>
            Member
          </FitText>
          <FitSelect
            value={memberId}
            onChange={(event) => patchField(() => setMemberId(event.target.value))}
            options={memberOptions}
            placeholder="Choose member"
            compact
            fullWidth
            disabled={isBusy || memberOptions.length === 0}
          />
        </label>
        <label style={{ display: "grid", gap: 6, minWidth: 0 }}>
          <FitText as="span" style={{ fontSize: 10, fontWeight: 800, color: colors.textMuted }}>
            Start date
          </FitText>
          <FitTextInput
            type="date"
            value={startDate}
            min={getDefaultDateInput()}
            onChange={(event) => patchField(() => setStartDate(event.target.value))}
            disabled={isBusy}
            style={{ minHeight: 36, width: "100%", boxSizing: "border-box" }}
          />
        </label>
        <label style={{ display: "grid", gap: 6, minWidth: 0 }}>
          <FitText as="span" style={{ fontSize: 10, fontWeight: 800, color: colors.textMuted }}>
            Cash reference
          </FitText>
          <FitTextInput
            type="text"
            value={referenceNo}
            placeholder="Receipt or reference number"
            onChange={(event) => patchField(() => setReferenceNo(event.target.value))}
            disabled={isBusy}
            style={{ minHeight: 36, width: "100%", boxSizing: "border-box" }}
          />
        </label>
      </div>
      {inlineError ? (
        <FitText
          role="alert"
          style={{
            color: colors.danger,
            fontSize: 11,
            lineHeight: 1.4,
            padding: "8px 10px",
            borderRadius: 7,
            backgroundColor: `${colors.danger}10`,
            border: `1px solid ${colors.danger}35`,
          }}
        >
          {inlineError}
        </FitText>
      ) : null}
      {successMessage ? (
        <FitText
          role="status"
          style={{
            color: colors.success,
            fontSize: 11,
            lineHeight: 1.4,
            padding: "8px 10px",
            borderRadius: 7,
            backgroundColor: `${colors.success}10`,
            border: `1px solid ${colors.success}35`,
          }}
        >
          {successMessage}
        </FitText>
      ) : null}
    </FitModal>
  );
}
