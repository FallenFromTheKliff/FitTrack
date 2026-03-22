"use client";
import type { HTMLAttributes, InputHTMLAttributes, TextareaHTMLAttributes } from "react";

import { useTheme, useFontClass } from "@/contexts/ThemeContext";
import { cn } from "@/utils/cn";
import { makeFitTextStyles } from "@/styles/fitStyles";
import { WEB_FONT_CLASSES } from "@fittrack/ui";

type FitTextProps = HTMLAttributes<HTMLElement> & {
  as?: "span" | "p" | "label" | "h1" | "h2" | "h3" | "h4" | "small";
  htmlFor?: string;
};

export function FitText({ as: Tag = "span", className = "", style, htmlFor, ...props }: FitTextProps) {
  const { colors } = useTheme();
  const fontClass = useFontClass();
  const s = makeFitTextStyles(colors);
  return (
    <Tag
      {...props}
      htmlFor={Tag === "label" ? htmlFor : undefined}
      className={cn(fontClass, className)}
      style={{ ...s.text, ...style }}
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
export function FitTextInput({ className = "", style, ...props }: FitTextInputProps) {
  const { colors } = useTheme();
  const fontClass = useFontClass();
  const s = makeFitTextStyles(colors);
  return (
    <input
      {...props}
      className={cn("flex-1 bg-transparent outline-none text-sm border-none", fontClass, className)}
      style={{
        ...s.input(props.disabled),
        ...style
      }}
    />
  );
}

type FitTextAreaProps = TextareaHTMLAttributes<HTMLTextAreaElement>;
export function FitTextArea({ className = "", style, ...props }: FitTextAreaProps) {
  const { colors } = useTheme();
  const fontClass = useFontClass();
  const s = makeFitTextStyles(colors);
  return (
    <textarea
      {...props}
      className={cn("flex-1 bg-transparent outline-none text-sm resize-none border-none", fontClass, className)}
      style={{ ...s.area(props.disabled), ...style }}
    />
  );
}