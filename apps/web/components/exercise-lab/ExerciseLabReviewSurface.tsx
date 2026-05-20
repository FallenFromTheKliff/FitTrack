"use client";

import type {
  ExerciseReviewSubmissionStatus,
  FitnessExerciseCategory,
} from "@fittrack/api-client";
import {
  FitDropdown,
  FitPagination,
  FitPill,
  FitSearch,
  FitSection,
  FitTable,
  FitText,
  FitTextInput,
} from "@/components/fit";
import { EXERCISE_CATEGORY_OPTIONS } from "@/components/exercise-lab/exercise-lab-data";
import {
  REVIEW_STATUS_OPTIONS,
  getErrorMessage,
  toTitleCase,
} from "@/components/exercise-lab/exerciseLabShared";

import { ExerciseLabModeNavigation } from "./ExerciseLabModeNavigation";
import { useExerciseLabPage } from "./ExerciseLabPageContext";

export function ExerciseLabReviewSurface() {
  const {
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
    surfaceControlsStyle,
    surfaceTitleNavStyle,
    surfaceTopRowStyle,
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
        padding: 14,
        height: isCompact ? "auto" : "100%",
        overflow: isCompact ? "visible" : "hidden",
      }}
    >
      <div
        style={{
          display: "grid",
          gap: 14,
          gridTemplateRows: isCompact ? undefined : "auto minmax(0, 1fr) auto",
          height: isCompact ? "auto" : "100%",
          minHeight: 0,
        }}
      >
        <div className="exercise-review-top-row" style={surfaceTopRowStyle}>
          <div className="exercise-review-title-nav" style={surfaceTitleNavStyle}>
            <FitText style={{ fontSize: 18, fontWeight: 950, whiteSpace: "nowrap" }}>
              Review Queue
            </FitText>
            <ExerciseLabModeNavigation />
          </div>
          <div className="exercise-review-controls" style={surfaceControlsStyle}>
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
                setReviewStatus(
                  value as ExerciseReviewSubmissionStatus | "",
                )
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
            <FitTextInput
              name="exercise-review-muscle-filter"
              value={reviewMuscleFilter}
              onChange={(event) => setReviewMuscleFilter(event.target.value)}
              placeholder="Muscle group"
              style={{
                border: `1px solid ${colors.border}`,
                borderRadius: 8,
                backgroundColor: colors.fieldBg,
                padding: "0 14px",
                minHeight: 38,
              }}
            />
            <FitPill
              mode="status"
              label={`${reviewMeta?.total ?? 0} ${reviewStatus ? toTitleCase(reviewStatus) : "Total"}`}
              color={colors.brand}
            />
          </div>
        </div>

        <div
          className="exercise-review-table-shell"
          style={{
            minHeight: 0,
            overflow: "hidden",
            border: `1px solid ${colors.border}`,
            borderRadius: 8,
            backgroundColor: colors.surface,
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
            actions={reviewTableActions}
            compact
            onRowClick={openReviewModal}
            overflowX
            style={{ borderRadius: 0, border: 0 }}
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
              border: `1px solid ${colors.border}`,
              borderRadius: 8,
              backgroundColor: colors.surface,
              padding: "8px 10px",
            }}
          >
            <FitText style={{ fontSize: 12, color: colors.textSecondary }}>
              Page {reviewMeta.page} of {Math.max(1, reviewMeta.total_pages)} /{" "}
              {reviewMeta.total} submissions
            </FitText>
            <FitPagination
              ariaLabel="Exercise review table pagination"
              currentPage={reviewMeta.page}
              totalPages={Math.max(1, reviewMeta.total_pages)}
              onPageChange={setReviewPage}
            />
          </div>
        ) : null}
        <style>{`
          .exercise-review-top-row {
            grid-template-columns: minmax(360px, max-content) minmax(0, 1fr) !important;
          }

          .exercise-review-title-nav {
            min-width: 0;
          }

          .exercise-review-controls {
            grid-template-columns:
              minmax(150px, 1fr)
              minmax(102px, 0.55fr)
              minmax(112px, 0.58fr)
              minmax(94px, 0.46fr)
              auto !important;
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

          .exercise-review-table-shell table td:last-child > div {
            justify-content: flex-start !important;
          }

          @media (max-width: 1420px) {
            .exercise-review-top-row {
              grid-template-columns: minmax(0, 1fr) !important;
            }

            .exercise-review-controls {
              grid-template-columns:
                minmax(180px, 1fr)
                minmax(110px, 0.62fr)
                minmax(120px, 0.66fr)
                minmax(110px, 0.58fr)
                auto !important;
            }

            .exercise-review-controls > span {
              justify-self: start;
            }
          }

          @media (max-width: 1160px) {
            .exercise-review-controls {
              grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
            }
          }

          @media (max-width: 680px) {
            .exercise-review-controls {
              grid-template-columns: minmax(0, 1fr) !important;
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
