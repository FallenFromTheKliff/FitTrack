"use client";
import type { ButtonHTMLAttributes, ReactNode, CSSProperties, Ref } from "react";
import { ChevronRight, LoaderCircle } from "lucide-react";
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
  buttonRef?: Ref<HTMLButtonElement>;
};

export default function FitButton({
  label, children, variant = "primary",
  icon: Icon, iconSize = 16, iconOnly = false,
  loading = false, loadingLabel, fullWidth = false,
  flex, showTrailing = false, textStyle,
  active = false, disabled, className,
  style, buttonRef, ...props
}: Props) {
  const { colors, activeIconColor, onBrandTextColor } = useTheme();
  const fontClass = useFontClass();
  const accentColor = activeIconColor ?? colors.brand;
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
    accentColor,
    onBrandTextColor
  });

  const needsTrailing = showTrailing || variant === "field";
  const isCard = variant === "card";
  const LeadingIcon = loading ? LoaderCircle : Icon;

  return (
      <button
          {...props}
          ref={buttonRef}
          type={props.type ?? "button"}
          disabled={isDisabled}
          className={base}
          style={{ ...variants[variant], ...flexStyle, ...style }}
      >
        {LeadingIcon && variant !== "field" && <LeadingIcon size={iconSize} strokeWidth={2} className={loading ? "animate-spin" : undefined} />}
        {!iconOnly && (
            <span style={{
              flex: needsTrailing ? 1 : undefined,
              display: isCard && children ? "contents" : undefined,
              ...(!isCard || !children ? textStyle : {})
            }}>
              {children ?? displayLabel}
            </span>
        )}
        {needsTrailing && !loading && (
            <ChevronRight size={variant === "field" ? iconSize : 17} strokeWidth={2} />
        )}
      </button>
  );
}
