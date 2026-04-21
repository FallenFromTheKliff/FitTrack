-- AlterTable
ALTER TABLE "sale_transactions" ADD COLUMN     "customer_user_id" UUID;

-- CreateIndex
CREATE INDEX "sale_transactions_customer_user_id_idx" ON "sale_transactions"("customer_user_id");

-- AddForeignKey
ALTER TABLE "sale_transactions" ADD CONSTRAINT "sale_transactions_customer_user_id_fkey" FOREIGN KEY ("customer_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
