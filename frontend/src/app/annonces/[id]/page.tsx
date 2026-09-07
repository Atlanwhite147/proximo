'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import api from '@/lib/api';
import { useAuth } from '@/components/AuthProvider';
import { ErrorMessage, Spinner } from '@/components/Feedback';
import { formatDistance, formatLocation, formatRelativeDate } from '@/lib/format';
import { CATEGORY_EMOJI, CATEGORY_LABELS, Listing, STATUS_LABELS } from '@/lib/types';
import { RequireAccount } from '@/components/RequireAccount';
import { Comments } from '@/components/Comments';


/**
 * Détail d'une annonce + mise en relation (message au voisin).
 * L'adresse exacte n'est jamais affichée : uniquement le résidence.
 */
export default function ListingDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();

  const [listing, setListing] = useState<Listing | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [contactMessage, setContactMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    if (authLoading || !user) return; // RequireAccount gère la redirection
    api<{ listing: Listing }>(`/listings/${id}`)
      .then((data) => setListing(data.listing))
      .catch((err) => setError(err instanceof Error ? err.message : 'Annonce introuvable'))
      .finally(() => setLoading(false));
  }, [id, user, authLoading]);

  const handleContact = async () => {
    if (!listing) return;
    if (!user) {
      router.push(`/connexion?next=/annonces/${listing.id}`);
      return;
    }
    setSending(true);
    setError(null);
    try {
      const result = await api<{ conversationId: string }>('/messages', {
        method: 'POST',
        body: JSON.stringify({
          recipientId: listing.owner.id,
          content: contactMessage.trim() || `Bonjour ${listing.owner.firstName}, votre annonce « ${listing.title} » m'intéresse.`,
        }),
      });
      setSent(true);
      setTimeout(() => router.push(`/messages/${result.conversationId}`), 800);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Envoi impossible');
    } finally {
      setSending(false);
    }
  };

  if (authLoading) return <Spinner label="Vérification du compte…" />;

  // Non connecté : RequireAccount redirige vers /connexion?next=…
  if (!user) {
    return <RequireAccount next={`/annonces/${id}`}>{null}</RequireAccount>;
  }

  if (loading) return <Spinner label="Chargement de l'annonce…" />;

  if (error || !listing) {
    return (
      <div className="space-y-4">
        <ErrorMessage message={error ?? 'Annonce introuvable'} />
        <Link href="/annonces" className="text-sm font-medium text-brand-600 hover:underline">
          ← Retour aux annonces
        </Link>
      </div>
    );
  }

  const closed = listing.status !== 'OPEN';

  return (
    <RequireAccount next={`/annonces/${listing.id}`}>
    <article className="mx-auto max-w-2xl space-y-5">
      <Link href="/annonces" className="text-sm font-medium text-brand-600 hover:underline">
        ← Retour aux annonces
      </Link>

      <div className="ds-card p-6">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 text-sm font-medium text-slate-600">
            <span aria-hidden>{CATEGORY_EMOJI[listing.category]}</span>
            {CATEGORY_LABELS[listing.category]}
          </span>
          <span
            className={`rounded-full px-3 py-1 text-sm font-medium ${
              listing.status === 'OPEN'
                ? 'bg-green-100 text-green-700'
                : listing.status === 'RESERVED'
                  ? 'bg-amber-100 text-amber-700'
                  : 'bg-slate-200 text-slate-600'
            }`}
          >
            {STATUS_LABELS[listing.status]}
          </span>
        </div>

        <h1 className="text-2xl font-bold text-slate-900">{listing.title}</h1>
        <p className="mt-3 whitespace-pre-line leading-relaxed text-slate-600">
          {listing.description}
        </p>

        <dl className="mt-6 space-y-2 border-t border-slate-100 pt-4 text-sm text-slate-500">
          <div className="flex justify-between gap-4">
            <dt>Résidence</dt>
            <dd className="font-medium text-slate-700">
              📍{' '}
              {formatLocation(
                listing.residenceName,
                listing.neighborhood,
                listing.owner.building,
                listing.owner.floor,
                listing.owner.showDetails,
              )}
            </dd>
          </div>
          {listing.distanceKm !== undefined && (
            <div className="flex justify-between gap-4">
              <dt>Distance</dt>
              <dd className="font-medium text-slate-700">{formatDistance(listing.distanceKm)}</dd>
            </div>
          )}
          <div className="flex justify-between gap-4">
            <dt>Publiée par</dt>
            <dd className="font-medium text-slate-700">
              {listing.owner.firstName}
              {listing.owner.showDetails &&
              (listing.owner.building || listing.owner.floor)
                ? ` (${[listing.owner.building && `bât. ${listing.owner.building}`, listing.owner.floor && `étage ${listing.owner.floor}`].filter(Boolean).join(' · ')})`
                : listing.owner.neighborhood
                  ? ` (${listing.owner.neighborhood})`
                  : ''}
            </dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt>Publiée</dt>
            <dd className="font-medium text-slate-700">{formatRelativeDate(listing.createdAt)}</dd>
          </div>
        </dl>

        {/* Zone de contact */}
        {!listing.isOwner && !closed && (
          <div className="mt-6 rounded-xl bg-slate-50 p-4">
            {sent ? (
              <p className="text-sm font-medium text-green-700">
                ✓ Message envoyé ! Redirection vers la conversation…
              </p>
            ) : (
              <>
                <label htmlFor="contact-message" className="text-sm font-medium text-slate-700">
                  Envoyer un message à {listing.owner.firstName}
                </label>
                <textarea
                  id="contact-message"
                  rows={3}
                  value={contactMessage}
                  onChange={(event) => setContactMessage(event.target.value)}
                  placeholder={`Bonjour ${listing.owner.firstName}, votre annonce « ${listing.title} » m'intéresse.`}
                  className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => void handleContact()}
                  disabled={sending}
                  className="btn-primary-sm rounded-xl px-5 mt-3"
                >
                  {user ? (sending ? 'Envoi…' : 'Contacter le voisin') : 'Se connecter pour contacter'}
                </button>
              </>
            )}
          </div>
        )}

        {listing.isOwner && (
          <div className="mt-6 rounded-xl bg-brand-50 p-4 text-sm text-brand-800">
            C&apos;est votre annonce.{' '}
            <Link href="/profil" className="font-semibold underline">
              La gérer dans mon profil →
            </Link>
          </div>
        )}

        {closed && !listing.isOwner && (
          <p className="mt-6 text-sm text-slate-400">
            Cette annonce n&apos;est plus disponible.
          </p>
        )}
      </div>

      {/* Discussion publique dédiée */}
      <Comments type="listing" targetId={listing.id} />
    </article>
      </RequireAccount>
  );
}
