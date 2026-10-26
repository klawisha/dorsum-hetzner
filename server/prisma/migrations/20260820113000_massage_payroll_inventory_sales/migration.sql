
-- Dorsum v0.7.2
-- Recovery-safe / idempotent migration.
-- It can be re-run after a partially applied P3018 on PostgreSQL.

-- ---------------------------------------------------------------------------
-- Service payroll metadata
-- ---------------------------------------------------------------------------

ALTER TABLE "Service"
  ADD COLUMN IF NOT EXISTS "massageHalfHourTracking" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "massageTieredPay" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "massagePayClassMinutes" INTEGER,
  ADD COLUMN IF NOT EXISTS "massageUseHigherOfTierAndFixed" BOOLEAN NOT NULL DEFAULT false;

-- ---------------------------------------------------------------------------
-- Versioned massage payroll policy
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS "MassagePayrollPolicy" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "effectiveFrom" TIMESTAMP(3) NOT NULL,
  "effectiveTo" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "MassagePayrollPolicy_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "MassagePayrollTier" (
  "id" TEXT NOT NULL,
  "policyId" TEXT NOT NULL,
  "minHalfHours" INTEGER NOT NULL,
  "maxHalfHours" INTEGER,
  "pay30" DOUBLE PRECISION NOT NULL,
  "pay60" DOUBLE PRECISION NOT NULL,
  "pay90" DOUBLE PRECISION NOT NULL,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "MassagePayrollTier_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "MassagePayrollPolicy_effectiveFrom_effectiveTo_idx"
  ON "MassagePayrollPolicy"("effectiveFrom", "effectiveTo");

CREATE INDEX IF NOT EXISTS "MassagePayrollTier_policyId_minHalfHours_idx"
  ON "MassagePayrollTier"("policyId", "minHalfHours");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'MassagePayrollTier_policyId_fkey'
  ) THEN
    ALTER TABLE "MassagePayrollTier"
      ADD CONSTRAINT "MassagePayrollTier_policyId_fkey"
      FOREIGN KEY ("policyId") REFERENCES "MassagePayrollPolicy"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- Inventory retail
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS "InventoryItem" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "price" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "InventoryItem_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "InventoryItem_name_key"
  ON "InventoryItem"("name");

CREATE TABLE IF NOT EXISTS "InventorySale" (
  "id" TEXT NOT NULL,
  "itemId" TEXT NOT NULL,
  "clientId" TEXT,
  "quantity" INTEGER NOT NULL,
  "unitPrice" DOUBLE PRECISION NOT NULL,
  "total" DOUBLE PRECISION NOT NULL,
  "soldAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "note" TEXT,
  "voidedAt" TIMESTAMP(3),
  "voidReason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "InventorySale_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "InventorySale_soldAt_idx"
  ON "InventorySale"("soldAt");

CREATE INDEX IF NOT EXISTS "InventorySale_itemId_idx"
  ON "InventorySale"("itemId");

CREATE INDEX IF NOT EXISTS "InventorySale_clientId_idx"
  ON "InventorySale"("clientId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'InventorySale_itemId_fkey'
  ) THEN
    ALTER TABLE "InventorySale"
      ADD CONSTRAINT "InventorySale_itemId_fkey"
      FOREIGN KEY ("itemId") REFERENCES "InventoryItem"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'InventorySale_clientId_fkey'
  ) THEN
    ALTER TABLE "InventorySale"
      ADD CONSTRAINT "InventorySale_clientId_fkey"
      FOREIGN KEY ("clientId") REFERENCES "ClientProfile"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- Massage service metadata
-- Every massage contributes one half-hour per 30 actual minutes.
-- ---------------------------------------------------------------------------

UPDATE "Service"
SET
  "massageHalfHourTracking" = true,
  "massageTieredPay" = true,
  "massagePayClassMinutes" = CASE
    WHEN "durationMinutes" IN (30, 60, 90) THEN "durationMinutes"
    ELSE NULL
  END
WHERE "category" IN ('MASSAGE', 'APPARATUS_MASSAGE');

-- 60-minute back massage participates in tier calculation, but its stored
-- specialistPay is a guaranteed minimum.
UPDATE "Service"
SET
  "massageHalfHourTracking" = true,
  "massageTieredPay" = true,
  "massagePayClassMinutes" = 60,
  "massageUseHigherOfTierAndFixed" = true
WHERE lower("title") = lower('Массаж спины (60 минут)');

-- ---------------------------------------------------------------------------
-- Initial massage payroll policy
-- ---------------------------------------------------------------------------

INSERT INTO "MassagePayrollPolicy"
  ("id","name","enabled","effectiveFrom","effectiveTo","createdAt","updatedAt")
VALUES
  (
    'massage-policy-2026-08',
    'Массаж: получасовая сетка 2026-08',
    true,
    '2026-08-01 00:00:00',
    NULL,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
  )
ON CONFLICT ("id") DO UPDATE SET
  "name" = EXCLUDED."name",
  "updatedAt" = CURRENT_TIMESTAMP;

INSERT INTO "MassagePayrollTier"
  ("id","policyId","minHalfHours","maxHalfHours","pay30","pay60","pay90","sortOrder")
VALUES
  ('massage-tier-0-99',    'massage-policy-2026-08', 0,   99,   150, 250, 350, 1),
  ('massage-tier-100-149', 'massage-policy-2026-08', 100, 149,  150, 270, 390, 2),
  ('massage-tier-150-plus','massage-policy-2026-08', 150, NULL, 150, 290, 430, 3)
ON CONFLICT ("id") DO UPDATE SET
  "policyId" = EXCLUDED."policyId",
  "minHalfHours" = EXCLUDED."minHalfHours",
  "maxHalfHours" = EXCLUDED."maxHalfHours",
  "pay30" = EXCLUDED."pay30",
  "pay60" = EXCLUDED."pay60",
  "pay90" = EXCLUDED."pay90",
  "sortOrder" = EXCLUDED."sortOrder";

-- ---------------------------------------------------------------------------
-- Initial inventory catalogue.
-- Prices stay 0 until admin sets the real retail prices.
-- ---------------------------------------------------------------------------

INSERT INTO "InventoryItem"
  ("id","name","price","active","sortOrder","createdAt","updatedAt")
VALUES
  ('inventory-sphere', 'Сфера', 0, true, 10, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('inventory-roller-small', 'Валик маленький', 0, true, 20, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('inventory-roller-medium', 'Валик средний', 0, true, 30, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('inventory-roller-green-dorsum', 'Валик зелёный с наклейкой Dorsum', 0, true, 40, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('inventory-tape', 'Тейп', 0, true, 50, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('inventory-tape-color', 'Цветной тейп', 0, true, 60, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("name") DO NOTHING;
