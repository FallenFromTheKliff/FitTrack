"use client";
import type { LucideIcon } from "lucide-react";
import { useTheme } from "@/contexts/ThemeContext";
import { useLoadingText } from "@fittrack/hooks";
import FitButton from "@/components/fit/FitButton";
import { FitText } from "@/components/fit/FitText";
import FitModal from "@/components/modals/FitModal";

type Props = {
  isOpen: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
  confirmLabel?: string;
  cancelLabel?: string;
  loadingLabel?: string;
  loadingTitle?: string;
  confirmIcon?: LucideIcon;
  isLoading?: boolean;
  isDanger?: boolean;
};

export default function ConfirmModal({
  isOpen,
  title,
  message,
  onConfirm,
  onCancel,
  confirmLabel = "CONFIRM",
  cancelLabel = "CANCEL",
  loadingLabel,
  loadingTitle,
  confirmIcon,
  isLoading = false,
  isDanger = false
}: Props) {
  const { colors } = useTheme();
  const animatedLoadingLabel = useLoadingText(loadingLabel ?? confirmLabel, isLoading);
  const modalTitle = isLoading && loadingTitle ? loadingTitle : title;
  const handleCancel = isLoading ? () => {} : onCancel;

  return (
    <FitModal
      isOpen={isOpen}
      onClose={handleCancel}
      title={modalTitle}
      titleStyle={{ fontSize: 20, fontWeight: 700, lineHeight: 1.2 }}
      hideHeaderDivider
      hideFooterDivider
      hideCloseButton={isLoading}
      headerStyle={{ alignItems: "flex-start", paddingBottom: 8 }}
      footer={isLoading ? undefined : (
        <>
          <FitButton
            variant="ghost"
            label={cancelLabel}
            onClick={onCancel}
            style={{ flex: 1 }}
          />
          <FitButton
            variant={isDanger ? "danger" : "primary"}
            label={confirmLabel}
            icon={confirmIcon}
            onClick={onConfirm}
            style={{ flex: 1 }}
          />
        </>
      )}
    >
      <FitText
        style={{
          fontSize: 15,
          color: colors.textSecondary,
          textAlign: isLoading ? "center" : "left",
          fontWeight: isLoading ? 600 : 400
        }}
      >
        {isLoading ? animatedLoadingLabel : message}
      </FitText>
    </FitModal>
  );
}
