import type { IncidentCategory, IncidentStatus, ListingCategory } from '@/lib/types';

/**
 * Mapping catégories → tokens sémantiques du design system.
 * TOOL → loan (bleu) · SERVICE → service (indigo) · DONATION → gift (émeraude)
 * NOTICE → notice (ambre) · OTHER → slate · incidents → incident (corail).
 */
export type CategoryKey = 'loan' | 'service' | 'gift' | 'notice' | 'other' | 'incident';

export interface CategoryVisual {
  key: CategoryKey;
  /** Couleur primaire (texte, bordure forte). */
  color: string;
  /** Classes Tailwind texte (ex. 'text-category-loan'). */
  text: string;
  /** Classes Tailwind fond doux (pill). */
  soft: string;
  /** Classes Tailwind bordure. */
  border: string;
  /** Classe Tailwind fond solide (dot, icône). */
  solid: string;
}

const LISTING_TO_KEY: Record<ListingCategory, CategoryKey> = {
  TOOL: 'loan',
  SERVICE: 'service',
  DONATION: 'gift',
  NOTICE: 'notice',
  OTHER: 'other',
};

/** Les signalements (incidents) partagent le token « incident » corail. */
const INCIDENT_KEY: CategoryKey = 'incident';

export const CATEGORY_VISUALS: Record<CategoryKey, CategoryVisual> = {
  loan: {
    key: 'loan',
    color: '#0052FF',
    text: 'text-category-loan',
    soft: 'bg-category-loan-soft',
    border: 'border-category-loan-border',
    solid: 'bg-category-loan',
  },
  service: {
    key: 'service',
    color: '#6366F1',
    text: 'text-category-service',
    soft: 'bg-category-service-soft',
    border: 'border-category-service-border',
    solid: 'bg-category-service',
  },
  gift: {
    key: 'gift',
    color: '#10B981',
    text: 'text-category-gift',
    soft: 'bg-category-gift-soft',
    border: 'border-category-gift-border',
    solid: 'bg-category-gift',
  },
  notice: {
    key: 'notice',
    color: '#F59E0B',
    text: 'text-category-notice',
    soft: 'bg-category-notice-soft',
    border: 'border-category-notice-border',
    solid: 'bg-category-notice',
  },
  other: {
    key: 'other',
    color: '#64748B',
    text: 'text-slate-600',
    soft: 'bg-slate-100',
    border: 'border-slate-200',
    solid: 'bg-slate-500',
  },
  incident: {
    key: 'incident',
    color: '#EF4444',
    text: 'text-category-incident',
    soft: 'bg-category-incident-soft',
    border: 'border-category-incident-border',
    solid: 'bg-category-incident',
  },
};

export function listingCategoryVisual(category: ListingCategory): CategoryVisual {
  return CATEGORY_VISUALS[LISTING_TO_KEY[category] ?? 'other'];
}

export function incidentCategoryVisual(_category: IncidentCategory): CategoryVisual {
  return CATEGORY_VISUALS[INCIDENT_KEY];
}

/** Statut d'incident → token (nouveau=ambre, en cours=bleu, résolu=émeraude). */
export function incidentStatusVisual(status: IncidentStatus): CategoryVisual {
  switch (status) {
    case 'OPEN':
      return CATEGORY_VISUALS.notice;
    case 'IN_PROGRESS':
      return CATEGORY_VISUALS.loan;
    case 'RESOLVED':
      return CATEGORY_VISUALS.gift;
  }
}
