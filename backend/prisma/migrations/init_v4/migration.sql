-- This migration adds Service/Product management and treatment plan doctor assignment

-- CreateService table
CREATE TABLE "Service" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "category" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "price" NUMERIC(10, 2) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Service_pkey" PRIMARY KEY ("id")
);

-- CreateService unique constraint
CREATE UNIQUE INDEX "Service_category_name_key" ON "Service" ("category", "name");

-- CreateService indexes
CREATE INDEX "Service_category_idx" ON "Service" ("category");

-- Add serviceCategory to CommissionRate
ALTER TABLE "CommissionRate" ADD COLUMN "serviceCategory" TEXT;

-- Add doctorId to TreatmentPlan
ALTER TABLE "TreatmentPlan" ADD COLUMN "doctorId" UUID;

-- Add foreign key constraint for TreatmentPlan_doctorId
ALTER TABLE "TreatmentPlan" ADD CONSTRAINT "TreatmentPlan_doctorId_fkey" FOREIGN KEY ("doctorId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Add doctorId index to TreatmentPlan
CREATE INDEX "TreatmentPlan_doctorId_idx" ON "TreatmentPlan" ("doctorId");

-- Add serviceId to TreatmentItem
ALTER TABLE "TreatmentItem" ADD COLUMN "serviceId" UUID;

-- Add foreign key constraint for TreatmentItem_serviceId
ALTER TABLE "TreatmentItem" ADD CONSTRAINT "TreatmentItem_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service" ("id") ON DELETE SET NULL ON UPDATE CASCADE;
