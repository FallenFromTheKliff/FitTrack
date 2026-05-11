"use client";

import { RefreshCcw } from "lucide-react";
import {
  FitButton,
  FitPagination,
  FitPill,
  FitSearch,
  FitTable,
  FitText,
  FitTextInput,
} from "@/components/fit";
import { getErrorMessage } from "@/components/exercise-lab/exerciseLabShared";

import { ExerciseLabModeNavigation } from "./ExerciseLabModeNavigation";
import { useExerciseLabPage } from "./ExerciseLabPageContext";

export function ExerciseLabMuscleSurface() {
  const {
    colors,
    createMuscleDefinitionMutation,
    editingMuscleId,
    handleSaveMuscleDefinition,
    isCompact,
    muscleDefinitions,
    muscleDefinitionsQuery,
    muscleDraft,
    musclePage,
    muscleSearch,
    muscleTableActions,
    muscleTableColumns,
    muscleTotalPages,
    resetMuscleDraft,
    setMuscleDraft,
    setMusclePage,
    setMuscleSearch,
    surfaceControlsStyle,
    surfaceTitleNavStyle,
    surfaceTopRowStyle,
    updateMuscleDefinitionMutation,
    visibleMuscleDefinitions,
  } = useExerciseLabPage();

  return (          <section
            style={{
              display: "grid",
              gap: 14,
              padding: 14,
              borderRadius: 8,
              border: `1px solid ${colors.border}`,
              backgroundColor: colors.surfaceRaised,
              gridTemplateRows: isCompact ? undefined : "auto minmax(0, 1fr)",
              height: isCompact ? "auto" : "100%",
              minHeight: 0,
              overflow: isCompact ? "visible" : "hidden",
            }}
          >
            <div style={surfaceTopRowStyle}>
              <div style={surfaceTitleNavStyle}>
                <FitText style={{ fontSize: 18, fontWeight: 950, whiteSpace: "nowrap" }}>
                  Muscle Library
                </FitText>
                <ExerciseLabModeNavigation />
              </div>
              <div style={surfaceControlsStyle}>
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
                <FitPill
                  mode="status"
                  label={`${muscleDefinitions.length} definitions`}
                  color={colors.brand}
                />
              </div>
            </div>

            <div
              style={{
                display: "grid",
                gap: 12,
                gridTemplateColumns: isCompact
                  ? "minmax(0, 1fr)"
                  : "minmax(0, 1fr) minmax(320px, 360px)",
                height: isCompact ? "auto" : "100%",
                minHeight: 0,
                overflow: isCompact ? "visible" : "hidden",
              }}
            >
              <aside
                style={{
                  gridColumn: isCompact ? undefined : "2",
                  gridRow: isCompact ? undefined : "1",
                  display: "grid",
                  gap: 12,
                  alignContent: "start",
                  gridTemplateColumns: "minmax(0, 1fr)",
                  padding: 12,
                  borderRadius: 8,
                  border: `1px solid ${colors.border}`,
                  backgroundColor: colors.surface,
                  minHeight: 0,
                  overflow: "hidden",
                }}
              >
                <FitText style={{ fontSize: 18, fontWeight: 800, gridColumn: "1 / -1" }}>
                  {editingMuscleId ? "Muscle Details" : "Muscle Creation"}
                </FitText>
                <FitText
                  style={{
                    fontSize: 12.5,
                    color: colors.textSecondary,
                    gridColumn: "1 / -1",
                  }}
                >
                  Keys are normalized identifiers such as `front_delts`; names
                  are what admins see in Exercise Lab.
                </FitText>
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
                  style={{
                    border: `1px solid ${colors.border}`,
                    borderRadius: 8,
                    padding: "12px 14px",
                    width: "100%",
                  }}
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
                  style={{
                    border: `1px solid ${colors.border}`,
                    borderRadius: 8,
                    opacity: editingMuscleId ? 0.55 : 1,
                    padding: "12px 14px",
                    width: "100%",
                  }}
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
                  style={{
                    border: `1px solid ${colors.border}`,
                    borderRadius: 8,
                    padding: "12px 14px",
                    width: "100%",
                  }}
                />
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
                  style={{
                    border: `1px solid ${colors.border}`,
                    borderRadius: 8,
                    padding: "12px 14px",
                    width: "100%",
                  }}
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
                  style={{
                    border: `1px solid ${colors.border}`,
                    borderRadius: 8,
                    padding: "12px 14px",
                    width: "100%",
                  }}
                />
                <div
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    gap: 10,
                    gridColumn: "1 / -1",
                  }}
                >
                  <FitButton
                    label={editingMuscleId ? "Save muscle" : "Create muscle"}
                    loading={
                      createMuscleDefinitionMutation.isPending ||
                      updateMuscleDefinitionMutation.isPending
                    }
                    onClick={() => void handleSaveMuscleDefinition()}
                  />
                  <FitButton
                    label="Reset"
                    variant="ghost"
                    onClick={() => resetMuscleDraft()}
                  />
                </div>
              </aside>

              <div
                style={{
                  gridColumn: isCompact ? undefined : "1",
                  gridRow: isCompact ? undefined : "1",
                  display: "grid",
                  gap: 10,
                  gridTemplateRows: isCompact ? undefined : "minmax(0, 1fr) auto",
                  height: isCompact ? "auto" : "100%",
                  minHeight: 0,
                  overflow: isCompact ? "visible" : "hidden",
                }}
              >
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
                      emptyMessage="No muscle definitions match the current search."
                      actions={muscleTableActions}
                      onRowClick={resetMuscleDraft}
                      compact
                      overflowX={false}
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
                    Showing {muscleDefinitions.length} muscle definitions
                  </FitText>
                  <FitPagination
                    ariaLabel="Muscle library pagination"
                    currentPage={musclePage}
                    totalPages={muscleTotalPages}
                    onPageChange={setMusclePage}
                    showSinglePage
                  />
                </div>
              </div>
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
          </section>  );
}
