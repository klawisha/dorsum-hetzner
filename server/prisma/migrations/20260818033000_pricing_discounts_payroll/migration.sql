-- ============================================================
-- DORSUM
-- Pricing / discounts / payroll / courses / specialist blocks
-- This migration also reconciles historical schema drift so a
-- clean database can be built only from migrations.
-- ============================================================


-- ------------------------------------------------------------
-- Appointment status
-- ------------------------------------------------------------

ALTER TYPE "AppointmentStatus"
ADD VALUE IF NOT EXISTS 'NOT_COMPLETED';


-- ------------------------------------------------------------
-- Client flags
-- ------------------------------------------------------------

ALTER TABLE "ClientProfile"
ADD COLUMN IF NOT EXISTS "isMilitary" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "ClientProfile"
ADD COLUMN IF NOT EXISTS "isPensioner" BOOLEAN NOT NULL DEFAULT false;


-- ------------------------------------------------------------
-- Service
-- ------------------------------------------------------------

ALTER TABLE "Service"
ADD COLUMN IF NOT EXISTS "category" TEXT NOT NULL DEFAULT 'OTHER';

ALTER TABLE "Service"
ADD COLUMN IF NOT EXISTS "isPackage" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "Service"
ADD COLUMN IF NOT EXISTS "packageSessions" INTEGER;

ALTER TABLE "Service"
ADD COLUMN IF NOT EXISTS "specialistPayPerSession"
DOUBLE PRECISION NOT NULL DEFAULT 0;

ALTER TABLE "Service"
ADD COLUMN IF NOT EXISTS "active"
BOOLEAN NOT NULL DEFAULT true;


-- ------------------------------------------------------------
-- Appointment financial fields
-- ------------------------------------------------------------

ALTER TABLE "Appointment"
ADD COLUMN IF NOT EXISTS "basePrice" DOUBLE PRECISION;

ALTER TABLE "Appointment"
ADD COLUMN IF NOT EXISTS "discountPercent"
DOUBLE PRECISION NOT NULL DEFAULT 0;

ALTER TABLE "Appointment"
ADD COLUMN IF NOT EXISTS "discountReason" TEXT;

ALTER TABLE "Appointment"
ADD COLUMN IF NOT EXISTS "paidAt" TIMESTAMP(3);

ALTER TABLE "Appointment"
ADD COLUMN IF NOT EXISTS "specialistPay"
DOUBLE PRECISION NOT NULL DEFAULT 0;


-- ------------------------------------------------------------
-- Historical payment schema reconciliation
--
-- An older migration changed:
-- paymentStatus -> isPaid
--
-- Current application uses PaymentStatus again.
-- ------------------------------------------------------------

ALTER TABLE "Appointment"
ADD COLUMN IF NOT EXISTS "paymentStatus"
"PaymentStatus" NOT NULL DEFAULT 'PENDING';

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'Appointment'
          AND column_name = 'isPaid'
    ) THEN

        UPDATE "Appointment"
        SET "paymentStatus" =
            CASE
                WHEN "isPaid" = true
                    THEN 'PAID'::"PaymentStatus"
                ELSE 'PENDING'::"PaymentStatus"
            END;

        ALTER TABLE "Appointment"
        DROP COLUMN "isPaid";
    END IF;
END $$;


-- ------------------------------------------------------------
-- Course
--
-- Historical project databases had Course even though the old
-- migration chain did not create it. Create it here so a clean
-- install is reproducible.
-- ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS "Course" (
    "id" TEXT NOT NULL,

    "clientId" TEXT NOT NULL,

    "title" TEXT NOT NULL,

    "totalLessons" INTEGER NOT NULL,
    "usedLessons" INTEGER NOT NULL DEFAULT 0,

    "price" DOUBLE PRECISION NOT NULL,
    "basePrice" DOUBLE PRECISION,

    "discountPercent" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "discountReason" TEXT,

    "paidAt" TIMESTAMP(3),

    "serviceId" TEXT,

    "isPaid" BOOLEAN NOT NULL DEFAULT true,

    "startsAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),

    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Course_pkey" PRIMARY KEY ("id")
);

