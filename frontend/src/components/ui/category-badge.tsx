import { cn } from '@/lib/utils';
import { CATEGORY_LABELS, CATEGORY_EMOJI } from '@/lib/types';
import type { IncidentCategory, IncidentStatus, ListingCategory } from '@/lib/types';
import {
  incidentCategoryVisual,
  incidentStatusVisual,
  listingCategoryVisual,
} from '@/lib/category';

/**
 * CategoryBadge — étiquette de catégorie avec couleur sémantique.
 * - listing : TOOL/SERVICE/DONATION/NOTICE/OTHER → tokens catégorie
 * - incident : token « incident » (corail) + emoji spécifique
 * Affichage : emoji + libellé, fond doux + bordure + texte colorés.
 */
const INCIDENT_EMOJI: Record<IncidentCategory, string> = {
  WATER_LEAK: '💧',
  ELEVATOR: '🛗',
  DAMAGE: '🏚️',
  OTHER: '📋',
};

export function CategoryBadge({
  type,
  category,
  className,
}: {
  type: 'listing' | 'incident';
  category: ListingCategory | IncidentCategory;
  className?: string;
}) {
  const isIncident = type === 'incident';
  const visual = isIncident
    ? incidentCategoryVisual(category as IncidentCategory)
    : listingCategoryVisual(category as ListingCategory);
  const emoji = isIncident
    ? INCIDENT_EMOJI[category as IncidentCategory]
    : CATEGORY_EMOJI[category as ListingCategory];
  const label = isIncident
    ? 'Signalement syndic'
    : CATEGORY_LABELS[category as ListingCategory];

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 font-mono text-[11px] font-medium uppercase tracking-badge',
        visual.soft,
        visual.border,
        visual.text,
        className,
      )}
    >
      <span aria-hidden>{emoji}</span>
      {label}
    </span>
  );
}

/** Badge de statut d'incident (Nouveau / En cours / Résolu) coloré. */
export function IncidentStatusBadge({
  status,
  className,
}: {
  status: IncidentStatus;
  className?: string;
}) {
  const visual = incidentStatusVisual(status);
  const labels: Record<IncidentStatus, string> = {
    OPEN: 'Nouveau',
    IN_PROGRESS: 'En cours',
    RESOLVED: 'Résolu',
  };
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 font-mono text-[11px] font-medium uppercase tracking-badge',
        visual.soft,
        visual.border,
        visual.text,
        className,
      )}
    >
      <span aria-hidden className={cn('h-1.5 w-1.5 rounded-full', visual.solid)} />
      {labels[status]}
    </span>
  );
}
