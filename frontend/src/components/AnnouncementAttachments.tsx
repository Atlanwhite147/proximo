'use client';

import { FileText, Paperclip } from 'lucide-react';
import { formatFileSize } from '@/lib/format';
import type { AnnouncementAttachment } from '@/lib/types';

type Props = {
  announcementId: string;
  attachments?: AnnouncementAttachment[];
  /** Affiche les images en vignettes (page dédiée) ou en version compacte. */
  compact?: boolean;
};

/** URL de service d'une pièce jointe (protégée : session + même résidence). */
export function attachmentUrl(announcementId: string, attachmentId: string): string {
  return `/api/announcements/${announcementId}/attachments/${attachmentId}`;
}

/**
 * Pièces jointes d'une annonce officielle : images en vignettes cliquables,
 * documents (PDF) en lien avec icône. Le fichier est servi par l'API, donc
 * réservé aux habitants connectés de la résidence.
 */
export function AnnouncementAttachments({ announcementId, attachments, compact }: Props) {
  if (!attachments || attachments.length === 0) return null;

  const images = attachments.filter((file) => file.mimeType.startsWith('image/'));
  const documents = attachments.filter((file) => !file.mimeType.startsWith('image/'));

  return (
    <div className="mt-3 space-y-2">
      {images.length > 0 && (
        <div className={`flex flex-wrap gap-2 ${compact ? '' : 'sm:gap-3'}`}>
          {images.map((file) => (
            <a
              key={file.id}
              href={attachmentUrl(announcementId, file.id)}
              target="_blank"
              rel="noopener noreferrer"
              title={file.filename}
              className={`group relative block overflow-hidden rounded-xl border border-slate-200 bg-slate-50 ${
                compact ? 'h-20 w-20' : 'h-28 w-28 sm:h-32 sm:w-32'
              }`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={attachmentUrl(announcementId, file.id)}
                alt={file.filename}
                loading="lazy"
                className="h-full w-full object-cover transition group-hover:scale-[1.03]"
              />
            </a>
          ))}
        </div>
      )}

      {documents.length > 0 && (
        <ul className="space-y-1.5">
          {documents.map((file) => (
            <li key={file.id}>
              <a
                href={attachmentUrl(announcementId, file.id)}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex max-w-full items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 transition hover:border-brand-200 hover:bg-brand-50/50"
              >
                {file.mimeType === 'application/pdf' ? (
                  <FileText className="h-4 w-4 shrink-0 text-red-500" aria-hidden />
                ) : (
                  <Paperclip className="h-4 w-4 shrink-0 text-slate-500" aria-hidden />
                )}
                <span className="truncate font-medium">{file.filename}</span>
                <span className="shrink-0 text-xs text-slate-400">{formatFileSize(file.size)}</span>
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
