-- Dr.DENTES-inspired clinical architecture: tariffs, clinical records, audit and backups

-- CreateEnum
CREATE TYPE "TariffType" AS ENUM ('TDB', 'CUSTOM');
CREATE TYPE "DiagnosisStatus" AS ENUM ('ACTIVE', 'RESOLVED');
CREATE TYPE "TreatmentRecordStatus" AS ENUM ('PLANNED', 'APPLIED', 'CANCELLED');
CREATE TYPE "ClinicalNoteType" AS ENUM ('NOTE', 'ANAMNESIS', 'FOLLOW_UP');
CREATE TYPE "BackupStatus" AS ENUM ('COMPLETED', 'FAILED');

-- Extend Patient card (Dr.DENTES patient card fields)
ALTER TABLE "Patient"
  ADD COLUMN "mobilePhone" TEXT,
  ADD COLUMN "wiredPhone" TEXT,
  ADD COLUMN "nationality" TEXT DEFAULT 'TR',
  ADD COLUMN "country" TEXT DEFAULT 'TR',
  ADD COLUMN "city" TEXT,
  ADD COLUMN "town" TEXT,
  ADD COLUMN "postCode" TEXT,
  ADD COLUMN "profession" TEXT,
  ADD COLUMN "bloodGroup" TEXT,
  ADD COLUMN "controlPeriodMonth" INTEGER,
  ADD COLUMN "specialCode" TEXT,
  ADD COLUMN "relativeName" TEXT,
  ADD COLUMN "relativePhone" TEXT,
  ADD COLUMN "referenceName" TEXT,
  ADD COLUMN "referencePatientId" UUID,
  ADD COLUMN "organization" TEXT,
  ADD COLUMN "foreignPatientType" TEXT,
  ADD COLUMN "balance" DECIMAL(65,30) NOT NULL DEFAULT 0,
  ADD COLUMN "notes" TEXT,
  ADD COLUMN "tariffId" UUID,
  ADD COLUMN "dentistId" UUID;

CREATE INDEX "Patient_tariffId_idx" ON "Patient"("tariffId");
CREATE INDEX "Patient_dentistId_idx" ON "Patient"("dentistId");
CREATE INDEX "Patient_referencePatientId_idx" ON "Patient"("referencePatientId");

ALTER TABLE "Patient" ADD CONSTRAINT "Patient_referencePatientId_fkey" FOREIGN KEY ("referencePatientId") REFERENCES "Patient"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Patient" ADD CONSTRAINT "Patient_dentistId_fkey" FOREIGN KEY ("dentistId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Extend Appointment (chair/unit, duration, external title/phone, procedure type)
ALTER TABLE "Appointment"
  ADD COLUMN "unitNo" INTEGER,
  ADD COLUMN "duration" INTEGER,
  ADD COLUMN "title" TEXT,
  ADD COLUMN "phone" TEXT,
  ADD COLUMN "procedureType" TEXT;

CREATE INDEX "Appointment_appointmentDate_idx" ON "Appointment"("appointmentDate");

-- Create Tariff and TariffItem
CREATE TABLE "Tariff" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "name" TEXT NOT NULL,
  "year" INTEGER NOT NULL,
  "type" "TariffType" NOT NULL DEFAULT 'TDB',
  "effectiveDate" TIMESTAMP(3),
  "pdfUrl" TEXT,
  "sourceKey" TEXT,
  "sourceUrl" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Tariff_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Tariff_sourceKey_key" ON "Tariff"("sourceKey");
CREATE UNIQUE INDEX "Tariff_year_type_name_key" ON "Tariff"("year", "type", "name");
CREATE INDEX "Tariff_year_idx" ON "Tariff"("year");
CREATE INDEX "Tariff_type_idx" ON "Tariff"("type");
CREATE INDEX "Tariff_isActive_idx" ON "Tariff"("isActive");

CREATE TABLE "TariffItem" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tariffId" UUID NOT NULL,
  "code" TEXT NOT NULL,
  "categoryCode" TEXT,
  "category" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "priceExclVat" DECIMAL(65,30) NOT NULL,
  "priceInclVat" DECIMAL(65,30) NOT NULL,
  "vatRate" DECIMAL(65,30) NOT NULL DEFAULT 10,
  "notes" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TariffItem_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TariffItem_tariffId_code_key" ON "TariffItem"("tariffId", "code");