-- ------------------------------------------------------------
-- Reconcile an already existing legacy Course table
-- ------------------------------------------------------------

ALTER TABLE "Course"
ADD COLUMN IF NOT EXISTS "basePrice" DOUBLE PRECISION;

ALTER TABLE "Course"
ADD COLUMN IF NOT EXISTS "discountPercent"
DOUBLE PRECISION NOT NULL DEFAULT 0;

ALTER TABLE "Course"
ADD COLUMN IF NOT EXISTS "discountReason" TEXT;

ALTER TABLE "Course"
ADD COLUMN IF NOT EXISTS "paidAt" TIMESTAMP(3);

ALTER TABLE "Course"
ADD COLUMN IF NOT EXISTS "serviceId" TEXT;

ALTER TABLE "Course"
ADD COLUMN IF NOT EXISTS "isPaid"
BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE "Course"
ADD COLUMN IF NOT EXISTS "startsAt" TIMESTAMP(3);

ALTER TABLE "Course"
ADD COLUMN IF NOT EXISTS "expiresAt" TIMESTAMP(3);

ALTER TABLE "Course"
ADD COLUMN IF NOT EXISTS "createdAt"
TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;


-- Course -> Client
DO $$
BEGIN
    ALTER TABLE "Course"
    ADD CONSTRAINT "Course_clientId_fkey"
    FOREIGN KEY ("clientId")
    REFERENCES "ClientProfile"("id")
    ON DELETE RESTRICT
    ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;


-- Course -> Service
DO $$
BEGIN
    ALTER TABLE "Course"
    ADD CONSTRAINT "Course_serviceId_fkey"
    FOREIGN KEY ("serviceId")
    REFERENCES "Service"("id")
    ON DELETE SET NULL
    ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;


-- ------------------------------------------------------------
-- Appointment -> Course
-- ------------------------------------------------------------

ALTER TABLE "Appointment"
ADD COLUMN IF NOT EXISTS "courseId" TEXT;

DO $$
BEGIN
    ALTER TABLE "Appointment"
    ADD CONSTRAINT "Appointment_courseId_fkey"
    FOREIGN KEY ("courseId")
    REFERENCES "Course"("id")
    ON DELETE SET NULL
    ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;


-- ------------------------------------------------------------
-- Specialist unavailable blocks
-- ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS "SpecialistBlock" (
    "id" TEXT NOT NULL,

    "specialistId" TEXT NOT NULL,

    "startTime" TIMESTAMP(3) NOT NULL,
    "endTime" TIMESTAMP(3) NOT NULL,

    "reason" TEXT,

    "createdAt" TIMESTAMP(3)
        NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SpecialistBlock_pkey"
        PRIMARY KEY ("id")
);


DO $$
BEGIN
    ALTER TABLE "SpecialistBlock"
    ADD CONSTRAINT "SpecialistBlock_specialistId_fkey"
    FOREIGN KEY ("specialistId")
    REFERENCES "SpecialistProfile"("id")
    ON DELETE CASCADE
    ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;


CREATE INDEX IF NOT EXISTS
"SpecialistBlock_specialistId_startTime_endTime_idx"
ON "SpecialistBlock"
("specialistId", "startTime", "endTime");


-- ------------------------------------------------------------
-- Historical values
-- ------------------------------------------------------------

UPDATE "Appointment"
SET "basePrice" = "price"
WHERE "basePrice" IS NULL;


UPDATE "Appointment"
SET "paidAt" = "createdAt"
WHERE "paymentStatus" = 'PAID'
  AND "paidAt" IS NULL;


UPDATE "Course"
SET "basePrice" = "price"
WHERE "basePrice" IS NULL;


UPDATE "Course"
SET "paidAt" = "createdAt"
WHERE "isPaid" = true
  AND "paidAt" IS NULL;
