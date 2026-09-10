-- ============================================================
-- Exports de résidence envoyés par email
-- Le fichier chiffré n'est jamais renvoyé directement au navigateur :
-- il reste sur le serveur, un email contenant un lien à usage unique
-- (valable 24 h) est envoyé au superadmin qui l'a demandé.
-- Le jeton n'est stocké que haché (SHA-256), comme les autres jetons.
-- ============================================================

CREATE TABLE "ResidenceExport" (
    "id"             TEXT NOT NULL,
    "tokenHash"      TEXT NOT NULL,
    "residenceId"    TEXT,
    "residenceName"  TEXT NOT NULL,
    "filename"       TEXT NOT NULL,
    "sizeBytes"      INTEGER NOT NULL,
    "createdById"    TEXT NOT NULL,
    "createdByEmail" TEXT NOT NULL,
    "expiresAt"      TIMESTAMP(3) NOT NULL,
    "downloadedAt"   TIMESTAMP(3),
    "deletedAt"      TIMESTAMP(3),
    "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ResidenceExport_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ResidenceExport_tokenHash_key" ON "ResidenceExport"("tokenHash");
CREATE INDEX "ResidenceExport_expiresAt_idx" ON "ResidenceExport"("expiresAt");
