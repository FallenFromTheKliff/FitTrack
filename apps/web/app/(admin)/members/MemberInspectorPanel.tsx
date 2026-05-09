"use client";

import type { ReactNode } from "react";

import { useTheme } from "@/contexts/ThemeContext";

type Props = {
  ariaLabel: string;
  children?: ReactNode;
  footer?: ReactNode;
};

export default function MemberInspectorPanel({
  ariaLabel,
  children,
  footer,
}: Props) {
  const { colors } = useTheme();

  return (
    <aside
      className="member-inspector-panel"
      data-member-inspector-panel
      aria-label={ariaLabel}
      style={{
        display: "grid",
        gridTemplateRows: "minmax(0, 1fr) auto",
        gap: 0,
        height: "100%",
        minHeight: 0,
        padding: 0,
        borderRadius: 8,
        border: `1px solid ${colors.border}`,
        backgroundColor: colors.surface,
        boxShadow: "none",
        overflow: "hidden",
      }}
    >
      {children ? <div className="member-inspector-panel__body">{children}</div> : null}
      {footer ? <div className="member-inspector-panel__footer">{footer}</div> : null}

      <style>{`
        .member-inspector-panel__body {
          display: grid;
          align-content: start;
          gap: 12px;
          min-height: 0;
          overflow: hidden;
          padding: 18px;
          background: ${colors.surface};
        }

        .member-inspector-panel__footer {
          display: grid;
          gap: 10px;
          padding: 16px 18px 18px;
          border-top: 1px solid ${colors.border};
          background-color: ${colors.surfaceRaised};
        }

        @media (max-width: 1259px) {
          .member-inspector-panel__body {
            padding: 16px !important;
          }

          .member-inspector-panel__footer {
            padding: 14px 16px 16px !important;
          }
        }
      `}</style>
    </aside>
  );
}
