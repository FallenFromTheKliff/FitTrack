"use client";
import { motion } from "framer-motion";
import type { MotionStyle } from "framer-motion";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";

import { useTheme } from "@/contexts/ThemeContext";
import { formatScheduleDate } from "@fittrack/utils";

import { FitText } from "@/components/fit/FitText";
import FitButton from "@/components/fit/FitButton";

type Props = {
    date: Date;
    dateSlideStyle: MotionStyle;
    onPrevDay: () => void;
    onNextDay: () => void;
    onOpenCalendar: () => void;
};

export default function TimelineHeader({ date, dateSlideStyle, onPrevDay, onNextDay, onOpenCalendar }: Props) {
    const { colors } = useTheme();
    return (
        <div style={{
            display: "flex", alignItems: "center", justifyContent: "center",
            gap: 14, padding: "15px 16px",
            borderBottom: `1px solid ${colors.border}`
        }}>
            <FitButton
                variant="link" icon={ChevronLeft} iconSize={18} iconOnly
                onClick={onPrevDay}
                style={{ padding: 6, textDecoration: "none", color: colors.textMuted }}
            />
            <motion.button
                type="button"
                onClick={onOpenCalendar}
                style={{ display: "flex", alignItems: "center", gap: 8, border: "none", background: "transparent", cursor: "pointer", padding: 0, ...dateSlideStyle }}
                aria-label="Choose date"
            >
                <CalendarDays size={14} color={colors.brand} />
                <FitText style={{ fontSize: 14, fontWeight: 600 }}>{formatScheduleDate(date)}</FitText>
            </motion.button>
            <FitButton
                variant="link" icon={ChevronRight} iconSize={18} iconOnly
                onClick={onNextDay}
                style={{ padding: 6, textDecoration: "none", color: colors.textMuted }}
            />
        </div>
    );
}