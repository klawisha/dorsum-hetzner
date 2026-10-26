ALTER TABLE "Service"
 ADD COLUMN "audience" TEXT NOT NULL DEFAULT 'ALL',
 ADD COLUMN "specialistPayMode" TEXT NOT NULL DEFAULT 'FIXED',
 ADD COLUMN "specialistPayPercent" DOUBLE PRECISION NOT NULL DEFAULT 0,
 ADD COLUMN "groupPayMode" TEXT NOT NULL DEFAULT 'PER_CLIENT';
UPDATE "Service" SET "specialistPayMode"='MASSAGE_TIER' WHERE "massageTieredPay"=true;
ALTER TABLE "Course" ADD COLUMN "payConfig" JSONB;
ALTER TABLE "Appointment" ADD COLUMN "payConfig" JSONB;
-- Capture current rules once. Subsequent catalogue edits never rewrite these rows.
UPDATE "Course" c SET "payConfig"=jsonb_build_object(
 'version',1,'mode',s."specialistPayMode",'percent',s."specialistPayPercent",
 'groupPayMode',s."groupPayMode",'isGroup',s."groupAllowed",
 'massageHalfHourTracking',s."massageHalfHourTracking",
 'massagePayClassMinutes',COALESCE(s."massagePayClassMinutes",s."durationMinutes"),
 'massageUseHigherOfTierAndFixed',s."massageUseHigherOfTierAndFixed"
) FROM "Service" s WHERE c."serviceId"=s.id;
UPDATE "Appointment" a SET "payConfig"=jsonb_build_object(
 'version',1,'mode',s."specialistPayMode",'percent',s."specialistPayPercent",
 'groupPayMode',s."groupPayMode",'isGroup',s."groupAllowed",
 'massageHalfHourTracking',s."massageHalfHourTracking",
 'massagePayClassMinutes',COALESCE(s."massagePayClassMinutes",s."durationMinutes"),
 'massageUseHigherOfTierAndFixed',s."massageUseHigherOfTierAndFixed"
) FROM "Service" s WHERE a."serviceId"=s.id;
-- Existing course numeric payouts remain exactly as recorded.
UPDATE "Appointment" a SET "payConfig"=c."payConfig" FROM "Course" c
 WHERE a."courseId"=c.id AND c."payConfig" IS NOT NULL;
