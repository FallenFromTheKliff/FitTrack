"use client";
import { useEffect, useId, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { createPortal } from "react-dom";
import type { LucideIcon } from "lucide-react";
import { X } from "lucide-react";
import { useTheme } from "@/contexts/ThemeContext";
import { modalStyles } from "@/styles/modalStyles";
import FitButton from "@/components/fit/FitButton";
import { FitText } from "@/components/fit/FitText";

type Props = {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  icon?: LucideIcon;
  iconNode?: ReactNode;
  titleStyle?: CSSProperties;
  subtitleStyle?: CSSProperties;
  maxWidth?: number;
  closeAriaLabel?: string;
  footer?: ReactNode;
  children: ReactNode;
  noScroll?: boolean;
  hideHeaderDivider?: boolean;
  hideFooterDivider?: boolean;
  hideHeaderText?: boolean;
  hideCloseButton?: boolean;
  headerStyle?: CSSProperties;
  footerStyle?: CSSProperties;
};

export default function FitModal({
  isOpen,
  onClose,
  title,
  subtitle,
  icon,
  iconNode,
  titleStyle,
  subtitleStyle,
  maxWidth = 500,
  closeAriaLabel,
  footer,
  children,
  noScroll,
  hideHeaderDivider = false,
  hideFooterDivider = false,
  hideHeaderText = false,
  hideCloseButton = false,
  headerStyle,
  footerStyle
}: Props) {
  const { colors, settings, onBrandTextColor } = useTheme();
  const s = modalStyles(colors);
  const shouldAnimate = settings.animationLevel !== "none";
  const [visible, setVisible] = useState(false);
  const [portalRoot, setPortalRoot] = useState<HTMLElement | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const modalRef = useRef<HTMLDivElement | null>(null);
  const onCloseRef = useRef(onClose);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const titleId = useId();
  const subtitleId = useId();
  const Icon = icon;

  useEffect(() => {
    setPortalRoot(document.body);
  }, []);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

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

    previousFocusRef.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const focusFrame = requestAnimationFrame(() => {
      modalRef.current?.focus({ preventScroll: true });
    });
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      const dialogs = Array.from(
        document.querySelectorAll('[role="dialog"][aria-modal="true"]'),
      );
      if (dialogs[dialogs.length - 1] !== modalRef.current) return;
      event.preventDefault();
      onCloseRef.current();
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      cancelAnimationFrame(focusFrame);
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
      previousFocusRef.current?.focus({ preventScroll: true });
    };
  }, [isOpen, portalRoot]);

  if ((!isOpen && !visible) || !portalRoot) return null;

  return createPortal(
    <div
      style={{
        ...s.overlay,
        opacity: visible ? 1 : 0,
        pointerEvents: isOpen && visible ? "auto" : "none",
        transition: shouldAnimate ? "opacity 180ms ease" : "none"
      }}
      onClick={onClose}
    >
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={hideHeaderText ? undefined : titleId}
        aria-describedby={subtitle && !hideHeaderText ? subtitleId : undefined}
        aria-label={hideHeaderText ? title : undefined}
        tabIndex={-1}
        style={{
          ...s.container,
          maxWidth,
          transform: visible ? "scale(1)" : "scale(0.96)",
          opacity: visible ? 1 : 0,
          pointerEvents: isOpen && visible ? "auto" : "none",
          transition: shouldAnimate ? "transform 180ms ease, opacity 180ms ease" : "none"
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{
            ...s.header,
            ...(hideHeaderDivider ? { borderBottom: "none" } : {}),
            ...headerStyle
          }}
        >
          <div style={s.headerLeft}>
            {(iconNode || icon) && (
              <div style={s.headerIconWrap}>
                {iconNode ?? (Icon ? <Icon size={15} color={onBrandTextColor} strokeWidth={2} /> : null)}
              </div>
            )}
            {!hideHeaderText && (
              <div style={s.headerText}>
                <FitText id={titleId} style={{ ...s.title, ...titleStyle }}>{title}</FitText>
                {subtitle ? (
                  <FitText id={subtitleId} as="p" style={{ ...s.subtitle, ...subtitleStyle }}>{subtitle}</FitText>
                ) : null}
              </div>
            )}
          </div>
          {!hideCloseButton ? (
            <FitButton
              variant="ghost"
              iconOnly
              icon={X}
              iconSize={20}
              onClick={onClose}
              style={s.closeBtn}
              aria-label={closeAriaLabel ?? "Close modal"}
            />
          ) : null}
        </div>
        <div style={noScroll ? s.content : { ...s.content, overflowY: "auto" as const, maxHeight: "60vh" }}>
          {children}
        </div>
        {footer && (
          <div
            style={{
              ...s.footer,
              ...(hideFooterDivider ? { borderTop: "none" } : {}),
              ...footerStyle
            }}
          >
            {footer}
          </div>
        )}
      </div>
    </div>,
    portalRoot
  );
}
