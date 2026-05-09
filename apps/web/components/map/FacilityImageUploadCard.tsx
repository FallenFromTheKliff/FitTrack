"use client";

import { useRef } from "react";
import { ImagePlus } from "lucide-react";
import { buildRenderableAssetUrl } from "@fittrack/utils";

import { useTheme } from "@/contexts/ThemeContext";
import { WEB_API_BASE_URL } from "@/lib/api-client";
import FitButton from "@/components/fit/FitButton";
import { FitText } from "@/components/fit/FitText";

type Props = {
  buttonLabel: string;
  disabled?: boolean;
  helperText: string;
  imageUrl?: string | null;
  onUpload: (file: File) => void;
  title: string;
};

export function FacilityImageUploadCard({
  buttonLabel,
  disabled = false,
  helperText,
  imageUrl,
  onUpload,
  title,
}: Props) {
  const { colors } = useTheme();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const renderableImageUrl = buildRenderableAssetUrl({
    apiBaseUrl: WEB_API_BASE_URL,
    assetUrl: imageUrl ?? null,
  });

  return (
    <div
      style={{
        padding: 12,
        borderRadius: 8,
        border: `1px solid ${colors.border}`,
        backgroundColor: colors.surfaceRaised,
      }}
    >
      <FitText style={{ fontSize: 12, fontWeight: 700, color: colors.textMuted }}>
        {title.toUpperCase()}
      </FitText>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 14,
          marginTop: 12,
          flexWrap: "wrap",
        }}
      >
        <div
          style={{
            width: 92,
            height: 76,
            borderRadius: 8,
            border: `1px solid ${colors.border}`,
            overflow: "hidden",
            display: "grid",
            placeItems: "center",
            backgroundColor: colors.surface,
          }}
        >
          {renderableImageUrl ? (
            <img
              src={renderableImageUrl}
              alt={title}
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
            />
          ) : (
            <ImagePlus size={22} color={colors.textMuted} />
          )}
        </div>
        <div style={{ display: "grid", gap: 8, flex: "1 1 220px" }}>
          <FitText style={{ fontSize: 13, color: colors.textMuted }}>
            {helperText}
          </FitText>
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            style={{ display: "none" }}
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (!file) return;
              onUpload(file);
              event.currentTarget.value = "";
            }}
          />
          <FitButton
            variant="ghost"
            label={buttonLabel}
            onClick={() => inputRef.current?.click()}
            disabled={disabled}
            style={{ width: "fit-content" }}
          />
        </div>
      </div>
    </div>
  );
}
