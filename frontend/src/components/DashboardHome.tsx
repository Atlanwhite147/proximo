'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import api from '@/lib/api';
import { useAuth } from '@/components/AuthProvider';
import { Spinner } from '@/components/Feedback';
import { ListingCard } from '@/components/ListingCard';
import { CATEGORY_LABELS, INCIDENT_CATEGORY_LABELS } from '@/lib/types';
import { formatRelativeDate } from '@/lib/format';
import { incidentCategoryVisual } from '@/lib/category';
import { cn } from '@/lib/utils';
import type { Conversation, Incident, Listing } from '@/lib/types';

interface ResidenceStats {
  activeResidents: number;
  listingsCount: number;
  openIncidentsCount: number;
}

/** Icône + couleur par type d'activité (fil unifié). */
const TYPE_VISUAL = {
  listing: { icon: '📦', soft: 'bg-blue-50', text: 'text-blue-700' },
  incident: { icon: '🛠️', soft: 'bg-red-50', text: 'text-red-700' },
  resolved: { icon: '✅', soft: 'bg-emerald-50', text: 'text-emerald-700' },
} as const;

type Activity = { kind: keyof typeof TYPE_VISUAL; date: string; node: React.ReactNode; key: string };

/** Widget « Inviter un voisin » : QR généré à la demande + partage WhatsApp. */
function InviteWidget() {
  const { user } = useAuth();
  const [invitation, setInvitation] = useState<{ url: string; qrUrl?: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  const generate = async () => {
    setBusy(true);
    try {
      const created = await api<{ url: string; qrUrl?: string }>('/invitations', {
        method: 'POST',
        body: JSON.stringify({
          neighborhood: user?.residenceName ?? user?.neighborhood ?? '',
          expiresInHours: 72,
        }),
      });
      setInvitation(created);
    } catch {
      /* silencieux : le lien /inviter reste accessible */
    } finally {
      setBusy(false);
    }
  };

  const copy = async () => {
    if (!invitation?.url) return;
    await navigator.clipboard.writeText(invitation.url).catch(() => undefined);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const whatsappUrl = invitation?.url
    ? `https://wa.me/?text=${encodeURIComponent(`Rejoignez notre résidence sur Proximo : ${invitation.url}`)}`
    : null;

  if (!invitation) {
    return (
      <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm leading-relaxed text-white/90">
          Le lien d&apos;invitation est à usage unique et expire au bout de 72 h.
          Générez-le, puis partagez-le par QR code (à imprimer) ou par message.
        </p>
        <button
          type="button"
          onClick={() => void generate()}
          disabled={busy}
          className="shrink-0 rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-primary-700 shadow-sm hover:bg-primary-50 disabled:opacity-60"
        >
          {busy ? 'Génération…' : 'Générer le QR code'}
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-center">
      <Link href="/inviter" className="shrink-0" title="Voir en grand sur la page Inviter">
        {invitation.qrUrl ? (
          <img
            src={invitation.qrUrl}
            alt="QR code d'invitation"
            width={104}
            height={104}
            className="rounded-xl border-2 border-white/30 bg-white p-1"
          />
        ) : null}
      </Link>
      <div className="min-w-0 flex-1">
        <p className="break-all font-mono text-xs text-white/80">{invitation.url}</p>
        <div className="mt-2.5 flex flex-wrap gap-2">
          {whatsappUrl && (
            <a
              href={whatsappUrl}
              target="_blank"
              rel="noreferrer"
              className="rounded-lg bg-[#25D366] px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90"
            >
              Partager sur WhatsApp
            </a>
          )}
          <button
            type="button"
            onClick={() => void copy()}
            className="rounded-lg border border-white/40 px-3 py-1.5 text-xs font-semibold text-white hover:bg-white/10"
          >
            {copied ? '✓ Copié !' : 'Copier le lien'}
          </button>
          <Link
            href="/inviter"
            className="rounded-lg border border-white/40 px-3 py-1.5 text-xs font-semibold text-white hover:bg-white/10"
          >
            Imprimer le QR →
          </Link>
        </div>
      </div>
    </div>
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
  const [stats, setStats] = useState<ResidenceStats | null>(null);
  const [listings, setListings] = useState<Listing[]>([]);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void Promise.allSettled([
      api<ResidenceStats>('/users/me/residence-stats'),
      api<{ items: Listing[] }>('/listings?limit=6'),
      api<{ incidents: Incident[] }>('/incidents'),
      api<{ conversations: Conversation[] }>('/messages'),
    ]).then(([s, l, i, c]) => {
      if (cancelled) return;
      if (s.status === 'fulfilled') setStats(s.value);
      if (l.status === 'fulfilled') setListings(l.value.items);
      if (i.status === 'fulfilled') setIncidents(i.value.incidents);
      if (c.status === 'fulfilled') setConversations(c.value.conversations);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const residenceName = user?.residenceName ?? 'votre résidence';

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
              Plus la résidence est complète, plus elle vit : partagez l&apos;accès à{' '}
              <strong>{residenceName}</strong>.
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

      {/* ─── Rappel messagerie si aucune conversation ───────── */}
      {conversations.length === 0 && (
        <section className="rounded-2xl border border-slate-200 bg-white p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-semibold text-slate-800">💬 Messages privés</h2>
              <p className="text-sm text-slate-500">
                Échangez en direct avec un voisin depuis une annonce ou un signalement.
              </p>
            </div>
            <Link href="/annonces" className="rounded-xl bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-200">
              Trouver un voisin
            </Link>
          </div>
        </section>
      )}

      {unreadTotal > 0 && (
        <p className="text-center text-xs text-slate-400">
          Vous avez {unreadTotal} message{unreadTotal > 1 ? 's' : ''} non lu
          {unreadTotal > 1 ? 's' : ''} dans votre messagerie.
        </p>
      )}
    </div>
  );
}
