-- CreateTable
CREATE TABLE "membership_catalog_settings" (
    "id" UUID NOT NULL,
    "membership_card_price" DECIMAL(10,2) NOT NULL DEFAULT 400,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "membership_catalog_settings_pkey" PRIMARY KEY ("id")
);
