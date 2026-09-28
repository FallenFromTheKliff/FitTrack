"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { CheckCircle2, XCircle } from "lucide-react";
import { PASSWORD_REQUIREMENTS } from "@fittrack/app-config";

import { revisePassword } from "@fittrack/utils";
import { useTheme } from "@/contexts/ThemeContext";
import { FitText } from "@/components/fit/FitText";

type Props = {
  password: string;
  onValidationChange?: (isValid: boolean) => void;
};

export default function PasswordRequirements({ password, onValidationChange }: Props) {
  const { colors, settings } = useTheme();
  const contentRef = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState(0);
  const shouldAnimate = settings.animationLevel !== "none";

  useEffect(() => {
    if (contentRef.current) {
      setHeight(contentRef.current.scrollHeight);
    }
  }, [password]);

  const result = useMemo(() => revisePassword(password), [password]);
  const checks = PASSWORD_REQUIREMENTS.map((item) => ({ met: result[item.key], label: item.label }));
  const isValid = checks.every((item) => item.met);

  useEffect(() => {
    onValidationChange?.(isValid);
  }, [isValid, onValidationChange]);

  return (
    <div
      style={{
        overflow: "hidden",
        maxHeight: height || "none",
        opacity: height ? 1 : 0,
        transition: shouldAnimate ? "max-height 250ms ease, opacity 200ms ease" : "none"
      }}
    >
      <div
        ref={contentRef}
        style={{
          border: `1px solid ${colors.border}`,
          borderRadius: 10,
          backgroundColor: colors.surfaceRaised,
          padding: 10,
          marginTop: 8,
          display: "grid",
          gap: 6
        }}
      >
        <FitText style={{ fontSize: 12, fontWeight: 700, color: colors.textSecondary }}>
          Password Requirements
        </FitText>
        {checks.map((item) => (
          <div key={item.label} style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {item.met ? (
              <CheckCircle2 size={14} color={colors.success} />
            ) : (
              <XCircle size={14} color={colors.danger} />
            )}
            <FitText style={{ fontSize: 12, color: item.met ? colors.success : colors.textMuted }}>
              {item.label}
            </FitText>
          </div>
        ))}
      </div>
    </div>
  );
}
