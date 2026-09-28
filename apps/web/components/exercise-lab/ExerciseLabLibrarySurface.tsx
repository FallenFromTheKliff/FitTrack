"use client";

import { Plus, RefreshCcw } from "lucide-react";
import {
  FitButton,
  FitDropdown,
  FitPagination,
  FitSearch,
  FitTable,
  FitText,
} from "@/components/fit";
import { EXERCISE_CATEGORY_OPTIONS } from "@/components/exercise-lab/exercise-lab-data";
import { getErrorMessage } from "@/components/exercise-lab/exerciseLabShared";

import { ExerciseLabSurfaceFrame } from "./ExerciseLabSurfaceFrame";
import { useExerciseLabPage } from "./ExerciseLabPageContext";

type LibraryScope = "active" | "all";

type LibraryScopeToggleProps = {
  colors: {
    brand: string;
    border: string;
    onBrand?: string;
    surfaceRaised: string;
    textPrimary: string;
    textSecondary: string;
  };
  value: LibraryScope;
  onChange: (value: LibraryScope) => void;
};

function LibraryScopeToggle({
  colors,
  onChange,
  value,
}: LibraryScopeToggleProps) {
  const onBrand = colors.onBrand ?? colors.textPrimary;

  return (
    <div
      aria-label="Exercise library scope"
      role="group"
      style={{
        alignItems: "center",
        backgroundColor: colors.surfaceRaised,
        border: `1px solid ${colors.border}`,
        borderRadius: 10,
        display: "inline-flex",
        gap: 4,
        maxWidth: "100%",
        minHeight: 36,
        overflowX: "auto",
        overflowY: "hidden",
        padding: 4,
        WebkitOverflowScrolling: "touch",
      }}
    >
      {[
        { label: "Active only", value: "active" as const },
        { label: "Include archived", value: "all" as const },
      ].map((option) => {
        const selected = option.value === value;

        return (
          <FitButton
            key={option.value}
            aria-pressed={selected}
            label={option.label}
            onClick={() => onChange(option.value)}
            style={{
              backgroundColor: selected ? colors.brand : "transparent",
              border: `1px solid ${selected ? colors.brand : "transparent"}`,
              borderRadius: 7,
              color: selected ? onBrand : colors.textSecondary,
              flexShrink: 0,
              minHeight: 32,
              padding: "5px 14px",
            }}
            textStyle={{
              color: selected ? onBrand : colors.textSecondary,
              fontSize: 12,
              fontWeight: 600,
              whiteSpace: "nowrap",
            }}
            variant="ghost"
          />
        );
      })}
    </div>
  );
}

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
      ariaLabel="Exercise Library"
      className="exercise-library-surface"
      testId="exercise-lab-library-surface"
      tableMinWidth={1240}
      actions={
        <>
          <FitButton
            icon={RefreshCcw}
            label="Refresh"
            variant="ghost"
            onClick={() => void libraryQuery.refetch()}
            style={{ borderRadius: 6, minHeight: 36, minWidth: 100 }}
          />
          <FitButton
            icon={Plus}
            label="Create"
            onClick={handleOpenCreate}
            style={{ borderRadius: 6, minHeight: 36, minWidth: 104 }}
            textStyle={{ whiteSpace: "nowrap" }}
          />
        </>
      }
      toolbar={
        <div className="exercise-library-toolbar">
          <FitSearch
            ariaLabel="Search global exercises"
            compact
            name="exercise-library-search"
            placeholder="Search by name, muscle group, or keyword"
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
          <LibraryScopeToggle
            colors={colors}
            onChange={setLibraryScope}
            value={libraryScope}
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
          actionsColumnStyle={{ width: "8%" }}
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
