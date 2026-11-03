-- CreateEnum
CREATE TYPE "CashHandoverStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateTable
CREATE TABLE "PaymentMethod" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PaymentMethod_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Collection" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "invoiceId" UUID,
    "patientId" UUID,
    "amount" DECIMAL(65,30) NOT NULL,
    "methodId" UUID NOT NULL,
    "collectedById" UUID NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Collection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CashRegister" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "userId" UUID NOT NULL,
    "balance" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CashRegister_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CashHandover" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "fromUserId" UUID NOT NULL,
    "toUserId" UUID NOT NULL,
    "amount" DECIMAL(65,30) NOT NULL,
    "status" "CashHandoverStatus" NOT NULL DEFAULT 'PENDING',
    "note" TEXT,
    "approvedById" UUID,
    "approvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CashHandover_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PaymentMethod_name_key" ON "PaymentMethod"("name");

-- CreateIndex
CREATE INDEX "Collection_invoiceId_idx" ON "Collection"("invoiceId");

-- CreateIndex
CREATE INDEX "Collection_patientId_idx" ON "Collection"("patientId");

-- CreateIndex
CREATE INDEX "Collection_methodId_idx" ON "Collection"("methodId");

-- CreateIndex
CREATE INDEX "Collection_collectedById_idx" ON "Collection"("collectedById");

-- CreateIndex
CREATE INDEX "Collection_createdAt_idx" ON "Collection"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "CashRegister_userId_key" ON "CashRegister"("userId");

-- CreateIndex
CREATE INDEX "CashHandover_fromUserId_idx" ON "CashHandover"("fromUserId");

-- CreateIndex
CREATE INDEX "CashHandover_toUserId_idx" ON "CashHandover"("toUserId");

-- CreateIndex
CREATE INDEX "CashHandover_status_idx" ON "CashHandover"("status");

-- CreateIndex
CREATE INDEX "CashHandover_createdAt_idx" ON "CashHandover"("createdAt");

-- AddForeignKey
ALTER TABLE "Collection" ADD CONSTRAINT "Collection_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Collection" ADD CONSTRAINT "Collection_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Collection" ADD CONSTRAINT "Collection_methodId_fkey" FOREIGN KEY ("methodId") REFERENCES "PaymentMethod"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Collection" ADD CONSTRAINT "Collection_collectedById_fkey" FOREIGN KEY ("collectedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CashRegister" ADD CONSTRAINT "CashRegister_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CashHandover" ADD CONSTRAINT "CashHandover_fromUserId_fkey" FOREIGN KEY ("fromUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CashHandover" ADD CONSTRAINT "CashHandover_toUserId_fkey" FOREIGN KEY ("toUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CashHandover" ADD CONSTRAINT "CashHandover_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
