-- Phone-first authentication. Keep email nullable for legacy accounts.
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "phone" TEXT;
ALTER TABLE "User" ALTER COLUMN "email" DROP NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS "User_phone_key" ON "User"("phone");

-- Reuse a client profile phone for legacy users when it is unique and present.
UPDATE "User" u
SET "phone" = cp."phone"
FROM "ClientProfile" cp
WHERE cp."userId" = u."id"
  AND cp."phone" IS NOT NULL
  AND btrim(cp."phone") <> ''
  AND NOT EXISTS (
    SELECT 1 FROM "User" other
    WHERE other."phone" = cp."phone" AND other."id" <> u."id"
  );
