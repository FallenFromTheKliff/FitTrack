import { useMemo } from "react";
import { Clock3 } from "lucide-react-native";
import { View, StyleSheet } from "react-native";

import type { CommerceCheckoutAttempt } from "@fittrack/api-client";
import type { ThemeColors } from "@fittrack/types";
import { R } from "@fittrack/ui/tokens";

import { useTheme } from "@/contexts/ThemeContext";
import { FitButton, FitText } from "@/components/fit";
import type { CheckoutRecoveryOperation } from "@/hooks/commerce/useCommerceCheckoutReturn";
import { formatCommerceCheckoutCountdown } from "@/hooks/commerce/checkoutRecovery";

export type CheckoutRecoveryProps = {
  attempt: CommerceCheckoutAttempt;
  errorMessage: string | null;
  isBusy: boolean;
  onCancel: () => void;
  onCheckStatus: () => void;
  onResume: () => void;
  operation: CheckoutRecoveryOperation;
  remainingSeconds: number | null;
};

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    panel: {
      borderRadius: R.lg,
      borderWidth: 1,
      borderColor: colors.brand + "66",
      backgroundColor: colors.brand + "10",
      padding: 14,
      gap: 8,
    },
    eyebrow: {
      color: colors.brand,
      fontSize: 11,
      fontWeight: "700",
      letterSpacing: 0.7,
    },
    body: {
      color: colors.textSecondary,
      fontSize: 12,
      lineHeight: 18,
    },
    deadlineRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      minHeight: 24,
    },
    deadline: {
      color: colors.textPrimary,
      fontSize: 12,
      fontWeight: "700",
    },
    operation: {
      color: colors.textMuted,
      fontSize: 12,
      lineHeight: 18,
    },
    error: {
      color: colors.danger,
      fontSize: 12,
      lineHeight: 18,
    },
    actions: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 8,
      marginTop: 4,
    },
    action: {
      flexGrow: 1,
      flexBasis: 132,
      minWidth: 132,
      minHeight: 44,
    },
  });
}

function getOperationLabel(operation: CheckoutRecoveryOperation) {
  return operation === "cancelling"
    ? "Cancelling this payment…"
    : null;
}

type RecoveryContentProps = Pick<
  CheckoutRecoveryProps,
  "attempt" | "errorMessage" | "operation" | "remainingSeconds"
>;

export function CheckoutRecoveryContent({
  attempt,
  errorMessage,
  operation,
  remainingSeconds,
}: RecoveryContentProps) {
  const { colors } = useTheme();
  const s = useMemo(() => makeStyles(colors), [colors]);
  const atDeadline = remainingSeconds === 0;
  const operationLabel = getOperationLabel(operation);

  return (
    <View testID="checkout-recovery-copy">
      <FitText style={s.body}>
        {atDeadline
          ? "The payment window has ended. FitTrack is checking the result before you can start another booking."
          : "This payment is still being confirmed. Resume the same checkout or keep browsing while FitTrack checks the result."}
      </FitText>
      <View style={s.deadlineRow}>
        <Clock3 size={16} color={colors.brand} strokeWidth={2} />
        <FitText style={s.deadline}>
          {atDeadline
            ? "Payment window ended"
            : `Time left ${formatCommerceCheckoutCountdown(remainingSeconds)}`}
        </FitText>
      </View>
      {operationLabel ? <FitText style={s.operation}>{operationLabel}</FitText> : null}
      {errorMessage ? (
        <FitText accessibilityRole="alert" style={s.error}>
          {errorMessage}
        </FitText>
      ) : null}
      {!attempt.holdId ? (
        <FitText accessibilityRole="alert" style={s.error}>
          This payment cannot be recovered right now. Please try again later.
        </FitText>
      ) : null}
    </View>
  );
}

type RecoveryActionsProps = Pick<
  CheckoutRecoveryProps,
  "attempt" | "errorMessage" | "isBusy" | "onCancel" | "onCheckStatus" | "onResume"
>;

export function CheckoutRecoveryActions({
  attempt,
  errorMessage,
  isBusy,
  onCancel,
  onCheckStatus,
  onResume,
}: RecoveryActionsProps) {
  const { colors } = useTheme();
  const s = useMemo(() => makeStyles(colors), [colors]);
  const hasCheckoutUrl = Boolean(attempt.checkoutUrl?.trim());

  return (
    <View style={s.actions} testID="checkout-recovery-actions">
      <FitButton
        label="Resume payment"
        variant="primary"
        onPress={onResume}
        disabled={isBusy || !hasCheckoutUrl}
        accessibilityLabel="Resume payment"
        style={s.action}
      />
      <FitButton
        label="Cancel checkout"
        variant="danger"
        onPress={onCancel}
        disabled={isBusy}
        accessibilityLabel="Cancel checkout"
        style={s.action}
      />
      <FitButton
        label={errorMessage ? "Retry status" : "Check status"}
        variant="ghost"
        onPress={onCheckStatus}
        disabled={isBusy}
        accessibilityLabel={errorMessage ? "Retry status" : "Check status"}
        style={s.action}
      />
    </View>
  );
}

export default function CheckoutRecoveryPanel({
  attempt,
  errorMessage,
  isBusy,
  onCancel,
  onCheckStatus,
  onResume,
  operation,
  remainingSeconds,
}: CheckoutRecoveryProps) {
  const { colors } = useTheme();
  const s = useMemo(() => makeStyles(colors), [colors]);

  return (
    <View style={s.panel} testID="checkout-recovery-panel">
      <CheckoutRecoveryContent
        attempt={attempt}
        errorMessage={errorMessage}
        operation={operation}
        remainingSeconds={remainingSeconds}
      />
      <CheckoutRecoveryActions
        attempt={attempt}
        errorMessage={errorMessage}
        isBusy={isBusy}
        onCancel={onCancel}
        onCheckStatus={onCheckStatus}
        onResume={onResume}
      />
    </View>
  );
}
