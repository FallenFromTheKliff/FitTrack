"use client";

import { useEffect, useState } from "react";
import { Plus, RefreshCcw, Upload } from "lucide-react";
import { buildRenderableAssetUrl } from "@fittrack/utils";
import {
  FitButton,
  FitPagination,
  FitPill,
  FitSearch,
  FitSelect,
  FitTable,
  FitText,
  FitTextInput,
} from "@/components/fit";
import { FitModal } from "@/components/modals";
import { getErrorMessage } from "@/components/exercise-lab/exerciseLabShared";
import { WEB_API_BASE_URL } from "@/lib/api-client";

import { ExerciseLabSurfaceFrame } from "./ExerciseLabSurfaceFrame";
import { ExerciseLabField } from "./ExerciseLabShell";
import {
  MUSCLE_ICON_ACCEPT,
  MUSCLE_ICON_OPTIONS,
  MuscleDefinitionIcon,
  type MuscleDefinitionField,
  useExerciseLabPage,
} from "./ExerciseLabPageContext";

export function ExerciseLabMuscleSurface() {
  const {
    closeMuscleEditor,
    colors,
    createMuscleDefinitionMutation,
    editingMuscleId,
    handleSaveMuscleDefinition,
    handleMuscleIconFileChange,
    isCompact,
    markMuscleFieldTouched,
    muscleDefinitions,
    muscleDefinitionsQuery,
    muscleDraft,
    muscleFormError,
    muscleIconUploadError,
    muscleEditorOpen,
    musclePage,
    muscleSearch,
    muscleSubmitAttempted,
    muscleTableActions,
    muscleTableColumns,
    muscleTotalPages,
    muscleTouchedFields,
    muscleValidationErrors,
    openMuscleEditor,
    pendingMuscleIconFile,
    selectMuscleLibraryIcon,
    setMuscleDraft,
    setMusclePage,
    setMuscleSearch,
    updateMuscleDefinitionMutation,
    uploadMuscleIconMutation,
    visibleMuscleDefinitions,
  } = useExerciseLabPage();

  const [localIconPreviewUrl, setLocalIconPreviewUrl] = useState<string | null>(
    null,
  );
  const [iconPreviewError, setIconPreviewError] = useState<string | null>(null);

  useEffect(() => {
    if (!pendingMuscleIconFile) {
      setLocalIconPreviewUrl(null);
      return;
    }

    const nextUrl = URL.createObjectURL(pendingMuscleIconFile);
    setLocalIconPreviewUrl(nextUrl);
    return () => URL.revokeObjectURL(nextUrl);
  }, [pendingMuscleIconFile]);

  const persistedIconPreviewUrl =
    muscleDraft.iconKind === "custom" && muscleDraft.iconAssetKey
      ? buildRenderableAssetUrl({
          apiBaseUrl: WEB_API_BASE_URL,
          assetKey: muscleDraft.iconAssetKey,
        })
      : null;
  const iconPreviewUrl =
    muscleDraft.iconKind === "custom"
      ? localIconPreviewUrl ?? persistedIconPreviewUrl
      : null;

  useEffect(() => {
    setIconPreviewError(null);
  }, [iconPreviewUrl]);

  const fieldStyle = {
    border: `1px solid ${colors.border}`,
    borderRadius: 8,
    padding: "10px 12px",
    width: "100%",
  };
  const visibleFieldError = (field: MuscleDefinitionField) =>
    muscleSubmitAttempted || muscleTouchedFields[field]
      ? muscleValidationErrors[field]
      : undefined;

  return (
    <>
      <ExerciseLabSurfaceFrame
        className="exercise-muscle-surface"
        actions={
          <>
            <FitPill
              mode="status"
              label={`${muscleDefinitions.length} definitions`}
              color={colors.brand}
              style={{ borderRadius: 6, minHeight: 32 }}
            />
            <FitButton
              icon={Plus}
              label="Add muscle"
              onClick={() => openMuscleEditor()}
              style={{ borderRadius: 6, minHeight: 36, minWidth: 116 }}
            />
            <FitButton
              icon={RefreshCcw}
              label="Refresh"
              variant="ghost"
              onClick={() => void muscleDefinitionsQuery.refetch()}
              style={{ borderRadius: 6, minHeight: 36, minWidth: 100 }}
            />
          </>
        }
        toolbar={
          <FitSearch
            ariaLabel="Search muscle library"
            compact
            name="muscle-library-search"
            placeholder="Search muscles, aliases, or body region"
            value={muscleSearch}
            onChangeText={setMuscleSearch}
          />
        }
        footer={
          <>
            <FitText style={{ fontSize: 12, color: colors.textSecondary }}>
              Showing {visibleMuscleDefinitions.length} of {muscleDefinitions.length} definitions
            </FitText>
            {muscleDefinitions.length > 0 ? (
              <FitPagination
                ariaLabel="Muscle library pagination"
                currentPage={musclePage}
                totalPages={muscleTotalPages}
                onPageChange={setMusclePage}
                showSinglePage
              />
            ) : null}
          </>
        }
      >
        {muscleDefinitionsQuery.isError ? (
          <div
            style={{
              alignItems: "center",
              backgroundColor: `${colors.danger}10`,
              display: "flex",
              justifyContent: "center",
              padding: 18,
            }}
          >
            <FitText style={{ fontSize: 14, color: colors.danger }}>
              {getErrorMessage(
                muscleDefinitionsQuery.error,
                "Unable to load Muscle Library.",
              )}
            </FitText>
          </div>
        ) : (
          <FitTable
            columns={muscleTableColumns}
            rows={visibleMuscleDefinitions}
            getRowKey={(definition) => definition.id}
            isLoading={muscleDefinitionsQuery.isLoading}
            loadingMessage="Loading muscle definitions..."
            emptyMessage={
              muscleSearch.trim()
                ? "No muscle definitions match the current search."
                : "No muscle definitions are available yet."
            }
            emptyStateHeight={isCompact ? 220 : "100%"}
            actions={muscleTableActions}
            onRowClick={openMuscleEditor}
            compact
            overflowX
            style={{ border: 0, borderRadius: 0, height: "100%" }}
          />
        )}
      </ExerciseLabSurfaceFrame>

      <FitModal
        isOpen={muscleEditorOpen}
        onClose={closeMuscleEditor}
        title={editingMuscleId ? "Edit muscle definition" : "Create muscle definition"}
        subtitle="Maintain the canonical muscle names used by exercise targeting, rankings, and workout analytics."
        maxWidth={720}
        containerStyle={{
          borderRadius: 8,
          height: "min(660px, calc(100dvh - 40px))",
          maxHeight: "calc(100dvh - 40px)",
        }}
        headerStyle={{ padding: "14px 18px" }}
        contentStyle={{
          maxHeight: "none",
          minHeight: 0,
          overflowY: "auto",
          padding: "16px 18px",
        }}
        footerStyle={{ padding: "12px 18px" }}
        footer={
          <div
            style={{
              alignItems: "center",
              display: "flex",
              justifyContent: "space-between",
              width: "100%",
            }}
          >
            <FitButton label="Cancel" variant="ghost" onClick={closeMuscleEditor} />
            <FitButton
              label={editingMuscleId ? "Save muscle" : "Create muscle"}
              loading={
                createMuscleDefinitionMutation.isPending ||
                updateMuscleDefinitionMutation.isPending ||
                uploadMuscleIconMutation.isPending
              }
              onClick={() => void handleSaveMuscleDefinition()}
            />
          </div>
        }
      >
        <div style={{ display: "grid", gap: 12 }}>
          {muscleFormError ? (
            <div
              role="alert"
              style={{
                backgroundColor: `${colors.danger}12`,
                border: `1px solid ${colors.danger}55`,
                borderRadius: 8,
                color: colors.danger,
                fontSize: 12.5,
                fontWeight: 750,
                padding: "9px 11px",
              }}
            >
              {muscleFormError}
            </div>
          ) : null}
          <div
            style={{
              display: "grid",
              gap: 12,
              gridTemplateColumns: isCompact
                ? "minmax(0, 1fr)"
                : "repeat(2, minmax(0, 1fr))",
            }}
          >
            <ExerciseLabField
              error={visibleFieldError("name")}
              label="Display name"
              hint="The name shown throughout FitTrack."
            >
              <FitTextInput
                aria-invalid={Boolean(visibleFieldError("name"))}
                name="muscle-definition-name"
                placeholder="Muscle name, e.g. Biceps"
                value={muscleDraft.name}
                onChange={(event) => {
                  markMuscleFieldTouched("name");
                  setMuscleDraft((current) => ({
                    ...current,
                    name: event.target.value,
                  }));
                }}
                style={fieldStyle}
              />
            </ExerciseLabField>
            <ExerciseLabField
              error={visibleFieldError("key")}
              label="Key"
              hint="Immutable after creation to preserve history."
            >
              <FitTextInput
                aria-invalid={Boolean(visibleFieldError("key"))}
                disabled={Boolean(editingMuscleId)}
                name="muscle-definition-key"
                placeholder="Auto-generated if blank"
                value={muscleDraft.key}
                onChange={(event) => {
                  markMuscleFieldTouched("key");
                  setMuscleDraft((current) => ({
                    ...current,
                    key: event.target.value,
                  }));
                }}
                style={{ ...fieldStyle, opacity: editingMuscleId ? 0.55 : 1 }}
              />
            </ExerciseLabField>
            <ExerciseLabField
              error={visibleFieldError("bodyRegion")}
              label="Body region"
              hint="Used by filters and movement grouping."
            >
              <FitTextInput
                aria-invalid={Boolean(visibleFieldError("bodyRegion"))}
                name="muscle-definition-region"
                placeholder="e.g. Upper Body"
                value={muscleDraft.bodyRegion}
                onChange={(event) => {
                  markMuscleFieldTouched("bodyRegion");
                  setMuscleDraft((current) => ({
                    ...current,
                    bodyRegion: event.target.value,
                  }));
                }}
                style={fieldStyle}
              />
            </ExerciseLabField>
            <ExerciseLabField
              error={visibleFieldError("sortOrder")}
              label="Sort order"
              hint="Lower numbers appear first."
            >
              <FitTextInput
                aria-invalid={Boolean(visibleFieldError("sortOrder"))}
                name="muscle-definition-sort-order"
                placeholder="Sort order"
                type="number"
                value={String(muscleDraft.sortOrder)}
                onChange={(event) => {
                  markMuscleFieldTouched("sortOrder");
                  setMuscleDraft((current) => ({
                    ...current,
                    sortOrder: Number(event.target.value),
                  }));
                }}
                style={fieldStyle}
              />
            </ExerciseLabField>
          </div>
          <ExerciseLabField label="Aliases" hint="Separate alternate names with commas.">
            <FitTextInput
              name="muscle-definition-aliases"
              placeholder="pectoralis major, pecs, chest muscles"
              value={muscleDraft.aliases}
              onChange={(event) =>
                setMuscleDraft((current) => ({
                  ...current,
                  aliases: event.target.value,
                }))
              }
              style={fieldStyle}
            />
          </ExerciseLabField>
          <div
            style={{
              display: "grid",
              gap: 12,
              gridTemplateColumns: isCompact
                ? "minmax(0, 1fr)"
                : "repeat(2, minmax(0, 1fr))",
            }}
          >
            <ExerciseLabField
              label="Default icon"
              hint="Only allowlisted FitTrack library icons are persisted."
            >
              <FitSelect
                compact
                fullWidth
                name="muscle-definition-icon"
                options={MUSCLE_ICON_OPTIONS}
                value={muscleDraft.iconKey}
                onChange={(event) => selectMuscleLibraryIcon(event.target.value)}
                style={fieldStyle}
              />
            </ExerciseLabField>
            <ExerciseLabField
              error={muscleIconUploadError ?? visibleFieldError("icon")}
              label="Managed icon"
              hint="PNG, JPEG, or WebP only. SVG is rejected."
            >
              <label
                htmlFor="muscle-definition-icon-upload"
                style={{
                  alignItems: "center",
                  backgroundColor: colors.surface,
                  border: `1px dashed ${colors.border}`,
                  borderRadius: 8,
                  color: colors.textSecondary,
                  cursor: "pointer",
                  display: "flex",
                  gap: 8,
                  minHeight: 42,
                  padding: "8px 10px",
                }}
              >
                <Upload color={colors.brand} size={16} />
                <span
                  style={{
                    minWidth: 0,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {pendingMuscleIconFile?.name ??
                    (muscleDraft.iconKind === "custom"
                      ? "Replace managed image"
                      : "Choose managed image")}
                </span>
                <input
                  accept={MUSCLE_ICON_ACCEPT}
                  aria-invalid={Boolean(
                    muscleIconUploadError ?? visibleFieldError("icon"),
                  )}
                  id="muscle-definition-icon-upload"
                  onChange={(event) => {
                    const file = event.target.files?.[0] ?? null;
                    event.target.value = "";
                    if (file) handleMuscleIconFileChange(file);
                  }}
                  style={{ display: "none" }}
                  type="file"
                />
              </label>
            </ExerciseLabField>
          </div>
          <div
            style={{
              alignItems: "center",
              backgroundColor: colors.surface,
              border: `1px solid ${colors.border}`,
              borderRadius: 10,
              display: "flex",
              gap: 12,
              minHeight: 72,
              padding: 10,
            }}
          >
            <MuscleDefinitionIcon
              assetUrl={iconPreviewUrl}
              colors={{
                accent: colors.brand,
                background: colors.surfaceRaised,
                border: colors.border,
              }}
              definition={muscleDraft}
              onImageError={() =>
                setIconPreviewError("This managed icon could not be previewed.")
              }
              onImageLoad={() => setIconPreviewError(null)}
              size={52}
            />
            <div style={{ display: "grid", gap: 3, minWidth: 0 }}>
              <FitText style={{ color: colors.textPrimary, fontSize: 13, fontWeight: 850 }}>
                {muscleDraft.iconKind === "custom"
                  ? "Managed icon preview"
                  : `${muscleDraft.iconKey} library icon`}
              </FitText>
              <FitText style={{ color: colors.textSecondary, fontSize: 11.5 }}>
                {pendingMuscleIconFile?.name ??
                  (muscleDraft.iconKind === "custom"
                    ? "Existing managed asset"
                    : "The selected icon is used until a managed image is uploaded.")}
              </FitText>
            </div>
          </div>
          {iconPreviewError ? (
            <FitText style={{ color: colors.danger, fontSize: 12, fontWeight: 750 }}>
              {iconPreviewError}
            </FitText>
          ) : null}
          <FitText as="p" style={{ color: colors.textSecondary, fontSize: 12.5 }}>
            Aliases help normalize imported exercise data. The key becomes immutable after
            creation so historical rankings and workout records stay connected.
          </FitText>
        </div>
      </FitModal>
    </>
  );
}
