'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { Megaphone, MessageCircle, Plus, Send } from 'lucide-react';
import api from '@/lib/api';
import { useAuth } from '@/components/AuthProvider';
import { formatRelativeDate } from '@/lib/format';
import type { Announcement } from '@/lib/types';

/**
 * Section « Messages prioritaires » du tableau de bord.
 *
 * Canal officiel de la résidence : tout le monde voit et commente, seuls les
 * administrateurs de la résidence publient. Le tableau de bord n'en montre
 * qu'un aperçu — la lecture complète et les commentaires vivent sur
 * /annonces-officielles.
 */
export function AnnouncementsHighlight() {
  const { user } = useAuth();
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isAdmin = user?.role === 'ADMIN' || user?.role === 'SUPERADMIN';

  const load = useCallback(async () => {
    try {
      const data = await api<{ announcements: Announcement[] }>('/announcements?limit=2');
      setAnnouncements(data.announcements);
    } catch {
      /* silencieux : la section disparaît si l'API est indisponible */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const publish = async () => {
    if (!title.trim() || !body.trim()) {
      setError('Titre et message sont requis.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await api('/announcements', {
        method: 'POST',
        body: JSON.stringify({ title: title.trim(), body: body.trim() }),
      });
      setTitle('');
      setBody('');
      setOpen(false);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Publication impossible');
    } finally {
      setBusy(false);
    }
  };

  if (loading) return null;
  if (announcements.length === 0 && !isAdmin) return null;

  return (
    <section>
      <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
        <div>
          <p className="font-mono text-[11px] font-medium uppercase tracking-badge text-slate-400">
            ● Informations
          </p>
          <h2 className="mt-0.5 text-lg font-bold text-slate-900">Annonces officielles</h2>
        </div>
        <div className="flex items-center gap-3">
          {announcements.length > 0 && (
            <Link
              href="/annonces-officielles"
              className="text-sm font-semibold text-brand-600 hover:underline"
            >
              Tout voir et commenter →
            </Link>
          )}
          {isAdmin && (
            <button
              type="button"
              onClick={() => setOpen((value) => !value)}
              className="inline-flex items-center gap-1.5 rounded-xl bg-brand-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-brand-700"
            >
              <Plus className="h-4 w-4" aria-hidden />
              Publier
            </button>
          )}
        </div>
      </div>

      {open && isAdmin && (
        <div className="ds-card mb-3 space-y-3 p-4">
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Objet (ex. Coupure d'eau mardi matin)"
            maxLength={120}
            className="input-field"
          />
          <textarea
            value={body}
            onChange={(event) => setBody(event.target.value)}
            placeholder="Votre annonce aux habitants…"
            rows={4}
            maxLength={4000}
            className="input-field"
          />
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => void publish()}
              disabled={busy}
              className="btn-primary-sm h-11 shrink-0 px-5 disabled:opacity-50"
            >
              <Send className="h-4 w-4" aria-hidden />
              {busy ? 'Publication…' : 'Publier l&apos;annonce'}
            </button>
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                setError(null);
              }}
              className="h-11 shrink-0 rounded-xl border border-slate-300 px-4 text-sm font-semibold text-slate-700"
            >
              Annuler
            </button>
          </div>
        </div>
      )}

      {announcements.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-5 text-center">
          <Megaphone className="mx-auto h-6 w-6 text-slate-300" aria-hidden />
          <p className="mt-2 text-sm font-medium text-slate-600">
            Aucune annonce pour le moment
          </p>
          <p className="mx-auto mt-1 max-w-sm text-sm text-slate-500">
            Cet espace est réservé aux informations officielles de la résidence
            (travaux, coupures, réunions). Vous serez prévenu ici.
          </p>
        </div>
      ) : (
        <ul className="ds-card divide-y divide-slate-100">
          {announcements.map((announcement) => (
            <li key={announcement.id} className="px-4 py-3">
              <Link href="/annonces-officielles" className="block">
                <div className="flex flex-wrap items-center gap-2">
                  <Megaphone className="h-4 w-4 shrink-0 text-brand-600" aria-hidden />
                  <span className="font-semibold text-slate-800">{announcement.title}</span>
                  <span className="rounded-full bg-brand-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-brand-700">
                    Officiel
                  </span>
                </div>
                <p className="mt-1 line-clamp-2 text-sm text-slate-600">{announcement.body}</p>
                <p className="mt-1.5 flex flex-wrap items-center gap-x-3 text-xs text-slate-400">
                  <span>
                    {announcement.author.firstName} {announcement.author.lastName}
                  </span>
                  <span>{formatRelativeDate(announcement.createdAt)}</span>
                  <span className="inline-flex items-center gap-1">
                    <MessageCircle className="h-3.5 w-3.5" aria-hidden />
                    {announcement._count?.comments ?? 0} commentaire
                    {(announcement._count?.comments ?? 0) > 1 ? 's' : ''}
                  </span>
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
