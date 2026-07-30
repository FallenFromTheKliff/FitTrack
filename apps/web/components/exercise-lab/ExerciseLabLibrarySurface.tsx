"use client";

import { Plus, RefreshCcw } from "lucide-react";
import {
  FitButton,
  FitDropdown,
  FitPagination,
  FitPill,
  FitSearch,
  FitTable,
  FitText,
} from "@/components/fit";
import { EXERCISE_CATEGORY_OPTIONS } from "@/components/exercise-lab/exercise-lab-data";
import { getErrorMessage } from "@/components/exercise-lab/exerciseLabShared";

import { ExerciseLabModeNavigation } from "./ExerciseLabModeNavigation";
import { useExerciseLabPage } from "./ExerciseLabPageContext";

export function ExerciseLabLibrarySurface() {
  const {
    colors,
    handleOpenCreate,
    isCompact,
    libraryCategory,
    libraryItems,
    libraryMeta,
    libraryQuery,
    libraryScope,
    librarySearch,
    libraryTableActions,
    libraryTableColumns,
    setLibraryCategory,
    setLibraryPage,
    setLibraryScope,
    setLibrarySearch,
    surfaceControlsStyle,
    surfaceTitleNavStyle,
    surfaceTopRowStyle,
  } = useExerciseLabPage();
  const libraryTotalPages = Math.max(1, libraryMeta?.total_pages ?? 1);

  return (          <section
            style={{
              display: "grid",
              gap: 14,
              padding: 14,
              borderRadius: 8,
              border: `1px solid ${colors.border}`,
              backgroundColor: colors.surfaceRaised,
              gridTemplateRows: isCompact ? undefined : "auto minmax(0, 1fr) auto",
              height: isCompact ? "auto" : "100%",
              minHeight: 0,
              overflow: isCompact ? "visible" : "hidden",
            }}
          >
            <div style={surfaceTopRowStyle}>
              <div style={surfaceTitleNavStyle}>
                <FitText style={{ fontSize: 18, fontWeight: 950, whiteSpace: "nowrap" }}>
                  Canonical exercises
                </FitText>
                <ExerciseLabModeNavigation />
              </div>
              <div style={surfaceControlsStyle}>
                <FitSearch
                  ariaLabel="Search global exercises"
                  name="exercise-library-search"
                  placeholder="Search exercise name, muscle group, or notes..."
                  value={librarySearch}
                  onChangeText={setLibrarySearch}
                />
                <FitDropdown
                    fullWidth
                    value={libraryCategory}
                    onChange={setLibraryCategory}
                    options={[
                      { label: "All categories", value: "" },
                      ...EXERCISE_CATEGORY_OPTIONS.map((option) => ({
                        label: option.label,
                        value: option.value,
                      })),
                    ]}
                />
                <FitPill
                  mode="toggle"
                  active={libraryScope}
                  onChange={setLibraryScope}
                  options={[
                    { key: "active", label: "Active only" },
                    { key: "all", label: "Include archived" },
                  ]}
                />
                <div
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 8,
                    justifyContent: isCompact ? "flex-start" : "flex-end",
                  }}
                >
                  <FitButton
                    icon={Plus}
                    label="Create"
                    onClick={handleOpenCreate}
                    style={{ minHeight: 34 }}
                    textStyle={{ whiteSpace: "nowrap" }}
                  />
                  <FitButton
                    icon={RefreshCcw}
                    label="Refresh"
                    variant="ghost"
                    onClick={() => void libraryQuery.refetch()}
                    style={{ minHeight: 34 }}
                  />
                </div>
              </div>
            </div>

            <div
              style={{
                display: "grid",
                minHeight: 0,
                overflow: "hidden",
              }}
            >
              {libraryQuery.isError ? (
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
                      libraryQuery.error,
                      "Unable to load the global exercise library.",
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
                    columns={libraryTableColumns}
                    rows={libraryItems}
                    getRowKey={(exercise) => exercise.id}
                    isLoading={libraryQuery.isLoading}
                    loadingMessage="Loading global exercise records..."
                    emptyMessage="No global exercises match the current filters yet."
                    actions={libraryTableActions}
                    compact
                    overflowX
                    style={{ borderRadius: 0, border: 0 }}
                  />
                </div>
              )}
            </div>

            {libraryMeta ? (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 12,
                  flexWrap: "wrap",
                  border: `1px solid ${colors.border}`,
                  borderRadius: 8,
                  backgroundColor: colors.surface,
                  padding: "8px 10px",
                }}
              >
                <FitText
                  style={{ fontSize: 12.5, color: colors.textSecondary }}
                >
                  Showing page {Math.min(libraryMeta.page, libraryTotalPages)} of {libraryTotalPages} /{" "}
                  {libraryMeta.total} total exercises
                </FitText>
                {libraryMeta.total > 0 ? (
                  <FitPagination
                    ariaLabel="Exercise library pagination"
                    currentPage={Math.min(libraryMeta.page, libraryTotalPages)}
                    totalPages={libraryTotalPages}
                    onPageChange={setLibraryPage}
                    showSinglePage
                  />
                ) : null}
              </div>
            ) : null}
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
