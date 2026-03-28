"use client";
import type { CSSProperties, ReactNode, SelectHTMLAttributes } from "react";
import { ChevronRight, ChevronDown, Star } from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { useTheme, useFontClass } from "@/contexts/ThemeContext";
import { cn } from "@/utils/cn";
import { makeFitCardStyles } from "@/styles/fitStyles";

import { FitText } from "./FitText";

type FitCardProps = {
  icon?: LucideIcon;
  iconSize?: number;
  label?: string;
  subtitle?: string;
  hasBorder?: boolean;
  hasDropdown?: boolean;
  noChevron?: boolean;
  iconBg?: string;
  trailingLabel?: string;
  trailingLabelColor?: string;
  progress?: number;
  onPress?: () => void;
  children?: ReactNode;
  statValue?: string;
  statMode?: boolean;
  statLabel?: string;
  statValueStyle?: CSSProperties;
  emoji?: string;
  avatarInitials?: string;
  rating?: number;
  selected?: boolean;
  renderMode?: "default" | "custom";
  contentStyle?: CSSProperties;
};

export default function FitCard({
  icon: Icon,
  iconSize = 20,
  label,
  subtitle,
  hasBorder = false,
  hasDropdown = false,
  noChevron = false,
  iconBg,
  trailingLabel,
  trailingLabelColor,
  progress,
  onPress,
  children,
  statValue,
  statMode = false,
  statLabel,
  statValueStyle,
  emoji,
  avatarInitials,
  rating,
  selected = false,
  renderMode = "default",
  contentStyle
}: FitCardProps) {
  const { colors } = useTheme();
  const s = makeFitCardStyles(colors);

  if (statMode) {
    return (
        <div style={{
          backgroundColor: colors.surface,
          border: `1px solid ${colors.border}`,
          borderRadius: 12,
          padding: 16,
          minHeight: 96,
          display: "flex",
          flexDirection: "column",
          justifyContent: "center"
        }}>
          {Icon ? <Icon size={15} color={colors.brand} style={{ marginBottom: 8 }} /> : null}
          <FitText as="p" style={{ fontSize: 11, color: colors.textMuted }}>{statLabel ?? label}</FitText>
          <FitText as="p" style={{ fontSize: 22, fontWeight: 700, marginTop: 4, ...statValueStyle }}>
            {statValue ?? children}
          </FitText>
        </div>
    );
  }
  if (statValue !== undefined && !statMode) {
    return (
        <div style={{ ...s.row, flexDirection: "column", alignItems: "flex-start" }}>
          {Icon ? <Icon size={iconSize} color={colors.brand} /> : null}
          <FitText style={{ fontSize: 20, fontWeight: 700 }}>{statValue}</FitText>
          <FitText style={{ fontSize: 12, color: colors.textMuted }}>{label}</FitText>
        </div>
    );
  }
  if (renderMode === "custom") {
    return (
        <div style={{ marginBottom: hasBorder ? 8 : 0 }}>
          <div style={{ ...s.row, ...contentStyle }}>
            {children}
          </div>
        </div>
    );
  }

  const showChevron = !noChevron && (hasDropdown || onPress !== undefined);
  const trailColor = trailingLabelColor ?? colors.brand;
  return (
      <div style={{ marginBottom: hasBorder ? 8 : 0 }}>
        <div
            style={{
              ...s.row,
              cursor: onPress || hasDropdown ? "pointer" : "default",
              ...(selected ? { border: `1.5px solid ${colors.brand}`, backgroundColor: `${colors.brand}08` } : undefined)
            }}
            onClick={() => { if (!hasDropdown) onPress?.(); }}
        >
          <div style={s.iconWrap(iconBg)}>
            {emoji ? (
                <span>{emoji}</span>
            ) : avatarInitials ? (
                <span style={{ color: colors.brand }}>{avatarInitials}</span>
            ) : Icon ? (
                <Icon size={iconSize} color={iconBg ? colors.textPrimary : colors.brand} />
            ) : null}
          </div>
          <div style={{ flex: 1, display: "grid", gap: subtitle ? 6 : 0 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
              <FitText as="span" style={{ fontSize: 15, fontWeight: 700, color: colors.textPrimary }}>
                {label}
              </FitText>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                {rating !== undefined ? (
                    <div style={s.ratingWrap}>
                      <Star size={13} color={colors.warning} />
                      <FitText as="span" style={{ color: colors.textPrimary }}>{rating}</FitText>
                    </div>
                ) : null}
                {trailingLabel ? (
                    <div style={s.trailingBadge(trailColor)}>
                      <FitText as="span" style={{ color: trailColor }}>{trailingLabel}</FitText>
                    </div>
                ) : null}
              </div>
            </div>
            {subtitle ? <FitText as="p" style={{ fontSize: 13, color: colors.textMuted }}>{subtitle}</FitText> : null}
            {progress !== undefined ? (
                <div style={s.progressTrack}>
                  <div style={s.progressFill(progress, trailColor)} />
                </div>
            ) : null}
          </div>
          {showChevron ? (
              hasDropdown ? (
                  <ChevronDown size={18} color={colors.textMuted} />
              ) : (
                  <ChevronRight size={18} color={colors.textMuted} />
              )
          ) : null}
        </div>
        {hasDropdown ? (
            <div style={s.dropdownContent}>{children}</div>
        ) : null}
      </div>
  );
}

type FitKpiCardProps = {
  icon: LucideIcon;
  label: string;
  value: string | number;
  color?: string;
  style?: CSSProperties;
  labelStyle?: CSSProperties;
  valueStyle?: CSSProperties;
};

export function FitKpiCard({ icon: Icon, label, value, color, style, labelStyle, valueStyle }: FitKpiCardProps) {
  const { colors } = useTheme();
  const iconColor = color ?? colors.brand;
  return (
      <div className="fit-kpi-card" style={style}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
          <Icon size={15} color={iconColor} />
          <FitText style={{ fontSize: 12, color: colors.textMuted, ...labelStyle }}>{label}</FitText>
        </div>
        <FitText style={{ fontSize: 24, fontWeight: 700, ...valueStyle }}>{value}</FitText>
      </div>
  );
}

export type FitSelectOption = {
  label: string;
  value: string;
};

type FitSelectProps = Omit<SelectHTMLAttributes<HTMLSelectElement>, "children"> & {
  options: FitSelectOption[];
  placeholder?: string;
  compact?: boolean;
  fullWidth?: boolean;
};

export function FitSelect({ options, placeholder, compact = false, fullWidth = false, className, style, value, defaultValue, ...props }: FitSelectProps) {
  const { colors } = useTheme();
  const fontClass = useFontClass();
  const s = makeFitCardStyles(colors);
  const controlStyle = s.selectControl(compact, fullWidth, !!props.disabled);
  const hasPlaceholder = Boolean(placeholder);
  const selectedValue = typeof value === "string" ? value : undefined;
  const selectedDefaultValue = typeof defaultValue === "string" ? defaultValue : undefined;
  return (
      <div style={s.selectWrap(fullWidth)}>
        <select
            {...props}
            value={selectedValue}
            defaultValue={selectedDefaultValue}
            className={cn(fontClass, className)}
            style={{ ...controlStyle, ...style }}
        >
          {hasPlaceholder && <option value="">{placeholder}</option>}
          {options.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
          ))}
        </select>
        <ChevronDown
            size={16}
            color={colors.textMuted}
            strokeWidth={2}
            style={s.selectChevron}
        />
      </div>
  );
}
