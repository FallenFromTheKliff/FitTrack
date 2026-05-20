"use client";
import { useEffect, useMemo, useState } from "react";

import { FitButton, FitText, FitTextArea } from "@/components/fit";
import FitModal from "@/components/modals/FitModal";
import { useTheme } from "@/contexts/ThemeContext";

type ActionMode = "cancel" | "complete" | "reject";

type Props = {
  appointmentLabel: string;
  initialValue?: string;
  isOpen: boolean;
  isSubmitting?: boolean;
  mode: ActionMode;
  onClose: () => void;
  onSubmit: (value: string) => Promise<void> | void;
};

const COPY: Record<
  ActionMode,
  {
    actionLabel: string;
    buttonLabel: string;
    description: string;
    fieldLabel: string;
    placeholder: string;
    required: boolean;
    title: string;
    variant: "danger" | "primary";
  }
> = {
  reject: {
    title: "Reject Appointment",
    actionLabel: "REJECTING...",
    buttonLabel: "REJECT APPOINTMENT",
    description:
      "Tell the member why this appointment cannot proceed so staff and coaching records stay aligned.",
    fieldLabel: "Rejection Reason",
    placeholder: "Explain why the requested slot is being declined.",
    required: true,
    variant: "danger",
  },
  cancel: {
    title: "Cancel Appointment",
    actionLabel: "CANCELLING...",
    buttonLabel: "CANCEL APPOINTMENT",
    description:
      "Use this when staff needs to cancel an already tracked appointment. Paid downpayments remain non-refundable.",
    fieldLabel: "Cancellation Reason",
    placeholder: "Explain why this appointment is being cancelled.",
    required: true,
    variant: "danger",
  },
  complete: {
    title: "Complete Appointment",
    actionLabel: "COMPLETING...",
    buttonLabel: "MARK COMPLETE",
    description:
      "Optionally record a short session summary so the member and coach history stays readable later.",
    fieldLabel: "Session Notes",
    placeholder: "Optional summary of what happened in the session.",
    required: false,
    variant: "primary",
  },
};

export default function CoachAppointmentActionModal({
  appointmentLabel,
  initialValue = "",
  isOpen,
  isSubmitting = false,
  mode,
  onClose,
  onSubmit,
}: Props) {
  const { colors } = useTheme();
  const [value, setValue] = useState(initialValue);
  const copy = useMemo(() => COPY[mode], [mode]);

  useEffect(() => {
    if (!isOpen) return;
    setValue(initialValue);
  }, [initialValue, isOpen, mode]);

  const isDisabled = isSubmitting || (copy.required && !value.trim());

  return (
    <FitModal
      isOpen={isOpen}
      onClose={onClose}
      title={copy.title}
      subtitle={appointmentLabel}
      maxWidth={560}
      closeDisabled={isSubmitting}
      closeAriaLabel="Close appointment action modal"
      footer={
        <FitButton
          variant={copy.variant}
          label={isSubmitting ? copy.actionLabel : copy.buttonLabel}
          onClick={() => void onSubmit(value.trim())}
          disabled={isDisabled}
          style={{ flex: 1 }}
        />
      }
    >
      <div style={{ display: "grid", gap: 14 }}>
        <FitText style={{ fontSize: 14, color: colors.textMuted }}>
          {copy.description}
        </FitText>
        <div style={{ display: "grid", gap: 8 }}>
          <FitText style={{ fontSize: 12, fontWeight: 700, color: colors.textMuted }}>
            {copy.fieldLabel}
          </FitText>
          <FitTextArea
            value={value}
            onChange={(event) => setValue(event.target.value)}
            placeholder={copy.placeholder}
            rows={5}
            disabled={isSubmitting}
          />
        </div>
      </div>
    </FitModal>
  );
}
