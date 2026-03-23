-- CreateEnum
CREATE TYPE "CashFlowDirection" AS ENUM ('INFLOW', 'OUTFLOW');

-- CreateEnum
CREATE TYPE "CashFlowCategory" AS ENUM ('TICKET_PAYMENT', 'TICKET_REFUND', 'PARTNER_FEEDBACK', 'AIRLINE_PAYMENT', 'SALARY', 'OFFICE_RENT', 'OFFICE_SUPPLIES', 'ENTERTAINMENT', 'TRAVEL', 'RITUAL', 'MARKETING', 'TECHNOLOGY', 'DISBURSEMENT', 'OTHER');

-- CreateTable
CREATE TABLE "cash_flow_entries" (
    "id" TEXT NOT NULL,
    "direction" "CashFlowDirection" NOT NULL,
    "category" "CashFlowCategory" NOT NULL,
    "amount" DECIMAL(65,30) NOT NULL,
    "pic" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "reference" TEXT,
    "date" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DONE',
    "notes" TEXT,
    "created_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cash_flow_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "operating_expenses" (
    "id" TEXT NOT NULL,
    "category" "CashFlowCategory" NOT NULL,
    "description" TEXT NOT NULL,
    "amount" DECIMAL(65,30) NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DONE',
    "notes" TEXT,
    "created_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "operating_expenses_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "cash_flow_entries_direction_idx" ON "cash_flow_entries"("direction");

-- CreateIndex
CREATE INDEX "cash_flow_entries_category_idx" ON "cash_flow_entries"("category");

-- CreateIndex
CREATE INDEX "cash_flow_entries_date_idx" ON "cash_flow_entries"("date");

-- CreateIndex
CREATE INDEX "cash_flow_entries_pic_idx" ON "cash_flow_entries"("pic");

-- CreateIndex
CREATE INDEX "operating_expenses_category_idx" ON "operating_expenses"("category");

-- CreateIndex
CREATE INDEX "operating_expenses_date_idx" ON "operating_expenses"("date");
