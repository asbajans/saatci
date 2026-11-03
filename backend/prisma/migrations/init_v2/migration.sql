-- AppointmentType: CONSULTATION -> MEETING, add EXAMINATION
CREATE TYPE "AppointmentType_new" AS ENUM ('MEETING', 'EXAMINATION', 'TREATMENT');

ALTER TABLE "Appointment" ALTER COLUMN "type" TYPE "AppointmentType_new" USING (
  CASE "type"::text
    WHEN 'CONSULTATION' THEN 'MEETING'
    ELSE "type"::text
  END
)::"AppointmentType_new";

DROP TYPE "AppointmentType";
ALTER TYPE "AppointmentType_new" RENAME TO "AppointmentType";

-- Appointment: lead desteği, randevuyu veren, kanal/kampanya
ALTER TABLE "Appointment" ALTER COLUMN "patientId" DROP NOT NULL;
ALTER TABLE "Appointment" ADD COLUMN "leadId" UUID;
ALTER TABLE "Appointment" ADD COLUMN "createdById" UUID;
ALTER TABLE "Appointment" ADD COLUMN "channel" TEXT;
ALTER TABLE "Appointment" ADD COLUMN "campaignId" UUID;

-- TreatmentPlan: satışı yapan, kanal/kampanya
ALTER TABLE "TreatmentPlan" ADD COLUMN "createdById" UUID;
ALTER TABLE "TreatmentPlan" ADD COLUMN "channel" TEXT;
ALTER TABLE "TreatmentPlan" ADD COLUMN "campaignId" UUID;

-- VisitStatus + PatientVisit (Geliş / Protokol)
CREATE TYPE "VisitStatus" AS ENUM ('WAITING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');

CREATE TABLE "PatientVisit" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "protokolNo" TEXT NOT NULL,
    "appointmentId" UUID,
    "patientId" UUID,
    "leadId" UUID,
    "channel" TEXT,
    "campaignId" UUID,
    "status" "VisitStatus" NOT NULL DEFAULT 'WAITING',
    "visitDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PatientVisit_pkey" PRIMARY KEY ("id")
);

-- Backfill channel/campaign from lead source
UPDATE "Appointment" a
SET "channel" = l."source", "campaignId" = l."campaignId"
FROM "Lead" l
WHERE l."patientId" = a."patientId" AND a."channel" IS NULL;

UPDATE "TreatmentPlan" p
SET "channel" = l."source", "campaignId" = l."campaignId"
FROM "Lead" l
WHERE l."patientId" = p."patientId" AND p."channel" IS NULL;

UPDATE "Appointment" SET "channel" = 'Bilinmiyor' WHERE "channel" IS NULL;
UPDATE "TreatmentPlan" SET "channel" = 'Bilinmiyor' WHERE "channel" IS NULL;

-- Backfill personnel
UPDATE "Appointment"
SET "createdById" = (SELECT "id" FROM "User" WHERE "role" = 'CALL_CENTER' ORDER BY "createdAt" ASC LIMIT 1)
WHERE "createdById" IS NULL;

UPDATE "TreatmentPlan"
SET "createdById" = (SELECT "id" FROM "User" WHERE "role" = 'SALES' ORDER BY "createdAt" ASC LIMIT 1)
WHERE "createdById" IS NULL;

-- Foreign keys
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "TreatmentPlan" ADD CONSTRAINT "TreatmentPlan_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "TreatmentPlan" ADD CONSTRAINT "TreatmentPlan_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "PatientVisit" ADD CONSTRAINT "PatientVisit_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "Appointment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PatientVisit" ADD CONSTRAINT "PatientVisit_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PatientVisit" ADD CONSTRAINT "PatientVisit_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PatientVisit" ADD CONSTRAINT "PatientVisit_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Unique / index
CREATE UNIQUE INDEX "PatientVisit_protokolNo_key" ON "PatientVisit"("protokolNo");
CREATE UNIQUE INDEX "PatientVisit_appointmentId_key" ON "PatientVisit"("appointmentId");

CREATE INDEX "Appointment_leadId_idx" ON "Appointment"("leadId");
CREATE INDEX "Appointment_channel_idx" ON "Appointment"("channel");
CREATE INDEX "Appointment_createdById_idx" ON "Appointment"("createdById");

CREATE INDEX "TreatmentPlan_createdById_idx" ON "TreatmentPlan"("createdById");
CREATE INDEX "TreatmentPlan_channel_idx" ON "TreatmentPlan"("channel");

CREATE INDEX "PatientVisit_patientId_idx" ON "PatientVisit"("patientId");
CREATE INDEX "PatientVisit_leadId_idx" ON "PatientVisit"("leadId");
CREATE INDEX "PatientVisit_channel_idx" ON "PatientVisit"("channel");
CREATE INDEX "PatientVisit_status_idx" ON "PatientVisit"("status");
CREATE INDEX "PatientVisit_visitDate_idx" ON "PatientVisit"("visitDate");
