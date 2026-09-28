"use client";

import type { CSSProperties, ReactNode } from "react";

import { useExerciseLabPage } from "./ExerciseLabPageContext";
import { ExerciseLabModeNavigation } from "./ExerciseLabModeNavigation";

type ExerciseLabSurfaceFrameProps = {
  actions?: ReactNode;
  ariaLabel?: string;
  toolbar: ReactNode;
  children: ReactNode;
  footer: ReactNode;
  className?: string;
  testId?: string;
  tableMinWidth?: number;
};

export function ExerciseLabSurfaceFrame({
  actions,
  ariaLabel,
  toolbar,
  children,
  footer,
  className,
  testId,
  tableMinWidth = 1080,
}: ExerciseLabSurfaceFrameProps) {
  const { colors, isCompact } = useExerciseLabPage();

  const frameStyle: CSSProperties = {
    backgroundColor: "transparent",
    border: "none",
    borderRadius: 0,
    display: "grid",
    gap: 16,
    gridTemplateRows: isCompact
      ? undefined
      : "40px 42px minmax(0, 1fr) 42px",
    height: isCompact ? "auto" : "100%",
    minHeight: 0,
    overflow: isCompact ? "visible" : "hidden",
    padding: 0,
  };

  return (
    <section
      aria-label={ariaLabel}
      className={`exercise-lab-surface-frame${className ? ` ${className}` : ""}`}
      data-testid={testId}
      role={ariaLabel ? "region" : undefined}
      style={frameStyle}
    >
      <div className="exercise-lab-surface-navigation-row">
        <ExerciseLabModeNavigation />
      </div>

      <div className="exercise-lab-surface-command-row">
        <div className="exercise-lab-surface-toolbar">{toolbar}</div>
        {actions ? (
          <div className="exercise-lab-surface-actions">{actions}</div>
        ) : null}
      </div>

      <div
        className="exercise-lab-surface-table"
        style={{
          backgroundColor: colors.surface,
          border: `1px solid ${colors.border}`,
          borderRadius: 10,
        }}
      >
        {children}
      </div>

      <div
        className="exercise-lab-surface-footer"
        style={{
          borderTop: `1px solid ${colors.border}`,
          color: colors.textSecondary,
        }}
      >
        {footer}
      </div>

      <style>{`
        .exercise-lab-surface-navigation-row {
          min-width: 0;
          width: 100%;
        }

        .exercise-lab-surface-command-row {
          align-items: center;
          display: flex;
          gap: 16px;
          justify-content: space-between;
          min-width: 0;
        }

        .exercise-lab-surface-actions {
          align-items: center;
          display: flex;
          flex: 0 0 auto;
          gap: 12px;
          justify-content: flex-end;
        }

        .exercise-lab-surface-toolbar {
          align-items: stretch;
          display: grid;
          flex: 1 1 auto;
          gap: 12px;
          min-height: 42px;
          min-width: 0;
        }

        .exercise-lab-surface-table {
          display: grid;
          min-height: 0;
          overflow: hidden;
        }

        .exercise-lab-surface-table > div {
          height: 100%;
          min-height: 0;
        }

        .exercise-lab-surface-table table {
          min-width: ${tableMinWidth}px;
          table-layout: fixed;
        }

        .exercise-lab-surface-table table th,
        .exercise-lab-surface-table table td {
          padding-inline: 16px !important;
          text-align: left !important;
        }

        .exercise-lab-surface-table table th {
          height: 36px;
          letter-spacing: 0.08em;
          padding-block: 6px !important;
          text-transform: uppercase;
        }

        .exercise-lab-surface-table table th span {
          letter-spacing: inherit;
          text-transform: inherit;
        }

        .exercise-lab-surface-table table td {
          height: 62px;
          padding-block: 8px !important;
        }

        .exercise-lab-surface-table table tbody tr:last-child td {
          border-bottom: 0 !important;
        }

        .exercise-lab-surface-table table td:last-child > div {
          justify-content: flex-end !important;
        }

        .exercise-lab-surface-footer {
          align-items: center;
          display: flex;
          gap: 12px;
          justify-content: space-between;
          min-height: 42px;
          padding: 0 2px;
        }

        @media (max-width: 900px) {
          .exercise-lab-surface-command-row {
            align-items: stretch;
            flex-direction: column;
          }

          .exercise-lab-surface-navigation-row {
            min-height: 44px;
          }

          .exercise-lab-surface-actions {
            align-items: stretch;
            justify-content: flex-start;
            width: 100%;
          }

          .exercise-lab-surface-actions > button {
            flex: 1 1 auto;
          }

          .exercise-lab-surface-command-row button,
          .exercise-lab-surface-toolbar input,
          .exercise-lab-surface-toolbar button,
          .exercise-lab-surface-footer .fit-pagination-button,
          .exercise-lab-surface-table table td:last-child button {
            min-height: 44px !important;
          }

          .exercise-lab-surface-footer .fit-pagination-button,
          .exercise-lab-surface-table table td:last-child button {
            min-width: 44px !important;
          }

          .exercise-lab-surface-toolbar > * {
            min-width: 0;
            width: 100%;
          }

          .exercise-lab-surface-table {
            max-width: 100%;
            min-width: 0;
          }

          .exercise-lab-surface-table > div {
            max-width: 100%;
            min-width: 0;
          }

          .exercise-lab-surface-frame {
            grid-template-rows: none !important;
          }

          .exercise-lab-surface-footer {
            align-items: flex-start;
            flex-direction: column;
            padding-right: 2px;
          }
        }
      `}</style>
    </section>
  );
}
