'use client';

import { useEffect, useState } from 'react';
import { Megaphone, Send, X } from 'lucide-react';
import api from '@/lib/api';
import type { Announcement } from '@/lib/types';

type Props = {
  /** Annonce à modifier ; `null`/absente = nouvelle annonce. */
  announcement?: Announcement | null;
  onClose: () => void;
  /** Recharge la liste après enregistrement. */
  onSaved: () => void | Promise<void>;
};

/**
 * Fenêtre de rédaction d'une annonce officielle (création ou modification).
 *
 * Volontairement séparée de la page : la saisie se fait au calme, dans une
 * fenêtre dédiée plutôt qu'un formulaire intercalé dans la liste. Fermeture
 * par Échap, par le bouton, ou par un clic sur le fond.
 */
export function AnnouncementFormModal({ announcement, onClose, onSaved }: Props) {
  const editing = Boolean(announcement);
  const [title, setTitle] = useState(announcement?.title ?? '');
  const [body, setBody] = useState(announcement?.body ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const save = async () => {
    if (!title.trim() || !body.trim()) {
      setError('Titre et message sont requis.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const payload = JSON.stringify({ title: title.trim(), body: body.trim() });
      if (editing && announcement) {
        await api(`/announcements/${announcement.id}`, { method: 'PATCH', body: payload });
      } else {
        await api('/announcements', { method: 'POST', body: payload });
      }
      await onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Enregistrement impossible');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/50 backdrop-blur-[2px] sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label={editing ? "Modifier l'annonce" : 'Nouvelle annonce officielle'}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-lg rounded-t-2xl bg-white p-5 shadow-xl sm:rounded-2xl">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
              <Megaphone className="h-4.5 w-4.5" aria-hidden />
            </span>
            <div>
              <h2 className="font-display text-lg leading-tight text-slate-900">
                {editing ? "Modifier l'annonce" : 'Nouvelle annonce'}
              </h2>
              <p className="text-xs text-slate-500">
                {editing
                  ? 'Les corrections sont visibles immédiatement par tous les habitants.'
                  : 'Visible par tous les habitants de la résidence.'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer"
            className="shrink-0 rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        </div>

        <div className="mt-4 space-y-3">
          <div>
            <label htmlFor="announcement-title" className="mb-1 block text-xs font-semibold text-slate-600">
              Objet
            </label>
            <input
              id="announcement-title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Ex. Coupure d'eau mardi matin"
              maxLength={120}
              className="input-field"
              autoFocus
            />
          </div>

          <div>
            <label htmlFor="announcement-body" className="mb-1 block text-xs font-semibold text-slate-600">
              Message
            </label>
            <textarea
              id="announcement-body"
              value={body}
              onChange={(event) => setBody(event.target.value)}
              placeholder="Travaux, coupure, réunion, consigne de sécurité…"
              rows={5}
              maxLength={4000}
              className="input-field h-auto py-3"
            />
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="flex items-center justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="h-11 shrink-0 rounded-xl border border-slate-300 px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              Annuler
            </button>
            <button
              type="button"
              onClick={() => void save()}
              disabled={busy}
              className="btn-primary-sm h-11 shrink-0 px-5"
            >
              <Send className="h-4 w-4" aria-hidden />
              {busy ? 'Enregistrement…' : editing ? 'Enregistrer' : 'Publier'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
