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

  return (    <FitSection
      heading=""
      hideHeading
      noPadding
      style={{
        border: `1px solid ${colors.border}`,
        backgroundColor: colors.surfaceRaised,
        borderRadius: 8,
        marginBottom: 0,
        padding: 10,
        height: isCompact ? "auto" : "100%",
        overflow: isCompact ? "visible" : "hidden",
      }}
    >
      <div
        style={{
          display: "grid",
          gap: 10,
          gridTemplateRows: isCompact ? undefined : "auto minmax(0, 1fr) auto",
          height: isCompact ? "auto" : "100%",
          minHeight: 0,
        }}
      >
        <div style={surfaceTopRowStyle}>
          <div style={surfaceTitleNavStyle}>
            <FitText style={{ fontSize: 18, fontWeight: 950, whiteSpace: "nowrap" }}>
              Review Queue
            </FitText>
            <ExerciseLabModeNavigation />
          </div>
          <div style={surfaceControlsStyle}>
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
            overflowX={false}
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
      </div>
    </FitSection>  );
}
