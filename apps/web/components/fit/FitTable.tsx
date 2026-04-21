"use client";
import type { CSSProperties, ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

import { useTheme } from "@/contexts/ThemeContext";

import { FitText } from "@/components/fit/FitText";
import FitPill from "@/components/fit/FitPill";
import FitButton from "@/components/fit/FitButton";
import type { FitButtonVariant } from "@/components/fit/FitButton";

export type FitTableColumn<T> = {
  key: string;
  heading: string;
  headingStyle?: CSSProperties;
  align?: "left" | "center" | "right";
  render: (row: T, colors: ReturnType<typeof useTheme>["colors"]) => ReactNode;
};

export type FitTableAction<T> = {
  label: string;
  variant: FitButtonVariant;
  icon?: LucideIcon;
  iconSize?: number;
  iconOnly?: boolean;
  disabled?: (row: T) => boolean;
  onClick: (row: T) => void;
  style?: CSSProperties;
  ariaLabel?: (row: T) => string;
};

type Props<T> = {
  columns: FitTableColumn<T>[];
  rows: T[];
  getRowKey: (row: T) => string;
  actions?: FitTableAction<T>[];
  actionsHeading?: string;
  getRowClassName?: (row: T) => string | undefined;
  onRowClick?: (row: T) => void;
  emptyMessage?: string;
  isLoading?: boolean;
  loadingMessage?: string;
  overflowX?: boolean;
  maxHeight?: number | null;
  style?: CSSProperties;
};

export default function FitTable<T>({
  columns,
  rows,
  getRowKey,
  actions,
  actionsHeading = "ACTIONS",
  getRowClassName,
  onRowClick,
  emptyMessage = "No results found.",
  isLoading = false,
  loadingMessage = "Loading...",
  overflowX = true,
  maxHeight,
  style
}: Props<T>) {
  const { colors } = useTheme();
  const getColumnAlignment = (column: FitTableColumn<T>) => {
    if (column.align) return column.align;
    const heading = column.heading.toLowerCase();
    return /capacity|stock|price|rate|value|total|revenue|cost|amount|hours|bmi/.test(heading)
      ? "right"
      : "left";
  };

  const headStyle: CSSProperties = {
    fontSize: 11,
    fontWeight: 700,
    color: colors.textSecondary,
    padding: "16px 14px",
    textAlign: "left",
    borderBottom: `1px solid ${colors.border}`,
    backgroundColor: colors.surfaceRaised,
    whiteSpace: "nowrap"
  };

  const cellStyle: CSSProperties = {
    padding: "16px 14px",
    fontSize: 14,
    color: colors.textPrimary,
    borderBottom: `1px solid ${colors.border}`,
    verticalAlign: "middle"
  };

  const colSpan = columns.length + (actions ? 1 : 0);

  return (
      <div
          style={{
            border: `1px solid ${colors.border}`,
            borderRadius: 10,
            overflow: "hidden",
            overflowX: overflowX ? "auto" : "visible",
            overflowY: maxHeight ? "auto" : "visible",
            maxHeight: maxHeight ?? undefined,
            ...style
          }}
      >
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
          <tr>
            {columns.map((col) => (
                <th key={col.key} style={{ ...headStyle, textAlign: getColumnAlignment(col), ...col.headingStyle }}>
                  <FitText as="span" style={{ fontSize: 11, fontWeight: 700, color: colors.textSecondary }}>
                    {col.heading}
                  </FitText>
                </th>
            ))}
            {actions && (
                <th style={{ ...headStyle, textAlign: "right" }}>
                  <FitText as="span" style={{ fontSize: 11, fontWeight: 700, color: colors.textSecondary }}>
                    {actionsHeading}
                  </FitText>
                </th>
            )}
          </tr>
          </thead>
          <tbody>
          {isLoading ? (
              <tr>
                <td colSpan={colSpan} style={{ ...cellStyle, textAlign: "center", color: colors.textSecondary }}>
                  <FitText style={{ fontSize: 14, color: colors.textSecondary }}>{loadingMessage}</FitText>
                </td>
              </tr>
          ) : rows.length === 0 ? (
              <tr>
                <td colSpan={colSpan} style={{ ...cellStyle, textAlign: "center", color: colors.textSecondary }}>
                  <FitText style={{ fontSize: 14, color: colors.textSecondary }}>{emptyMessage}</FitText>
                </td>
              </tr>
          ) : (
              rows.map((row) => {
                const rowClassName = getRowClassName?.(row);
                return (
                    <tr
                      key={getRowKey(row)}
                      className={rowClassName ? `fit-table-row ${rowClassName}` : "fit-table-row"}
                      onClick={onRowClick ? () => onRowClick(row) : undefined}
                      style={onRowClick ? { cursor: "pointer" } : undefined}
                    >
                      {columns.map((col) => (
                          <td key={col.key} style={{ ...cellStyle, textAlign: getColumnAlignment(col) }}>
                            {col.render(row, colors)}
                          </td>
                      ))}
                      {actions && (
                          <td style={{ ...cellStyle, textAlign: "right" }}>
                            <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 6 }}>
                              {actions.map((action) => (
                                  <FitButton
                                      key={action.label}
                                      variant={action.variant}
                                      label={action.iconOnly ? undefined : action.label}
                                      icon={action.icon}
                                      iconSize={action.iconSize ?? 14}
                                      iconOnly={action.iconOnly}
                                      disabled={action.disabled?.(row)}
                                      onClick={(event) => {
                                        event.stopPropagation();
                                        action.onClick(row);
                                      }}
                                      style={action.style}
                                      aria-label={action.ariaLabel?.(row)}
                                  />
                              ))}
                            </div>
                          </td>
                      )}
                    </tr>
                );
              })
          )}
          </tbody>
        </table>
      </div>
  );
}

type StatusCellProps = {
  label: string;
  color: string;
};

export function FitTableStatusCell({ label, color }: StatusCellProps) {
  return <FitPill mode="status" label={label} color={color} fontSize={13} />;
}

type TextCellProps = {
  primary: string;
  secondary?: string;
};

export function FitTableTextCell({ primary, secondary }: TextCellProps) {
  const { colors } = useTheme();
  return (
      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        <FitText style={{ fontSize: 14, fontWeight: 600, color: colors.textPrimary }}>{primary}</FitText>
        {secondary ? (
            <FitText style={{ fontSize: 12, color: colors.textSecondary }}>{secondary}</FitText>
        ) : null}
      </div>
  );
}
