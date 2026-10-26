CREATE TABLE "ClientCardImage" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "byteSize" INTEGER NOT NULL,
    "data" BYTEA NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClientCardImage_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ClientCardImage_clientId_key" ON "ClientCardImage"("clientId");

ALTER TABLE "ClientCardImage"
ADD CONSTRAINT "ClientCardImage_clientId_fkey"
FOREIGN KEY ("clientId") REFERENCES "ClientProfile"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
