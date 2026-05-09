"use client";

import type { ReactNode } from "react";

import { FitText } from "@/components/fit";
import { useTheme } from "@/contexts/ThemeContext";

type Tone = "default" | "brand" | "review" | "warning" | "accent";

export type MembersRouteShellChip = {
  label: string;
  tone?: Tone;
};

export type MembersRouteShellMetric = {
  label: string;
  note?: string;
  value: string;
  tone?: Tone;
};

type Props = {
  actions?: ReactNode;
  children: ReactNode;
  commandSurface?: ReactNode;
  eyebrow?: string;
  heroChips?: MembersRouteShellChip[];
  summaryItems?: MembersRouteShellMetric[];
  subtitle?: string;
  title: string;
};

export default function MembersRouteShell({
  actions,
  children,
  commandSurface,
  eyebrow,
  heroChips = [],
  summaryItems = [],
  subtitle,
  title,
}: Props) {
  const { colors } = useTheme();

  const getToneColor = (tone: Tone = "default") => {
    switch (tone) {
      case "brand":
        return colors.brand;
      case "warning":
        return colors.warning;
      case "accent":
        return colors.brand;
      case "review":
        return colors.warning;
      default:
        return colors.textSecondary;
    }
  };

  const renderChip = ({ label, tone = "default" }: MembersRouteShellChip) => {
    const toneColor = getToneColor(tone);

    return (
      <div
        key={label}
        className="members-route-shell-chip"
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          padding: "7px 11px",
          borderRadius: 999,
          border: `1px solid ${toneColor}33`,
          backgroundColor: `${toneColor}14`,
        }}
      >
        <FitText
          style={{
            fontSize: 10.5,
            fontWeight: 700,
            color: toneColor,
            letterSpacing: "0.06em",
          }}
        >
          {label}
        </FitText>
      </div>
    );
  };

  const renderMetric = ({ label, note, value, tone = "default" }: MembersRouteShellMetric) => {
    const toneColor = getToneColor(tone);
    const surfaceBackground = tone === "brand"
      ? `${colors.brand}10`
      : tone === "review" || tone === "warning"
          ? `${colors.warning}12`
          : tone === "accent"
            ? `${colors.brand}10`
            : `${colors.surface}f0`;

    return (
      <div
        key={label}
        className="members-route-shell-metric"
        style={{
          display: "grid",
          gap: 4,
          minWidth: 0,
          padding: "11px 12px",
          borderRadius: 18,
          border: `1px solid ${toneColor}20`,
          backgroundColor: surfaceBackground,
          boxShadow: "0 10px 20px rgba(0,0,0,0.08)",
        }}
      >
        <FitText
          style={{
            fontSize: 10,
            fontWeight: 700,
            color: toneColor,
            letterSpacing: "0.06em",
          }}
        >
          {label}
        </FitText>
        <FitText style={{ fontSize: 16, fontWeight: 800, color: colors.textPrimary, lineHeight: 1.05 }}>
          {value}
        </FitText>
        {note ? (
          <FitText style={{ fontSize: 10.5, lineHeight: 1.35, color: colors.textSecondary }}>
            {note}
          </FitText>
        ) : null}
      </div>
    );
  };

  return (
    <div className="members-route-shell" style={{ display: "grid", gap: 12 }}>
      <section
        className="members-route-shell-command"
        style={{
          display: "grid",
          gap: 12,
          padding: "16px 18px",
          borderRadius: 14,
          border: `1px solid ${colors.border}`,
          background: `linear-gradient(180deg, ${colors.surfaceRaised} 0%, ${colors.surface} 100%)`,
          boxShadow: "0 16px 28px rgba(0,0,0,0.12)",
        }}
      >
        <div
          className="members-route-shell-top"
          style={{
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            gap: 14,
            flexWrap: "wrap",
          }}
        >
          <div style={{ display: "grid", gap: 6, maxWidth: 720 }}>
            {eyebrow ? (
              <FitText
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  color: colors.brand,
                  letterSpacing: "0.08em",
                }}
              >
                {eyebrow}
              </FitText>
            ) : null}
            <FitText style={{ fontSize: 28, fontWeight: 800, color: colors.textPrimary, lineHeight: 1.02 }}>
              {title}
            </FitText>
            {subtitle ? (
              <FitText style={{ fontSize: 11.75, lineHeight: 1.5, color: colors.textSecondary }}>
                {subtitle}
              </FitText>
            ) : null}
          </div>
          {actions ? (
            <div
              className="members-route-shell-actions"
              style={{
                display: "flex",
                gap: 8,
                flexWrap: "wrap",
                justifyContent: "flex-end",
              }}
            >
              {actions}
            </div>
          ) : null}
        </div>

        {heroChips.length > 0 ? (
          <div className="members-route-shell-chip-row" style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            {heroChips.map(renderChip)}
          </div>
        ) : null}

        {commandSurface ? (
          <div
            className="members-route-shell-surface"
            style={{
              display: "grid",
              gap: 10,
              padding: "12px",
              borderRadius: 12,
              border: `1px solid ${colors.border}`,
              backgroundColor: `${colors.surface}f0`,
            }}
          >
            {commandSurface}
          </div>
        ) : null}

        {summaryItems.length > 0 ? (
          <div
            className="members-route-shell-summary"
            style={{
              display: "grid",
              gap: 10,
              gridTemplateColumns: "repeat(auto-fit, minmax(148px, 1fr))",
            }}
          >
            {summaryItems.map(renderMetric)}
          </div>
        ) : null}
      </section>

      <div className="members-route-shell-stage" style={{ display: "grid", gap: 14 }}>
        {children}
      </div>

      <style>{`
        @keyframes members-route-shell-rise {
          0% {
            opacity: 0;
            transform: translateY(10px);
          }

          100% {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes members-route-shell-stage-in {
          0% {
            opacity: 0;
            transform: translateY(12px);
          }

          100% {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .members-route-shell-command {
          animation: members-route-shell-rise 180ms ease-out both;
        }

        .members-route-shell-stage {
          animation: members-route-shell-stage-in 180ms cubic-bezier(0.2, 0.8, 0.2, 1) both;
        }

        .members-route-shell-chip,
        .members-route-shell-metric {
          transition: border-color 140ms ease;
        }

        @media (prefers-reduced-motion: reduce) {
          .members-route-shell-command,
          .members-route-shell-stage {
            animation: none !important;
          }

          .members-route-shell-chip,
          .members-route-shell-metric {
            transition: none !important;
          }
        }

        @media (max-width: 920px) {
          .members-route-shell-actions {
            width: 100%;
            justify-content: flex-start !important;
          }
        }

        @media (max-width: 640px) {
          .members-route-shell-command {
            padding: 15px !important;
          }

          .members-route-shell-summary {
            grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
          }
        }
      `}</style>
    </div>
  );
}
