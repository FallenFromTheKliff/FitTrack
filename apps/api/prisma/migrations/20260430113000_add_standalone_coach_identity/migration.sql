ALTER TABLE "coach_profiles"
ALTER COLUMN "user_id" DROP NOT NULL;

ALTER TABLE "coach_profiles"
ADD COLUMN "display_name" VARCHAR(160),
ADD COLUMN "contact_email" VARCHAR(255),
ADD COLUMN "contact_phone" VARCHAR(40);
