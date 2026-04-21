import type { CSSProperties } from "react";
import { BORDER_RADIUS, type ThemeColors } from "@fittrack/ui/tokens";

import type { FitButtonVariant } from "@/components/fit/FitButton";

export function makeFitButtonVariants(
    colors: ThemeColors,
    {
      active,
      isDisabled,
      iconOnly,
      accentColor,
      onBrandTextColor
    }: {
      active: boolean;
      isDisabled: boolean;
      iconOnly: boolean;
      accentColor: string;
      onBrandTextColor: string;
    }
): Record<FitButtonVariant, CSSProperties> {
  const onBrand = colors.onBrand ?? onBrandTextColor;
  return {
    primary: {
      backgroundColor: isDisabled ? colors.textDisabled : colors.brand,
      color: onBrand,
      padding: iconOnly ? "8px" : "11px 18px",
      border: "none",
      fontSize: 15,
      fontWeight: 700,
      borderRadius: BORDER_RADIUS.input
    },
    ghost: {
      backgroundColor: colors.surfaceRaised,
      color: colors.textSecondary,
      padding: iconOnly ? "8px" : "10px 18px",
      border: `1px solid ${colors.border}`,
      fontSize: 15,
      fontWeight: 600,
      borderRadius: BORDER_RADIUS.input
    },
    danger: {
      backgroundColor: colors.surfaceRaised,
      color: colors.danger,
      padding: iconOnly ? "8px" : "10px 18px",
      border: `1px solid ${colors.danger}`,
      fontSize: 15,
      fontWeight: 600,
      borderRadius: BORDER_RADIUS.input
    },
    link: {
      background: "transparent",
      color: isDisabled ? colors.textDisabled : accentColor,
      padding: "4px 0",
      border: "none",
      fontSize: 14,
      textDecoration: iconOnly ? "none" : "underline"
    },
    nav: {
      background: "transparent",
      color: colors.textMuted,
      padding: "9px 10px",
      border: "none",
      fontSize: 13,
      justifyContent: "flex-start",
      width: "100%"
    },
    navActive: {
      backgroundColor: colors.brand,
      color: onBrand,
      padding: "9px 10px",
      border: "none",
      fontSize: 13,
      justifyContent: "flex-start",
      width: "100%"
    },
    sidebarLogout: {
      background: "transparent",
      color: colors.danger,
      padding: "15px 14px",
      border: `1px solid ${colors.danger}`,
      fontSize: 14,
      fontWeight: 500,
      borderRadius: BORDER_RADIUS.card,
      justifyContent: "flex-start",
      width: "100%"
    },
    field: {
      backgroundColor: colors.fieldBg,
      color: colors.textPrimary,
      padding: "14px",
      border: `1px solid ${colors.fieldBorder}`,
      fontSize: 15,
      fontWeight: 500,
      borderRadius: BORDER_RADIUS.input,
      justifyContent: "space-between",
      textAlign: "left"
    },
    chip: {
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      padding: iconOnly ? "8px" : "8px 16px",
      borderRadius: BORDER_RADIUS.input,
      border: `1px solid ${active ? colors.brand : colors.border}`,
      backgroundColor: active ? `${colors.brand}18` : colors.surfaceRaised,
      color: active ? colors.brand : colors.textSecondary,
      fontSize: 13,
      fontWeight: active ? 600 : 400,
      cursor: "pointer",
      whiteSpace: "nowrap"
    },
    iconClear: {
      background: "none",
      border: "none",
      padding: 0,
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      cursor: "pointer",
      color: colors.textMuted
    },
    card: {
      backgroundColor: active ? `${colors.brand}12` : colors.surface,
      color: colors.textPrimary,
      border: `1px solid ${active ? colors.brand : colors.border}`,
      borderRadius: 12,
      padding: "12px",
      fontSize: 14,
      width: "100%",
      textAlign: "left",
      justifyContent: "flex-start",
      display: "flex",
      alignItems: "center",
      gap: 12,
      cursor: isDisabled ? "not-allowed" : "pointer"
    },
    overlay: {
      background: "transparent",
      color: "inherit",
      border: "1px solid currentColor",
      borderRadius: 6,
      padding: "2px 6px",
      fontSize: 10,
      fontWeight: 700,
      cursor: isDisabled ? "default" : "pointer"
    }
  };
}

