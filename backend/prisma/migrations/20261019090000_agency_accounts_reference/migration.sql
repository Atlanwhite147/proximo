-- Comptes agence (rôle AGENCE, email et mot de passe), périmètre multi-résidences,
-- référence de dossier lisible et journal des événements d'un signalement.
CREATE TABLE "Agency" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "contactEmail" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Agency_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AgencyResidence" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "residenceId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AgencyResidence_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "IncidentEvent" (
    "id" TEXT NOT NULL,
    "incidentId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "actorType" TEXT NOT NULL,
    "actorId" TEXT,
    "actorLabel" TEXT,
    "fromStatus" TEXT,
    "toStatus" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IncidentEvent_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "User" ADD COLUMN "agencyId" TEXT;
ALTER TABLE "Incident" ADD COLUMN "reference" TEXT;

CREATE UNIQUE INDEX "AgencyResidence_agencyId_residenceId_key" ON "AgencyResidence"("agencyId", "residenceId");
CREATE INDEX "AgencyResidence_residenceId_idx" ON "AgencyResidence"("residenceId");
CREATE INDEX "IncidentEvent_incidentId_createdAt_idx" ON "IncidentEvent"("incidentId", "createdAt");
CREATE UNIQUE INDEX "Incident_reference_key" ON "Incident"("reference");
CREATE INDEX "User_agencyId_idx" ON "User"("agencyId");

ALTER TABLE "AgencyResidence" ADD CONSTRAINT "AgencyResidence_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "Agency"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AgencyResidence" ADD CONSTRAINT "AgencyResidence_residenceId_fkey" FOREIGN KEY ("residenceId") REFERENCES "Residence"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "IncidentEvent" ADD CONSTRAINT "IncidentEvent_incidentId_fkey" FOREIGN KEY ("incidentId") REFERENCES "Incident"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "User" ADD CONSTRAINT "User_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "Agency"("id") ON DELETE SET NULL ON UPDATE CASCADE;
