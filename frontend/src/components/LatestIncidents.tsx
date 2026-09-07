'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import api from '@/lib/api';
import { cn } from '@/lib/utils';
import { INCIDENT_CATEGORY_LABELS, type Incident } from '@/lib/types';
import { Spinner } from './Feedback';
import { formatLocation } from '@/lib/format';
import { incidentCategoryVisual, incidentStatusVisual } from '@/lib/category';
import { IncidentStatusBadge } from './ui/category-badge';

/**
 * Derniers signalements publiés (page d'accueil) — design system.
 * Cartes avec liseré corail (token incident), statut coloré mono.
 */
export function LatestIncidents() {
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api<{ incidents: Incident[] }>('/incidents')
      .then((data) => setIncidents(data.incidents.slice(0, 3)))
      .catch(() => setError('Impossible de charger les signalements.'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <Spinner label="Chargement des signalements…" />;
  if (error) return <p className="text-sm text-red-600">{error}</p>;

  if (incidents.length === 0) {
    return (
      <p className="rounded-2xl border border-dashed border-border bg-card/60 p-6 text-center text-sm text-muted-foreground">
        Aucun signalement en cours.
      </p>
    );
  }

  return (
    <ul className="grid gap-3 sm:grid-cols-3">
      {incidents.map((incident) => {
        const visual = incidentCategoryVisual(incident.category);
        const statusVisual = incidentStatusVisual(incident.status);
        return (
          <li
            key={incident.id}
            className="group relative flex flex-col overflow-hidden rounded-2xl border border-border bg-card p-4 pl-5 shadow-card transition-all duration-200 hover:-translate-y-0.5 hover:shadow-card-hover"
          >
            <span
              aria-hidden
              className="absolute inset-y-0 left-0 w-1"
              style={{ backgroundColor: visual.color }}
            />
            <Link href={`/signalements/${incident.id}`} className="flex flex-1 flex-col">
              <div className="flex items-start justify-between gap-2">
                <span className="font-mono text-[11px] uppercase tracking-badge text-muted-foreground">
                  {INCIDENT_CATEGORY_LABELS[incident.category]}
                </span>
                <IncidentStatusBadge status={incident.status} />
              </div>
              <p className="mt-1.5 line-clamp-2 font-sans font-semibold text-foreground transition-colors group-hover:text-primary">
                {incident.title}
              </p>
              <p className="mt-auto pt-2 text-xs text-muted-foreground">
                📍{' '}
                {formatLocation(
                  undefined,
                  incident.neighborhood,
                  incident.user?.building,
                  incident.user?.floor,
                  incident.user?.showDetails,
                )}
              </p>
            </Link>
            {incident._count && incident._count.comments > 0 && (
              <div className="mt-2 border-t border-border/70 pt-2">
                <span
                  className={cn(
                    'inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-mono text-[11px] font-semibold',
                    statusVisual.soft,
                    statusVisual.text,
                  )}
                >
                  💬 {incident._count.comments} commentaire
                  {incident._count.comments > 1 ? 's' : ''}
                </span>
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
