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
  FitSection,
  FitTable,
  FitText,
} from "@/components/fit";
import { EXERCISE_CATEGORY_OPTIONS } from "@/components/exercise-lab/exercise-lab-data";
import {
  REVIEW_STATUS_OPTIONS,
  getErrorMessage,
} from "@/components/exercise-lab/exerciseLabShared";

import { ExerciseLabModeNavigation } from "./ExerciseLabModeNavigation";
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
    <FitSection
      className="exercise-review-surface"
      heading=""
      hideHeading
      noPadding
      style={{
        border: `1px solid ${colors.border}`,
        backgroundColor: colors.surfaceRaised,
        borderRadius: 8,
        marginBottom: 0,
        padding: 18,
        height: isCompact ? "auto" : "100%",
        overflow: isCompact ? "visible" : "hidden",
      }}
    >
      <div
        style={{
          display: "grid",
          gap: 14,
          gridTemplateRows: isCompact
            ? undefined
            : "auto auto minmax(0, 1fr) auto",
          height: isCompact ? "auto" : "100%",
          minHeight: 0,
        }}
      >
        <div className="exercise-review-command-row">
          <ExerciseLabModeNavigation />
          <FitButton
            label="Review next"
            disabled={visibleReviewCandidates.length === 0}
            onClick={() => {
              const nextCandidate = visibleReviewCandidates[0];
              if (nextCandidate) openReviewModal(nextCandidate);
            }}
            style={{
              borderRadius: 7,
              minHeight: 40,
              minWidth: 126,
              paddingInline: 18,
            }}
            textStyle={{ fontSize: 12, fontWeight: 850 }}
          />
        </div>

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
            fullWidth
            ariaLabel="Exercise review status filter"
            value={reviewStatus}
            options={[...REVIEW_STATUS_OPTIONS]}
            onChange={(value) =>
              setReviewStatus(value as ExerciseReviewSubmissionStatus | "")
            }
          />
          <FitDropdown
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

        <div
          className="exercise-review-table-shell"
          style={{
            minHeight: 0,
            overflow: "hidden",
            border: `1px solid ${colors.border}`,
            borderRadius: 7,
            backgroundColor: colors.surface,
            display: "grid",
            gridTemplateRows: "minmax(0, 1fr)",
          }}
        >
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
            style={{
              borderRadius: 0,
              border: 0,
              height: "100%",
              overflowY: "hidden",
            }}
            tableStyle={{ minWidth: 1320, tableLayout: "fixed" }}
          />
        </div>

        {reviewQueueQuery.isError ? (
          <div
            style={{
              border: `1px solid ${colors.danger}45`,
              borderRadius: 8,
              backgroundColor: `${colors.danger}10`,
              padding: 12,
            }}
          >
            <FitText style={{ color: colors.danger, fontSize: 13 }}>
              {getErrorMessage(
                reviewQueueQuery.error,
                "Unable to load the exercise review queue.",
              )}
            </FitText>
          </div>
        ) : null}

        {reviewMeta ? (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 10,
              flexWrap: "wrap",
              borderTop: `1px solid ${colors.border}`,
              backgroundColor: "transparent",
              minHeight: 48,
              padding: "10px 58px 0 2px",
            }}
          >
            <FitText style={{ fontSize: 12, color: colors.textSecondary }}>
              Showing{" "}
              {reviewMeta.total === 0 ? 0 : (reviewMeta.page - 1) * 8 + 1} to{" "}
              {Math.min(reviewMeta.page * 8, reviewMeta.total)} of{" "}
              {reviewMeta.total} submissions
            </FitText>
            <div
              style={{
                alignItems: "center",
                display: "flex",
                gap: 10,
              }}
            >
              {reviewMeta.total > 0 ? (
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
                  borderRadius: 7,
                  color: colors.textSecondary,
                  display: "inline-flex",
                  fontSize: 11.5,
                  fontWeight: 750,
                  minHeight: 34,
                  paddingInline: 10,
                }}
              >
                8 / page
              </div>
            </div>
          </div>
        ) : null}
        <style>{`
          .exercise-review-command-row {
            align-items: center;
            display: flex;
            gap: 18px;
            justify-content: space-between;
            min-width: 0;
          }

          .exercise-review-filter-row {
            align-items: center;
            display: grid;
            gap: 14px;
            grid-template-columns:
              minmax(280px, 1.5fr)
              minmax(170px, 0.75fr)
              minmax(190px, 0.85fr)
              minmax(190px, 0.85fr);
            min-width: 0;
          }

          .exercise-review-table-shell {
            display: grid;
            grid-template-rows: minmax(0, 1fr);
            min-height: 0;
          }

          .exercise-review-table-shell table th,
          .exercise-review-table-shell table td {
            text-align: left !important;
          }

          .exercise-review-table-shell table th:nth-child(1) {
            width: 20%;
          }

          .exercise-review-table-shell table th:nth-child(2) {
            width: 20%;
          }

          .exercise-review-table-shell table th:nth-child(3) {
            width: 9%;
          }

          .exercise-review-table-shell table th:nth-child(4) {
            width: 15%;
          }

          .exercise-review-table-shell table th:nth-child(5) {
            width: 15%;
          }

          .exercise-review-table-shell table th:nth-child(6) {
            width: 10%;
          }

          .exercise-review-table-shell table th:last-child {
            width: 124px;
          }

          .exercise-review-table-shell table th {
            height: 40px;
            padding-block: 8px !important;
          }

          .exercise-review-table-shell table td {
            height: 68px;
            padding-block: 7px !important;
          }

          .exercise-review-table-shell table td p,
          .exercise-review-table-shell table td span {
            line-height: 16px;
          }

          .exercise-review-table-shell table tbody tr:last-child td {
            border-bottom: 0 !important;
          }

          .exercise-review-table-shell table td:last-child > div {
            justify-content: flex-end !important;
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
            .exercise-review-command-row {
              align-items: stretch;
              flex-direction: column;
            }

            .exercise-review-filter-row {
              grid-template-columns: minmax(0, 1fr);
            }

            .exercise-lab-mode-navigation {
              width: 100%;
            }
          }
        `}</style>
      </div>
    </FitSection>
  );
}
