"use client";
import { useTheme } from "@/contexts/ThemeContext";

import { FitText } from "@/components/fit/FitText";

type Props = {
    label: string;
    date: string;
};

export default function ActivityItem({ label, date }: Props) {
    const { colors } = useTheme();
    return (
        <div style={{
            backgroundColor: colors.surface,
            borderRadius: 12,
            padding: 14,
            display: "flex",
            justifyContent: "space-between",
            gap: 12
        }}>
            <FitText as="span" style={{ fontSize: 13, fontWeight: 600 }}>{label}</FitText>
            <FitText as="span" style={{ fontSize: 12, color: colors.textMuted }}>{date}</FitText>
        </div>
    );
}