export function makeFitCardStyles(colors: ThemeColors) {
  return {
    row: {
      display: "flex",
      alignItems: "center",
      gap: 12,
      padding: 12,
      backgroundColor: colors.surface,
      borderRadius: BORDER_RADIUS.card
    } as CSSProperties,
    iconWrap: (bg?: string): CSSProperties => ({
      width: 46,
      height: 46,
      borderRadius: BORDER_RADIUS.card,
      backgroundColor: bg ?? colors.surfaceRaised,
      display: "flex",
      alignItems: "center",
      justifyContent: "center"
    }),
    trailingBadge: (color: string): CSSProperties => ({
      padding: "4px 8px",
      borderRadius: BORDER_RADIUS.card,
      border: `1px solid ${color}`,
      backgroundColor: `${color}22`
    }),
    ratingWrap: {
      display: "flex",
      alignItems: "center",
      gap: 6,
      padding: "4px 8px",
      borderRadius: BORDER_RADIUS.card,
      backgroundColor: colors.surfaceRaised
    } as CSSProperties,
    progressTrack: {
      height: 6,
      backgroundColor: colors.surfaceRaised,
      borderRadius: 6,
      marginTop: 8
    } as CSSProperties,
    progressFill: (pct: number, color: string): CSSProperties => ({
      width: `${Math.min(pct, 1) * 100}%`,
      height: "100%",
      backgroundColor: color,
      borderRadius: 6
    }),
    dropdownContent: {
      marginTop: 8,
      borderTop: `1px solid ${colors.border}`,
      paddingTop: 8
    } as CSSProperties,
    selectWrap: (fullWidth: boolean): CSSProperties => ({
      position: "relative",
      width: fullWidth ? "100%" : "auto"
    }),
    selectControl: (compact: boolean, fullWidth: boolean, disabled: boolean): CSSProperties => ({
      width: fullWidth ? "100%" : "auto",
      minWidth: compact ? 148 : 180,
      height: compact ? 32 : 42,
      paddingLeft: compact ? 10 : 12,
      paddingRight: 34,
      borderRadius: 10,
      border: `1px solid ${colors.border}`,
      backgroundColor: colors.surfaceRaised,
      color: colors.textPrimary,
      fontSize: compact ? 13 : 14,
      outline: "none",
      appearance: "none",
      WebkitAppearance: "none",
      MozAppearance: "none",
      cursor: disabled ? "not-allowed" : "pointer"
    }),
    selectChevron: {
      position: "absolute",
      right: 10,
      top: "50%",
      transform: "translateY(-50%)",
      pointerEvents: "none"
    } as CSSProperties
  };
}

export function makeFitTextStyles(colors: ThemeColors) {
  return {
    text: {
      color: colors.textPrimary
    } as CSSProperties,
    input: (disabled?: boolean): CSSProperties => ({
      color: disabled ? colors.textDisabled : colors.textPrimary,
      WebkitTextFillColor: disabled ? colors.textDisabled : undefined
    }),
    area: (disabled?: boolean): CSSProperties => ({
      color: disabled ? colors.textDisabled : colors.textPrimary
    })
  };
}

