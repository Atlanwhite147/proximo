'use client';

import { useState } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { ErrorMessage } from '@/components/Feedback';
import api from '@/lib/api';
import type { Invitation } from '@/lib/types';
import { RequireAccount } from '@/components/RequireAccount';


/**
 * Inviter un voisin de la résidence : lien partageable + QR code
 * à imprimer (affichage dans les parties communes).
 */
export default function InviterPage() {
  const { user } = useAuth();
  const [invitation, setInvitation] = useState<Invitation | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const create = async () => {
    setError(null);
    setSubmitting(true);
    try {
      const data = await api<Invitation>('/invitations', {
        method: 'POST',
        body: JSON.stringify({ neighborhood: user?.residenceName ?? user?.neighborhood ?? '', expiresInHours: 72 }),
      });
      setInvitation(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Création impossible');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <RequireAccount>
    <div className="mx-auto max-w-md px-4 py-8">
      <h1 className="text-2xl font-bold text-slate-900">Inviter un voisin</h1>
      <p className="mt-1 text-sm text-slate-600">
        Générez un lien d&apos;invitation pour{' '}
        <strong>{user?.residenceName ?? user?.neighborhood ?? 'votre résidence'}</strong>, partagez-le
        par message, ou imprimez le QR code pour l&apos;afficher dans les parties
        communes.
      </p>

      <ErrorMessage message={error} />

      {!invitation ? (
        <button
          type="button"
          onClick={() => void create()}
          disabled={submitting}
          className="btn-primary mt-6"
        >
          {submitting ? 'Génération…' : 'Générer l’invitation'}
        </button>
      ) : (
        <div className="mt-6 ds-card p-6 text-center">
          <img
            src={invitation.qrUrl}
            alt={`QR code d'invitation : ${invitation.neighborhood}`}
            width={200}
            height={200}
            className="mx-auto rounded-xl border border-slate-200"
          />
          <p className="mt-3 font-semibold text-slate-900">{invitation.neighborhood}</p>
          <p className="text-xs text-slate-400">
            Expire le {new Date(invitation.expiresAt).toLocaleDateString('fr-FR')} · usage unique
          </p>
          <a
            href={invitation.url}
            target="_blank"
            rel="noreferrer"
            className="mt-2 block break-all text-sm text-brand-600 hover:underline"
          >
            {invitation.url}
          </a>
          <button
            type="button"
            onClick={() => void navigator.clipboard.writeText(invitation.url)}
            className="mt-3 rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Copier le lien
          </button>
        </div>
      )}
    </div>
      </RequireAccount>
  );
}
