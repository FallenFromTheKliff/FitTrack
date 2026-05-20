"use client";

import type { CSSProperties, ReactNode } from "react";
import { useMemo } from "react";
import { motion } from "framer-motion";
import type { LucideIcon } from "lucide-react";
import { ChevronRight, Lock } from "lucide-react";

import { useTheme } from "@/contexts/ThemeContext";
import FitButton from "@/components/fit/FitButton";
import { FitText } from "@/components/fit/FitText";
import { getMemberOnlyToneColor, makeMemberOnlyStyles } from "@/styles/memberOnlyStyles";

type ThemeColors = ReturnType<typeof useTheme>["colors"];
type Tone = "brand" | "danger" | "muted" | "success" | "warning";
type Density = "normal" | "compact";
type TextVariant = "body" | "brand" | "eyebrow" | "muted" | "subtitle" | "title";

export function getToneColor(tone: Tone, colors: ThemeColors) {
  return getMemberOnlyToneColor(tone, colors);
}

export function MemberOnlyScreen({ children }: { children: ReactNode }) {
  const { colors } = useTheme();
  const s = useMemo(() => makeMemberOnlyStyles(colors), [colors]);

  return (
    <motion.div
      className="member-only-screen"
      style={s.screen}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18, ease: "easeOut" }}
    >
      <div className="member-only-content">{children}</div>
    </motion.div>
  );
}

export function MemberSection({
  action,
  children,
  heading,
  style,
}: {
  action?: ReactNode;
  children: ReactNode;
  heading: string;
  style?: CSSProperties;
}) {
  const { colors } = useTheme();
  const s = useMemo(() => makeMemberOnlyStyles(colors), [colors]);

  return (
    <section className="member-only-stack" style={style}>
      <div style={s.sectionHeaderRow}>
        <FitText as="h2" style={s.sectionHeading} excludeGlobalScale>
          {heading}
        </FitText>
        {action ?? null}
      </div>
      {children}
    </section>
  );
}

export function MemberSurface({
  children,
  className,
  dashed = false,
  padded = false,
  style,
}: {
  children: ReactNode;
  className?: string;
  dashed?: boolean;
  padded?: boolean;
  style?: CSSProperties;
}) {
  const { colors } = useTheme();
  const s = useMemo(() => makeMemberOnlyStyles(colors), [colors]);
  const surfaceStyle = padded ? s.surface(dashed, { ...s.surfacePadded, ...style }) : s.surface(dashed, style);

  return (
    <motion.div
      className={className}
      style={surfaceStyle}
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.16, ease: "easeOut" }}
    >
      {children}
    </motion.div>
  );
}

export function MemberCard({
  avatarInitials,
  children,
  density = "normal",
  hasBorder = false,
  icon: Icon,
  iconBg,
  iconColor,
  label,
  onClick,
  progress,
  selected = false,
  subtitle,
  trailingLabel,
  trailingTone = "brand",
}: {
  avatarInitials?: string;
  children?: ReactNode;
  density?: Density;
  hasBorder?: boolean;
  icon?: LucideIcon;
  iconBg?: string;
  iconColor?: string;
  label: string;
  onClick?: () => void;
  progress?: number;
  selected?: boolean;
  subtitle?: ReactNode;
  trailingLabel?: string;
  trailingTone?: Tone;
}) {
  const { colors } = useTheme();
  const s = useMemo(() => makeMemberOnlyStyles(colors), [colors]);
  const toneColor = getToneColor(trailingTone, colors);
  const baseStyle = s.card(selected, hasBorder, !!onClick, density);

  const content = (
    <>
      <div style={s.cardIcon(iconBg, iconColor, density)}>
        {avatarInitials ? (
          <FitText style={s.cardIconLabel(iconColor, density)} excludeGlobalScale>
            {avatarInitials}
          </FitText>
        ) : Icon ? (
          <Icon size={density === "compact" ? 17 : 19} strokeWidth={2} />
        ) : null}
      </div>
      <div style={s.cardBody(!!subtitle, density)}>
        <div style={s.cardTitleRow}>
          <FitText style={s.cardTitle} excludeGlobalScale>
            {label}
          </FitText>
          {trailingLabel ? <span style={s.trailingPill(toneColor)}>{trailingLabel}</span> : null}
        </div>
        {subtitle ? (
          <FitText as="p" style={s.cardSubtitle} excludeGlobalScale>
            {subtitle}
          </FitText>
        ) : null}
        {progress !== undefined ? <ProgressBar progress={progress} color={toneColor} /> : null}
        {children ?? null}
      </div>
      {onClick ? <ChevronRight size={18} color={colors.textMuted} strokeWidth={2} /> : null}
    </>
  );

  if (onClick) {
    return (
      <motion.button
        type="button"
        style={baseStyle}
        onClick={onClick}
        whileHover={{ y: -1 }}
        whileTap={{ scale: 0.995 }}
        transition={{ duration: 0.14, ease: "easeOut" }}
      >
        {content}
      </motion.button>
    );
  }

  return <div style={baseStyle}>{content}</div>;
}

