
ALTER TABLE "User"
  ADD COLUMN IF NOT EXISTS "active" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "deactivatedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "deactivatedReason" TEXT;

CREATE INDEX IF NOT EXISTS "User_active_role_idx"
  ON "User"("active", "role");