CREATE INDEX "TariffItem_tariffId_category_idx" ON "TariffItem"("tariffId", "category");
CREATE INDEX "TariffItem_tariffId_name_idx" ON "TariffItem"("tariffId", "name");
CREATE INDEX "TariffItem_isActive_idx" ON "TariffItem"("isActive");
ALTER TABLE "TariffItem" ADD CONSTRAINT "TariffItem_tariffId_fkey" FOREIGN KEY ("tariffId") REFERENCES "Tariff"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Patient" ADD CONSTRAINT "Patient_tariffId_fkey" FOREIGN KEY ("tariffId") REFERENCES "Tariff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Create DentistProfile
CREATE TABLE "DentistProfile" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "userId" UUID NOT NULL,
  "nationalId" TEXT,
  "birthDate" TIMESTAMP(3),
  "officeHours" JSONB,
  "preventOutsideOfficeHours" BOOLEAN NOT NULL DEFAULT true,
  "lunchBreakStart" TEXT,
  "lunchBreakEnd" TEXT,
  "mobilePhone" TEXT,
  "wiredPhone" TEXT,
  "phone" TEXT,
  "country" TEXT,
  "city" TEXT,
  "town" TEXT,
  "address" TEXT,
  "postCode" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DentistProfile_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "DentistProfile_userId_key" ON "DentistProfile"("userId");
CREATE INDEX "DentistProfile_isActive_idx" ON "DentistProfile"("isActive");
ALTER TABLE "DentistProfile" ADD CONSTRAINT "DentistProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Extend Service with tariff link and VAT
ALTER TABLE "Service"
  ADD COLUMN "code" TEXT,
  ADD COLUMN "vatRate" DECIMAL(65,30) NOT NULL DEFAULT 10,
  ADD COLUMN "tariffItemId" UUID;

CREATE UNIQUE INDEX "Service_tariffItemId_key" ON "Service"("tariffItemId");
CREATE INDEX "Service_code_idx" ON "Service"("code");
ALTER TABLE "Service" ADD CONSTRAINT "Service_tariffItemId_fkey" FOREIGN KEY ("tariffItemId") REFERENCES "TariffItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Extend TreatmentPlan
ALTER TABLE "TreatmentPlan"
  ADD COLUMN "subtotal" DECIMAL(65,30),
  ADD COLUMN "vatAmount" DECIMAL(65,30) NOT NULL DEFAULT 0,
  ADD COLUMN "grandTotal" DECIMAL(65,30),
  ADD COLUMN "currency" TEXT NOT NULL DEFAULT 'TRY',
  ADD COLUMN "notes" TEXT,
  ADD COLUMN "tariffId" UUID;

CREATE INDEX "TreatmentPlan_tariffId_idx" ON "TreatmentPlan"("tariffId");
ALTER TABLE "TreatmentPlan" ADD CONSTRAINT "TreatmentPlan_tariffId_fkey" FOREIGN KEY ("tariffId") REFERENCES "Tariff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Extend TreatmentItem
ALTER TABLE "TreatmentItem"
  ADD COLUMN "tariffItemId" UUID,
  ADD COLUMN "code" TEXT,
  ADD COLUMN "vatRate" DECIMAL(65,30) NOT NULL DEFAULT 0,
  ADD COLUMN "discount" DECIMAL(65,30) NOT NULL DEFAULT 0,
  ADD COLUMN "total" DECIMAL(65,30);

CREATE INDEX "TreatmentItem_tariffItemId_idx" ON "TreatmentItem"("tariffItemId");
ALTER TABLE "TreatmentItem" ADD CONSTRAINT "TreatmentItem_tariffItemId_fkey" FOREIGN KEY ("tariffItemId") REFERENCES "TariffItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Extend Invoice
ALTER TABLE "Invoice"
  ADD COLUMN "invoiceNo" TEXT,
  ADD COLUMN "invoiceDate" TIMESTAMP(3),
  ADD COLUMN "invoiceType" TEXT NOT NULL DEFAULT 'OUTGOING',
  ADD COLUMN "subtotal" DECIMAL(65,30),
  ADD COLUMN "vatAmount" DECIMAL(65,30) NOT NULL DEFAULT 0,
  ADD COLUMN "discount" DECIMAL(65,30) NOT NULL DEFAULT 0,
  ADD COLUMN "grandTotal" DECIMAL(65,30),
  ADD COLUMN "currency" TEXT NOT NULL DEFAULT 'TRY',
  ADD COLUMN "exchangeRate" DECIMAL(65,30) NOT NULL DEFAULT 1,
  ADD COLUMN "description" TEXT,
  ADD COLUMN "senderTaxpayerId" TEXT,
  ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

