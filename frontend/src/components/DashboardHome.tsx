'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { Check, Copy, MessageCircle, QrCode, Share2, X } from 'lucide-react';
import api from '@/lib/api';
import { useAuth } from '@/components/AuthProvider';
import { Spinner } from '@/components/Feedback';
import { ListingCard } from '@/components/ListingCard';
import { CATEGORY_LABELS, INCIDENT_CATEGORY_LABELS } from '@/lib/types';
import { formatRelativeDate } from '@/lib/format';
import { incidentCategoryVisual } from '@/lib/category';
import { cn } from '@/lib/utils';
import type { Conversation, Incident, Invitation, Listing } from '@/lib/types';

interface ResidenceStats {
  activeResidents: number;
  listingsCount: number;
  openIncidentsCount: number;
}

/** Entrée d'annuaire : voisin ACTIVE de la même résidence (sans email). */
interface Neighbor {
  id: string;
  firstName: string;
  lastName: string;
  building: string | null;
  floor: string | null;
  role: string;
}

/** Icône + couleur par type d'activité (fil unifié). */
const TYPE_VISUAL = {
  listing: { icon: '📦', soft: 'bg-blue-50', text: 'text-blue-700' },
  incident: { icon: '🛠️', soft: 'bg-red-50', text: 'text-red-700' },
  resolved: { icon: '✅', soft: 'bg-emerald-50', text: 'text-emerald-700' },
} as const;

type Activity = { kind: keyof typeof TYPE_VISUAL; date: string; node: React.ReactNode; key: string };

/**
 * Widget « Inviter un voisin » pensé pour le minimum de friction :
 *  1. l'invitation est prête dès l'ouverture (réutilisée si elle existe) ;
 *  2. un bouton principal ouvre la feuille de partage native (iOS/Android :
 *     WhatsApp, Messages, Mail, AirDrop…) ;
 *  3. WhatsApp, copie du lien et QR code plein écran restent à un seul tap.
 */
