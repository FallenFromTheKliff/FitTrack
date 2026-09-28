"use client";

import { ArrowLeft, ArrowRight, Check, CircleAlert } from "lucide-react";
import type { CSSProperties, ReactNode } from "react";

import { tokens } from "@fittrack/ui/tokens";

import { useTheme } from "@/contexts/ThemeContext";

import FitButton from "./FitButton";
import { FitText } from "./FitText";

export type FitWorkflowRailStep = {
  errorCount?: number;
  errorLabel?: ReactNode;
  step: number;
  label: string;
  optional?: boolean;
};

export type FitWorkflowRailProps = {
  steps: readonly FitWorkflowRailStep[];
  activeStep: number;
  eyebrow: ReactNode;
  title: ReactNode;
  onStepChange: (step: number) => void;
  onExit: () => void;
  exitLabel?: string;
  ariaLabel?: string;
  responsiveMode?: "auto" | "narrow";
  className?: string;
  style?: CSSProperties;
  "data-testid"?: string;
};

/**
 * Shared progress rail for multi-step FitTrack workflows.
 *
 * The rail owns layout and state presentation only. The caller owns the draft,
 * step validation, and what happens after a step is selected or exited.
 */
export default function FitWorkflowRail({
  steps,
  activeStep,
  eyebrow,
  title,
  onStepChange,
  onExit,
  exitLabel = "Exit to catalog",
  ariaLabel = "Workflow progress",
  responsiveMode = "auto",
  className,
  style,
  "data-testid": testId,
}: FitWorkflowRailProps) {
  const { colors } = useTheme();

  return (
    <aside
      aria-label={ariaLabel}
      className={className ? `fit-workflow-rail ${className}` : "fit-workflow-rail"}
      data-testid={testId}
      data-workflow-rail-mode={responsiveMode}
      style={{
        display: "grid",
        gap: 18,
        gridTemplateRows: "auto auto minmax(0, 1fr)",
        minHeight: 0,
        minWidth: 0,
        padding: "4px 0",
        width: tokens.workflowRail.desktopWidth,
        ...style,
      }}
    >
      <FitButton
        aria-label={exitLabel}
        className="fit-workflow-rail__exit"
        icon={ArrowLeft}
        label={exitLabel}
        onClick={onExit}
        variant="link"
        style={{ justifyContent: "flex-start", minHeight: tokens.workflowRail.touchTargetMinHeight, padding: 0, width: "fit-content" }}
      />

      <div className="fit-workflow-rail__heading" style={{ display: "grid", gap: 6, minWidth: 0 }}>
        <FitText
          excludeGlobalScale
          style={{ color: colors.textMuted, fontSize: 10.5, fontWeight: 850, letterSpacing: "0.1em", lineHeight: 1.2, textTransform: "uppercase" }}
        >
          {eyebrow}
        </FitText>
        <FitText
          as="h1"
          excludeGlobalScale
          style={{ color: colors.textPrimary, fontSize: 22, fontWeight: 950, lineHeight: 1.1, margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
        >
          {title}
        </FitText>
      </div>

      <nav
        aria-label={ariaLabel}
        className="fit-workflow-rail__steps"
        data-workflow-step-list
        style={{
          alignContent: "start",
          display: "grid",
          gap: tokens.workflowRail.stepGap,
          gridAutoRows: `${tokens.workflowRail.stepHeight}px`,
          minHeight: 0,
          minWidth: 0,
          overflowX: "hidden",
          overflowY: "auto",
        }}
      >
        {steps.map((step) => {
          const active = step.step === activeStep;
          const hasErrors = (step.errorCount ?? 0) > 0;
          const complete = step.step < activeStep && !hasErrors;
          const state = active ? "active" : complete ? "complete" : "pending";
          const errorLabel =
            step.errorLabel ??
            (hasErrors
              ? `${step.errorCount} issue${step.errorCount === 1 ? "" : "s"}`
              : null);
          const errorLabelText =
            typeof errorLabel === "string" || typeof errorLabel === "number"
              ? String(errorLabel)
              : hasErrors
                ? `${step.errorCount} issue${step.errorCount === 1 ? "" : "s"}`
                : "";

          return (
            <button
              aria-current={active ? "step" : undefined}
              aria-invalid={hasErrors ? "true" : undefined}
              aria-label={`${step.label}${step.optional ? " optional" : ""}${errorLabelText ? `, ${errorLabelText}` : ""}`}
              className="fit-workflow-rail__step"
              data-workflow-error={hasErrors ? "true" : undefined}
              data-workflow-step={step.step}
              data-workflow-step-state={state}
              key={step.step}
              onClick={() => onStepChange(step.step)}
              type="button"
              style={{
                alignItems: "center",
                backgroundColor: hasErrors
                  ? `${colors.danger}12`
                  : active
                    ? `${colors.brand}16`
                    : "transparent",
                border: `1px solid ${hasErrors ? `${colors.danger}66` : active ? colors.brand : "transparent"}`,
                borderRadius: 9,
                boxSizing: "border-box",
                color: colors.textPrimary,
                cursor: "pointer",
                display: "grid",
                gap: 10,
                gridTemplateColumns: "28px minmax(0, 1fr) auto",
                height: tokens.workflowRail.stepHeight,
                minHeight: tokens.workflowRail.touchTargetMinHeight,
                overflow: "hidden",
                padding: `${tokens.workflowRail.stepPaddingY}px ${tokens.workflowRail.stepPaddingX}px`,
                textAlign: "left",
                width: "100%",
              }}
            >
              <span
                aria-hidden="true"
                style={{
                  alignItems: "center",
                  backgroundColor: hasErrors
                    ? `${colors.danger}12`
                    : complete
                      ? `${colors.success}24`
                      : active
                        ? colors.brand
                        : colors.surfaceRaised,
                  border: `1px solid ${hasErrors ? `${colors.danger}66` : complete ? `${colors.success}66` : active ? colors.brand : colors.border}`,
                  borderRadius: "50%",
                  color: hasErrors
                    ? colors.danger
                    : complete
                      ? colors.success
                      : active
                        ? colors.onBrand
                        : colors.textMuted,
                  display: "inline-flex",
                  fontSize: 11,
                  fontWeight: 900,
                  height: 24,
                  justifyContent: "center",
                  lineHeight: 1,
                  width: 24,
                }}
              >
                {hasErrors ? (
                  <CircleAlert aria-hidden="true" color={colors.danger} size={14} strokeWidth={2.4} />
                ) : complete ? (
                  <Check size={13} />
                ) : (
                  step.step
                )}
              </span>

              <span style={{ display: "grid", gap: 2, minWidth: 0 }}>
                <FitText
                  excludeGlobalScale
                  style={{ color: active ? colors.textPrimary : colors.textSecondary, fontSize: 12.5, fontWeight: active ? 900 : 750, lineHeight: 1.15, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
                >
                  {step.label}
                </FitText>
                {step.optional ? (
                  <FitText
                    excludeGlobalScale
                    style={{ color: colors.textMuted, fontSize: 9.5, letterSpacing: "0.08em", lineHeight: 1.1, textTransform: "uppercase" }}
                  >
                    Optional
                  </FitText>
                ) : null}
                {errorLabel ? (
                  <FitText
                    excludeGlobalScale
                    style={{ color: colors.danger, fontSize: 9.5, fontWeight: 750, lineHeight: 1.1 }}
                  >
                    {errorLabel}
                  </FitText>
                ) : null}
              </span>

              <span aria-hidden="true" className="fit-workflow-rail__state-cue" style={{ alignItems: "center", display: "inline-flex", justifyContent: "center", minWidth: 14 }}>
                {hasErrors ? <CircleAlert color={colors.danger} size={13} strokeWidth={2.4} /> : active ? <ArrowRight color={colors.brand} size={14} /> : null}
              </span>
            </button>
          );
        })}
      </nav>

      <style>{`
        .fit-workflow-rail__exit,
        .fit-workflow-rail__exit * {
          font-family: inherit;
        }

        .fit-workflow-rail__step,
        .fit-workflow-rail__step * {
          font-family: inherit;
        }

        .fit-workflow-rail__step:hover {
          background-color: ${colors.surfaceRaised} !important;
          border-color: ${colors.border} !important;
        }

        .fit-workflow-rail__step[data-workflow-step-state="active"]:hover {
          background-color: ${colors.brand}16 !important;
          border-color: ${colors.brand} !important;
        }

        .fit-workflow-rail__step[data-workflow-error="true"]:hover {
          background-color: ${colors.danger}18 !important;
          border-color: ${colors.danger} !important;
        }

        .fit-workflow-rail__step:focus-visible,
        .fit-workflow-rail__exit:focus-visible {
          outline: 2px solid ${colors.brand};
          outline-offset: 2px;
        }

        @media (max-width: 920px) {
          .fit-workflow-rail {
            gap: 10px !important;
            grid-template-rows: auto auto auto !important;
            padding: 0 !important;
            width: 100% !important;
          }

          .fit-workflow-rail__steps {
            display: flex !important;
            gap: ${tokens.workflowRail.stepGap}px !important;
            max-width: 100%;
            overflow-x: auto !important;
            overflow-y: hidden !important;
            padding-bottom: 2px;
            scrollbar-width: thin;
          }

          .fit-workflow-rail__step {
            flex: 0 0 auto;
            min-width: ${tokens.workflowRail.narrowStepMinWidth}px;
            width: auto !important;
          }
        }

        .fit-workflow-rail[data-workflow-rail-mode="narrow"] {
          gap: 10px !important;
          grid-template-rows: auto auto auto !important;
          padding: 0 !important;
          width: 100% !important;
        }

        .fit-workflow-rail[data-workflow-rail-mode="narrow"] .fit-workflow-rail__steps {
          display: flex !important;
          gap: ${tokens.workflowRail.stepGap}px !important;
          max-width: 100%;
          overflow-x: auto !important;
          overflow-y: hidden !important;
          padding-bottom: 2px;
          scrollbar-width: thin;
        }

        .fit-workflow-rail[data-workflow-rail-mode="narrow"] .fit-workflow-rail__step {
          flex: 0 0 auto;
          min-width: ${tokens.workflowRail.narrowStepMinWidth}px;
          width: auto !important;
        }

        @media (prefers-reduced-motion: reduce) {
          .fit-workflow-rail__step,
          .fit-workflow-rail__exit {
            transition: none !important;
          }
        }
      `}</style>
    </aside>
  );
}
