"use client";

import { useEffect, useState, type CSSProperties } from "react";
import { Plus, RefreshCcw, Upload } from "lucide-react";
import { buildRenderableAssetUrl } from "@fittrack/utils";
import {
  FitButton,
  FitPagination,
  FitSearch,
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
  getMuscleIconComponent,
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

  const fieldStyle: CSSProperties = {
    backgroundColor: colors.fieldBg,
    border: `1px solid ${colors.border}`,
    borderRadius: 8,
    boxSizing: "border-box",
    fontSize: 13,
    height: 36,
    minHeight: 36,
    padding: "7px 10px",
    width: "100%",
  };
  const modalFieldLabelStyle: CSSProperties = {
    color: colors.textSecondary,
    fontSize: 10.5,
    fontWeight: 600,
    letterSpacing: "normal",
    textTransform: "none",
  };
  const visibleFieldError = (field: MuscleDefinitionField) =>
    muscleSubmitAttempted || muscleTouchedFields[field]
      ? muscleValidationErrors[field]
      : undefined;
  const isManagedIcon = muscleDraft.iconKind === "custom";
  const iconSourceError = muscleIconUploadError ?? visibleFieldError("icon");

  const selectManagedMuscleIcon = () => {
    markMuscleFieldTouched("icon");
    setMuscleDraft((current) => ({
      ...current,
      iconKind: "custom",
    }));
  };

  return (
    <>
      <ExerciseLabSurfaceFrame
        ariaLabel="Muscle Groups"
        className="exercise-muscle-surface"
        testId="exercise-lab-muscle-surface"
        tableMinWidth={1080}
        actions={
          <>
            <FitText
              as="span"
              style={{ color: colors.textSecondary, fontSize: 12, whiteSpace: "nowrap" }}
            >
              {muscleDefinitions.length} definitions
            </FitText>
            <FitButton
              icon={RefreshCcw}
              label="Refresh"
              variant="ghost"
              onClick={() => void muscleDefinitionsQuery.refetch()}
              style={{ borderRadius: 6, minHeight: 36, minWidth: 100 }}
            />
            <FitButton
              icon={Plus}
              label="Add muscle"
              onClick={() => openMuscleEditor()}
              style={{ borderRadius: 6, minHeight: 36, minWidth: 116 }}
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
            actionsColumnStyle={{
              minWidth: 132,
              paddingInline: 8,
              whiteSpace: "nowrap",
              width: 132,
            }}
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
        title={editingMuscleId ? "Edit muscle definition" : "Add muscle definition"}
        subtitle="Canonical muscle used by exercise targeting, rankings, and analytics."
        hideHeaderIcon
        maxWidth={672}
        closeButtonStyle={{
          backgroundColor: "transparent",
          border: "none",
          borderRadius: 8,
        }}
        containerStyle={{
          borderRadius: 16,
          height: "auto",
          maxHeight: "92vh",
        }}
        headerStyle={{ padding: "16px 24px" }}
        contentStyle={{
          maxHeight: "none",
          minHeight: 0,
          overflowY: "auto",
          padding: 24,
        }}
        footerStyle={{ padding: "16px 24px" }}
        footer={
          <div
            style={{
              alignItems: "center",
              display: "flex",
              justifyContent: "space-between",
              width: "100%",
            }}
          >
            <FitButton
              label="Cancel"
              variant="ghost"
              onClick={closeMuscleEditor}
              style={{ borderRadius: 8, minHeight: 36 }}
            />
            <FitButton
              label={editingMuscleId ? "Save definition" : "Create definition"}
              loading={
                createMuscleDefinitionMutation.isPending ||
                updateMuscleDefinitionMutation.isPending ||
                uploadMuscleIconMutation.isPending
              }
              onClick={() => void handleSaveMuscleDefinition()}
              style={{ borderRadius: 8, minHeight: 36 }}
            />
          </div>
        }
      >
        <div style={{ display: "grid", gap: 20 }}>
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
              gap: 20,
              gridTemplateColumns: isCompact
                ? "minmax(0, 1fr)"
                : "repeat(2, minmax(0, 1fr))",
            }}
          >
            <ExerciseLabField
              error={visibleFieldError("name")}
              label="Display name"
              labelStyle={modalFieldLabelStyle}
              required
            >
              <FitTextInput
                aria-invalid={Boolean(visibleFieldError("name"))}
                name="muscle-definition-name"
                placeholder="e.g. Latissimus dorsi"
                required
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
              labelStyle={modalFieldLabelStyle}
              hint={
                editingMuscleId
                  ? "Immutable after creation to preserve history."
                  : "Optional · auto-generated if blank"
              }
            >
              <FitTextInput
                aria-invalid={Boolean(visibleFieldError("key"))}
                disabled={Boolean(editingMuscleId)}
                name="muscle-definition-key"
                placeholder="auto"
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
              labelStyle={modalFieldLabelStyle}
              required
            >
              <FitTextInput
                aria-invalid={Boolean(visibleFieldError("bodyRegion"))}
                name="muscle-definition-region"
                placeholder="e.g. Back"
                required
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
              labelStyle={modalFieldLabelStyle}
              hint="Lower numbers sort first"
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
          <ExerciseLabField
            label="Aliases"
            hint="Comma-separated alternate names"
            labelStyle={modalFieldLabelStyle}
          >
            <FitTextInput
              name="muscle-definition-aliases"
              placeholder="lats, latissimus"
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
          <ExerciseLabField
            error={iconSourceError}
            label="Icon source"
            labelStyle={modalFieldLabelStyle}
            hint={
              isManagedIcon ? "PNG, JPEG, or WebP only. SVG is rejected." : undefined
            }
          >
            <div
              aria-label="Icon source"
              role="group"
              style={{
                backgroundColor: colors.fieldBg,
                border: `1px solid ${colors.border}`,
                borderRadius: 10,
                display: "grid",
                gap: 4,
                gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
                padding: 3,
                width: "100%",
              }}
            >
              <button
                aria-pressed={!isManagedIcon}
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  selectMuscleLibraryIcon(muscleDraft.iconKey);
                }}
                style={{
                  alignItems: "center",
                  backgroundColor: !isManagedIcon ? colors.brand : colors.surfaceRaised,
                  border: `1px solid ${!isManagedIcon ? colors.brand : colors.border}`,
                  borderRadius: 7,
                  color: !isManagedIcon ? colors.onBrand : colors.textSecondary,
                  cursor: "pointer",
                  display: "flex",
                  fontSize: 12,
                  fontWeight: !isManagedIcon ? 750 : 650,
                  justifyContent: "center",
                  minHeight: 36,
                  padding: "0 10px",
                  width: "100%",
                }}
                type="button"
              >
                <FitText
                  as="span"
                  excludeGlobalScale
                  style={{ color: "inherit", fontSize: 12, fontWeight: "inherit" }}
                >
                  Library Icon
                </FitText>
              </button>
              <button
                aria-pressed={isManagedIcon}
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  selectManagedMuscleIcon();
                }}
                style={{
                  alignItems: "center",
                  backgroundColor: isManagedIcon ? colors.brand : colors.surfaceRaised,
                  border: `1px solid ${isManagedIcon ? colors.brand : colors.border}`,
                  borderRadius: 7,
                  color: isManagedIcon ? colors.onBrand : colors.textSecondary,
                  cursor: "pointer",
                  display: "flex",
                  fontSize: 12,
                  fontWeight: isManagedIcon ? 750 : 650,
                  justifyContent: "center",
                  minHeight: 36,
                  padding: "0 10px",
                  width: "100%",
                }}
                type="button"
              >
                <FitText
                  as="span"
                  excludeGlobalScale
                  style={{ color: "inherit", fontSize: 12, fontWeight: "inherit" }}
                >
                  Managed Custom Image
                </FitText>
              </button>
            </div>
            {isManagedIcon ? (
              <div
                style={{
                  backgroundColor: colors.surfaceRaised,
                  border: `1px solid ${colors.border}`,
                  borderRadius: 10,
                  display: "grid",
                  gap: 8,
                  padding: 10,
                }}
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
                    minHeight: 36,
                    padding: "7px 10px",
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
                    aria-invalid={Boolean(iconSourceError)}
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
                <FitText
                  as="span"
                  style={{
                    color:
                      pendingMuscleIconFile || muscleDraft.iconAssetKey
                        ? colors.success
                        : colors.textSecondary,
                    fontSize: 11.5,
                  }}
                >
                  {pendingMuscleIconFile
                    ? "Image ready to upload when you save."
                    : muscleDraft.iconAssetKey
                      ? "Existing managed image. Choose a new file to replace it."
                      : "Upload a managed image before saving."}
                </FitText>
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
                      Managed icon preview
                    </FitText>
                    <FitText style={{ color: colors.textSecondary, fontSize: 11.5 }}>
                      {pendingMuscleIconFile?.name ??
                        (muscleDraft.iconAssetKey
                          ? "Existing managed asset"
                          : "Upload a managed image to preview it here.")}
                    </FitText>
                  </div>
                </div>
                {iconPreviewError ? (
                  <FitText style={{ color: colors.danger, fontSize: 12, fontWeight: 750 }}>
                    {iconPreviewError}
                  </FitText>
                ) : null}
              </div>
            ) : (
              <div
                aria-label="Library icon choices"
                role="group"
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: 8,
                }}
              >
                {MUSCLE_ICON_OPTIONS.map((option) => {
                  const Icon = getMuscleIconComponent(option.value);
                  const selected = muscleDraft.iconKey === option.value;
                  return (
                    <button
                      aria-label={`Use ${option.label} library icon`}
                      aria-pressed={selected}
                      key={option.value}
                      onClick={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        selectMuscleLibraryIcon(option.value);
                      }}
                      style={{
                        alignItems: "center",
                        backgroundColor: selected ? `${colors.brand}16` : colors.fieldBg,
                        border: `1px solid ${selected ? colors.brand : colors.border}`,
                        borderRadius: 8,
                        color: selected ? colors.brand : colors.textSecondary,
                        cursor: "pointer",
                        display: "flex",
                        flex: "0 0 auto",
                        gap: 6,
                        justifyContent: "center",
                        minHeight: 36,
                        padding: "6px 12px",
                        boxSizing: "border-box",
                        whiteSpace: "nowrap",
                      }}
                      type="button"
                    >
                      <Icon aria-hidden="true" size={16} strokeWidth={2} />
                      <FitText
                        as="span"
                        excludeGlobalScale
                        style={{ color: "inherit", fontSize: 11.5, fontWeight: selected ? 750 : 650 }}
                      >
                        {option.label}
                      </FitText>
                    </button>
                  );
                })}
              </div>
            )}
          </ExerciseLabField>
        </div>
      </FitModal>
    </>
  );
}
