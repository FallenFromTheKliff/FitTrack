-- AlterTable
ALTER TABLE "users" ADD COLUMN     "qr_code_expires_at" TIMESTAMPTZ(6),
ADD COLUMN     "qr_code_rotated_at" TIMESTAMPTZ(6);
