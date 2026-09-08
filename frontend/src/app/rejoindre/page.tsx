'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import { AddToHomeScreen } from '@/components/AddToHomeScreen';
import { ErrorMessage } from '@/components/Feedback';
import api from '@/lib/api';

interface InvitationInfo {
  neighborhood: string;
  residenceName: string;
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
      <div className="ds-card p-6 text-center sm:p-8">
        <div className="text-4xl">🏘️</div>
        <h1 className="mt-3 text-2xl font-bold text-slate-900">Bienvenue dans votre résidence !</h1>
        <p className="mt-2 text-sm text-slate-600">
          Un voisin vous invite à rejoindre <strong className="text-slate-900">{invitation.residenceName}</strong>{' '}
          sur Proximo : prêt de matériel, entraide, dons…
        </p>

        {/* Ce que permet Proximo */}
        <ul className="mt-5 space-y-2 rounded-xl border border-border bg-slate-50 p-4 text-left text-sm text-slate-700">
          <li className="flex gap-2.5">
            <span aria-hidden>📦</span>
            <span>Publier des annonces entre voisins (prêt, don, entraide).</span>
          </li>
          <li className="flex gap-2.5">
            <span aria-hidden>🚨</span>
            <span>Signaler un problème au syndic, avec photos.</span>
          </li>
          <li className="flex gap-2.5">
            <span aria-hidden>💬</span>
            <span>Échanger avec les habitants de la résidence.</span>
          </li>
        </ul>

        {/* Déroulement en 3 étapes */}
        <ol className="mt-5 flex flex-col gap-2 text-left text-sm sm:flex-row sm:items-stretch sm:gap-2 sm:text-center">
          {[
            ['1', 'Créez votre compte', 'Email ou Google, 2 minutes.'],
            ['2', 'Validation', 'Un administrateur de la résidence valide votre inscription.'],
            ['3', 'Accès direct', 'Ajoutez Proximo à l’écran d’accueil du téléphone.'],
          ].map(([step, title, detail]) => (
            <li
              key={step}
              className="flex-1 rounded-xl border border-border bg-white p-3 sm:flex sm:flex-col sm:items-center sm:justify-center"
            >
              <span className="mx-auto flex h-6 w-6 items-center justify-center rounded-full bg-brand-600 text-xs font-bold text-white">
                {step}
              </span>
              <span className="mt-1.5 block text-xs font-semibold text-slate-900">{title}</span>
              <span className="block text-xs text-muted-foreground">{detail}</span>
            </li>
          ))}
        </ol>

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

        <div className="mt-5">
          <AddToHomeScreen />
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