export function makeFitInputFieldStyles(colors: ThemeColors, compact = false) {
  const vPad = compact ? 7 : 10;
  return {
    wrapper: {
      display: "flex",
      flexDirection: "column",
      gap: compact ? 2 : 3
    } as CSSProperties,
    labelRow: {
      display: "flex",
      alignItems: "baseline",
      gap: 4
    } as CSSProperties,
    inputRow: (borderColor: string, disabled: boolean): CSSProperties => ({
      display: "flex",
      alignItems: "center",
      borderRadius: BORDER_RADIUS.input,
      paddingLeft: 12,
      paddingRight: 12,
      paddingTop: vPad,
      paddingBottom: vPad,
      backgroundColor: disabled ? colors.surfaceRaised : colors.fieldBg,
      border: `1px solid ${borderColor}`,
      transition: "border-color 0.15s"
    }),
    eyeBtn: {
      paddingLeft: 8,
      display: "flex",
      alignItems: "center",
      color: colors.textMuted,
      background: "none",
      border: "none",
      cursor: "pointer"
    } as CSSProperties,
    errorRow: { height: 16 } as CSSProperties
  };
}

export function makeFitSectionStyles(colors: ThemeColors) {
  return {
    section: { marginBottom: 16 } as CSSProperties,
    headingRow: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: 12
    } as CSSProperties,
    heading: {
      fontSize: 11,
      fontWeight: 700,
      letterSpacing: "0.08em",
      textTransform: "uppercase",
      color: colors.textMuted
    } as CSSProperties,
    card: {
      backgroundColor: colors.surface,
      border: `1px solid ${colors.border}`,
      borderRadius: BORDER_RADIUS.card,
      overflow: "hidden"
    } as CSSProperties
  };
}

export function makeFitSearchStyles(colors: ThemeColors) {
  return {
    field: {
      display: "flex",
      alignItems: "center",
      gap: 10,
      backgroundColor: colors.surfaceRaised,
      border: `1px solid ${colors.border}`,
      borderRadius: BORDER_RADIUS.input,
      paddingLeft: 16,
      paddingRight: 12,
      paddingTop: 12,
      paddingBottom: 12
    } as CSSProperties,
    input: {
      flex: 1,
      fontSize: 15
    } as CSSProperties,
    actionBar: (style?: CSSProperties): CSSProperties => ({
      marginBottom: 14,
      ...style
    }),
    actionRow: (hasFilters: boolean): CSSProperties => ({
      display: "flex",
      alignItems: "center",
      gap: 16,
      flexWrap: "wrap",
      marginBottom: hasFilters ? 10 : 0
    }),
    searchWrap: {
      flex: "1 1 320px",
      minWidth: 220
    } as CSSProperties,
    actionsWrap: {
      display: "flex",
      alignItems: "center",
      gap: 8
    } as CSSProperties
  };
}

export function makeFitFilterStyles(colors: ThemeColors) {
  return {
    panel: {
      backgroundColor: colors.surface,
      borderColor: colors.border,
      padding: 14,
      borderRadius: 12,
      borderWidth: 1,
      borderStyle: "solid"
    } as CSSProperties,
    sectionLabel: {
      fontSize: 12,
      color: colors.textMuted,
      marginBottom: 10,
      display: "block"
    } as CSSProperties,
    chipWrap: {
      display: "flex",
      flexWrap: "wrap",
      gap: 8
    } as CSSProperties,
    dateRangeRow: {
      display: "flex",
      flexWrap: "wrap",
      gap: 8
    } as CSSProperties,
    resetLink: {
      color: colors.textMuted,
      textDecoration: "none",
      fontSize: 13
    } as CSSProperties,
    resetRow: {
      marginTop: 8,
      display: "flex",
      flexDirection: "column",
      gap: 4
    } as CSSProperties,
    inlineWrap: (isOpen: boolean, maxWidth: number, _canAnimate: boolean): CSSProperties => ({
      display: isOpen ? "flex" : "none",
      alignItems: "center",
      flexWrap: "wrap",
      columnGap: 8,
      rowGap: 8,
      overflow: "visible",
      whiteSpace: "normal",
      width: "100%",
      maxWidth,
      minWidth: 0
    }),
    inlineChip: {
      padding: "8px 14px",
      borderRadius: 8
    } as CSSProperties
  };
}
