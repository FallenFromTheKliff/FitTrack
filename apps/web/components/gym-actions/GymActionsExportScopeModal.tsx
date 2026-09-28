"use client";

import type { CSSProperties } from "react";
import { Download } from "lucide-react";

import { useTheme } from "@/contexts/ThemeContext";
import { FitButton, FitText } from "@/components/fit";
import FitModal from "@/components/modals/FitModal";

export type GymActionsExportScope = "current" | "all";

type Props = {
  isOpen: boolean;
  scope: GymActionsExportScope;
  isExporting: boolean;
  sectionLabel: string;
  onScopeChange: (scope: GymActionsExportScope) => void;
  onCancel: () => void;
  onConfirm: () => void;
};

const optionLabelStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  minHeight: 44,
  padding: "10px 12px",
  borderRadius: 10,
  cursor: "pointer",
};

export default function GymActionsExportScopeModal({
  isOpen,
  scope,
  isExporting,
  sectionLabel,
  onScopeChange,
  onCancel,
  onConfirm,
}: Props) {
  const { colors } = useTheme();

  return (
    <FitModal
      isOpen={isOpen}
      onClose={onCancel}
      title="Export Gym Actions PDF"
      subtitle={`Export ${sectionLabel} using the active tab and filters currently applied.`}
      icon={Download}
      maxWidth={440}
      closeDisabled={isExporting}
      noScroll
      containerStyle={{
        width: "min(100%, 440px)",
        maxHeight: "min(90vh, 420px)",
      }}
      contentStyle={{
        padding: "18px 22px",
      }}
      footerStyle={{
        padding: "12px 22px",
      }}
      footer={
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 8,
            justifyContent: "flex-end",
            width: "100%",
          }}
        >
          <FitButton
            variant="ghost"
            label="CANCEL"
            disabled={isExporting}
            onClick={onCancel}
          />
          <FitButton
            variant="primary"
            icon={Download}
            label="EXPORT PDF"
            loading={isExporting}
            loadingLabel="EXPORT PDF"
            aria-busy={isExporting}
            onClick={onConfirm}
          />
        </div>
      }
    >
      <div data-ui="gym-actions-export-scope-modal" style={{ display: "grid", gap: 16 }}>
        <FitText
          as="p"
          style={{
            color: colors.textSecondary,
            fontSize: 13,
            lineHeight: 1.45,
            margin: 0,
          }}
        >
          Choose whether the PDF should include rows on the current page or all rows matching the active filters.
        </FitText>
        <div
          role="radiogroup"
          aria-label="Export scope"
          style={{ display: "grid", gap: 8 }}
        >
          {([
            ["current", "Current page"],
            ["all", "All pages"],
          ] as const).map(([value, label]) => {
            const selected = scope === value;
            return (
              <label
                key={value}
                htmlFor={`gym-actions-export-scope-${value}`}
                style={{
                  ...optionLabelStyle,
                  backgroundColor: selected ? `${colors.brand}12` : colors.surfaceRaised,
                  border: `1px solid ${selected ? colors.brand : colors.border}`,
                  color: colors.textPrimary,
                  opacity: isExporting ? 0.72 : 1,
                }}
              >
                <input
                  id={`gym-actions-export-scope-${value}`}
                  type="radio"
                  name="gym-actions-export-scope"
                  value={value}
                  checked={selected}
                  disabled={isExporting}
                  aria-label={label}
                  onChange={() => onScopeChange(value)}
                  style={{
                    accentColor: colors.brand,
                    flexShrink: 0,
                    height: 16,
                    width: 16,
                  }}
                />
                <FitText as="span" style={{ fontSize: 14, fontWeight: selected ? 750 : 600 }}>
                  {label}
                </FitText>
              </label>
            );
          })}
        </div>
      </div>
    </FitModal>
  );
}
