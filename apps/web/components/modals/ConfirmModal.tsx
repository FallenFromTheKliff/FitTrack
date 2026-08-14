"use client";
import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { useTheme } from "@/contexts/ThemeContext";
import { useLoadingText } from "@fittrack/hooks";
import FitButton from "@/components/fit/FitButton";
import { FitText } from "@/components/fit/FitText";
import { acquireModalInteractionLock } from "@/components/modals/FitModal";

type Props = {
  isOpen: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
  cancelLabel?: string;
  confirmLabel?: string;
  loadingLabel?: string;
  loadingTitle?: string;
  confirmIcon?: LucideIcon;
  isLoading?: boolean;
  isDanger?: boolean;
  children?: ReactNode;
  confirmDisabled?: boolean;
};

function getLoadingTitle(
  title: string,
  actionLabel?: string,
  loadingTitle?: string,
) {
  if (loadingTitle) return loadingTitle;
  const nextTitle = (actionLabel ?? "").replace(/\.+$/, "").trim();
  return nextTitle || title;
}

export default function ConfirmModal({
  isOpen,
  title,
  message,
  onConfirm,
  onCancel,
  cancelLabel = "Cancel",
  confirmLabel = "CONFIRM",
  loadingLabel,
  loadingTitle,
  confirmIcon,
  isLoading = false,
  isDanger = false,
  children,
  confirmDisabled = false,
}: Props) {
  const { colors } = useTheme();
  const [visible, setVisible] = useState(false);
  const [portalRoot, setPortalRoot] = useState<HTMLElement | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const overlayRef = useRef<HTMLDivElement | null>(null);
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const onCancelRef = useRef(onCancel);
  const titleId = useId();
  const messageId = useId();
  const animatedLoadingLabel = useLoadingText(
    loadingLabel ?? confirmLabel,
    isLoading,
  );
  const modalTitle = isLoading
    ? getLoadingTitle(title, loadingLabel ?? confirmLabel, loadingTitle)
    : title;
  const handleCancel = isLoading ? () => {} : onCancel;

  useEffect(() => {
    setPortalRoot(document.body);
  }, []);

  useEffect(() => {
    onCancelRef.current = onCancel;
  }, [onCancel]);

  useEffect(() => {
    if (animationFrameRef.current !== null) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }

    if (isOpen) {
      animationFrameRef.current = requestAnimationFrame(() => {
        setVisible(true);
        animationFrameRef.current = null;
      });
      return;
    }

    setVisible(false);
  }, [isOpen]);

  useEffect(() => {
    return () => {
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!isOpen || !portalRoot) return;

    const overlay = overlayRef.current;
    const releaseModalInteractionLock = acquireModalInteractionLock(overlay);
    const focusFrame = requestAnimationFrame(() => {
      dialogRef.current?.focus({ preventScroll: true });
    });

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !isLoading) {
        event.preventDefault();
        onCancelRef.current();
        return;
      }

      if (event.key !== "Tab") return;
      const dialog = dialogRef.current;
      if (!dialog) return;
      const focusable = Array.from(
        dialog.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((element) => !element.hidden && element.offsetParent !== null);

      if (focusable.length === 0) {
        event.preventDefault();
        dialog.focus({ preventScroll: true });
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus({ preventScroll: true });
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus({ preventScroll: true });
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      cancelAnimationFrame(focusFrame);
      document.removeEventListener("keydown", handleKeyDown);
      releaseModalInteractionLock();
    };
  }, [isLoading, isOpen, portalRoot]);

  if ((!isOpen && !visible) || !portalRoot) return null;

  return createPortal(
    <div
      ref={overlayRef}
      style={{
        alignItems: "center",
        backgroundColor: colors.overlay,
        display: "flex",
        inset: 0,
        justifyContent: "center",
        opacity: visible ? 1 : 0,
        padding: 20,
        pointerEvents: isOpen && visible ? "auto" : "none",
        position: "fixed",
        transition: "opacity 180ms ease",
        zIndex: 1200,
      }}
      onClick={handleCancel}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={messageId}
        tabIndex={-1}
        style={{
          backgroundColor: colors.surface,
          border: `1px solid ${colors.border}`,
          borderRadius: 16,
          boxShadow: "0 20px 25px -5px rgba(0,0,0,0.2)",
          display: "flex",
          flexDirection: "column",
          gap: 8,
          maxWidth: 500,
          opacity: visible ? 1 : 0,
          padding: 24,
          pointerEvents: isOpen && visible ? "auto" : "none",
          transform: visible ? "scale(1)" : "scale(0.94)",
          transition:
            "transform 180ms cubic-bezier(0.2, 0.8, 0.2, 1), opacity 180ms ease",
          width: "min(90vw, 500px)",
        }}
        onClick={(event) => event.stopPropagation()}
      >
        <FitText
          id={titleId}
          style={{
            color: colors.textPrimary,
            fontSize: 22,
            fontWeight: 700,
            lineHeight: 1.2,
            marginBottom: 4,
          }}
        >
          {modalTitle}
        </FitText>
        <FitText
          id={messageId}
          as="p"
          style={{
            color: colors.textSecondary,
            fontSize: 15,
            fontWeight: isLoading ? 600 : 400,
            lineHeight: 1.45,
            margin: 0,
            textAlign: isLoading ? "center" : "left",
          }}
        >
          {isLoading ? animatedLoadingLabel : message}
        </FitText>
        {!isLoading && children ? children : null}
        {!isLoading ? (
          <div
            style={{
              display: "flex",
              gap: 10,
              marginTop: 16,
            }}
          >
            <FitButton
              variant="ghost"
              label={cancelLabel}
              onClick={onCancel}
              style={{ flex: 1 }}
            />
            <FitButton
              variant={isDanger ? "danger" : "positive"}
              label={confirmLabel}
              icon={confirmIcon}
              onClick={onConfirm}
              disabled={confirmDisabled}
              style={{ flex: 1 }}
            />
          </div>
        ) : null}
      </div>
    </div>,
    portalRoot,
  );
}
