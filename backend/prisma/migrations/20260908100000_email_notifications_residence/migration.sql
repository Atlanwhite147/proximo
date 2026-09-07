-- ============================================================
-- Notifications email par résidence + file d'attente (quota Brevo)
-- 1. Residence : interrupteurs de notification (agence + habitants)
-- 2. EmailSettings : retrait des toggles globaux (remplacés par résidence)
-- 3. Table EmailOutbox (file d'attente quand le quota Brevo est atteint)
-- ============================================================

-- 1. Interrupteurs de notification par résidence (défaut : activés)
ALTER TABLE "Residence" ADD COLUMN "notifyAgencyOnIncident" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Residence" ADD COLUMN "notifyResidentsOnIncident" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Residence" ADD COLUMN "notifyResidentsOnListing" BOOLEAN NOT NULL DEFAULT true;

-- 2. Les toggles globaux de EmailSettings sont remplacés par le réglage
-- par résidence (chaque admin local gère les mails de SA résidence).
ALTER TABLE "EmailSettings" DROP COLUMN "incidentNotificationsEnabled";
ALTER TABLE "EmailSettings" DROP COLUMN "listingNotificationsEnabled";

-- 3. File d'attente d'emails (quota Brevo gratuit dépassé : 300/jour)
CREATE TABLE "EmailOutbox" (
    "id"          TEXT NOT NULL,
    "to"          TEXT NOT NULL,
    "subject"     TEXT NOT NULL,
    "html"        TEXT NOT NULL,
    "attachments" TEXT,
    "attempts"    INTEGER NOT NULL DEFAULT 0,
    "lastError"   TEXT,
    "sentAt"      TIMESTAMP(3),
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "EmailOutbox_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "EmailOutbox_sentAt_createdAt_idx" ON "EmailOutbox"("sentAt", "createdAt");
