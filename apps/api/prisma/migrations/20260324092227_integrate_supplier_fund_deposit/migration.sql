-- CreateEnum
CREATE TYPE "FundAccount" AS ENUM ('CASH_OFFICE', 'BANK_HTX', 'BANK_PERSONAL');

-- AlterTable: airline_deposits — convert airline from Airline enum to TEXT safely
-- Step 1: Add a temporary text column
ALTER TABLE "airline_deposits" ADD COLUMN "airline_text" TEXT;

-- Step 2: Copy existing enum values as text
UPDATE "airline_deposits" SET "airline_text" = "airline"::TEXT;

-- Step 3: Drop old enum column and rename
ALTER TABLE "airline_deposits" DROP COLUMN "airline";
ALTER TABLE "airline_deposits" RENAME COLUMN "airline_text" TO "airline";

-- Step 4: Set NOT NULL constraint
ALTER TABLE "airline_deposits" ALTER COLUMN "airline" SET NOT NULL;

-- AlterTable
ALTER TABLE "bookings" ADD COLUMN     "supplier_id" TEXT;

-- AlterTable
ALTER TABLE "payments" ADD COLUMN     "fund_account" "FundAccount";

-- CreateIndex
CREATE UNIQUE INDEX "airline_deposits_airline_key" ON "airline_deposits"("airline");

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "supplier_profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;