export function StatTile({
  icon: Icon,
  label,
  variant = "stacked",
  value,
  tone = "brand",
}: {
  icon?: LucideIcon;
  label: string;
  variant?: "stacked" | "inline";
  value: string;
  tone?: Tone;
}) {
  const { colors } = useTheme();
  const s = useMemo(() => makeMemberOnlyStyles(colors), [colors]);
  const toneColor = getToneColor(tone, colors);
  const isInline = variant === "inline";

  return (
    <div style={isInline ? s.statTileInline : s.statTile}>
      {Icon ? (
        isInline ? (
          <div style={s.statTileIconPanel(toneColor)}>
            <Icon size={28} color={toneColor} strokeWidth={1.9} />
          </div>
        ) : (
          <Icon size={16} color={toneColor} strokeWidth={2} />
        )
      ) : null}
      {isInline ? (
        <div style={s.statTileBody}>
          <FitText style={s.statLabelInline} excludeGlobalScale>
            {label}
          </FitText>
          <FitText style={s.statValueInline} excludeGlobalScale>
            {value}
          </FitText>
        </div>
      ) : (
        <>
          <FitText style={s.statLabel} excludeGlobalScale>
            {label}
          </FitText>
          <FitText style={s.statValue} excludeGlobalScale>
            {value}
          </FitText>
        </>
      )}
    </div>
  );
}

export function ProgressBar({ color, progress }: { color?: string; progress: number }) {
  const { colors } = useTheme();
  const s = useMemo(() => makeMemberOnlyStyles(colors), [colors]);

  return (
    <div style={s.progressTrack}>
      <div style={s.progressFill(progress, color)} />
    </div>
  );
}

export function EmptyState({
  hint,
  icon: Icon,
  title,
}: {
  hint: string;
  icon?: LucideIcon;
  title: string;
}) {
  const { colors } = useTheme();
  const s = useMemo(() => makeMemberOnlyStyles(colors), [colors]);

  return (
    <div style={s.emptyState}>
      {Icon ? <Icon size={40} color={colors.textMuted} strokeWidth={1.5} /> : null}
      <FitText style={s.emptyTitle} excludeGlobalScale>
        {title}
      </FitText>
      <FitText as="p" style={s.emptyHint} excludeGlobalScale>
        {hint}
      </FitText>
    </div>
  );
}

export function PremiumGate({
  actionHref,
  actionLabel,
  eyebrow = "MEMBERSHIP CARD REQUIRED",
  icon: Icon = Lock,
  message,
  statusLabel,
  title,
}: {
  actionHref?: string;
  actionLabel?: string;
  eyebrow?: string;
  icon?: LucideIcon;
  message: string;
  statusLabel?: string;
  title: string;
}) {
  const { colors } = useTheme();
  const s = useMemo(() => makeMemberOnlyStyles(colors), [colors]);

  return (
    <MemberSurface dashed style={s.gateSurface}>
      <div style={s.gateHeader}>
        <div style={s.gateIcon}>
          <Icon size={18} color={colors.brand} strokeWidth={2} />
        </div>
        <div style={s.gateCopy}>
          <FitText style={s.gateEyebrow} excludeGlobalScale>
            {eyebrow}
          </FitText>
          <FitText style={s.gateTitle} excludeGlobalScale>
            {title}
          </FitText>
        </div>
        {statusLabel ? <span style={s.gateStatus}>{statusLabel}</span> : null}
      </div>
      <FitText as="p" style={s.gateMessage} excludeGlobalScale>
        {message}
      </FitText>
      {actionHref && actionLabel ? (
        <FitButton
          variant="primary"
          label={actionLabel}
          onClick={() => {
            window.location.href = actionHref;
          }}
        />
      ) : null}
    </MemberSurface>
  );
}

