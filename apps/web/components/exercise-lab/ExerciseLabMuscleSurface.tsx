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

import { ExerciseLabModeNavigation } from "./ExerciseLabModeNavigation";
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
      <section
        style={{
          display: "grid",
          gap: 12,
          padding: 14,
          borderRadius: 8,
          border: `1px solid ${colors.border}`,
          backgroundColor: colors.surfaceRaised,
          gridTemplateRows: isCompact ? undefined : "auto auto minmax(0, 1fr) auto",
          height: isCompact ? "auto" : "100%",
          minHeight: 0,
          overflow: isCompact ? "visible" : "hidden",
        }}
      >
        <div
          style={{
            alignItems: "center",
            display: "flex",
            gap: 10,
            justifyContent: "space-between",
            minWidth: 0,
          }}
        >
          <div
            style={{
              alignItems: "center",
              display: "flex",
              flexWrap: "wrap",
              gap: 8,
              minWidth: 0,
            }}
          >
            <FitText style={{ fontSize: 18, fontWeight: 950, whiteSpace: "nowrap" }}>
              Muscle definitions
            </FitText>
            <ExerciseLabModeNavigation />
          </div>
          <div style={{ alignItems: "center", display: "flex", gap: 8 }}>
            <FitPill
              mode="status"
              label={`${muscleDefinitions.length} definitions`}
              color={colors.brand}
            />
            <FitButton
              icon={Plus}
              label="Create muscle"
              onClick={() => openMuscleEditor()}
              style={{ minHeight: 34 }}
            />
          </div>
        </div>

        <div
          style={{
            alignItems: "center",
            display: "grid",
            gap: 8,
            gridTemplateColumns: isCompact ? "minmax(0, 1fr)" : "minmax(0, 1fr) auto",
          }}
        >
          <FitSearch
            ariaLabel="Search muscle library"
            name="muscle-library-search"
            placeholder="Search muscles, aliases, or body region..."
            value={muscleSearch}
            onChangeText={setMuscleSearch}
          />
          <FitButton
            icon={RefreshCcw}
            label="Refresh"
            variant="ghost"
            onClick={() => void muscleDefinitionsQuery.refetch()}
            style={{ minHeight: 34 }}
          />
        </div>

        {muscleDefinitionsQuery.isError ? (
          <div
            style={{
              padding: 18,
              borderRadius: 8,
              border: `1px solid ${colors.danger}40`,
              backgroundColor: `${colors.danger}10`,
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
          <div
            className="exercise-lab-table-shell"
            style={{
              minHeight: 0,
              overflow: "hidden",
              border: `1px solid ${colors.border}`,
              borderRadius: 8,
              backgroundColor: colors.surface,
            }}
          >
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
              actions={muscleTableActions}
              onRowClick={openMuscleEditor}
              compact
              overflowX
              style={{ border: 0, borderRadius: 0 }}
            />
          </div>
        )}

        <div
          style={{
            alignItems: "center",
            border: `1px solid ${colors.border}`,
            borderRadius: 8,
            backgroundColor: colors.surface,
            display: "flex",
            justifyContent: "space-between",
            gap: 12,
            flexWrap: "wrap",
            padding: "8px 10px",
          }}
        >
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
        </div>

        <style>{`
          .exercise-lab-table-shell table th,
          .exercise-lab-table-shell table td {
            text-align: left !important;
          }

          .exercise-lab-table-shell table td:last-child > div {
            justify-content: flex-start !important;
          }
        `}</style>
      </section>

      <FitModal
        isOpen={muscleEditorOpen}
        onClose={closeMuscleEditor}
        title={editingMuscleId ? "Edit muscle definition" : "Create muscle definition"}
        subtitle="Maintain the canonical muscle names used by exercise targeting, rankings, and workout analytics."
        maxWidth={680}
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
            <FitTextInput
              disabled={Boolean(editingMuscleId)}
              name="muscle-definition-key"
              placeholder="Optional key, auto-generated if blank"
              value={muscleDraft.key}
              onChange={(event) =>
                setMuscleDraft((current) => ({
                  ...current,
                  key: event.target.value,
                }))
              }
              style={{ ...fieldStyle, opacity: editingMuscleId ? 0.55 : 1 }}
            />
            <FitTextInput
              name="muscle-definition-region"
              placeholder="Body region, e.g. arms"
              value={muscleDraft.bodyRegion}
              onChange={(event) =>
                setMuscleDraft((current) => ({
                  ...current,
                  bodyRegion: event.target.value,
                }))
              }
              style={fieldStyle}
            />
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
          </div>
          <FitTextInput
            name="muscle-definition-aliases"
            placeholder="Aliases separated by comma"
            value={muscleDraft.aliases}
            onChange={(event) =>
              setMuscleDraft((current) => ({
                ...current,
                aliases: event.target.value,
              }))
            }
            style={fieldStyle}
          />
          <FitText as="p" style={{ color: colors.textSecondary, fontSize: 12.5 }}>
            Aliases help normalize imported exercise data. The key becomes immutable after
            creation so historical rankings and workout records stay connected.
          </FitText>
          <div
            style={{
              alignItems: "center",
              display: "flex",
              gap: 10,
              justifyContent: "flex-end",
            }}
          >
            <FitButton label="Cancel" variant="ghost" onClick={closeMuscleEditor} />
            <FitButton
              label={editingMuscleId ? "Save changes" : "Create muscle"}
              loading={
                createMuscleDefinitionMutation.isPending ||
                updateMuscleDefinitionMutation.isPending
              }
              onClick={() => void handleSaveMuscleDefinition()}
            />
          </div>
        </div>
      </FitModal>
    </>
  );
}
