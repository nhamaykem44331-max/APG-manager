/*
  Warnings:

  - A unique constraint covering the columns `[customer_code]` on the table `customers` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "LeadStatus" AS ENUM ('NEW', 'CONTACTED', 'NEGOTIATING', 'WON', 'ACTIVE', 'LOST', 'ON_HOLD');

-- AlterTable
ALTER TABLE "customers" ADD COLUMN     "customer_code" TEXT;

-- CreateTable
CREATE TABLE "sales_leads" (
    "id" TEXT NOT NULL,
    "sales_person" TEXT NOT NULL,
    "company_name" TEXT NOT NULL,
    "contact_name" TEXT,
    "contact_phone" TEXT,
    "contact_email" TEXT,
    "customer_code" TEXT,
    "source" TEXT,
    "description" TEXT,
    "status" "LeadStatus" NOT NULL DEFAULT 'NEW',
    "notes" TEXT,
    "next_action" TEXT,
    "next_action_date" TIMESTAMP(3),
    "estimated_value" DECIMAL(65,30),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sales_leads_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "sales_leads_sales_person_idx" ON "sales_leads"("sales_person");

-- CreateIndex
CREATE INDEX "sales_leads_status_idx" ON "sales_leads"("status");

-- CreateIndex
CREATE INDEX "sales_leads_customer_code_idx" ON "sales_leads"("customer_code");

-- CreateIndex
CREATE UNIQUE INDEX "customers_customer_code_key" ON "customers"("customer_code");
