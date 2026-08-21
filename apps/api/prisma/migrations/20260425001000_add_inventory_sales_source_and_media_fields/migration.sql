-- CreateEnum
DO $$
BEGIN
  CREATE TYPE "SaleSource" AS ENUM ('manual', 'mobile');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- AlterTable
ALTER TABLE "retail_products"
ADD COLUMN IF NOT EXISTS "cost" DECIMAL(10,2) NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "sale_transactions"
ADD COLUMN IF NOT EXISTS "notes" TEXT,
ADD COLUMN IF NOT EXISTS "source" "SaleSource" NOT NULL DEFAULT 'manual';

-- AlterTable
ALTER TABLE "gym_equipment_items"
ADD COLUMN IF NOT EXISTS "image_url" VARCHAR(500);
