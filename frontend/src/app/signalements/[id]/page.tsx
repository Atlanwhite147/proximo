'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import api from '@/lib/api';
import { useAuth } from '@/components/AuthProvider';
import { Comments } from '@/components/Comments';
import { ErrorMessage, Spinner } from '@/components/Feedback';
import { RequireAccount } from '@/components/RequireAccount';
import { formatLocation, formatRelativeDate } from '@/lib/format';
import { INCIDENT_CATEGORY_LABELS, INCIDENT_STATUS_LABELS, Incident } from '@/lib/types';

/**
 * Détail d'un signalement + discussion publique dédiée.
 * Visible par tous les habitants (statut ACTIVE).
 */
export default function IncidentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user, loading: authLoading } = useAuth();
  const [incident, setIncident] = useState<Incident | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading || !user) return; // RequireAccount gère la redirection
    api<{ incident: Incident }>(`/incidents/${id}/public`)
      .then((data) => setIncident(data.incident))
      .catch((err) => setError(err instanceof Error ? err.message : 'Signalement introuvable'))
      .finally(() => setLoading(false));
  }, [id, user, authLoading]);

  if (authLoading) return <Spinner label="Vérification du compte…" />;

  // Non connecté : RequireAccount redirige vers /connexion?next=…
  if (!user) {
    return <RequireAccount next={`/signalements/${id}`}>{null}</RequireAccount>;
  }

  if (loading) return <Spinner label="Chargement du signalement…" />;

  if (error || !incident) {
    return (
      <div className="space-y-4">
        <ErrorMessage message={error ?? 'Signalement introuvable'} />
        <Link href="/annonces?categorie=SIGNALEMENT" className="text-sm font-medium text-brand-600 hover:underline">
          ← Retour aux signalements
        </Link>
      </div>
    );
  }

  return (
    <RequireAccount next={`/signalements/${incident.id}`}>
      <article className="mx-auto max-w-2xl space-y-5">
        <Link
          href="/annonces?categorie=SIGNALEMENT"
          className="text-sm font-medium text-brand-600 hover:underline"
        >
          ← Retour aux signalements
        </Link>

        <div className="ds-card p-6">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800">
              🛠️ {INCIDENT_CATEGORY_LABELS[incident.category] ?? incident.category}
            </span>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
              {INCIDENT_STATUS_LABELS[incident.status] ?? incident.status}
            </span>
            {incident.neighborhood && (
              <span className="text-xs text-slate-400">
                {formatLocation(undefined, incident.neighborhood)}
              </span>
            )}
          </div>

          <h1 className="mt-3 text-xl font-bold text-slate-900 sm:text-2xl">{incident.title}</h1>
          <p className="mt-1 text-xs text-slate-400">
            Signalé par {incident.user?.firstName} {incident.user?.lastName} ·{' '}
            {formatRelativeDate(incident.createdAt)}
          </p>

          <p className="mt-4 whitespace-pre-line text-sm text-slate-700">{incident.description}</p>

          {incident.attachments.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2">
              {incident.attachments.map((attachment) => (
                <a
                  key={attachment.id}
                  href={`/api/incidents/${incident.id}/attachments/${attachment.id}`}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-brand-700 hover:bg-slate-100"
                >
                  📎 {attachment.filename}
                </a>
              ))}
            </div>
          )}
        </div>

        {/* Discussion publique dédiée */}
        <Comments type="incident" targetId={incident.id} />
      </article>
    </RequireAccount>
  );
}
