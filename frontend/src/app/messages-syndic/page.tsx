'use client';

import { useCallback, useEffect, useState } from 'react';
import { Megaphone, MessageCircle, Plus, Send, Trash2 } from 'lucide-react';
import api from '@/lib/api';
import { useAuth } from '@/components/AuthProvider';
import { RequireAccount } from '@/components/RequireAccount';
import { SectionLabel } from '@/components/ui/section-label';
import { Spinner } from '@/components/Feedback';
import { formatRelativeDate } from '@/lib/format';
import type { Announcement, AnnouncementComment } from '@/lib/types';

/**
 * Messages prioritaires de la résidence.
 *
 * Lecture et commentaires ouverts à TOUS les habitants ; la publication est
 * réservée aux rôles ADMIN / SUPERADMIN (contrôlé côté serveur, l'interface
 * ne fait que masquer le formulaire).
 */
function MessagesSyndicView() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'ADMIN' || user?.role === 'SUPERADMIN';

  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [comments, setComments] = useState<Record<string, AnnouncementComment[]>>({});
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [sending, setSending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [formOpen, setFormOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [publishing, setPublishing] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await api<{ announcements: Announcement[] }>('/announcements');
      setAnnouncements(data.announcements);
      // Commentaires du ou des messages (dépliés d'office : c'est le cœur de la page).
      const entries = await Promise.all(
        data.announcements.map(async (announcement) => {
          try {
            const result = await api<{ comments: AnnouncementComment[] }>(
              `/announcements/${announcement.id}/comments`,
            );
            return [announcement.id, result.comments] as const;
          } catch {
            return [announcement.id, [] as AnnouncementComment[]] as const;
          }
        }),
      );
      setComments(Object.fromEntries(entries));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Chargement impossible');
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
    setPublishing(true);
    setError(null);
    try {
      await api('/announcements', {
        method: 'POST',
        body: JSON.stringify({ title: title.trim(), body: body.trim() }),
      });
      setTitle('');
      setBody('');
      setFormOpen(false);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Publication impossible');
    } finally {
      setPublishing(false);
    }
  };

  const comment = async (announcementId: string) => {
    const content = (drafts[announcementId] ?? '').trim();
    if (!content) return;
    setSending(announcementId);
    try {
      const result = await api<{ comment: AnnouncementComment }>(
        `/announcements/${announcementId}/comments`,
        { method: 'POST', body: JSON.stringify({ content }) },
      );
      setComments((prev) => ({
        ...prev,
        [announcementId]: [...(prev[announcementId] ?? []), result.comment],
      }));
      setDrafts((prev) => ({ ...prev, [announcementId]: '' }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Commentaire impossible');
    } finally {
      setSending(null);
    }
  };

  const remove = async (id: string) => {
    if (!window.confirm('Supprimer ce message prioritaire et ses commentaires ?')) return;
    try {
      await api(`/announcements/${id}`, { method: 'DELETE' });
      setAnnouncements((prev) => prev.filter((item) => item.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Suppression impossible');
    }
  };

  if (loading) return <Spinner label="Chargement des messages…" />;

  return (
    <section className="mx-auto max-w-3xl">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <SectionLabel color="blue">Canal officiel</SectionLabel>
          <h1 className="mt-1 font-display text-xl">Messages prioritaires</h1>
          <p className="mt-1 text-sm text-slate-500">
            Les annonces du syndic et de l&apos;agence : travaux, coupures, réunions.
            Tout le monde peut lire et commenter.
          </p>
        </div>
        {isAdmin && (
          <button
            type="button"
            onClick={() => setFormOpen((value) => !value)}
            className="btn-primary inline-flex items-center gap-2"
          >
            <Plus className="h-4 w-4" aria-hidden />
            Publier un message
          </button>
        )}
      </div>

      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

      {formOpen && isAdmin && (
        <div className="ds-card mt-4 space-y-3 p-4">
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Objet (ex. Réunion des copropriétaires le 12 octobre)"
            maxLength={120}
            className="input-field"
          />
          <textarea
            value={body}
            onChange={(event) => setBody(event.target.value)}
            placeholder="Message aux habitants…"
            rows={5}
            maxLength={4000}
            className="input-field"
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => void publish()}
              disabled={publishing}
              className="btn-primary inline-flex items-center gap-2 disabled:opacity-50"
            >
              <Send className="h-4 w-4" aria-hidden />
              {publishing ? 'Publication…' : 'Publier'}
            </button>
            <button
              type="button"
              onClick={() => setFormOpen(false)}
              className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700"
            >
              Annuler
            </button>
          </div>
        </div>
      )}

      {announcements.length === 0 ? (
        <div className="mt-4 rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center">
          <Megaphone className="mx-auto h-7 w-7 text-slate-300" aria-hidden />
          <p className="mt-3 text-sm font-medium text-slate-600">
            Aucun message prioritaire pour le moment
          </p>
          <p className="mx-auto mt-1 max-w-md text-sm text-slate-500">
            {isAdmin
              ? 'Publiez un premier message : il apparaîtra sur le tableau de bord de tous les habitants, qui pourront le commenter.'
              : 'Cet espace accueillera les annonces officielles de votre syndic ou de l’agence.'}
          </p>
        </div>
      ) : (
        <ul className="mt-4 space-y-4">
          {announcements.map((announcement) => {
            const list = comments[announcement.id] ?? [];
            return (
              <li key={announcement.id} className="ds-card p-5">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Megaphone className="h-4 w-4 shrink-0 text-brand-600" aria-hidden />
                      <h2 className="text-base font-bold text-slate-900">{announcement.title}</h2>
                      <span className="rounded-full bg-brand-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-brand-700">
                        {announcement.author.role === 'SUPERADMIN'
                          ? 'Plateforme'
                          : 'Syndic / agence'}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-slate-400">
                      {announcement.author.firstName} {announcement.author.lastName} ·{' '}
                      {formatRelativeDate(announcement.createdAt)}
                    </p>
                  </div>
                  {(isAdmin || announcement.author.id === user?.id) && (
                    <button
                      type="button"
                      onClick={() => void remove(announcement.id)}
                      title="Supprimer ce message"
                      className="shrink-0 rounded-lg border border-red-200 p-2 text-red-600 transition hover:bg-red-50"
                    >
                      <Trash2 className="h-4 w-4" aria-hidden />
                    </button>
                  )}
                </div>

                <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-slate-700">
                  {announcement.body}
                </p>

                <div className="mt-4 border-t border-slate-100 pt-3">
                  <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400">
                    <MessageCircle className="h-3.5 w-3.5" aria-hidden />
                    {list.length} commentaire{list.length > 1 ? 's' : ''}
                  </p>

                  {list.length > 0 && (
                    <ul className="mt-2 space-y-2">
                      {list.map((item) => (
                        <li key={item.id} className="rounded-xl bg-slate-50 px-3 py-2">
                          <p className="text-xs font-medium text-slate-500">
                            {item.author.firstName} {item.author.lastName}
                            {item.author.role === 'ADMIN' || item.author.role === 'SUPERADMIN'
                              ? ' · syndic'
                              : ''}
                            {' · '}
                            {formatRelativeDate(item.createdAt)}
                          </p>
                          <p className="mt-0.5 text-sm text-slate-700">{item.content}</p>
                        </li>
                      ))}
                    </ul>
                  )}

                  <div className="mt-3 flex gap-2">
                    <input
                      value={drafts[announcement.id] ?? ''}
                      onChange={(event) =>
                        setDrafts((prev) => ({ ...prev, [announcement.id]: event.target.value }))
                      }
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') void comment(announcement.id);
                      }}
                      placeholder="Écrire un commentaire…"
                      maxLength={1000}
                      className="input-field flex-1"
                    />
                    <button
                      type="button"
                      onClick={() => void comment(announcement.id)}
                      disabled={sending === announcement.id || !(drafts[announcement.id] ?? '').trim()}
                      className="btn-primary inline-flex items-center gap-1.5 disabled:opacity-50"
                    >
                      <Send className="h-4 w-4" aria-hidden />
                      <span className="hidden sm:inline">Envoyer</span>
                    </button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

export default function MessagesSyndicPage() {
  return (
    <RequireAccount>
      <MessagesSyndicView />
    </RequireAccount>
  );
}
