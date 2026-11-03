-- CreateEnum
CREATE TYPE "IntegrationType" AS ENUM ('META_PIXEL', 'META_CAPI', 'META_LEAD_ADS', 'META_MESSENGER', 'INSTAGRAM_DM', 'WHATSAPP', 'GOOGLE_ADS', 'GA4', 'TIKTOK_PIXEL', 'CUSTOM_WEBHOOK');

-- CreateEnum
CREATE TYPE "ConversionEventType" AS ENUM ('LEAD_CREATED', 'LEAD_CONTACTED', 'APPOINTMENT_BOOKED', 'CLINIC_VISIT', 'TREATMENT_APPROVED', 'SALE', 'PAYMENT_RECEIVED');

-- CreateEnum
CREATE TYPE "TrackingStatus" AS ENUM ('PENDING', 'SENT', 'FAILED', 'SKIPPED');

-- AlterTable Lead
ALTER TABLE "Lead" ADD COLUMN "formId" UUID,
ADD COLUMN "externalId" TEXT,
ADD COLUMN "utmTerm" TEXT,
ADD COLUMN "utmContent" TEXT,
ADD COLUMN "fbclid" TEXT,
ADD COLUMN "gclid" TEXT,
ADD COLUMN "ttclid" TEXT,
ADD COLUMN "landingPage" TEXT,
ADD COLUMN "referrer" TEXT,
ADD COLUMN "rawPayload" JSONB,
ADD COLUMN "lastContactAt" TIMESTAMP(3);

-- AlterTable Campaign
ALTER TABLE "Campaign" ADD COLUMN "platform" TEXT,
ADD COLUMN "externalId" TEXT,
ADD COLUMN "pixelId" TEXT,
ADD COLUMN "utmCampaign" TEXT,
ADD COLUMN "notes" TEXT,
ADD COLUMN "isActive" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- CreateTable
CREATE TABLE "WebsiteForm" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'Web',
    "campaignId" UUID,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "successMessage" TEXT DEFAULT 'Başvurunuz alındı. En kısa sürede sizi arayacağız.',
    "redirectUrl" TEXT,
    "allowedOrigins" TEXT,
    "fields" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WebsiteForm_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeadStatusHistory" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "leadId" UUID NOT NULL,
    "campaignId" UUID,
    "fromStatus" TEXT,
    "toStatus" TEXT NOT NULL,
    "note" TEXT,
    "changedById" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LeadStatusHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConversionEvent" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "type" "ConversionEventType" NOT NULL,
    "leadId" UUID,
    "campaignId" UUID,
    "appointmentId" UUID,
    "patientId" UUID,
    "planId" UUID,
    "invoiceId" UUID,
    "value" DECIMAL(65,30),
    "currency" TEXT NOT NULL DEFAULT 'TRY',
    "payload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConversionEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Integration" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" TEXT NOT NULL,
    "type" "IntegrationType" NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "config" JSONB,
    "lastEventAt" TIMESTAMP(3),
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Integration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IntegrationDelivery" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "eventId" UUID NOT NULL,
    "integrationId" UUID NOT NULL,
    "status" "TrackingStatus" NOT NULL DEFAULT 'PENDING',
    "response" JSONB,
    "error" TEXT,
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IntegrationDelivery_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InboundEvent" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "type" TEXT NOT NULL,
    "externalId" TEXT,
    "payload" JSONB,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "error" TEXT,
    "leadId" UUID,
    "processedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InboundEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "WebsiteForm_token_key" ON "WebsiteForm"("token");

-- CreateIndex
CREATE INDEX "WebsiteForm_campaignId_idx" ON "WebsiteForm"("campaignId");

-- CreateIndex
CREATE INDEX "WebsiteForm_isActive_idx" ON "WebsiteForm"("isActive");

-- CreateIndex
CREATE INDEX "LeadStatusHistory_leadId_idx" ON "LeadStatusHistory"("leadId");

-- CreateIndex
CREATE INDEX "LeadStatusHistory_campaignId_idx" ON "LeadStatusHistory"("campaignId");

-- CreateIndex
CREATE INDEX "LeadStatusHistory_toStatus_idx" ON "LeadStatusHistory"("toStatus");

-- CreateIndex
CREATE INDEX "LeadStatusHistory_createdAt_idx" ON "LeadStatusHistory"("createdAt");

-- CreateIndex
CREATE INDEX "ConversionEvent_type_idx" ON "ConversionEvent"("type");

-- CreateIndex
CREATE INDEX "ConversionEvent_leadId_idx" ON "ConversionEvent"("leadId");

-- CreateIndex
CREATE INDEX "ConversionEvent_campaignId_idx" ON "ConversionEvent"("campaignId");

-- CreateIndex
CREATE INDEX "ConversionEvent_createdAt_idx" ON "ConversionEvent"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Integration_type_name_key" ON "Integration"("type", "name");

-- CreateIndex
CREATE INDEX "Integration_type_idx" ON "Integration"("type");

-- CreateIndex
CREATE INDEX "Integration_isActive_idx" ON "Integration"("isActive");

-- CreateIndex
CREATE INDEX "IntegrationDelivery_eventId_idx" ON "IntegrationDelivery"("eventId");

-- CreateIndex
CREATE INDEX "IntegrationDelivery_integrationId_idx" ON "IntegrationDelivery"("integrationId");

-- CreateIndex
CREATE INDEX "IntegrationDelivery_status_idx" ON "IntegrationDelivery"("status");

-- CreateIndex
CREATE INDEX "IntegrationDelivery_createdAt_idx" ON "IntegrationDelivery"("createdAt");

-- CreateIndex
CREATE INDEX "InboundEvent_type_idx" ON "InboundEvent"("type");

-- CreateIndex
CREATE INDEX "InboundEvent_status_idx" ON "InboundEvent"("status");

-- CreateIndex
CREATE INDEX "InboundEvent_createdAt_idx" ON "InboundEvent"("createdAt");

-- CreateIndex
CREATE INDEX "Lead_formId_idx" ON "Lead"("formId");

-- CreateIndex
CREATE INDEX "Lead_externalId_idx" ON "Lead"("externalId");

-- CreateIndex
CREATE INDEX "Lead_createdAt_idx" ON "Lead"("createdAt");

-- CreateIndex
CREATE INDEX "Campaign_channel_idx" ON "Campaign"("channel");

-- CreateIndex
CREATE INDEX "Campaign_platform_idx" ON "Campaign"("platform");

-- CreateIndex
CREATE INDEX "Campaign_isActive_idx" ON "Campaign"("isActive");

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_formId_fkey" FOREIGN KEY ("formId") REFERENCES "WebsiteForm"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WebsiteForm" ADD CONSTRAINT "WebsiteForm_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeadStatusHistory" ADD CONSTRAINT "LeadStatusHistory_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeadStatusHistory" ADD CONSTRAINT "LeadStatusHistory_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeadStatusHistory" ADD CONSTRAINT "LeadStatusHistory_changedById_fkey" FOREIGN KEY ("changedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConversionEvent" ADD CONSTRAINT "ConversionEvent_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConversionEvent" ADD CONSTRAINT "ConversionEvent_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntegrationDelivery" ADD CONSTRAINT "IntegrationDelivery_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "ConversionEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntegrationDelivery" ADD CONSTRAINT "IntegrationDelivery_integrationId_fkey" FOREIGN KEY ("integrationId") REFERENCES "Integration"("id") ON DELETE CASCADE ON UPDATE CASCADE;
