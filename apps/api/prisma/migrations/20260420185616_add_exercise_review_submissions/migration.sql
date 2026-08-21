-- CreateEnum
CREATE TYPE "ExerciseReviewSubmissionStatus" AS ENUM ('pending', 'left_private', 'rejected', 'published');

-- CreateTable
CREATE TABLE "exercise_review_submissions" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "pose_session_id" UUID,
    "published_exercise_id" UUID,
    "status" "ExerciseReviewSubmissionStatus" NOT NULL DEFAULT 'pending',
    "source_label" VARCHAR(100) NOT NULL DEFAULT 'detected unknown movement',
    "origin_label" VARCHAR(100) NOT NULL DEFAULT 'client custom',
    "queue_tag" VARCHAR(50) NOT NULL DEFAULT 'needs match',
    "trigger_label" VARCHAR(100) NOT NULL DEFAULT 'unknown after 3 reps',
    "title" VARCHAR(255) NOT NULL,
    "proposed_name" VARCHAR(255) NOT NULL,
    "summary" VARCHAR(255) NOT NULL,
    "match_hint" VARCHAR(255),
    "category" "ExerciseCategory" NOT NULL,
    "muscle_group" VARCHAR(100) NOT NULL,
    "description" TEXT,
    "instructions" TEXT,
    "evidence_bars" JSONB,
    "review_notes" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "reviewed_at" TIMESTAMPTZ(6),

    CONSTRAINT "exercise_review_submissions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "exercise_review_submissions_pose_session_id_key" ON "exercise_review_submissions"("pose_session_id");

-- CreateIndex
CREATE INDEX "exercise_review_submissions_status_created_at_idx" ON "exercise_review_submissions"("status", "created_at" DESC);

-- CreateIndex
CREATE INDEX "exercise_review_submissions_user_id_status_idx" ON "exercise_review_submissions"("user_id", "status");

-- AddForeignKey
ALTER TABLE "exercise_review_submissions" ADD CONSTRAINT "exercise_review_submissions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exercise_review_submissions" ADD CONSTRAINT "exercise_review_submissions_pose_session_id_fkey" FOREIGN KEY ("pose_session_id") REFERENCES "pose_sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exercise_review_submissions" ADD CONSTRAINT "exercise_review_submissions_published_exercise_id_fkey" FOREIGN KEY ("published_exercise_id") REFERENCES "exercise_catalog"("id") ON DELETE SET NULL ON UPDATE CASCADE;
