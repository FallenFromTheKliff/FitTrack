"use client";

import { Plus, RefreshCcw } from "lucide-react";
import {
  FitButton,
  FitPagination,
  FitPill,
  FitSearch,
  FitTable,
  FitText,
  FitTextInput,
} from "@/components/fit";
import { FitModal } from "@/components/modals";
import { getErrorMessage } from "@/components/exercise-lab/exerciseLabShared";

import { ExerciseLabSurfaceFrame } from "./ExerciseLabSurfaceFrame";
import { ExerciseLabField } from "./ExerciseLabShell";
import { useExerciseLabPage } from "./ExerciseLabPageContext";

export function ExerciseLabMuscleSurface() {
  const {
    closeMuscleEditor,
    colors,
    createMuscleDefinitionMutation,
    editingMuscleId,
    handleSaveMuscleDefinition,
    isCompact,
    muscleDefinitions,
    muscleDefinitionsQuery,
    muscleDraft,
    muscleEditorOpen,
    musclePage,
    muscleSearch,
    muscleTableActions,
    muscleTableColumns,
    muscleTotalPages,
    openMuscleEditor,
    setMuscleDraft,
    setMusclePage,
    setMuscleSearch,
    updateMuscleDefinitionMutation,
    visibleMuscleDefinitions,
  } = useExerciseLabPage();

  const fieldStyle = {
    border: `1px solid ${colors.border}`,
    borderRadius: 8,
    padding: "10px 12px",
    width: "100%",
  };

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
        maxWidth={680}
        containerStyle={{
          borderRadius: 8,
          height: "min(560px, calc(100dvh - 40px))",
          maxHeight: "calc(100dvh - 40px)",
        }}
        headerStyle={{ padding: "14px 18px" }}
        contentStyle={{ maxHeight: "none", minHeight: 0, padding: "16px 18px" }}
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
                updateMuscleDefinitionMutation.isPending
              }
              onClick={() => void handleSaveMuscleDefinition()}
            />
          </div>
        }
      >
        <div style={{ display: "grid", gap: 12 }}>
          <div
            style={{
              display: "grid",
              gap: 12,
              gridTemplateColumns: isCompact
                ? "minmax(0, 1fr)"
                : "repeat(2, minmax(0, 1fr))",
            }}
          >
            <ExerciseLabField label="Display name" hint="The name shown throughout FitTrack.">
              <FitTextInput
                name="muscle-definition-name"
                placeholder="Muscle name, e.g. Biceps"
                value={muscleDraft.name}
                onChange={(event) =>
                  setMuscleDraft((current) => ({
                    ...current,
                    name: event.target.value,
                  }))
                }
                style={fieldStyle}
              />
            </ExerciseLabField>
            <ExerciseLabField label="Key" hint="Immutable after creation to preserve history.">
              <FitTextInput
                disabled={Boolean(editingMuscleId)}
                name="muscle-definition-key"
                placeholder="Auto-generated if blank"
                value={muscleDraft.key}
                onChange={(event) =>
                  setMuscleDraft((current) => ({
                    ...current,
                    key: event.target.value,
                  }))
                }
                style={{ ...fieldStyle, opacity: editingMuscleId ? 0.55 : 1 }}
              />
            </ExerciseLabField>
            <ExerciseLabField label="Body region" hint="Used by filters and movement grouping.">
              <FitTextInput
                name="muscle-definition-region"
                placeholder="e.g. Upper Body"
                value={muscleDraft.bodyRegion}
                onChange={(event) =>
                  setMuscleDraft((current) => ({
                    ...current,
                    bodyRegion: event.target.value,
                  }))
                }
                style={fieldStyle}
              />
            </ExerciseLabField>
            <ExerciseLabField label="Sort order" hint="Lower numbers appear first.">
              <FitTextInput
                name="muscle-definition-sort-order"
                placeholder="Sort order"
                type="number"
                value={String(muscleDraft.sortOrder)}
                onChange={(event) =>
                  setMuscleDraft((current) => ({
                    ...current,
                    sortOrder: Number(event.target.value),
                  }))
                }
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
          <FitText as="p" style={{ color: colors.textSecondary, fontSize: 12.5 }}>
            Aliases help normalize imported exercise data. The key becomes immutable after
            creation so historical rankings and workout records stay connected.
          </FitText>
        </div>
      </FitModal>
    </>
  );
}
