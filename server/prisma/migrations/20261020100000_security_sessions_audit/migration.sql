CREATE TABLE "AuthSession" (
 "id" TEXT PRIMARY KEY, "userId" TEXT NOT NULL,
 "tokenHash" TEXT NOT NULL, "expiresAt" TIMESTAMP(3) NOT NULL,
 "revokedAt" TIMESTAMP(3), "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "lastUsedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "AuthSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "AuthSession_tokenHash_key" ON "AuthSession"("tokenHash");
CREATE INDEX "AuthSession_userId_expiresAt_idx" ON "AuthSession"("userId","expiresAt");
CREATE TABLE "LoginThrottle" ("key" TEXT PRIMARY KEY, "attempts" INTEGER NOT NULL, "windowStart" TIMESTAMP(3) NOT NULL);
CREATE INDEX "LoginThrottle_windowStart_idx" ON "LoginThrottle"("windowStart");
CREATE TABLE "AuditEvent" (
 "id" TEXT PRIMARY KEY, "actorId" TEXT NOT NULL, "action" TEXT NOT NULL, "route" TEXT NOT NULL,
 "targetId" TEXT, "statusCode" INTEGER NOT NULL, "requestId" TEXT NOT NULL,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "AuditEvent_createdAt_idx" ON "AuditEvent"("createdAt");
CREATE INDEX "AuditEvent_actorId_createdAt_idx" ON "AuditEvent"("actorId","createdAt");
CREATE INDEX "Appointment_specialistId_startTime_endTime_idx" ON "Appointment"("specialistId","startTime","endTime");
CREATE INDEX "Appointment_clientId_startTime_endTime_idx" ON "Appointment"("clientId","startTime","endTime");
CREATE INDEX "Appointment_paymentStatus_paidAt_idx" ON "Appointment"("paymentStatus","paidAt");

-- Credential, identity, role and archive changes immediately revoke old sessions,
-- including changes performed by legacy routes and operational tools.
CREATE FUNCTION public.dorsum_revoke_sessions() RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
BEGIN
 IF NEW.password IS DISTINCT FROM OLD.password OR NEW.phone IS DISTINCT FROM OLD.phone
 OR NEW.role IS DISTINCT FROM OLD.role OR NEW.active IS DISTINCT FROM OLD.active THEN
   UPDATE public."AuthSession" SET "revokedAt" = CURRENT_TIMESTAMP WHERE "userId" = NEW.id AND "revokedAt" IS NULL;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER dorsum_revoke_sessions AFTER UPDATE ON "User"
FOR EACH ROW EXECUTE FUNCTION public.dorsum_revoke_sessions();
