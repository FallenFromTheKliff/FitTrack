import type { CSSProperties } from "react";
import { BORDER_RADIUS, type ThemeColors } from "@fittrack/ui/tokens";

export const modalStyles = (colors: ThemeColors) => ({
  overlay: {
    position: "fixed" as const,
    inset: 0,
    backgroundColor: colors.overlay,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1200,
    padding: 20
  },
  container: {
    position: "relative" as const,
    backgroundColor: colors.surface,
    borderRadius: 16,
    boxShadow: "0 20px 25px -5px rgba(0,0,0,0.2)",
    maxWidth: 500,
    width: "90%",
    maxHeight: "90vh",
    display: "flex",
    flexDirection: "column" as const
  },
  header: {
    padding: "20px 24px",
    borderBottom: `1px solid ${colors.border}`,
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between"
  },
  headerLeft: {
    display: "flex",
    alignItems: "flex-start",
    gap: 12
  } as CSSProperties,
  headerText: {
    display: "flex",
    flexDirection: "column" as const,
    justifyContent: "center",
    gap: 4
  } as CSSProperties,
  headerIconWrap: {
    backgroundColor: colors.brand,
    borderRadius: BORDER_RADIUS.card,
    width: 32,
    height: 32,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0
  } as CSSProperties,
  title: {
    fontSize: 18,
    fontWeight: 700,
    color: colors.textPrimary
  },
  subtitle: {
    fontSize: 12,
    color: colors.textMuted,
    margin: 0,
    lineHeight: 1.2
  } as CSSProperties,
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: colors.surfaceRaised,
    border: `1px solid ${colors.border}`,
    cursor: "pointer",
    color: colors.textMuted,
    display: "flex",
    alignItems: "center",
    justifyContent: "center"
  },
  content: {
    flex: 1,
    overflow: "auto",
    padding: "20px 24px"
  },
  footer: {
    padding: "16px 24px",
    borderTop: `1px solid ${colors.border}`,
    display: "flex",
    gap: 12,
    justifyContent: "flex-end"
  },
  field: {
    marginBottom: 12
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: 600,
    color: colors.textPrimary,
    marginBottom: 4,
    display: "block"
  },
  fieldInput: {
    width: "100%",
    padding: "10px 12px",
    borderRadius: 8,
    border: `1px solid ${colors.fieldBorder}`,
    backgroundColor: colors.fieldBg,
    color: colors.textPrimary,
    fontSize: 14,
    fontFamily: "inherit",
    outline: "none"
  },
  fieldTextarea: {
    resize: "vertical",
    minHeight: 96,
    lineHeight: 1.5
  } as CSSProperties,
  fieldSelect: {
    width: "100%",
    padding: "10px 12px",
    borderRadius: 8,
    border: `1px solid ${colors.fieldBorder}`,
    backgroundColor: colors.fieldBg,
    color: colors.textPrimary,
    fontSize: 14,
    fontFamily: "inherit",
    outline: "none"
  },
  radioGroup: {
    display: "flex",
    flexDirection: "column" as const,
    gap: 8
  },
  radioOption: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    padding: "10px 12px",
    borderRadius: 8,
    border: `1px solid ${colors.border}`,
    cursor: "pointer"
  },
  radioOptionSelected: {
    backgroundColor: `${colors.brand}15`,
    borderColor: colors.brand
  },
  radioInput: {
    width: 16,
    height: 16,
    cursor: "pointer"
  },
  confirmMessage: {
    fontSize: 14,
    color: colors.textSecondary
  },
  readOnlyBanner: {
    padding: "10px 14px",
    marginBottom: 12,
    borderRadius: 8,
    backgroundColor: `${colors.brand}10`,
    border: `1px solid ${colors.brand}30`
  } as CSSProperties,
  readOnlyBannerText: {
    fontSize: 13,
    color: colors.brand
  } as CSSProperties,
  hintText: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 4,
    display: "block"
  } as CSSProperties,
  errorText: {
    fontSize: 12,
    color: colors.danger,
    marginTop: 4,
    display: "block"
  } as CSSProperties,
  requiredAsterisk: {
    color: colors.danger,
    marginLeft: 2
  } as CSSProperties,
  readOnlyField: {
    opacity: 0.7,
    cursor: "default"
  } as CSSProperties,
  readOnlyRadio: {
    pointerEvents: "none" as const,
    opacity: 0.7
  } as CSSProperties,
  otpBox: (filled: boolean): CSSProperties => ({
    width: 44,
    height: 52,
    borderRadius: 8,
    border: `1.5px solid ${filled ? colors.brand : colors.border}`,
    backgroundColor: colors.fieldBg,
    color: colors.textPrimary,
    fontSize: 22,
    fontWeight: 700,
    textAlign: "center",
    outline: "none",
    transition: "border-color 0.15s"
  }),
  otpRow: {
    display: "flex",
    gap: 8,
    justifyContent: "center",
    marginBottom: 16
  } as CSSProperties,
  otpInstruction: {
    fontSize: 13,
    color: colors.textMuted,
    textAlign: "center" as const,
    marginBottom: 18
  } as CSSProperties,
  otpResendRow: {
    display: "flex",
    justifyContent: "center",
    gap: 6,
    marginTop: 14
  } as CSSProperties,
  otpResendText: {
    fontSize: 12,
    color: colors.textMuted
  } as CSSProperties,
  otpResendBtn: {
    fontSize: 12,
    padding: 0,
    fontWeight: 600
  } as CSSProperties,
  demoBanner: {
    backgroundColor: colors.surfaceRaised,
    borderRadius: 8,
    padding: "8px 12px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    marginBottom: 16
  } as CSSProperties,
  demoBannerLabel: {
    fontSize: 12,
    color: colors.brand,
    fontWeight: 600
  } as CSSProperties,
  demoBannerHint: {
    fontSize: 12,
    color: colors.textMuted
  } as CSSProperties,
  demoBannerCode: {
    fontSize: 12,
    fontWeight: 700
  } as CSSProperties,
  errorBanner: {
    backgroundColor: `${colors.danger}15`,
    border: `1px solid ${colors.danger}40`,
    borderRadius: 8,
    padding: "8px 12px",
    marginBottom: 12
  } as CSSProperties,
  errorBannerText: {
    fontSize: 12,
    color: colors.danger
  } as CSSProperties,
  securityFieldWrap: {
    display: "grid",
    gap: 4
  } as CSSProperties,
  securityInputRow: (borderColor: string): CSSProperties => ({
    display: "flex",
    alignItems: "center",
    gap: 8,
    border: `1px solid ${borderColor}`,
    borderRadius: 8,
    backgroundColor: colors.fieldBg,
    padding: "0 10px",
    height: 42
  }),
  securityInput: {
    width: "100%",
    border: "none",
    outline: "none",
    background: "transparent",
    color: colors.textPrimary,
    fontSize: 14,
    fontFamily: "inherit"
  } as CSSProperties,
  securityVisibilityToggle: {
    border: "none",
    background: "transparent",
    cursor: "pointer",
    color: colors.textMuted,
    padding: 0
  } as CSSProperties,
  securityErrorText: {
    fontSize: 12,
    color: colors.danger
  } as CSSProperties,
  calendarPadding: {
    padding: 14
  } as CSSProperties,
  calendarViewRow: {
    display: "grid",
    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
    gap: 8,
    marginBottom: 10
  } as CSSProperties,
  calendarBody: {
    minHeight: 316,
    display: "flex",
    flexDirection: "column" as const,
    justifyContent: "flex-start"
  } as CSSProperties,
  calendarMonthLabel: {
    fontSize: 13,
    fontWeight: 700
  } as CSSProperties,
  calendarGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(7, 1fr)",
    gap: 8
  } as CSSProperties,
  calendarMonthGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(3, 1fr)",
    gap: 8,
    flex: 1,
    alignContent: "start"
  } as CSSProperties,
  calendarYearGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(4, 1fr)",
    gap: 8,
    flex: 1,
    alignContent: "start"
  } as CSSProperties,
  calendarWeekDay: {
    fontSize: 11,
    color: colors.textMuted,
    textAlign: "center" as const,
    fontWeight: 600
  } as CSSProperties,
  calendarEmptyCell: {
    height: 40
  } as CSSProperties,
  calendarDayBtn: (isSelected: boolean, isToday: boolean): CSSProperties => ({
    height: 40,
    borderRadius: 8,
    border: `1px solid ${isSelected ? colors.brand : colors.border}`,
    backgroundColor: isSelected ? `${colors.brand}22` : colors.surfaceRaised,
    color: isSelected ? colors.brand : colors.textPrimary,
    fontSize: 12,
    fontWeight: isToday ? 700 : 500
  }),
  calendarViewBtn: (isActive: boolean): CSSProperties => ({
    width: "100%",
    minHeight: 36,
    borderRadius: 10,
    border: `1px solid ${isActive ? colors.brand : colors.border}`,
    backgroundColor: isActive ? `${colors.brand}18` : colors.surfaceRaised,
    color: isActive ? colors.brand : colors.textPrimary,
    fontSize: 12,
    fontWeight: 700
  }),
  calendarPickerBtn: (isActive: boolean): CSSProperties => ({
    width: "100%",
    minHeight: 44,
    borderRadius: 10,
    border: `1px solid ${isActive ? colors.brand : colors.border}`,
    backgroundColor: isActive ? `${colors.brand}18` : colors.surfaceRaised,
    color: isActive ? colors.brand : colors.textPrimary,
    fontSize: 13,
    fontWeight: isActive ? 700 : 600
  }),
  calendarFooter: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 10,
    marginTop: 14
  } as CSSProperties,
  calendarClearBtn: {
    height: 38,
    minWidth: 120,
    padding: "0 18px",
    fontSize: 13,
    fontWeight: 600
  } as CSSProperties,
  calendarTodayBtn: {
    border: `1px solid ${colors.brand}`,
    backgroundColor: `${colors.brand}14`,
    color: colors.brand,
    height: 32,
    minWidth: 76,
    padding: "0 10px",
    fontSize: 12,
    fontWeight: 700
  } as CSSProperties
});