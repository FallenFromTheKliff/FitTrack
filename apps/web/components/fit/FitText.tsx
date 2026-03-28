"use client";
import { forwardRef, type HTMLAttributes, type InputHTMLAttributes, type TextareaHTMLAttributes, type CSSProperties } from "react";

import { useTheme, useFontClass } from "@/contexts/ThemeContext";
import { cn } from "@/utils/cn";
import { makeFitTextStyles } from "@/styles/fitStyles";
import { WEB_FONT_CLASSES } from "@fittrack/ui";

type FitTextSize = "xs" | "sm" | "md" | "lg" | "xl";
const FIT_TEXT_SCALE = 1.2;

const FIT_TEXT_SIZE_MAP: Record<FitTextSize, CSSProperties> = {
  xs: { fontSize: 11 * FIT_TEXT_SCALE },
  sm: { fontSize: 13 * FIT_TEXT_SCALE },
  md: { fontSize: 14 * FIT_TEXT_SCALE },
  lg: { fontSize: 16 * FIT_TEXT_SCALE },
  xl: { fontSize: 18 * FIT_TEXT_SCALE }
};

function scaleFontSizeValue(value: CSSProperties["fontSize"]) {
  if (typeof value === "number") return value * FIT_TEXT_SCALE;
  if (typeof value !== "string") return value;
  const match = value.trim().match(/^(-?\d*\.?\d+)(px|rem|em)?$/);
  if (!match) return value;
  const [, amount, unit = "px"] = match;
  return `${Number(amount) * FIT_TEXT_SCALE}${unit}`;
}

type FitTextProps = HTMLAttributes<HTMLElement> & {
  as?: "span" | "p" | "label" | "h1" | "h2" | "h3" | "h4" | "small";
  htmlFor?: string;
  size?: FitTextSize;
  scale?: number;
  excludeGlobalScale?: boolean;
};

export function FitText({
  as: Tag = "span",
  className = "",
  style,
  htmlFor,
  size,
  scale,
  excludeGlobalScale = false,
  ...props
}: FitTextProps) {
  const { colors } = useTheme();
  const fontClass = useFontClass();
  const s = makeFitTextStyles(colors);
  const sizeStyle = size ? FIT_TEXT_SIZE_MAP[size] : undefined;
  const scaleStyle = scale !== undefined ? { fontSize: `calc(1em * ${scale})` } : undefined;
  const scaledStyle = excludeGlobalScale || !style?.fontSize
    ? style
    : { ...style, fontSize: scaleFontSizeValue(style.fontSize) };
  return (
    <Tag
      {...props}
      htmlFor={Tag === "label" ? htmlFor : undefined}
      className={cn(fontClass, className)}
      style={{ ...s.text, ...sizeStyle, ...scaleStyle, ...scaledStyle }}
    />
  );
}

type StaticFitTextProps = HTMLAttributes<HTMLElement> & {
  as?: "span" | "p" | "label" | "h1" | "h2" | "h3" | "h4" | "small";
  fontKey?: "standard" | "retro" | "painter";
};

export function StaticFitText({ as: Tag = "span", fontKey = "standard", className = "", ...props }: StaticFitTextProps) {
  const fontClass = WEB_FONT_CLASSES[fontKey] ?? WEB_FONT_CLASSES.standard;
  return <Tag {...props} className={cn(fontClass, className)} />;
}

type FitTextInputProps = InputHTMLAttributes<HTMLInputElement>;
export const FitTextInput = forwardRef<HTMLInputElement, FitTextInputProps>(function FitTextInput(
  { className = "", style, ...props },
  ref
) {
  const { colors } = useTheme();
  const fontClass = useFontClass();
  const s = makeFitTextStyles(colors);
  return (
    <input
      {...props}
      ref={ref}
      className={cn("flex-1 bg-transparent outline-none text-sm border-none", fontClass, className)}
      style={{
        ...s.input(props.disabled),
        ...style
      }}
    />
  );
});

type FitTextAreaProps = TextareaHTMLAttributes<HTMLTextAreaElement>;
export const FitTextArea = forwardRef<HTMLTextAreaElement, FitTextAreaProps>(function FitTextArea(
  { className = "", style, ...props },
  ref
) {
  const { colors } = useTheme();
  const fontClass = useFontClass();
  const s = makeFitTextStyles(colors);
  return (
    <textarea
      {...props}
      ref={ref}
      className={cn("flex-1 bg-transparent outline-none text-sm resize-none border-none", fontClass, className)}
      style={{ ...s.area(props.disabled), ...style }}
    />
  );
});