CREATE UNIQUE INDEX "Invoice_invoiceNo_key" ON "Invoice"("invoiceNo");
CREATE INDEX "Invoice_invoiceDate_idx" ON "Invoice"("invoiceDate");
CREATE INDEX "Invoice_status_idx" ON "Invoice"("status");

-- Clinical tables
CREATE TABLE "Diagnosis" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "patientId" UUID NOT NULL,
  "appointmentId" UUID,
  "doctorId" UUID,
  "toothNo" TEXT,
  "code" TEXT,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "status" "DiagnosisStatus" NOT NULL DEFAULT 'ACTIVE',
  "diagnosedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "resolvedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Diagnosis_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Diagnosis_patientId_status_idx" ON "Diagnosis"("patientId", "status");
CREATE INDEX "Diagnosis_appointmentId_idx" ON "Diagnosis"("appointmentId");
CREATE INDEX "Diagnosis_doctorId_idx" ON "Diagnosis"("doctorId");
ALTER TABLE "Diagnosis" ADD CONSTRAINT "Diagnosis_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Diagnosis" ADD CONSTRAINT "Diagnosis_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "Appointment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Diagnosis" ADD CONSTRAINT "Diagnosis_doctorId_fkey" FOREIGN KEY ("doctorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "TreatmentRecord" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "patientId" UUID NOT NULL,
  "planId" UUID,
  "planItemId" UUID,
  "appointmentId" UUID,
  "doctorId" UUID,
  "serviceId" UUID,
  "tariffItemId" UUID,
  "toothNo" TEXT,
  "code" TEXT,
  "procedureName" TEXT NOT NULL,
  "quantity" INTEGER NOT NULL DEFAULT 1,
  "unitPrice" DECIMAL(65,30) NOT NULL,
  "vatRate" DECIMAL(65,30) NOT NULL DEFAULT 0,
  "total" DECIMAL(65,30) NOT NULL,
  "status" "TreatmentRecordStatus" NOT NULL DEFAULT 'APPLIED',
  "appliedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TreatmentRecord_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "TreatmentRecord_patientId_status_idx" ON "TreatmentRecord"("patientId", "status");
CREATE INDEX "TreatmentRecord_planId_idx" ON "TreatmentRecord"("planId");
CREATE INDEX "TreatmentRecord_appointmentId_idx" ON "TreatmentRecord"("appointmentId");
CREATE INDEX "TreatmentRecord_doctorId_idx" ON "TreatmentRecord"("doctorId");
CREATE INDEX "TreatmentRecord_tariffItemId_idx" ON "TreatmentRecord"("tariffItemId");
CREATE INDEX "TreatmentRecord_appliedAt_idx" ON "TreatmentRecord"("appliedAt");
ALTER TABLE "TreatmentRecord" ADD CONSTRAINT "TreatmentRecord_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TreatmentRecord" ADD CONSTRAINT "TreatmentRecord_planId_fkey" FOREIGN KEY ("planId") REFERENCES "TreatmentPlan"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "TreatmentRecord" ADD CONSTRAINT "TreatmentRecord_planItemId_fkey" FOREIGN KEY ("planItemId") REFERENCES "TreatmentItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "TreatmentRecord" ADD CONSTRAINT "TreatmentRecord_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "Appointment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "TreatmentRecord" ADD CONSTRAINT "TreatmentRecord_doctorId_fkey" FOREIGN KEY ("doctorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "TreatmentRecord" ADD CONSTRAINT "TreatmentRecord_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "TreatmentRecord" ADD CONSTRAINT "TreatmentRecord_tariffItemId_fkey" FOREIGN KEY ("tariffItemId") REFERENCES "TariffItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "Prescription" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "patientId" UUID NOT NULL,
  "doctorId" UUID,
  "prescriptionNo" TEXT,
  "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "items" JSONB NOT NULL,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Prescription_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Prescription_patientId_issuedAt_idx" ON "Prescription"("patientId", "issuedAt");
