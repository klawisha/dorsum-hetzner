
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'CoursePaymentState') THEN
    CREATE TYPE "CoursePaymentState" AS ENUM ('UNPAID', 'HALF_PAID', 'PAID');
  END IF;
END $$;

ALTER TABLE "Course"
  ADD COLUMN IF NOT EXISTS "paymentState" "CoursePaymentState" NOT NULL DEFAULT 'PAID',
  ADD COLUMN IF NOT EXISTS "paidAmount" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- Existing production courses retain their historical semantics.
UPDATE "Course"
SET
  "paymentState" = CASE WHEN "isPaid" THEN 'PAID'::"CoursePaymentState" ELSE 'UNPAID'::"CoursePaymentState" END,
  "paidAmount" = CASE WHEN "isPaid" THEN "price" ELSE 0 END;

CREATE TABLE IF NOT EXISTS "CoursePayment" (
  "id" TEXT NOT NULL,
  "courseId" TEXT NOT NULL,
  "amount" DOUBLE PRECISION NOT NULL,
  "kind" TEXT NOT NULL,
  "paidAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CoursePayment_pkey" PRIMARY KEY ("id")
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'CoursePayment_courseId_fkey'
  ) THEN
    ALTER TABLE "CoursePayment"
      ADD CONSTRAINT "CoursePayment_courseId_fkey"
      FOREIGN KEY ("courseId") REFERENCES "Course"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "CoursePayment_paidAt_idx"
  ON "CoursePayment"("paidAt");

CREATE INDEX IF NOT EXISTS "CoursePayment_courseId_paidAt_idx"
  ON "CoursePayment"("courseId", "paidAt");

-- Backfill exactly one historical ledger entry for previously paid courses.
-- legacy/imported courses have paidAt NULL, so they intentionally create no cash event.
INSERT INTO "CoursePayment" ("id", "courseId", "amount", "kind", "paidAt", "createdAt")
SELECT
  'legacy_' || c."id",
  c."id",
  c."price",
  'FULL',
  c."paidAt",
  c."paidAt"
FROM "Course" c
WHERE c."isPaid" = true
  AND c."paidAt" IS NOT NULL
  AND c."price" > 0
  AND NOT EXISTS (
    SELECT 1 FROM "CoursePayment" cp WHERE cp."courseId" = c."id"
  );
