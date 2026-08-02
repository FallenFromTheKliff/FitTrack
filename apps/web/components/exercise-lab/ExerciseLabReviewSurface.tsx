"use client";

import type {
  ExerciseReviewSubmissionStatus,
  FitnessExerciseCategory,
} from "@fittrack/api-client";
import {
  FitButton,
  FitDropdown,
  FitPagination,
  FitSearch,
  FitTable,
  FitText,
} from "@/components/fit";
import { EXERCISE_CATEGORY_OPTIONS } from "@/components/exercise-lab/exercise-lab-data";
import {
  REVIEW_STATUS_OPTIONS,
  getErrorMessage,
} from "@/components/exercise-lab/exerciseLabShared";

import { ExerciseLabSurfaceFrame } from "./ExerciseLabSurfaceFrame";
import { useExerciseLabPage } from "./ExerciseLabPageContext";

export function ExerciseLabReviewSurface() {
  const {
    activeMuscleDefinitions,
    colors,
    isCompact,
    openReviewModal,
    reviewCategory,
    reviewMeta,
    reviewMuscleFilter,
    reviewQueueQuery,
    reviewSearch,
    reviewStatus,
    reviewTableActions,
    reviewTableColumns,
    selectedCandidateId,
    setReviewCategory,
    setReviewMuscleFilter,
    setReviewPage,
    setReviewSearch,
    setReviewStatus,
    visibleReviewCandidates,
  } = useExerciseLabPage();

  return (
    <ExerciseLabSurfaceFrame
      className="exercise-review-surface"
      tableMinWidth={1320}
      actions={
        <FitButton
          label="Review next"
          disabled={visibleReviewCandidates.length === 0}
          onClick={() => {
            const nextCandidate = visibleReviewCandidates[0];
            if (nextCandidate) openReviewModal(nextCandidate);
          }}
          style={{ borderRadius: 6, minHeight: 36, minWidth: 118 }}
          textStyle={{ fontSize: 12, fontWeight: 850 }}
        />
      }
      toolbar={
        <div className="exercise-review-filter-row">
          <FitSearch
            ariaLabel="Search exercise review queue"
            compact
            name="exercise-review-search"
            placeholder="Search exercise, creator, source, or match"
            value={reviewSearch}
            onChangeText={setReviewSearch}
          />
          <FitDropdown
            compact
            fullWidth
            ariaLabel="Exercise review status filter"
            value={reviewStatus}
            options={[...REVIEW_STATUS_OPTIONS]}
            onChange={(value) =>
              setReviewStatus(value as ExerciseReviewSubmissionStatus | "")
            }
          />
          <FitDropdown
            compact
            fullWidth
            ariaLabel="Exercise review category filter"
            value={reviewCategory}
            options={[
              { label: "All categories", value: "" },
              ...EXERCISE_CATEGORY_OPTIONS.map((option) => ({
                label: option.label,
                value: option.value,
              })),
            ]}
            onChange={(value) =>
              setReviewCategory(value as FitnessExerciseCategory | "")
            }
          />
          <FitDropdown
            compact
            fullWidth
            ariaLabel="Exercise review muscle filter"
            value={reviewMuscleFilter}
            options={[
              { label: "All muscles", value: "" },
              ...activeMuscleDefinitions.map((definition) => ({
                label: definition.name,
                value: definition.key,
              })),
            ]}
            onChange={setReviewMuscleFilter}
          />
        </div>
      }
      footer={
        <>
          <FitText style={{ fontSize: 12, color: colors.textSecondary }}>
            Showing {reviewMeta?.total === 0 ? 0 : ((reviewMeta?.page ?? 1) - 1) * 8 + 1} to{" "}
            {Math.min((reviewMeta?.page ?? 1) * 8, reviewMeta?.total ?? 0)} of{" "}
            {reviewMeta?.total ?? 0} submissions
          </FitText>
          <div style={{ alignItems: "center", display: "flex", gap: 10 }}>
            {reviewMeta && reviewMeta.total > 0 ? (
              <FitPagination
                ariaLabel="Exercise review table pagination"
                currentPage={reviewMeta.page}
                totalPages={Math.max(1, reviewMeta.total_pages)}
                onPageChange={setReviewPage}
              />
            ) : null}
            <div
              aria-label="Eight submissions per page"
              style={{
                alignItems: "center",
                border: `1px solid ${colors.border}`,
                borderRadius: 6,
                display: "inline-flex",
                fontSize: 11.5,
                fontWeight: 750,
                minHeight: 32,
                paddingInline: 10,
              }}
            >
              8 / page
            </div>
          </div>
        </>
      }
    >
      {reviewQueueQuery.isError ? (
        <div
          style={{
            alignItems: "center",
            backgroundColor: `${colors.danger}10`,
            display: "flex",
            justifyContent: "center",
            padding: 18,
          }}
        >
          <FitText style={{ color: colors.danger, fontSize: 13 }}>
            {getErrorMessage(
              reviewQueueQuery.error,
              "Unable to load the exercise review queue.",
            )}
          </FitText>
        </div>
      ) : (
        <FitTable
          columns={reviewTableColumns}
          rows={visibleReviewCandidates}
          getRowKey={(candidate) => candidate.id}
          getRowClassName={(candidate) =>
            candidate.id === selectedCandidateId ? "is-selected" : undefined
          }
          isLoading={reviewQueueQuery.isLoading}
          loadingMessage="Loading exercise review queue..."
          emptyMessage={
            reviewSearch.trim() || reviewCategory || reviewMuscleFilter.trim()
              ? "No exercise submissions match the current filters."
              : "The review queue is clear."
          }
          emptyStateHeight={isCompact ? 220 : "100%"}
          actions={reviewTableActions}
          actionsHeading="Action"
          compact
          onRowClick={openReviewModal}
          overflowX
          style={{ borderRadius: 0, border: 0, height: "100%" }}
          tableStyle={{ minWidth: 1320, tableLayout: "fixed" }}
        />
      )}

        <style>{`
          .exercise-review-filter-row {
            align-items: center;
            display: grid;
            gap: 10px;
            grid-template-columns:
              minmax(280px, 1.5fr)
              minmax(170px, 0.75fr)
              minmax(190px, 0.85fr)
              minmax(190px, 0.85fr);
            min-width: 0;
          }

          .exercise-review-surface table th:nth-child(1) {
            width: 20%;
          }

          .exercise-review-surface table th:nth-child(2) {
            width: 20%;
          }

          .exercise-review-surface table th:nth-child(3) {
            width: 9%;
          }

          .exercise-review-surface table th:nth-child(4) {
            width: 15%;
          }

          .exercise-review-surface table th:nth-child(5) {
            width: 15%;
          }

          .exercise-review-surface table th:nth-child(6) {
            width: 10%;
          }

          .exercise-review-surface table th:last-child {
            width: 124px;
          }

          .exercise-review-surface table td {
            height: 60px;
          }

          .exercise-review-surface table td p,
          .exercise-review-surface table td span {
            line-height: 16px;
          }

          @media (max-width: 1420px) {
            .exercise-review-filter-row {
              grid-template-columns:
                minmax(220px, 1.25fr)
                minmax(140px, 0.7fr)
                minmax(160px, 0.75fr)
                minmax(150px, 0.7fr);
            }
          }

          @media (max-width: 1160px) {
            .exercise-review-filter-row {
              grid-template-columns: repeat(2, minmax(0, 1fr));
            }
          }

          @media (max-width: 680px) {
            .exercise-review-filter-row {
              grid-template-columns: minmax(0, 1fr);
            }
          }
        `}</style>
    </ExerciseLabSurfaceFrame>
  );
}
