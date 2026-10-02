/** Formatage des distances et dates (locale française). */

export function formatDistance(km: number): string {
  if (km < 1) {
    return `${Math.max(1, Math.round(km * 1000))} m`;
  }
  return `${km.toLocaleString('fr-FR', { maximumFractionDigits: 1 })} km`;
}

export function formatRelativeDate(iso: string): string {
  const date = new Date(iso);
  const diffMs = Date.now() - date.getTime();
  const minutes = Math.floor(diffMs / 60_000);

  if (minutes < 1) return "à l'instant";
  if (minutes < 60) return `il y a ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `il y a ${hours} h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `il y a ${days} j`;
  return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('fr-FR', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Libellé de localisation affiché sur les cartes : résidence (ou quartier),
 * complété par bâtiment/étage UNIQUEMENT si l'utilisateur a coché
 * « afficher mes détails » (showDetails). Évite les « — ».
 */
export function formatLocation(
  residenceName: string | null | undefined,
  neighborhood: string | null | undefined,
  building?: string | null,
  floor?: string | null,
  showDetails?: boolean,
): string {
  const base = residenceName ?? neighborhood ?? 'Résidence';
  const details =
    showDetails && (building || floor)
      ? [building && `bât. ${building}`, floor && `étage ${floor}`].filter(Boolean).join(' · ')
      : null;
  return details ? `${base} (${details})` : base;
}
