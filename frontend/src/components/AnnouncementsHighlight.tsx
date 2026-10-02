'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { Megaphone, MessageCircle, Pencil, Plus } from 'lucide-react';
import api from '@/lib/api';
import { useAuth } from '@/components/AuthProvider';
import { AnnouncementFormModal } from '@/components/AnnouncementFormModal';
import { formatRelativeDate } from '@/lib/format';
import type { Announcement } from '@/lib/types';

/**
 * Section « Annonces officielles » du tableau de bord.
 *
 * Tout le monde voit et commente, seuls les administrateurs de la résidence
 * publient. Le tableau de bord n'en montre qu'un aperçu : la lecture complète
 * et les commentaires vivent sur /annonces-officielles. La saisie se fait dans
 * une fenêtre dédiée (AnnouncementFormModal), jamais dans la liste.
 */
export function AnnouncementsHighlight() {
  const { user } = useAuth();
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Announcement | null>(null);

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

  const canEdit = (announcement: Announcement) =>
    isAdmin || announcement.author?.id === user?.id;

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
              onClick={() => {
                setEditing(null);
                setModalOpen(true);
              }}
              className="inline-flex items-center gap-1.5 rounded-xl bg-brand-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-brand-700"
            >
              <Plus className="h-4 w-4" aria-hidden />
              Publier
            </button>
          )}
        </div>
      </div>

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
            <li key={announcement.id} className="flex items-start gap-2 px-4 py-3">
              <Link href="/annonces-officielles" className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <Megaphone className="h-4 w-4 shrink-0 text-brand-600" aria-hidden />
                  <span className="font-semibold text-slate-800">{announcement.title}</span>
                </div>
                <p className="mt-1 line-clamp-2 text-sm text-slate-600">{announcement.body}</p>
                <p className="mt-1.5 flex flex-wrap items-center gap-x-3 text-xs text-slate-400">
                  {/* Le nom du publieur n'est jamais affiché sur ce canal (choix produit) :
                      l'API renvoie toujours author, il sert aux droits, pas à l'affichage. */}
                  <span>{formatRelativeDate(announcement.createdAt)}</span>
                  <span className="inline-flex items-center gap-1">
                    <MessageCircle className="h-3.5 w-3.5" aria-hidden />
                    {announcement._count?.comments ?? 0} commentaire
                    {(announcement._count?.comments ?? 0) > 1 ? 's' : ''}
                  </span>
                </p>
              </Link>
              {canEdit(announcement) && (
                <button
                  type="button"
                  onClick={() => {
                    setEditing(announcement);
                    setModalOpen(true);
                  }}
                  title="Modifier l'annonce"
                  aria-label="Modifier l'annonce"
                  className="shrink-0 rounded-lg border border-slate-200 p-2 text-slate-500 transition hover:bg-slate-50 hover:text-slate-700"
                >
                  <Pencil className="h-4 w-4" aria-hidden />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {modalOpen && (
        <AnnouncementFormModal
          announcement={editing}
          onClose={() => setModalOpen(false)}
          onSaved={load}
        />
      )}
    </section>
  );
}
