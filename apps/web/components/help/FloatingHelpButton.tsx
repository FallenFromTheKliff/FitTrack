"use client";

import { useState } from "react";
import { HelpCircle, X } from "lucide-react";
import { useRouter } from "next/navigation";

import { useTheme } from "@/contexts/ThemeContext";
import FitButton from "@/components/fit/FitButton";
import { FitText } from "@/components/fit/FitText";

type FloatingHelpButtonProps = {
  description: string;
  terms: Array<{ label: string; value: string }>;
  title: string;
};

export default function FloatingHelpButton({
  description,
  terms,
  title,
}: FloatingHelpButtonProps) {
  const router = useRouter();
  const { colors } = useTheme();
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        aria-label={`Open help for ${title}`}
        onClick={() => setOpen((current) => !current)}
        style={{
          alignItems: "center",
          backgroundColor: colors.brand,
          border: "none",
          borderRadius: "50%",
          bottom: 24,
          boxShadow: "0 16px 38px rgba(0,0,0,0.22)",
          color: colors.onBrand,
          cursor: "pointer",
          display: "flex",
          height: 52,
          justifyContent: "center",
          position: "fixed",
          right: 24,
          width: 52,
          zIndex: 60,
        }}
      >
        {open ? <X size={22} /> : <HelpCircle size={24} />}
      </button>
      {open ? (
        <aside
          aria-label={`${title} help panel`}
          style={{
            backgroundColor: colors.surface,
            border: `1px solid ${colors.border}`,
            borderRadius: 12,
            bottom: 88,
            boxShadow: "0 18px 46px rgba(0,0,0,0.18)",
            display: "grid",
            gap: 12,
            maxWidth: 360,
            padding: 16,
            position: "fixed",
            right: 24,
            width: "calc(100vw - 48px)",
            zIndex: 60,
          }}
        >
          <div style={{ display: "grid", gap: 4 }}>
            <FitText style={{ color: colors.textPrimary, fontSize: 15, fontWeight: 800 }}>
              {title}
            </FitText>
            <FitText as="p" style={{ color: colors.textMuted, fontSize: 13, lineHeight: 1.45 }}>
              {description}
            </FitText>
          </div>
          <div style={{ display: "grid", gap: 8 }}>
            {terms.map((term) => (
              <div key={term.label} style={{ display: "grid", gap: 2 }}>
                <FitText style={{ color: colors.textPrimary, fontSize: 12, fontWeight: 800 }}>
                  {term.label}
                </FitText>
                <FitText as="p" style={{ color: colors.textMuted, fontSize: 12, lineHeight: 1.4 }}>
                  {term.value}
                </FitText>
              </div>
            ))}
          </div>
          <FitButton
            variant="ghost"
            label="Open Support Settings"
            onClick={() => router.push("/settings")}
            fullWidth
          />
        </aside>
      ) : null}
    </>
  );
}
