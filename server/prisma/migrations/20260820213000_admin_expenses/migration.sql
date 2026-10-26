
CREATE TABLE IF NOT EXISTS "Expense" (
  "id" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "amount" DOUBLE PRECISION NOT NULL,
  "purchasedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "note" TEXT,
  "voidedAt" TIMESTAMP(3),
  "voidReason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Expense_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "Expense_purchasedAt_idx"
  ON "Expense"("purchasedAt");

CREATE TABLE IF NOT EXISTS "ExpenseReceipt" (
  "id" TEXT NOT NULL,
  "expenseId" TEXT NOT NULL,
  "fileName" TEXT NOT NULL,
  "mimeType" TEXT NOT NULL,
  "byteSize" INTEGER NOT NULL,
  "data" BYTEA NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ExpenseReceipt_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ExpenseReceipt_expenseId_key"
  ON "ExpenseReceipt"("expenseId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ExpenseReceipt_expenseId_fkey'
  ) THEN
    ALTER TABLE "ExpenseReceipt"
      ADD CONSTRAINT "ExpenseReceipt_expenseId_fkey"
      FOREIGN KEY ("expenseId") REFERENCES "Expense"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
