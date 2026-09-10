-- ============================================================
-- Dernière connexion (annuaire « voisins connectés récemment »)
-- Colonne lastSeenAt : mise à jour aux connexions / rafraîchissements
-- de session, sert à afficher 3 voisins vus dans les dernières 24 h.
-- ============================================================

ALTER TABLE "User" ADD COLUMN "lastSeenAt" TIMESTAMP(3);
