"use client";
import type { ButtonHTMLAttributes, ReactNode, CSSProperties } from "react";
import { ChevronRight } from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { useTheme, useFontClass } from "@/contexts/ThemeContext";
import { cn } from "@/utils/cn";
import { makeFitButtonVariants } from "@/styles/fitStyles";

export type FitButtonVariant =
    | "primary" | "ghost" | "danger"
    | "link" | "nav" | "navActive"
    | "sidebarLogout" | "field" | "chip"
    | "iconClear" | "card" | "overlay";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  label?: string;
  children?: ReactNode;
  variant?: FitButtonVariant;
  icon?: LucideIcon;
  iconSize?: number;
  iconOnly?: boolean;
  loading?: boolean;
  loadingLabel?: string;
  fullWidth?: boolean;
  flex?: number;
  showTrailing?: boolean;
  textStyle?: CSSProperties;
  active?: boolean;
};

export default function FitButton({
  label, children, variant = "primary",
  icon: Icon, iconSize = 16, iconOnly = false,
  loading = false, loadingLabel, fullWidth = false,
  flex, showTrailing = false, textStyle,
  active = false, disabled, className,
  style, ...props
}: Props) {
  const { colors, activeIconColor, onBrandTextColor } = useTheme();
  const fontClass = useFontClass();
  const ic = activeIconColor ?? colors.brand;
  const isDisabled = disabled || loading;
  const displayLabel = loading && loadingLabel ? loadingLabel : label;
  const flexStyle: CSSProperties = flex !== undefined ? { flex } : {};

  const base = cn(
      "inline-flex items-center justify-center gap-2",
      "cursor-pointer transition-colors",
      "disabled:opacity-60 disabled:cursor-not-allowed",
      fontClass,
      fullWidth && "w-full",
      className
  );

  const variants = makeFitButtonVariants(colors, {
    active,
    isDisabled,
    iconOnly,
    accentColor: ic,
    onBrandTextColor
  });

  const needsTrailing = showTrailing || variant === "field";
  const isCard = variant === "card";

  return (
      <button
          {...props}
          type={props.type ?? "button"}
          disabled={isDisabled}
          className={base}
          style={{ ...variants[variant], ...flexStyle, ...style }}
      >
        {Icon && variant !== "field" && <Icon size={iconSize} strokeWidth={2} />}
        {!iconOnly && (
            <span style={{
              flex: needsTrailing ? 1 : undefined,
              display: isCard && children ? "contents" : undefined,
              ...(!isCard || !children ? textStyle : {})
            }}>
              {children ?? displayLabel}
            </span>
        )}
        {needsTrailing && (
            <ChevronRight size={variant === "field" ? iconSize : 17} strokeWidth={2} />
        )}
      </button>
  );
}