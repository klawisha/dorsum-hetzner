
ALTER TABLE "ClientProfile"
  ALTER COLUMN "userId" DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS "active" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "managedOnly" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS "ClientProfile_phone_active_idx"
  ON "ClientProfile"("phone", "active");
