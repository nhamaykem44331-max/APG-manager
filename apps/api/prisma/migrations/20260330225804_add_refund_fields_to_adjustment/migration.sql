-- AlterTable
ALTER TABLE "booking_adjustments"
ADD COLUMN "airline_refund" DECIMAL(65,30) NOT NULL DEFAULT 0,
ADD COLUMN "apg_service_fee" DECIMAL(65,30) NOT NULL DEFAULT 0,
ADD COLUMN "fund_account" "FundAccount",
ADD COLUMN "penalty_fee" DECIMAL(65,30) NOT NULL DEFAULT 0;
