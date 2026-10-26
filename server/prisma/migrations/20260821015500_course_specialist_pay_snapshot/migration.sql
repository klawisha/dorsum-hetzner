
ALTER TABLE "Course"
  ADD COLUMN IF NOT EXISTS "specialistPayPerSession" DOUBLE PRECISION;

UPDATE "Course" AS c
SET "specialistPayPerSession" = s."specialistPayPerSession"
FROM "Service" AS s
WHERE c."serviceId" = s."id"
  AND c."specialistPayPerSession" IS NULL;


-- Repair old appointments created when the UI allowed selecting both a course
-- and an unrelated service. For course appointments the Course is now the
-- authoritative source of service and specialist-pay snapshot.
UPDATE "Appointment" AS a
SET "serviceId" = c."serviceId"
FROM "Course" AS c
WHERE a."courseId" = c."id"
  AND c."serviceId" IS NOT NULL
  AND a."serviceId" IS DISTINCT FROM c."serviceId";

UPDATE "Appointment" AS a
SET "specialistPay" = c."specialistPayPerSession"
FROM "Course" AS c
WHERE a."courseId" = c."id"
  AND c."specialistPayPerSession" IS NOT NULL
  AND a."specialistPay" IS DISTINCT FROM c."specialistPayPerSession";
