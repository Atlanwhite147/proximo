-- ============================================================
-- Messages prioritaires (canal officiel de la résidence)
-- Publiés uniquement par les rôles ADMIN / SUPERADMIN, visibles et
-- commentables par tous les habitants de la résidence.
-- ============================================================

CREATE TABLE "Announcement" (
    "id"          TEXT NOT NULL,
    "title"       TEXT NOT NULL,
    "body"        TEXT NOT NULL,
    "authorId"    TEXT NOT NULL,
    "residenceId" TEXT,
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"   TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Announcement_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "Announcement"
    ADD CONSTRAINT "Announcement_authorId_fkey"
    FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Announcement"
    ADD CONSTRAINT "Announcement_residenceId_fkey"
    FOREIGN KEY ("residenceId") REFERENCES "Residence"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "Announcement_residenceId_createdAt_idx" ON "Announcement"("residenceId", "createdAt");
CREATE INDEX "Announcement_authorId_idx" ON "Announcement"("authorId");

-- Les commentaires peuvent désormais cibler un message prioritaire.
ALTER TABLE "Comment" ADD COLUMN "announcementId" TEXT;

ALTER TABLE "Comment"
    ADD CONSTRAINT "Comment_announcementId_fkey"
    FOREIGN KEY ("announcementId") REFERENCES "Announcement"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "Comment_announcementId_createdAt_idx" ON "Comment"("announcementId", "createdAt");