CREATE INDEX "Prescription_doctorId_idx" ON "Prescription"("doctorId");
ALTER TABLE "Prescription" ADD CONSTRAINT "Prescription_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Prescription" ADD CONSTRAINT "Prescription_doctorId_fkey" FOREIGN KEY ("doctorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "ClinicalNote" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "patientId" UUID NOT NULL,
  "appointmentId" UUID,
  "doctorId" UUID,
  "type" "ClinicalNoteType" NOT NULL DEFAULT 'NOTE',
  "content" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ClinicalNote_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ClinicalNote_patientId_createdAt_idx" ON "ClinicalNote"("patientId", "createdAt");
CREATE INDEX "ClinicalNote_appointmentId_idx" ON "ClinicalNote"("appointmentId");
ALTER TABLE "ClinicalNote" ADD CONSTRAINT "ClinicalNote_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ClinicalNote" ADD CONSTRAINT "ClinicalNote_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "Appointment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ClinicalNote" ADD CONSTRAINT "ClinicalNote_doctorId_fkey" FOREIGN KEY ("doctorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "ToothFinding" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "patientId" UUID NOT NULL,
  "toothNo" TEXT NOT NULL,
  "condition" TEXT NOT NULL,
  "surfaces" TEXT,
  "notes" TEXT,
  "updatedById" UUID,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ToothFinding_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ToothFinding_patientId_toothNo_key" ON "ToothFinding"("patientId", "toothNo");
CREATE INDEX "ToothFinding_patientId_idx" ON "ToothFinding"("patientId");
CREATE INDEX "ToothFinding_condition_idx" ON "ToothFinding"("condition");
ALTER TABLE "ToothFinding" ADD CONSTRAINT "ToothFinding_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ToothFinding" ADD CONSTRAINT "ToothFinding_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "InvoiceItem" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "invoiceId" UUID NOT NULL,
  "serviceId" UUID,
  "tariffItemId" UUID,
  "code" TEXT,
  "description" TEXT NOT NULL,
  "quantity" DECIMAL(65,30) NOT NULL DEFAULT 1,
  "unitPrice" DECIMAL(65,30) NOT NULL,
  "vatRate" DECIMAL(65,30) NOT NULL DEFAULT 10,
  "vatAmount" DECIMAL(65,30) NOT NULL DEFAULT 0,
  "discount" DECIMAL(65,30) NOT NULL DEFAULT 0,
  "total" DECIMAL(65,30) NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'TRY',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "InvoiceItem_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "InvoiceItem_invoiceId_idx" ON "InvoiceItem"("invoiceId");
CREATE INDEX "InvoiceItem_tariffItemId_idx" ON "InvoiceItem"("tariffItemId");
ALTER TABLE "InvoiceItem" ADD CONSTRAINT "InvoiceItem_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "InvoiceItem" ADD CONSTRAINT "InvoiceItem_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "InvoiceItem" ADD CONSTRAINT "InvoiceItem_tariffItemId_fkey" FOREIGN KEY ("tariffItemId") REFERENCES "TariffItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Audit logs and backups
CREATE TABLE "AuditLog" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "userId" UUID,
  "userName" TEXT,
  "userEmail" TEXT,
  "role" TEXT,
  "action" TEXT NOT NULL,
  "entity" TEXT NOT NULL,
  "entityId" TEXT,
  "method" TEXT,
  "path" TEXT,
  "statusCode" INTEGER,
  "ip" TEXT,
  "userAgent" TEXT,
  "description" TEXT,
  "changes" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");
CREATE INDEX "AuditLog_entity_idx" ON "AuditLog"("entity");
CREATE INDEX "AuditLog_action_idx" ON "AuditLog"("action");
CREATE INDEX "AuditLog_userId_idx" ON "AuditLog"("userId");
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "Backup" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "fileName" TEXT NOT NULL,
  "sizeBytes" INTEGER NOT NULL,
  "status" "BackupStatus" NOT NULL DEFAULT 'COMPLETED',
  "error" TEXT,
  "metadata" JSONB,
  "createdById" UUID,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Backup_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Backup_createdAt_idx" ON "Backup"("createdAt");
CREATE INDEX "Backup_status_idx" ON "Backup"("status");
ALTER TABLE "Backup" ADD CONSTRAINT "Backup_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