function InviteWidget() {
  const { user } = useAuth();
  const [invitation, setInvitation] = useState<Invitation | null>(null);
  const [shortUrl, setShortUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [qrOpen, setQrOpen] = useState(false);

  const residenceName = user?.residenceName ?? user?.neighborhood ?? 'la résidence';

  // Invitation disponible immédiatement : aucune étape « générer » à faire.
  useEffect(() => {
    let cancelled = false;
    api<Invitation>('/invitations/mine', {
      method: 'POST',
      body: JSON.stringify({ neighborhood: residenceName, expiresInHours: 72 }),
    })
      .then((created) => {
        if (cancelled) return;
        setInvitation(created);
        if (created.token) {
          api<{ shortUrl: string }>(`/invitations/${created.token}/short-url`)
            .then((data) => {
              if (!cancelled) setShortUrl(data.shortUrl);
            })
            .catch(() => undefined);
        }
      })
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [residenceName]);

  const shareUrl = shortUrl ?? invitation?.url ?? null;
  const shareText = `Rejoignez ${residenceName} sur Proximo`;

  const copy = async () => {
    if (!shareUrl) return;
    await navigator.clipboard.writeText(shareUrl).catch(() => undefined);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  /**
   * Partage natif : ouvre la feuille de partage du système (un seul tap pour
   * WhatsApp, Messages, Mail…). Annulation = silence ; si l'API n'existe pas
   * (desktop ancien), on copie le lien pour ne jamais laisser l'utilisateur
   * sans solution.
   */
  const share = async () => {
    if (!shareUrl) return;
    const nav = navigator as Navigator & { share?: (data: ShareData) => Promise<void> };
    if (typeof nav.share === 'function') {
      try {
        await nav.share({ title: 'Proximo', text: shareText, url: shareUrl });
      } catch (error) {
        if ((error as Error)?.name !== 'AbortError') await copy();
      }
      return;
    }
    await copy();
  };

  const whatsappUrl = shareUrl
    ? `https://wa.me/?text=${encodeURIComponent(`${shareText} : ${shareUrl}`)}`
    : null;

  if (loading) {
    return (
      <div className="flex items-center gap-3 text-sm font-medium text-white/85" role="status">
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
        Préparation de votre invitation…
      </div>
    );
  }

  if (!invitation) {
    return (
      <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm leading-relaxed text-white/90">
          Retrouvez votre invitation et l&apos;affiche à imprimer sur la page dédiée.
        </p>
        <Link
          href="/inviter"
          className="shrink-0 rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-primary-700 shadow-sm hover:bg-primary-50"
        >
          Ouvrir la page invitation →
        </Link>
      </div>
    );
  }

  return (
    <>
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void share()}
            className="flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-primary-700 shadow-sm transition hover:bg-primary-50"
          >
            <Share2 className="h-4 w-4" aria-hidden />
            Partager l&apos;invitation
          </button>
          {whatsappUrl && (
            <a
              href={whatsappUrl}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-2 rounded-xl bg-[#25D366] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:opacity-90"
            >
              <MessageCircle className="h-4 w-4" aria-hidden />
              WhatsApp
            </a>
          )}
          <button
            type="button"
            onClick={() => setQrOpen(true)}
            className="flex items-center gap-2 rounded-xl border border-white/40 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-white/10"
          >
            <QrCode className="h-4 w-4" aria-hidden />
            QR code
          </button>
          <button
            type="button"
            onClick={() => void copy()}
            className="flex items-center gap-2 rounded-xl border border-white/40 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-white/10"
          >
            {copied ? (
              <>
                <Check className="h-4 w-4" aria-hidden />
                Lien copié
              </>
            ) : (
              <>
                <Copy className="h-4 w-4" aria-hidden />
                Copier le lien
              </>
            )}
          </button>
        </div>
        <p className="truncate font-mono text-xs text-white/70" title={shareUrl ?? invitation.url}>
          {shareUrl ?? invitation.url}
        </p>
      </div>

      {/* QR code plein écran : pratique pour faire scanner un voisin en face. */}
      {qrOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 p-4"
          role="dialog"
          aria-modal="true"
          aria-label="QR code d'invitation"
          onClick={() => setQrOpen(false)}
        >
          <div
            className="w-full max-w-xs rounded-3xl bg-white p-6 text-center shadow-xl"
            onClick={(event) => event.stopPropagation()}
          >
            <p className="font-mono text-[11px] font-medium uppercase tracking-badge text-slate-400">
              ● Invitation
            </p>
            <h3 className="mt-1 text-lg font-bold text-slate-900">Rejoignez {residenceName}</h3>
            {invitation.qrUrl && (
              <img
                src={invitation.qrUrl}
                alt="QR code d'invitation à scanner"
                width={260}
                height={260}
                className="mx-auto mt-4 h-[260px] w-[260px] rounded-2xl border border-slate-200 p-2"
              />
            )}
            <p className="mt-3 text-sm text-slate-500">
              Faites scanner ce code avec l&apos;appareil photo, ou partagez le lien :
            </p>
            <p className="mt-1 break-all font-mono text-xs text-slate-600">{shareUrl}</p>
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={() => void copy()}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-slate-300 px-3 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                {copied ? <Check className="h-4 w-4" aria-hidden /> : <Copy className="h-4 w-4" aria-hidden />}
                {copied ? 'Copié' : 'Copier'}
              </button>
              <button
                type="button"
                onClick={() => setQrOpen(false)}
                className="flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800"
              >
                <X className="h-4 w-4" aria-hidden />
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

/**
 * Tableau de bord « vie de la résidence » (membres ACTIVE) :
 *  - bannière compacte avec indicateurs de vie (voisins actifs, annonces…)
 *  - fil d'activité unifié (annonces + signalements, triés par date)
 *  - conversations récentes
 *  - carte « Inviter un voisin » mise en avant (QR + WhatsApp)
 * Les empty states incitent à agir plutôt que d'afficher du vide.
 */
export function DashboardHome() {
  const { user } = useAuth();
  const router = useRouter();
  const [stats, setStats] = useState<ResidenceStats | null>(null);
  const [listings, setListings] = useState<Listing[]>([]);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [neighbors, setNeighbors] = useState<Neighbor[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void Promise.allSettled([
      api<ResidenceStats>('/users/me/residence-stats'),
      api<{ items: Listing[] }>('/listings?limit=6'),
      api<{ incidents: Incident[] }>('/incidents'),
      api<{ conversations: Conversation[] }>('/messages'),
      // Aperçu : 3 voisins au hasard parmi ceux vus récemment (48 h glissantes).
      api<{ neighbors: Neighbor[] }>('/users/neighbors/recent?hours=48&limit=3'),
    ]).then(([s, l, i, c, n]) => {
      if (cancelled) return;
      if (s.status === 'fulfilled') setStats(s.value);
      if (l.status === 'fulfilled') setListings(l.value.items);
      if (i.status === 'fulfilled') setIncidents(i.value.incidents);
      if (c.status === 'fulfilled') setConversations(c.value.conversations);
      if (n.status === 'fulfilled') setNeighbors(n.value.neighbors);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const residenceName = user?.residenceName ?? 'votre résidence';

  /** Démarre (ou retrouve) une conversation avec un voisin, puis l'ouvre. */
  const contact = async (neighbor: Neighbor) => {
    try {
      const data = await api<{ conversationId: string }>('/messages', {
        method: 'POST',
        body: JSON.stringify({
          recipientId: neighbor.id,
          content: `Bonjour ${neighbor.firstName}, je vous contacte depuis l'annuaire de la résidence.`,
        }),
      });
      router.push(`/messages/${data.conversationId}`);
    } catch {
      // Silencieux : l'utilisateur peut passer par une annonce du voisin.
    }
  };

  /** Fil d'activité unifié : 5 annonces + 5 signalements, triés par date. */
  const activity: Activity[] = [
    ...listings.slice(0, 5).map(
      (listing): Activity => ({
        kind: 'listing',
        date: listing.createdAt,
        key: `l-${listing.id}`,
        node: (
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <span
              aria-hidden
              className={cn(
                'flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-base',
                TYPE_VISUAL.listing.soft,
              )}
            >
              {TYPE_VISUAL.listing.icon}
            </span>
            <div className="min-w-0">
              <Link
                href={`/annonces/${listing.id}`}
                className="line-clamp-1 font-semibold text-foreground hover:text-primary"
              >
                {listing.title}
              </Link>
              <p className="text-xs text-muted-foreground">
                {CATEGORY_LABELS[listing.category]} · {listing.owner.firstName} ·{' '}
                {formatRelativeDate(listing.createdAt)}
              </p>
            </div>
          </div>
        ),
      }),
    ),
    ...incidents.slice(0, 5).map(
      (incident): Activity => ({
        kind: incident.status === 'RESOLVED' ? 'resolved' : 'incident',
        date: incident.updatedAt ?? incident.createdAt,
        key: `i-${incident.id}`,
        node: (
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <span
              aria-hidden
              className={cn(
                'flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-base',
                incident.status === 'RESOLVED'
                  ? TYPE_VISUAL.resolved.soft
                  : TYPE_VISUAL.incident.soft,
              )}
              style={
                incident.status !== 'RESOLVED'
                  ? { backgroundColor: `${incidentCategoryVisual(incident.category).color}18` }
                  : undefined
              }
            >
              {incident.status === 'RESOLVED' ? TYPE_VISUAL.resolved.icon : TYPE_VISUAL.incident.icon}
            </span>
            <div className="min-w-0">
              <Link
                href={`/signalements/${incident.id}`}
                className="line-clamp-1 font-semibold text-foreground hover:text-primary"
              >
                {incident.title}
              </Link>
              <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                {INCIDENT_CATEGORY_LABELS[incident.category]}
                {incident.user ? ` · ${incident.user.firstName}` : ''} ·{' '}
                {formatRelativeDate(incident.updatedAt ?? incident.createdAt)}
              </p>
            </div>
          </div>
        ),
      }),
    ),
  ]
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 8);

  const unreadTotal = conversations.reduce((sum, c) => sum + c.unreadCount, 0);
  const totalListings = stats?.listingsCount ?? listings.length;
  const hasListings = listings.length > 0 || (stats?.listingsCount ?? 0) > 0;

  if (loading) {
    return (
      <div className="py-10">
        <Spinner label="Chargement de la vie de la résidence…" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ─── Bannière compacte + indicateurs de vie ─────────── */}
      <section className="glow-bg relative overflow-hidden rounded-3xl bg-brand-gradient px-6 py-6 text-white shadow-lg sm:px-8">
        <div aria-hidden className="absolute -right-8 -top-8 h-36 w-36 rounded-full bg-white/10 blur-2xl" />
        <div className="relative flex flex-wrap items-end justify-between gap-4">
          <div className="min-w-0">
            <p className="font-mono text-[11px] font-medium uppercase tracking-badge text-white/80">
              🏢 Votre résidence
            </p>
            <h1 className="mt-1 truncate text-xl font-bold sm:text-2xl">{residenceName}</h1>
          </div>
          {stats && (
            <div className="flex items-center gap-2.5">
              <div className="rounded-2xl bg-white/15 px-3.5 py-2 text-center backdrop-blur">
                <p className="text-lg font-bold leading-none">{stats.activeResidents}</p>
                <p className="mt-1 text-[10px] font-medium uppercase tracking-wide text-white/80">
                  Voisins actifs
                </p>
              </div>
              <div className="rounded-2xl bg-white/15 px-3.5 py-2 text-center backdrop-blur">
                <p className="text-lg font-bold leading-none">{totalListings}</p>
                <p className="mt-1 text-[10px] font-medium uppercase tracking-wide text-white/80">
                  Annonces
                </p>
              </div>
              <div className="rounded-2xl bg-white/15 px-3.5 py-2 text-center backdrop-blur">
                <p className="text-lg font-bold leading-none">{stats.openIncidentsCount}</p>
                <p className="mt-1 text-[10px] font-medium uppercase tracking-wide text-white/80">
                  Signalements
                </p>
              </div>
            </div>
          )}
        </div>
        <div className="relative mt-4 flex flex-wrap gap-2">
          <Link
            href="/annonces/nouvelle"
            className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-primary-700 shadow hover:bg-primary-50"
          >
            + Publier une annonce
          </Link>
          <Link
            href="/annonces/nouvelle?categorie=SIGNALEMENT"
            className="rounded-xl border border-white/40 px-4 py-2 text-sm font-semibold text-white hover:bg-white/10"
          >
            🛠️ Signaler un incident
          </Link>
        </div>
      </section>

      {/* ─── Inviter un voisin (moteur de croissance, mis en avant) ── */}
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary to-[#4D7CFF] p-5 text-white shadow-lg sm:p-6">
        <div aria-hidden className="absolute -right-2 -top-6 text-7xl opacity-15">📲</div>
        <div className="relative flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold">Inviter un voisin</h2>
            <p className="text-sm text-white/85">
              Votre invitation est déjà prête : partagez-la en un tap, ou faites scanner le
              QR code à un voisin pour qu&apos;il rejoigne <strong>{residenceName}</strong>.
            </p>
          </div>
        </div>
        <div className="relative mt-4">
          <InviteWidget />
        </div>
      </section>

      {/* ─── Fil d'activité unifié ─────────────────────────── */}
      <section>
        <div className="mb-3 flex items-end justify-between">
          <div>
            <p className="font-mono text-[11px] font-medium uppercase tracking-badge text-slate-400">
              ● Activité récente
            </p>
            <h2 className="mt-0.5 text-lg font-bold text-slate-900">Ce qui se passe dans la résidence</h2>
          </div>
        </div>

        {activity.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center">
            <p className="text-3xl">🌱</p>
            <p className="mt-2 font-semibold text-slate-700">La résidence vient de naître sur Proximo</p>
            <p className="mx-auto mt-1 max-w-md text-sm text-slate-500">
              Soyez le premier à publier une annonce ou à signaler un incident : vos
              voisins verront la vie s&apos;animer ici.
            </p>
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              <Link
                href="/annonces/nouvelle"
                className="rounded-xl bg-brand-gradient px-4 py-2 text-sm font-semibold text-white"
              >
                + Publier la première annonce
              </Link>
              <Link
                href="/annonces/nouvelle?categorie=SIGNALEMENT"
                className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50"
              >
                🛠️ Signaler un incident
              </Link>
            </div>
          </div>
        ) : (
          <div className="ds-card divide-y divide-slate-100 p-2">
            {activity.map((item) => (
              <div key={item.key} className="flex items-center gap-3 rounded-xl px-2.5 py-2.5 hover:bg-slate-50">
                {item.node}
              </div>
            ))}
            <div className="px-2.5 pt-2 text-right">
              <Link href="/annonces" className="text-sm font-medium text-primary hover:underline">
                Tout voir dans les annonces →
              </Link>
            </div>
          </div>
        )}
      </section>

      {/* ─── Annonces récentes (détail enrichi) ─────────────── */}
      {hasListings && listings.length > 0 && (
        <section>
          <div className="mb-3 flex items-end justify-between">
            <h2 className="text-lg font-bold text-slate-900">📦 Dernières annonces</h2>
            <Link href="/annonces" className="text-sm font-medium text-primary hover:underline">
              Tout voir →
            </Link>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {listings.slice(0, 3).map((listing) => (
              <ListingCard key={listing.id} listing={listing} />
            ))}
          </div>
        </section>
      )}

      {/* ─── Conversations récentes ─────────────────────────── */}
      {conversations.length > 0 && (
        <section>
          <div className="mb-3 flex items-end justify-between">
            <div>
              <p className="font-mono text-[11px] font-medium uppercase tracking-badge text-slate-400">
                ● Messagerie
              </p>
              <h2 className="mt-0.5 text-lg font-bold text-slate-900">Conversations récentes</h2>
            </div>
            <Link href="/messages" className="text-sm font-medium text-primary hover:underline">
              Tout voir →
            </Link>
          </div>
          <ul className="ds-card divide-y divide-slate-100">
            {conversations.slice(0, 4).map((conversation) => (
              <li key={conversation.id}>
                <Link
                  href="/messages"
                  className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50"
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-gradient text-sm font-bold text-white">
                    {conversation.otherUser.firstName.charAt(0).toUpperCase()}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center justify-between gap-2">
                      <span className="truncate font-semibold text-slate-800">
                        {conversation.otherUser.firstName}
                      </span>
                      {conversation.lastMessage && (
                        <span className="shrink-0 text-xs text-slate-400">
                          {formatRelativeDate(conversation.lastMessage.createdAt)}
                        </span>
                      )}
                    </span>
                    <span className="block truncate text-sm text-slate-500">
                      {conversation.lastMessage?.content ?? 'Nouvelle conversation'}
                    </span>
                  </span>
                  {conversation.unreadCount > 0 && (
                    <span className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-brand-600 px-1.5 text-[11px] font-bold text-white">
                      {conversation.unreadCount}
                    </span>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* ─── Voisins connectés récemment (aperçu 3, au hasard) ──────── */}
      <section>
        <div className="mb-3 flex items-end justify-between">
          <div>
            <p className="font-mono text-[11px] font-medium uppercase tracking-badge text-slate-400">
              ● Annuaire de la résidence
            </p>
            <h2 className="mt-0.5 text-lg font-bold text-slate-900">Voisins</h2>
            <p className="mt-0.5 text-xs text-slate-500">Récemment</p>
          </div>
        </div>

        {neighbors.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-6 text-center">
            <p className="text-2xl">👥</p>
            <p className="mt-2 text-sm font-medium text-slate-600">
              Aucun voisin vu récemment
            </p>
            <p className="mx-auto mt-1 max-w-sm text-sm text-slate-500">
              Consultez l&apos;annuaire complet pour retrouver tous les habitants de la
              résidence, ou invitez vos voisins à rejoindre Proximo.
            </p>
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              <Link
                href="/voisins"
                className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700"
              >
                Voir l&apos;annuaire
              </Link>
              <Link
                href="/inviter"
                className="rounded-xl bg-brand-gradient px-4 py-2.5 text-sm font-semibold text-white"
              >
                📲 Inviter un voisin
              </Link>
            </div>
          </div>
        ) : (
          <>
            <ul className="ds-card divide-y divide-slate-100">
              {neighbors.map((neighbor) => (
                <li key={neighbor.id} className="flex items-center gap-3 px-4 py-3">
                  <span className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-gradient text-sm font-bold text-white">
                    {neighbor.firstName.charAt(0).toUpperCase()}
                    {neighbor.lastName?.charAt(0).toUpperCase() ?? ''}
                    <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-white bg-emerald-500" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold text-slate-800">
                      {neighbor.firstName} {neighbor.lastName}
                      {neighbor.role === 'ADMIN' && (
                        <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
                          Admin
                        </span>
                      )}
                    </span>
                    <span className="block truncate text-xs text-slate-400">
                      {neighbor.building && neighbor.floor
                        ? `Bât. ${neighbor.building} · Étage ${neighbor.floor}`
                        : neighbor.building
                          ? `Bât. ${neighbor.building}`
                          : neighbor.floor
                            ? `Étage ${neighbor.floor}`
                            : 'Voisin de la résidence'}
                    </span>
                  </span>
                  <button
                    type="button"
                    onClick={() => void contact(neighbor)}
                    className="shrink-0 rounded-lg border border-brand-200 bg-brand-50 px-3 py-1.5 text-xs font-semibold text-brand-700 transition-colors hover:bg-brand-100"
                  >
                    💬 Message
                  </button>
                </li>
              ))}
            </ul>
            <div className="mt-2 text-right">
              <Link
                href="/voisins"
                className="text-sm font-semibold text-brand-600 hover:underline"
              >
                Voir tous les habitants
                {stats?.activeResidents ? ` (${stats.activeResidents})` : ''} →
              </Link>
            </div>
          </>
        )}
      </section>

      {unreadTotal > 0 && (
        <p className="text-center text-xs text-slate-400">
          Vous avez {unreadTotal} message{unreadTotal > 1 ? 's' : ''} non lu
          {unreadTotal > 1 ? 's' : ''} dans votre messagerie.
        </p>
      )}
    </div>
  );
}
