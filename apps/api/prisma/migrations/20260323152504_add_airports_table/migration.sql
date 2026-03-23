-- CreateTable
CREATE TABLE "airports" (
    "id" TEXT NOT NULL,
    "iata" TEXT NOT NULL,
    "icao" TEXT,
    "name" TEXT NOT NULL,
    "nameVi" TEXT,
    "region" TEXT NOT NULL,
    "country_code" TEXT NOT NULL,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "airports_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "airports_iata_key" ON "airports"("iata");

-- CreateIndex
CREATE INDEX "airports_iata_idx" ON "airports"("iata");

-- CreateIndex
CREATE INDEX "airports_name_idx" ON "airports"("name");

-- CreateIndex
CREATE INDEX "airports_country_code_idx" ON "airports"("country_code");
