/*
  Warnings:

  - A unique constraint covering the columns `[airline]` on the table `airline_deposits` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "airline_deposits_airline_key" ON "airline_deposits"("airline");
