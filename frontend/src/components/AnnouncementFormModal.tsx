'use client';

import { useEffect, useRef, useState } from 'react';
import { FileText, Loader2, Megaphone, Paperclip, Send, Trash2, X } from 'lucide-react';
import api from '@/lib/api';
import { formatFileSize } from '@/lib/format';
import type { Announcement, AnnouncementAttachment } from '@/lib/types';
import { attachmentUrl } from '@/components/AnnouncementAttachments';

type Props = {
  /** Annonce à modifier ; `null`/absente = nouvelle annonce. */
  announcement?: Announcement | null;
  onClose: () => void;
  /** Recharge la liste après enregistrement. */
  onSaved: () => void | Promise<void>;
};

const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
const MAX_FILES = 5;
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 Mo par fichier

/**
 * Fenêtre de rédaction d'une annonce officielle (création ou modification),
 * pièces jointes comprises : photos ou PDF, 5 fichiers max, 10 Mo chacun.
 *
 * Volontairement séparée de la page : la saisie se fait au calme, dans une
 * fenêtre dédiée plutôt qu'un formulaire intercalé dans la liste. Fermeture par
 * Échap, par le bouton, ou par un clic sur le fond.
 */
export function AnnouncementFormModal({ announcement, onClose, onSaved }: Props) {
  const editing = Boolean(announcement);
  const [title, setTitle] = useState(announcement?.title ?? '');
  const [body, setBody] = useState(announcement?.body ?? '');
  const [files, setFiles] = useState<File[]>([]);
  const [existing, setExisting] = useState<AnnouncementAttachment[]>(
    announcement?.attachments ?? [],
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const totalFiles = existing.length + files.length;

  /** Ajoute les fichiers choisis en écartant ceux qui ne passent pas. */
  const addFiles = (list: FileList | null) => {
    if (!list || list.length === 0) return;
    const refused: string[] = [];
    const accepted: File[] = [];
    for (const file of Array.from(list)) {
      if (!ACCEPTED_TYPES.includes(file.type)) {
        refused.push(`${file.name} (format non accepté)`);
      } else if (file.size > MAX_FILE_SIZE) {
        refused.push(`${file.name} (plus de 10 Mo)`);
      } else {
        accepted.push(file);
      }
    }
    const room = Math.max(0, MAX_FILES - totalFiles);
    const kept = accepted.slice(0, room);
    if (accepted.length > kept.length) refused.push(`maximum ${MAX_FILES} pièces jointes`);
    if (kept.length > 0) setFiles((prev) => [...prev, ...kept]);
    setError(refused.length > 0 ? `Non ajouté : ${refused.join(', ')}` : null);
  };

  /** Retire une pièce jointe déjà en ligne (immédiat, avec confirmation). */
  const removeExisting = async (attachmentId: string) => {
    if (!announcement) return;
    if (!window.confirm('Retirer cette pièce jointe ?')) return;
    setRemovingId(attachmentId);
    setError(null);
    try {
      const result = await api<{ announcement: Announcement }>(
        `/announcements/${announcement.id}/attachments/${attachmentId}`,
        { method: 'DELETE' },
      );
      setExisting(result.announcement.attachments ?? []);
      await onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Retrait impossible');
    } finally {
      setRemovingId(null);
    }
  };

  const save = async () => {
    if (!title.trim() || !body.trim()) {
      setError('Titre et message sont requis.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      if (editing && announcement) {
        // Texte puis fichiers : deux appels, le texte reste modifiable seul.
        await api(`/announcements/${announcement.id}`, {
          method: 'PATCH',
          body: JSON.stringify({ title: title.trim(), body: body.trim() }),
        });
        if (files.length > 0) {
          const form = new FormData();
          for (const file of files) form.append('files', file);
          await api(`/announcements/${announcement.id}/attachments`, {
            method: 'POST',
            body: form,
          });
        }
      } else {
        const form = new FormData();
        form.append('title', title.trim());
        form.append('body', body.trim());
        for (const file of files) form.append('files', file);
        await api('/announcements', { method: 'POST', body: form });
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
      <div className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-2xl bg-white p-5 shadow-xl sm:rounded-2xl">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
              <Megaphone className="h-4 w-4" aria-hidden />
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
            <label
              htmlFor="announcement-title"
              className="mb-1 block text-xs font-semibold text-slate-600"
            >
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
            <label
              htmlFor="announcement-body"
              className="mb-1 block text-xs font-semibold text-slate-600"
            >
              Message
            </label>
            <textarea
              id="announcement-body"
              value={body}
              onChange={(event) => setBody(event.target.value)}
              placeholder="Travaux, coupure, réunion, consigne de sécurité…"
              rows={4}
              maxLength={4000}
              className="input-field h-auto py-3"
            />
          </div>

          {/* Pièces jointes : photos ou PDF, 5 max, 10 Mo par fichier. */}
          <div className="rounded-xl border border-slate-200 p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="flex items-center gap-1.5 text-xs font-semibold text-slate-600">
                <Paperclip className="h-3.5 w-3.5" aria-hidden />
                Pièces jointes
                {totalFiles > 0 && (
                  <span className="text-slate-400">
                    ({totalFiles}/{MAX_FILES})
                  </span>
                )}
              </p>
              <button
                type="button"
                onClick={() => fileInput.current?.click()}
                disabled={totalFiles >= MAX_FILES}
                className="shrink-0 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-40"
              >
                Ajouter un fichier
              </button>
              <input
                ref={fileInput}
                type="file"
                multiple
                accept="image/jpeg,image/png,image/webp,application/pdf,.jpg,.jpeg,.png,.webp,.pdf"
                className="hidden"
                onChange={(event) => {
                  addFiles(event.target.files);
                  event.target.value = '';
                }}
              />
            </div>
            <p className="mt-1 text-[11px] text-slate-400">
              Photos ou PDF, {MAX_FILES} fichiers max, 10 Mo chacun.
            </p>

            {existing.length > 0 && (
              <ul className="mt-2 space-y-1.5">
                {existing.map((file) => (
                  <li
                    key={file.id}
                    className="flex items-center gap-2 rounded-lg bg-slate-50 px-2.5 py-1.5"
                  >
                    {file.mimeType === 'application/pdf' ? (
                      <FileText className="h-4 w-4 shrink-0 text-red-500" aria-hidden />
                    ) : (
                      <Paperclip className="h-4 w-4 shrink-0 text-slate-500" aria-hidden />
                    )}
                    <a
                      href={announcement ? attachmentUrl(announcement.id, file.id) : '#'}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="min-w-0 flex-1 truncate text-xs font-medium text-slate-700 hover:underline"
                    >
                      {file.filename}
                    </a>
                    <span className="shrink-0 text-[11px] text-slate-400">
                      {formatFileSize(file.size)}
                    </span>
                    <button
                      type="button"
                      onClick={() => void removeExisting(file.id)}
                      disabled={removingId === file.id}
                      aria-label={`Retirer ${file.filename}`}
                      className="shrink-0 rounded-md p-1 text-red-600 transition hover:bg-red-50 disabled:opacity-40"
                    >
                      {removingId === file.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                      ) : (
                        <Trash2 className="h-3.5 w-3.5" aria-hidden />
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            )}

            {files.length > 0 && (
              <ul className="mt-2 space-y-1.5">
                {files.map((file, index) => (
                  <li
                    key={`${file.name}-${index}`}
                    className="flex items-center gap-2 rounded-lg bg-brand-50/60 px-2.5 py-1.5"
                  >
                    {file.type === 'application/pdf' ? (
                      <FileText className="h-4 w-4 shrink-0 text-red-500" aria-hidden />
                    ) : (
                      <Paperclip className="h-4 w-4 shrink-0 text-brand-600" aria-hidden />
                    )}
                    <span className="min-w-0 flex-1 truncate text-xs font-medium text-slate-700">
                      {file.name}
                    </span>
                    <span className="shrink-0 text-[11px] text-slate-400">
                      {formatFileSize(file.size)}
                    </span>
                    <button
                      type="button"
                      onClick={() => setFiles((prev) => prev.filter((_, i) => i !== index))}
                      aria-label={`Retirer ${file.name}`}
                      className="shrink-0 rounded-md p-1 text-slate-500 transition hover:bg-white"
                    >
                      <X className="h-3.5 w-3.5" aria-hidden />
                    </button>
                  </li>
                ))}
              </ul>
            )}
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
              {busy ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              ) : (
                <Send className="h-4 w-4" aria-hidden />
              )}
              {busy ? 'Enregistrement…' : editing ? 'Enregistrer' : 'Publier'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
