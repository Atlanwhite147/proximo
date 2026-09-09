-- ============================================================
-- Visibilité dans l'annuaire des voisins (RGPD)
-- Colonne showInDirectory : l'habitant choisit d'apparaître
-- ou non dans l'annuaire (défaut : visible, réglable à tout moment).
-- ============================================================

ALTER TABLE "User" ADD COLUMN "showInDirectory" BOOLEAN NOT NULL DEFAULT true;
