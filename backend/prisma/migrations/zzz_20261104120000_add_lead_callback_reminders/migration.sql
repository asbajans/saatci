-- AlterEnum
ALTER TYPE "LeadStatus" ADD VALUE IF NOT EXISTS 'IRRELEVANT';
ALTER TYPE "LeadStatus" ADD VALUE IF NOT EXISTS 'PRICE_HIGH';
ALTER TYPE "LeadStatus" ADD VALUE IF NOT EXISTS 'CALLBACK';

-- AlterTable
ALTER TABLE "Lead" ADD COLUMN "callbackAt" TIMESTAMP(3),
ADD COLUMN "callbackNote" TEXT;

-- CreateIndex
CREATE INDEX "Lead_status_callbackAt_idx" ON "Lead"("status", "callbackAt");
