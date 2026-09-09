-- ============================================================
-- Invitations multi-usage (affiche QR dans les parties communes)
-- Colonne multiUse : l'invitation reste valable pour N inscrits
-- jusqu'à sa date d'expiration (usage unique = comportement actuel).
-- ============================================================

ALTER TABLE "Invitation" ADD COLUMN "multiUse" BOOLEAN NOT NULL DEFAULT false;
