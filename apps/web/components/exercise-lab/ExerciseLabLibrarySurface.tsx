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

import { ExerciseLabSurfaceFrame } from "./ExerciseLabSurfaceFrame";
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
  } = useExerciseLabPage();
  const libraryTotalPages = Math.max(1, libraryMeta?.total_pages ?? 1);

  return (
    <ExerciseLabSurfaceFrame
      className="exercise-library-surface"
      actions={
        <>
          <FitButton
            icon={Plus}
            label="Create"
            onClick={handleOpenCreate}
            style={{ borderRadius: 6, minHeight: 36, minWidth: 104 }}
            textStyle={{ whiteSpace: "nowrap" }}
          />
          <FitButton
            icon={RefreshCcw}
            label="Refresh"
            variant="ghost"
            onClick={() => void libraryQuery.refetch()}
            style={{ borderRadius: 6, minHeight: 36, minWidth: 100 }}
          />
        </>
      }
      toolbar={
        <div className="exercise-library-toolbar">
          <FitSearch
            ariaLabel="Search global exercises"
            compact
            name="exercise-library-search"
            placeholder="Search exercise name, muscle group, or keyword"
            value={librarySearch}
            onChangeText={setLibrarySearch}
          />
          <FitDropdown
            compact
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
            style={{ minHeight: 36 }}
          />
        </div>
      }
      footer={
        <>
          <FitText style={{ fontSize: 12, color: colors.textSecondary }}>
            Showing page {Math.min(libraryMeta?.page ?? 1, libraryTotalPages)} of{" "}
            {libraryTotalPages} / {libraryMeta?.total ?? 0} total exercises
          </FitText>
          {libraryMeta && libraryMeta.total > 0 ? (
            <FitPagination
              ariaLabel="Exercise library pagination"
              currentPage={Math.min(libraryMeta.page, libraryTotalPages)}
              totalPages={libraryTotalPages}
              onPageChange={setLibraryPage}
              showSinglePage
            />
          ) : null}
        </>
      }
    >
      {libraryQuery.isError ? (
        <div
          style={{
            alignItems: "center",
            backgroundColor: `${colors.danger}10`,
            color: colors.danger,
            display: "flex",
            justifyContent: "center",
            padding: 18,
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
        <FitTable
          columns={libraryTableColumns}
          rows={libraryItems}
          getRowKey={(exercise) => exercise.id}
          isLoading={libraryQuery.isLoading}
          loadingMessage="Loading global exercise records..."
          emptyMessage="No global exercises match the current filters yet."
          emptyStateHeight={isCompact ? 220 : "100%"}
          actions={libraryTableActions}
          compact
          overflowX
          style={{ borderRadius: 0, border: 0, height: "100%" }}
        />
      )}

      <style>{`
        .exercise-library-toolbar {
          display: grid;
          gap: 10px;
          grid-template-columns: minmax(320px, 1.7fr) minmax(190px, 0.7fr) auto;
          min-width: 0;
        }

        @media (max-width: 1120px) {
          .exercise-library-toolbar {
            grid-template-columns: minmax(0, 1fr) minmax(180px, 0.7fr);
          }

          .exercise-library-toolbar > :last-child {
            grid-column: 1 / -1;
          }
        }

        @media (max-width: 680px) {
          .exercise-library-toolbar {
            grid-template-columns: minmax(0, 1fr);
          }
        }
      `}</style>
    </ExerciseLabSurfaceFrame>
  );
}
