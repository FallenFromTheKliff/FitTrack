"use client";

import type { CSSProperties, ReactNode } from "react";

import { useExerciseLabPage } from "./ExerciseLabPageContext";
import { ExerciseLabModeNavigation } from "./ExerciseLabModeNavigation";

type ExerciseLabSurfaceFrameProps = {
  actions?: ReactNode;
  toolbar: ReactNode;
  children: ReactNode;
  footer: ReactNode;
  className?: string;
  tableMinWidth?: number;
};

export function ExerciseLabSurfaceFrame({
  actions,
  toolbar,
  children,
  footer,
  className,
  tableMinWidth = 1080,
}: ExerciseLabSurfaceFrameProps) {
  const { colors, isCompact } = useExerciseLabPage();

  const frameStyle: CSSProperties = {
    backgroundColor: colors.surfaceRaised,
    border: `1px solid ${colors.border}`,
    borderRadius: 8,
    display: "grid",
    gap: 12,
    gridTemplateRows: isCompact
      ? undefined
      : "40px 42px minmax(0, 1fr) 42px",
    height: isCompact ? "auto" : "100%",
    minHeight: 0,
    overflow: isCompact ? "visible" : "hidden",
    padding: 12,
  };

  return (
    <section
      className={`exercise-lab-surface-frame${className ? ` ${className}` : ""}`}
      style={frameStyle}
    >
      <div className="exercise-lab-surface-command-row">
        <ExerciseLabModeNavigation />
        {actions ? (
          <div className="exercise-lab-surface-actions">{actions}</div>
        ) : null}
      </div>

      <div className="exercise-lab-surface-toolbar">{toolbar}</div>

      <div
        className="exercise-lab-surface-table"
        style={{
          backgroundColor: colors.surface,
          border: `1px solid ${colors.border}`,
          borderRadius: 7,
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
        .exercise-lab-surface-command-row {
          align-items: center;
          display: flex;
          gap: 14px;
          justify-content: space-between;
          min-width: 0;
        }

        .exercise-lab-surface-actions {
          align-items: center;
          display: flex;
          flex: 0 0 auto;
          gap: 8px;
          justify-content: flex-end;
        }

        .exercise-lab-surface-toolbar {
          align-items: stretch;
          display: grid;
          gap: 10px;
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
          text-align: left !important;
        }

        .exercise-lab-surface-table table th {
          height: 38px;
          padding-block: 6px !important;
        }

        .exercise-lab-surface-table table td {
          height: 54px;
          padding-block: 5px !important;
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
          padding: 8px 2px 0;
        }

        @media (max-width: 900px) {
          .exercise-lab-surface-command-row {
            align-items: stretch;
            flex-direction: column;
          }

          .exercise-lab-surface-actions {
            justify-content: flex-start;
          }

          .exercise-lab-surface-frame {
            grid-template-rows: none !important;
          }

          .exercise-lab-surface-footer {
            align-items: flex-start;
            flex-direction: column;
          }
        }
      `}</style>
    </section>
  );
}
