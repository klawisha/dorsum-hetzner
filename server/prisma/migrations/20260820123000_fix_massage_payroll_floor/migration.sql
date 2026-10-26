
-- Dorsum v0.7.2 follow-up. Safe if the previous migration already created it.
ALTER TABLE "Service"
  ADD COLUMN IF NOT EXISTS "massageUseHigherOfTierAndFixed" BOOLEAN NOT NULL DEFAULT false;

UPDATE "MassagePayrollTier"
SET "pay90" = 350
WHERE "policyId" = 'massage-policy-2026-08'
  AND "minHalfHours" = 0
  AND "maxHalfHours" = 99;

UPDATE "Service"
SET
  "massageHalfHourTracking" = true,
  "massageTieredPay" = true,
  "massagePayClassMinutes" = 60,
  "massageUseHigherOfTierAndFixed" = true
WHERE lower("title") = lower('Массаж спины (60 минут)');
