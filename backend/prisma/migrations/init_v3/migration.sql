-- This migration adds support for expense tracking and commission management
-- These features are requested for admin control and financial management

-- Expense Categories
CREATE TABLE "ExpenseCategory" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ExpenseCategory_pkey" PRIMARY KEY ("id")
);

-- Expenses
CREATE TABLE "Expense" (
    "id" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "amount" NUMERIC(10, 2) NOT NULL,
    "expenseDate" TIMESTAMP(3) NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Expense_pkey" PRIMARY KEY ("id")
);

-- Commission Rates
CREATE TABLE "CommissionRate" (
    "id" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "rate" NUMERIC(5, 2) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "CommissionRate_pkey" PRIMARY KEY ("id")
);

-- Commission Rates unique constraint
CREATE UNIQUE INDEX "CommissionRate_role_type_key" ON "CommissionRate" ("role", "type");

-- Foreign key constraints
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "ExpenseCategory" ("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Indexes
CREATE INDEX "Expense_categoryId_idx" ON "Expense" ("categoryId");
CREATE INDEX "Expense_expenseDate_idx" ON "Expense" ("expenseDate");
