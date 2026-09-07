'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import { ErrorMessage } from '@/components/Feedback';
import api from '@/lib/api';

interface InvitationInfo {
  neighborhood: string;
  expiresAt: string;
  valid: boolean;
}

/**
 * Page d'atterrissage scannée via le QR code d'invitation :
 * affiche le résidence / la résidence, puis redirige vers l'inscription
 * avec le jeton (pré-remplissage automatique du périmètre).
 */
function RejoindreContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token') ?? '';

  const [invitation, setInvitation] = useState<InvitationInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) {
      setError('Lien d’invitation invalide : aucun jeton.');
      setLoading(false);
      return;
    }
    api<InvitationInfo>(`/invitations/${token}`)
      .then((data) => setInvitation(data))
      .catch((err) =>
        setError(err instanceof Error ? err.message : 'Invitation invalide'),
      )
      .finally(() => setLoading(false));
  }, [token]);

  if (loading) {
    return <p className="py-16 text-center text-slate-500">Vérification de l’invitation…</p>;
  }

  if (error || !invitation) {
    return (
      <div className="mx-auto max-w-md px-4 py-16">
        <div className="ds-card p-8 text-center">
          <div className="text-4xl">🤝</div>
          <h1 className="mt-3 text-xl font-bold text-slate-900">Invitation invalide</h1>
          <p className="mt-2 text-sm text-slate-600">{error ?? 'Jeton inconnu.'}</p>
        </div>
      </div>
    );
  }

  if (!invitation.valid) {
    return (
      <div className="mx-auto max-w-md px-4 py-16">
        <div className="ds-card p-8 text-center">
          <div className="text-4xl">⏳</div>
          <h1 className="mt-3 text-xl font-bold text-slate-900">Invitation expirée</h1>
          <p className="mt-2 text-sm text-slate-600">
            Ce lien a déjà été utilisé ou a expiré. Demandez-en un nouveau à votre voisin.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md px-4 py-16">
      <div className="ds-card p-8 text-center">
        <div className="text-4xl">🏘️</div>
        <h1 className="mt-3 text-2xl font-bold text-slate-900">Bienvenue dans votre résidence !</h1>
        <p className="mt-2 text-sm text-slate-600">
          Un voisin vous invite à rejoindre <strong className="text-slate-900">{invitation.neighborhood}</strong>{' '}
          sur Proximo : prêt de matériel, entraide, dons…
        </p>
        <div className="mt-6 flex flex-col gap-3">
          <Link
            href={`/inscription?invitationToken=${token}`}
            className="btn-primary"
          >
            Créer mon compte
          </Link>
          <Link
            href={`/connexion?invitationToken=${token}`}
            className="rounded-lg border border-slate-300 px-4 py-3 font-medium text-slate-700 hover:bg-slate-50"
          >
            J&apos;ai déjà un compte
          </Link>
        </div>
        <ErrorMessage message={error} />
      </div>
    </div>
  );
}

export default function RejoindrePage() {
  return (
    <Suspense fallback={null}>
      <RejoindreContent />
    </Suspense>
  );
}
