'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { ErrorMessage, Spinner } from '@/components/Feedback';
import api from '@/lib/api';
import { formatRelativeDate } from '@/lib/format';
import type { Comment } from '@/lib/types';

/**
 * Fil de discussion public attaché à une annonce ou un signalement.
 * Réutilisable : `type="listing"` ou `type="incident"` + l'id de la cible.
 * Les commentaires sont visibles par tous les habitants (statut ACTIVE).
 */
export function Comments({
  type,
  targetId,
}: {
  type: 'listing' | 'incident';
  targetId: string;
}) {
  const { user, isAdmin } = useAuth();
  const [comments, setComments] = useState<Comment[] | null>(null);
  const [content, setContent] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  const load = useCallback(() => {
    api<{ comments: Comment[] }>(`/comments/${type}/${targetId}`)
      .then((data) => setComments(data.comments))
      .catch(() => setComments([]));
  }, [type, targetId]);

  useEffect(() => {
    setComments(null);
    load();
  }, [load]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!content.trim() || !user) return;
    setSending(true);
    setError(null);
    try {
      const data = await api<{ comment: Comment }>('/comments', {
        method: 'POST',
        body: JSON.stringify({
          ...(type === 'listing' ? { listingId: targetId } : { incidentId: targetId }),
          content: content.trim(),
        }),
      });
      setComments((current) => [...(current ?? []), data.comment]);
      setContent('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Publication impossible');
    } finally {
      setSending(false);
    }
  };

  const remove = async (commentId: string) => {
    if (!window.confirm('Supprimer ce commentaire ?')) return;
    try {
      await api(`/comments/${commentId}`, { method: 'DELETE' });
      setComments((current) => (current ?? []).filter((c) => c.id !== commentId));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Suppression impossible');
    }
  };

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="font-semibold text-slate-900">💬 Discussion</h2>
      <p className="mt-0.5 text-sm text-slate-500">
        Questions, précisions et retours, visibles par les habitants.
      </p>

      {comments === null ? (
        <div className="py-4">
          <Spinner label="Chargement des commentaires…" />
        </div>
      ) : (
        <ul className="mt-4 space-y-3">
          {comments.map((comment) => (
            <li key={comment.id} className="rounded-xl bg-slate-50 px-4 py-3">
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm font-semibold text-slate-800">
                  {comment.author.firstName} {comment.author.lastName}
                  <span className="ml-2 text-xs font-normal text-slate-400">
                    {formatRelativeDate(comment.createdAt)}
                  </span>
                </p>
                {(user?.id === comment.author.id || isAdmin) && (
                  <button
                    type="button"
                    onClick={() => void remove(comment.id)}
                    className="text-xs font-medium text-slate-400 hover:text-red-500"
                    aria-label="Supprimer le commentaire"
                  >
                    Supprimer
                  </button>
                )}
              </div>
              <p className="mt-1 whitespace-pre-line text-sm text-slate-700">{comment.content}</p>
            </li>
          ))}
          {comments.length === 0 && (
            <p className="rounded-xl border border-dashed border-slate-200 p-4 text-center text-sm text-slate-400">
              Aucun commentaire pour le moment : soyez le premier à réagir !
            </p>
          )}
        </ul>
      )}

      {user ? (
        <form onSubmit={(event) => void submit(event)} className="mt-4">
          <textarea
            value={content}
            onChange={(event) => setContent(event.target.value)}
            rows={2}
            maxLength={1000}
            required
            placeholder="Écrire un commentaire…"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
          />
          <ErrorMessage message={error} />
          <div className="mt-2 flex justify-end">
            <button
              type="submit"
              disabled={sending || !content.trim()}
              className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
            >
              {sending ? 'Envoi…' : 'Commenter'}
            </button>
          </div>
        </form>
      ) : (
        <p className="mt-4 text-sm text-slate-500">
          Connectez-vous pour participer à la discussion.
        </p>
      )}
    </section>
  );
}
