ALTER TABLE "Course" ADD COLUMN "voidedAt" TIMESTAMP(3), ADD COLUMN "voidReason" TEXT;
CREATE INDEX "Course_voidedAt_idx" ON "Course"("voidedAt");
