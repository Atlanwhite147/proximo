'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { ErrorMessage, SuccessMessage } from '@/components/Feedback';
import { Spinner } from '@/components/Feedback';
import api from '@/lib/api';
import {
  CATEGORY_LABELS,
  INCIDENT_CATEGORY_LABELS,
  type IncidentCategory,
  type ListingCategory,
} from '@/lib/types';
import { RequireAccount } from '@/components/RequireAccount';

/**
 * Publication unifiée de la résidence :
 * - une annonce (prêt, service, don, avis aux résidents) → POST /listings
 * - un signalement (catégorie « Signalement ») → POST /incidents (pièces
 *   jointes, localisation libre, alerte automatique de l'agence).
 */
type PublishCategory = ListingCategory | 'SIGNALEMENT';

const SIGNALEMENT = 'SIGNALEMENT';

function NewListingForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, loading: authLoading } = useAuth();

  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<PublishCategory>('TOOL');
  const [incidentCategory, setIncidentCategory] = useState<IncidentCategory>('OTHER');
  const [description, setDescription] = useState('');
  const [neighborhood, setNeighborhood] = useState('');
  const [location, setLocation] = useState('');
  const [showDetails, setShowDetails] = useState(true);
  const [notifyResidence, setNotifyResidence] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const isIncident = category === SIGNALEMENT;

  // Pré-sélection via l'URL (ex. ?categorie=SIGNALEMENT depuis l'accueil).
  useEffect(() => {
    const preset = searchParams.get('categorie');
    if (preset === SIGNALEMENT) setCategory(SIGNALEMENT);
  }, [searchParams]);

  // Redirection si non connecté.
  useEffect(() => {
    if (!authLoading && !user) {
      router.replace('/connexion?next=/annonces/nouvelle');
    }
  }, [authLoading, user, router]);

  if (authLoading || !user) return <Spinner label="Vérification de la session…" />;

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setSuccess(null);
    setSubmitting(true);

    try {
      if (isIncident) {
        if (!location.trim()) {
          setError('Précisez la localisation (ex. 3e étage, hall A, parking…).');
          setSubmitting(false);
          return;
        }
        const form = new FormData();
        form.set('title', title.trim());
        form.set('category', incidentCategory);
        form.set('description', description.trim());
        form.set('neighborhood', location.trim());
        form.set('showDetails', String(showDetails));
        for (const file of files) form.append('files', file);
        const result = await api<{ incident: { id: string } }>('/incidents', {
          method: 'POST',
          body: form,
        });
        setSuccess('Signalement envoyé à l’agence !');
        setTimeout(() => router.push(`/annonces?categorie=${SIGNALEMENT}`), 700);
        return;
      }

      const payload: Record<string, unknown> = {
        title: title.trim(),
        category,
        description: description.trim(),
        showDetails,
        notifyResidence,
      };
      if (neighborhood.trim()) {
        // Résidence : pas de géolocalisation nécessaire à l'échelle d'un immeuble.
        payload.neighborhood = neighborhood.trim();
      }

      const result = await api<{ listing: { id: string } }>('/listings', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      setSuccess('Annonce publiée !');
      setTimeout(() => router.push(`/annonces/${result.listing.id}`), 700);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Publication impossible';
      setError(
        /too large|entity too large|Payload Too Large/i.test(message)
          ? 'Fichier trop volumineux (10 Mo maximum par fichier).'
          : message,
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <RequireAccount>
      <div className="mx-auto max-w-2xl space-y-6">
        <h1 className="text-2xl font-bold text-slate-900">
          {isIncident ? 'Signaler un incident' : 'Publier dans la résidence'}
        </h1>
        <form
          onSubmit={(event) => void handleSubmit(event)}
          className="space-y-5 ds-card p-6"
        >
          {isIncident && (
            <div className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800">
              ⚠️ Ce signalement sera envoyé par email à l&apos;agence de la résidence
              (syndic / gestionnaire).
            </div>
          )}

          <div>
            <label htmlFor="title" className="mb-1 block text-sm font-medium text-slate-700">
              Titre
            </label>
            <input
              id="title"
              type="text"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              required
              minLength={3}
              maxLength={80}
              placeholder={
                isIncident ? 'Ex. Fuite d’eau dans le hall B' : 'Ex. Perceuse Bosch à prêter ce week-end'
              }
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
            />
          </div>

          <div>
            <label htmlFor="category" className="mb-1 block text-sm font-medium text-slate-700">
              Catégorie
            </label>
            <select
              id="category"
              value={category}
              onChange={(event) => setCategory(event.target.value as PublishCategory)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
            >
              {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
              <option value={SIGNALEMENT}>🛠️ Signalement (alerte l’agence)</option>
            </select>
          </div>

          {isIncident && (
            <div>
              <label htmlFor="incident-category" className="mb-1 block text-sm font-medium text-slate-700">
                Type de problème
              </label>
              <select
                id="incident-category"
                value={incidentCategory}
                onChange={(event) => setIncidentCategory(event.target.value as IncidentCategory)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
              >
                {Object.entries(INCIDENT_CATEGORY_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label htmlFor="description" className="mb-1 block text-sm font-medium text-slate-700">
              Description
            </label>
            <textarea
              id="description"
              rows={5}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              required
              minLength={10}
              maxLength={2000}
              placeholder={
                isIncident
                  ? 'Décrivez le problème : depuis quand, où, les détails utiles à l’intervention…'
                  : 'Décrivez ce que vous proposez : état, disponibilités, conditions…'
              }
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
            />
          </div>

          {isIncident ? (
            <>
              <div>
                <label htmlFor="location" className="mb-1 block text-sm font-medium text-slate-700">
                  Localisation
                </label>
                <input
                  id="location"
                  type="text"
                  value={location}
                  onChange={(event) => setLocation(event.target.value)}
                  required
                  maxLength={120}
                  placeholder="Ex. 3e étage, escalier B, parking sous-sol…"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
                />
                <p className="mt-1 text-xs text-slate-400">
                  Précisez où se trouve le problème (l&apos;agence déterminera la résidence).
                </p>
              </div>

              <div>
                <label htmlFor="files" className="mb-1 block text-sm font-medium text-slate-700">
                  Photos / documents (optionnel, max 5 × 5 Mo)
                </label>
                <input
                  id="files"
                  type="file"
                  multiple
                  accept="image/jpeg,image/png,image/webp,application/pdf"
                  onChange={(event) => setFiles(Array.from(event.target.files ?? []).slice(0, 5))}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-brand-50 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-brand-700 focus:border-brand-500 focus:outline-none"
                />
                {files.length > 0 && (
                  <p className="mt-1 text-xs text-slate-500">{files.length} fichier(s) joint(s)</p>
                )}
              </div>
            </>
          ) : (
            <>
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={showDetails}
                  onChange={(event) => setShowDetails(event.target.checked)}
                  className="rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                />
                Afficher mon bâtiment et mon étage sur cette publication
              </label>

              <label className="flex items-start gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={notifyResidence}
                  onChange={(event) => setNotifyResidence(event.target.checked)}
                  className="mt-0.5 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                />
                <span>
                  Notifier la résidence par email
                  <span className="block text-xs font-normal text-slate-400">
                    Les habitants recevront un mail avec votre annonce.
                  </span>
                </span>
              </label>
            </>
          )}
          {error && <ErrorMessage message={error} />}
          {success && <SuccessMessage message={success} />}

          <button
            type="submit"
            disabled={submitting}
            className="btn-primary"
          >
            {submitting
              ? 'Envoi…'
              : isIncident
                ? 'Envoyer le signalement à l’agence'
                : 'Publier dans la résidence'}
          </button>
        </form>
      </div>
    </RequireAccount>
  );
}

export default function NewListingPage() {
  return (
    <Suspense fallback={<Spinner label="Chargement…" />}>
      <NewListingForm />
    </Suspense>
  );
}
