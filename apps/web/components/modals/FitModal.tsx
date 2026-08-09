"use client";
import { useEffect, useId, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { createPortal } from "react-dom";
import type { LucideIcon } from "lucide-react";
import { Info, X } from "lucide-react";
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
  closeDisabled?: boolean;
  headerStyle?: CSSProperties;
  footerStyle?: CSSProperties;
  overlayStyle?: CSSProperties;
  containerStyle?: CSSProperties;
  contentStyle?: CSSProperties;
  motionPreset?: "slide-right" | "zoom";
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
  closeDisabled = false,
  headerStyle,
  footerStyle,
  overlayStyle,
  containerStyle,
  contentStyle,
  motionPreset = "zoom"
}: Props) {
  const { colors, onBrandTextColor } = useTheme();
  const s = modalStyles(colors);
  const [visible, setVisible] = useState(false);
  const [portalRoot, setPortalRoot] = useState<HTMLElement | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const modalRef = useRef<HTMLDivElement | null>(null);
  const onCloseRef = useRef(onClose);
  const closeDisabledRef = useRef(closeDisabled);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const titleId = useId();
  const subtitleId = useId();
  const Icon = icon ?? Info;
  const isSlideRight = motionPreset === "slide-right";

  useEffect(() => {
    setPortalRoot(document.body);
  }, []);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    closeDisabledRef.current = closeDisabled;
  }, [closeDisabled]);

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
    const activeOverlay =
      modalRef.current?.closest<HTMLElement>(
        '[data-fit-modal-overlay="true"]',
      ) ?? null;
    const backgroundSnapshots = Array.from(document.body.children)
      .filter(
        (element): element is HTMLElement =>
          element instanceof HTMLElement &&
          element !== activeOverlay &&
          !["SCRIPT", "STYLE", "LINK"].includes(element.tagName),
      )
      .map((element) => ({
        ariaHidden: element.getAttribute("aria-hidden"),
        element,
        hadInert: element.hasAttribute("inert"),
      }));

    backgroundSnapshots.forEach(({ element }) => {
      element.setAttribute("aria-hidden", "true");
      element.setAttribute("inert", "");
    });

    const focusFrame = requestAnimationFrame(() => {
      modalRef.current?.focus({ preventScroll: true });
    });
    const handleKeyDown = (event: KeyboardEvent) => {
      const dialogs = Array.from(
        document.querySelectorAll('[role="dialog"][aria-modal="true"]'),
      );
      if (dialogs[dialogs.length - 1] !== modalRef.current) return;

      if (event.key === "Tab") {
        const focusableElements = Array.from(
          modalRef.current?.querySelectorAll<HTMLElement>(
            'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
          ) ?? [],
        ).filter(
          (element) =>
            element.getAttribute("aria-hidden") !== "true" &&
            element.getClientRects().length > 0,
        );

        if (!focusableElements.length) {
          event.preventDefault();
          modalRef.current?.focus({ preventScroll: true });
          return;
        }

        const firstFocusable = focusableElements[0];
        const lastFocusable = focusableElements[focusableElements.length - 1];
        const activeElement = document.activeElement;
        const focusStartsOutside =
          !(activeElement instanceof Node) ||
          !modalRef.current?.contains(activeElement) ||
          activeElement === modalRef.current;

        if (
          (event.shiftKey &&
            (focusStartsOutside || activeElement === firstFocusable)) ||
          (!event.shiftKey &&
            (focusStartsOutside || activeElement === lastFocusable))
        ) {
          event.preventDefault();
          (event.shiftKey ? lastFocusable : firstFocusable).focus();
        }
        return;
      }

      if (event.key === "Escape" && !closeDisabledRef.current) {
        event.preventDefault();
        onCloseRef.current();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      cancelAnimationFrame(focusFrame);
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
      backgroundSnapshots.forEach(({ ariaHidden, element, hadInert }) => {
        if (ariaHidden === null) {
          element.removeAttribute("aria-hidden");
        } else {
          element.setAttribute("aria-hidden", ariaHidden);
        }

        if (!hadInert) {
          element.removeAttribute("inert");
        }
      });
      const previouslyFocused = previousFocusRef.current;
      requestAnimationFrame(() => {
        if (previouslyFocused?.isConnected) {
          previouslyFocused.focus({ preventScroll: true });
        }
      });
    };
  }, [isOpen, portalRoot]);

  if ((!isOpen && !visible) || !portalRoot) return null;

  const handleRequestClose = () => {
    if (closeDisabled) return;
    onClose();
  };

  return createPortal(
    <>
      <style>
        {`
          @keyframes fit-modal-zoom-in {
            from {
              opacity: 0;
              transform: scale(0.92);
            }
            to {
              opacity: 1;
              transform: scale(1);
            }
          }

          @media (prefers-reduced-motion: reduce) {
            [data-fit-modal-container="true"] {
              animation: none !important;
              transition: none !important;
              transform: scale(1) !important;
            }
          }

          @media (max-width: 640px) {
            [data-fit-modal-overlay="true"] {
              align-items: center !important;
              padding: 12px !important;
            }

            [data-fit-modal-container="true"] {
              border-radius: 12px !important;
              max-height: calc(100dvh - 24px) !important;
              width: min(100%, calc(100vw - 24px)) !important;
            }

            [data-fit-modal-header="true"],
            [data-fit-modal-content="true"],
            [data-fit-modal-footer="true"] {
              padding-left: 14px !important;
              padding-right: 14px !important;
            }

            [data-fit-modal-header="true"] {
              gap: 10px !important;
              padding-top: 14px !important;
              padding-bottom: 12px !important;
            }

            [data-fit-modal-content="true"] {
              max-height: calc(100dvh - 184px) !important;
              padding-top: 14px !important;
              padding-bottom: 14px !important;
            }

            [data-fit-modal-footer="true"] {
              flex-wrap: wrap !important;
              justify-content: stretch !important;
              padding-top: 12px !important;
              padding-bottom: 12px !important;
            }
          }
        `}
      </style>
      <div
        data-fit-modal-overlay="true"
        style={{
          ...s.overlay,
          opacity: visible ? 1 : 0,
          pointerEvents: isOpen && visible ? "auto" : "none",
          transition: "opacity 180ms ease",
          ...overlayStyle
        }}
        onClick={handleRequestClose}
      >
        <div
          ref={modalRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          aria-describedby={subtitle ? subtitleId : undefined}
          tabIndex={-1}
          style={{
            ...s.container,
            maxWidth,
            ...containerStyle,
            transformOrigin: isSlideRight ? "right center" : "center",
            transform: isSlideRight
              ? `translateX(${visible ? "0" : "100%"})`
              : visible
                ? "scale(1)"
                : "scale(0.92)",
            opacity: visible ? 1 : 0,
            pointerEvents: isOpen && visible ? "auto" : "none",
            transition: isSlideRight
              ? "transform 220ms ease-out, opacity 160ms ease"
              : "transform 220ms cubic-bezier(0.2, 0.8, 0.2, 1), opacity 180ms ease",
            animation: visible && !isSlideRight ? "fit-modal-zoom-in 220ms cubic-bezier(0.2, 0.8, 0.2, 1) both" : undefined,
            willChange: "transform, opacity"
          }}
          data-fit-modal-container="true"
          onClick={(e) => e.stopPropagation()}
        >
          <div
            data-fit-modal-header="true"
            style={{
              ...s.header,
              ...(hideHeaderDivider ? { borderBottom: "none" } : {}),
              ...headerStyle
            }}
          >
            <div style={s.headerLeft}>
              <div style={s.headerIconWrap}>
                {iconNode ?? <Icon size={15} color={onBrandTextColor} strokeWidth={2} />}
              </div>
              <div style={s.headerText}>
                <FitText id={titleId} style={{ ...s.title, ...titleStyle }}>{title}</FitText>
                {subtitle ? (
                  <FitText id={subtitleId} as="p" style={{ ...s.subtitle, ...subtitleStyle }}>{subtitle}</FitText>
                ) : null}
              </div>
            </div>
            <FitButton
              variant="ghost"
              iconOnly
              icon={X}
              iconSize={20}
              onClick={handleRequestClose}
              disabled={closeDisabled}
              style={s.closeBtn}
              aria-label={closeAriaLabel ?? "Close modal"}
            />
          </div>
          <div
            data-fit-modal-content="true"
            style={
              noScroll
                ? { ...s.content, ...contentStyle }
                : {
                    ...s.content,
                    overflowY: "auto" as const,
                    maxHeight: "60vh",
                    ...contentStyle
                  }
            }
          >
            {children}
          </div>
          {footer && (
            <div
              data-fit-modal-footer="true"
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
      </div>
    </>,
    portalRoot
  );
}
