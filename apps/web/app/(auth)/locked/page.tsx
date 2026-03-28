"use client";
import { useRouter } from "next/navigation";
import { Lock, AlertTriangle } from "lucide-react";
import { useTheme } from "@/contexts/ThemeContext";
import { useFadeIn } from "@/hooks/animations/useFadeIn";
import { useThemeTransition } from "@/hooks/animations/useThemeTransition";
import { LOCKED_PAGE_COPY } from "./helpers";

import { FitText } from "@/components/fit/FitText";
import FitButton from "@/components/fit/FitButton";

export default function LockedPage() {
  const { colors } = useTheme();
  const router = useRouter();
  const fadeIn = useFadeIn();
  const themeTransition = useThemeTransition();

  return (
    <main className={themeTransition} style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 16, backgroundColor: colors.base, ...fadeIn }}>
      <div style={{ maxWidth: 400, width: "100%", textAlign: "center" }}>
        <div style={{ width: 72, height: 72, borderRadius: 10, backgroundColor: colors.surfaceRaised, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px" }}>
          <Lock size={28} color={colors.brand} strokeWidth={1.5} />
        </div>
        <FitText as="h1" style={{ fontSize: 26, fontWeight: 700, marginBottom: 8 }}>{LOCKED_PAGE_COPY.title}</FitText>
        <FitText as="p" style={{ fontSize: 14, color: colors.textSecondary, lineHeight: 1.6 }}>
          {LOCKED_PAGE_COPY.body}
        </FitText>
        <div style={{ marginTop: 20, backgroundColor: colors.surface, border: `1px solid ${colors.border}`, borderRadius: 12, padding: 16, textAlign: "left" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
            <AlertTriangle size={14} color={colors.warning} />
            <FitText style={{ fontSize: 13, fontWeight: 600 }}>{LOCKED_PAGE_COPY.noticeTitle}</FitText>
          </div>
          <FitText as="p" style={{ fontSize: 13, color: colors.textSecondary, lineHeight: 1.6 }}>
            {LOCKED_PAGE_COPY.noticeBody}
          </FitText>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 20 }}>
          <FitButton variant="ghost" fullWidth label="Try Again" onClick={() => router.push("/login")} />
          <FitButton variant="primary" fullWidth label="Reset Password" onClick={() => {}} />
        </div>
        <FitText as="p" style={{ fontSize: 12, color: colors.textMuted, marginTop: 20 }}>
          Need help?{" "}
          <FitButton variant="link" style={{ fontSize: 12 }}>Contact Support</FitButton>
        </FitText>
      </div>
    </main>
  );
}