export function ChipButton({
  active,
  children,
  disabled,
  onClick,
}: {
  active: boolean;
  children: ReactNode;
  disabled?: boolean;
  onClick: () => void;
}) {
  const { colors } = useTheme();
  const s = useMemo(() => makeMemberOnlyStyles(colors), [colors]);

  return (
    <motion.button
      type="button"
      disabled={disabled}
      onClick={onClick}
      style={s.chip(active, disabled)}
      whileHover={disabled ? undefined : { y: -1 }}
      whileTap={disabled ? undefined : { scale: 0.98 }}
      transition={{ duration: 0.14, ease: "easeOut" }}
    >
      {children}
    </motion.button>
  );
}

export function MemberText({
  as,
  children,
  variant = "body",
}: {
  as?: "h1" | "h2" | "h3" | "p" | "span" | "small";
  children: ReactNode;
  variant?: TextVariant;
}) {
  const { colors } = useTheme();
  const s = useMemo(() => makeMemberOnlyStyles(colors), [colors]);

  return (
    <FitText as={as} style={s.text(variant)} excludeGlobalScale>
      {children}
    </FitText>
  );
}

export function MemberHero({
  children,
  eyebrow,
  subtitle,
  title,
}: {
  children?: ReactNode;
  eyebrow: string;
  subtitle?: ReactNode;
  title: ReactNode;
}) {
  const { colors } = useTheme();
  const s = useMemo(() => makeMemberOnlyStyles(colors), [colors]);

  return (
    <motion.div
      style={s.hero}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18, ease: "easeOut" }}
    >
      <FitText style={s.heroText("caption")} excludeGlobalScale>
        {eyebrow}
      </FitText>
      <FitText as="h2" style={s.heroText("title")} excludeGlobalScale>
        {title}
      </FitText>
      {subtitle ? (
        <FitText as="p" style={s.heroText("body")} excludeGlobalScale>
          {subtitle}
        </FitText>
      ) : null}
      {children ?? null}
    </motion.div>
  );
}

export function MemberPill({
  children,
  tone = "brand",
}: {
  children: ReactNode;
  tone?: Tone;
}) {
  const { colors } = useTheme();
  const s = useMemo(() => makeMemberOnlyStyles(colors), [colors]);

  return <span style={s.pill(tone)}>{children}</span>;
}

export function MemberGrid({
  children,
  columns = 2,
  compactPair = false,
}: {
  children: ReactNode;
  columns?: 2 | 3 | 4;
  compactPair?: boolean;
}) {
  const pairClass = compactPair ? " member-only-quick-grid" : "";
  return <div className={`member-only-grid-${columns}${pairClass}`}>{children}</div>;
}

export function MemberStack({ children }: { children: ReactNode }) {
  return <div className="member-only-stack">{children}</div>;
}

export function MemberPanelHeader({
  action,
  eyebrow,
  title,
}: {
  action?: ReactNode;
  eyebrow?: string;
  title: ReactNode;
}) {
  const { colors } = useTheme();
  const s = useMemo(() => makeMemberOnlyStyles(colors), [colors]);

  return (
    <div style={s.splitRow}>
      <div>
        {eyebrow ? <MemberText variant="brand">{eyebrow}</MemberText> : null}
        <MemberText as="h3" variant="body">
          {title}
        </MemberText>
      </div>
      {action ?? null}
    </div>
  );
}

export function MemberProgressRow({
  label,
  progress,
  tone = "brand",
  value,
}: {
  label: string;
  progress: number;
  tone?: Tone;
  value: string;
}) {
  const { colors } = useTheme();
  const s = useMemo(() => makeMemberOnlyStyles(colors), [colors]);
  const toneColor = getToneColor(tone, colors);

  return (
    <MemberStack>
      <div style={s.splitRow}>
        <MemberText variant="body">{label}</MemberText>
        <MemberText variant="muted">{value}</MemberText>
      </div>
      <ProgressBar progress={progress} color={toneColor} />
    </MemberStack>
  );
}

export function MemberToneSurface({
  children,
  tone = "brand",
}: {
  children: ReactNode;
  tone?: Tone;
}) {
  const { colors } = useTheme();
  const s = useMemo(() => makeMemberOnlyStyles(colors), [colors]);

  return <div style={s.toneSurface(tone)}>{children}</div>;
}

export function MemberSwatch({
  base,
  brand,
}: {
  base: string;
  brand: string;
}) {
  const { colors } = useTheme();
  const s = useMemo(() => makeMemberOnlyStyles(colors), [colors]);

  return <span style={s.swatch(base, brand)} />;
}
