-- ============================================================
-- Multi-résidences : modèle Residence + rattachement
-- 1. Table Residence (une instance héberge N résidences)
-- 2. User.residenceId, Listing.residenceId, Incident.residenceId
-- 3. Rôle SUPERADMIN (gère toutes les résidences)
-- 4. Migration de la résidence existante (SyndicSettings id=1)
-- ============================================================

-- 1. Table Residence
CREATE TABLE "Residence" (
    "id"          TEXT NOT NULL,
    "name"        TEXT NOT NULL,
    "code"        TEXT,
    "agencyName"  TEXT,
    "syndicEmail" TEXT,
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"   TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Residence_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Residence_name_key" ON "Residence"("name");
CREATE UNIQUE INDEX "Residence_code_key" ON "Residence"("code");

-- 2. Colonnes residenceId
ALTER TABLE "User" ADD COLUMN "residenceId" TEXT;
ALTER TABLE "Listing" ADD COLUMN "residenceId" TEXT;
ALTER TABLE "Incident" ADD COLUMN "residenceId" TEXT;
ALTER TABLE "Invitation" ADD COLUMN "residenceId" TEXT;

-- 3. Migration de la résidence existante (SyndicSettings singleton id=1)
INSERT INTO "Residence" ("id", "name", "code", "agencyName", "syndicEmail", "createdAt", "updatedAt")
SELECT 'r-default', COALESCE("residenceName", 'Ma résidence'), "residenceCode", "agencyName", "email", CURRENT_TIMESTAMP, "updatedAt"
FROM "SyndicSettings" WHERE "id" = 1
ON CONFLICT DO NOTHING;

-- Rattachement des utilisateurs existants (par quartier quand il correspond)
UPDATE "User" SET "residenceId" = 'r-default'
WHERE "residenceId" IS NULL
  AND ("neighborhood" = (SELECT "residenceName" FROM "SyndicSettings" WHERE "id" = 1)
       OR "neighborhood" IS NULL);

-- Rattachement des annonces / signalements via leur propriétaire
UPDATE "Listing" SET "residenceId" = 'r-default'
WHERE "residenceId" IS NULL AND "ownerId" IN (SELECT "id" FROM "User" WHERE "residenceId" = 'r-default');
UPDATE "Incident" SET "residenceId" = 'r-default'
WHERE "residenceId" IS NULL AND "userId" IN (SELECT "id" FROM "User" WHERE "residenceId" = 'r-default');
UPDATE "Invitation" SET "residenceId" = 'r-default'
WHERE "residenceId" IS NULL AND "createdById" IN (SELECT "id" FROM "User" WHERE "residenceId" = 'r-default');

-- FK + index
ALTER TABLE "User" ADD CONSTRAINT "User_residenceId_fkey" FOREIGN KEY ("residenceId") REFERENCES "Residence"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Listing" ADD CONSTRAINT "Listing_residenceId_fkey" FOREIGN KEY ("residenceId") REFERENCES "Residence"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Incident" ADD CONSTRAINT "Incident_residenceId_fkey" FOREIGN KEY ("residenceId") REFERENCES "Residence"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Invitation" ADD CONSTRAINT "Invitation_residenceId_fkey" FOREIGN KEY ("residenceId") REFERENCES "Residence"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE INDEX "User_residenceId_idx" ON "User"("residenceId");
CREATE INDEX "Listing_residenceId_idx" ON "Listing"("residenceId");
CREATE INDEX "Incident_residenceId_idx" ON "Incident"("residenceId");
CREATE INDEX "Invitation_residenceId_idx" ON "Invitation"("residenceId");
