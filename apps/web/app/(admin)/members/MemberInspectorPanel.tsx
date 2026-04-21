"use client";

import type { ReactNode } from "react";

import { FitText } from "@/components/fit";
import { useTheme } from "@/contexts/ThemeContext";

type Props = {
  children?: ReactNode;
  description?: string;
  footer?: ReactNode;
  eyebrow: string;
  title: string;
};

export default function MemberInspectorPanel({
  children,
  description,
  footer,
  eyebrow,
  title,
}: Props) {
  const { colors } = useTheme();

  return (
    <aside
      className="member-inspector-panel"
      aria-label={title}
      style={{
        display: "grid",
        gap: 16,
        padding: 20,
        borderRadius: 28,
        border: `1px solid ${colors.border}`,
        background: `linear-gradient(180deg, ${colors.surfaceRaised} 0%, ${colors.surface} 100%)`,
        boxShadow: "0 18px 34px rgba(0,0,0,0.14)",
      }}
    >
      <div style={{ display: "grid", gap: 6 }}>
        <FitText
          style={{
            fontSize: 11,
            fontWeight: 700,
            color: colors.textMuted,
            letterSpacing: "0.06em",
          }}
        >
          {eyebrow}
        </FitText>
        <FitText style={{ fontSize: 24, fontWeight: 800, color: colors.textPrimary, lineHeight: 1.08 }}>
          {title}
        </FitText>
        {description ? (
          <FitText style={{ fontSize: 12.5, lineHeight: 1.55, color: colors.textSecondary }}>
            {description}
          </FitText>
        ) : null}
      </div>

      {children ? <div className="member-inspector-panel__body">{children}</div> : null}
      {footer ? <div className="member-inspector-panel__footer">{footer}</div> : null}

      <style>{`
        .member-inspector-panel__body {
          display: grid;
          gap: 12px;
        }

        .member-inspector-panel__footer {
          display: grid;
          gap: 10px;
        }

        @media (max-width: 980px) {
          .member-inspector-panel {
            padding: 18px !important;
          }
        }
      `}</style>
    </aside>
  );
}
