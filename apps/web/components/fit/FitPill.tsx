"use client";
import type { CSSProperties } from "react";

import { useTheme } from "@/contexts/ThemeContext";

import FitButton from "./FitButton";
import { FitText } from "./FitText";

export type FitPillOption<T extends string = string> = {
    key: T;
    label: string;
};

type ToggleProps<T extends string = string> = {
    mode?: "toggle";
    options: FitPillOption<T>[];
    active: T;
    onChange: (key: T) => void;
    label?: never;
    color?: never;
    fontSize?: never;
    fontWeight?: never;
    borderOpacity?: never;
    bgOpacity?: never;
    style?: CSSProperties;
};

type StatusProps = {
    mode: "status";
    label: string;
    color?: string;
    fontSize?: number;
    fontWeight?: number;
    borderOpacity?: string;
    bgOpacity?: string;
    options?: never;
    active?: never;
    onChange?: never;
    style?: CSSProperties;
};

type Props<T extends string = string> = ToggleProps<T> | StatusProps;

export default function FitPill<T extends string = string>(props: Props<T>) {
    const { colors } = useTheme();

    if (props.mode === "status") {
        const {
            label,
            color,
            fontSize = 11,
            fontWeight = 700,
            borderOpacity = "55",
            bgOpacity = "18",
            style
        } = props;
        const tone = color ?? colors.brand;
        return (
            <span
                style={{
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    borderRadius: 999,
                    border: `1px solid ${tone}${borderOpacity}`,
                    padding: "3px 9px",
                    backgroundColor: `${tone}${bgOpacity}`,
                    ...style
                }}
            >
                <FitText as="span" style={{ color: tone, fontSize, fontWeight }}>
                    {label}
                </FitText>
            </span>
        );
    }

    const { options, active, onChange, style } = props as ToggleProps<T>;
    return (
        <div
            style={{
                display: "inline-flex",
                gap: 4,
                padding: 4,
                borderRadius: 10,
                backgroundColor: colors.surfaceRaised,
                border: `1px solid ${colors.border}`,
                ...style
            }}
        >
            {options.map((opt) => {
                const isActive = opt.key === active;
                return (
                    <FitButton
                        key={opt.key}
                        variant={isActive ? "primary" : "ghost"}
                        label={opt.label}
                        onClick={() => onChange(opt.key)}
                        style={{
                            padding: "5px 14px",
                            minHeight: 32,
                            borderRadius: 7,
                            border: `1px solid ${isActive ? colors.brand + "55" : "transparent"}`,
                            backgroundColor: isActive ? `${colors.brand}18` : "transparent"
                        }}
                        textStyle={{
                            fontSize: 12,
                            fontWeight: 600,
                            color: isActive ? colors.brand : colors.textMuted
                        }}
                    />
                );
            })}
        </div>
    );
}
