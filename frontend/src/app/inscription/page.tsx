'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { ErrorMessage } from '@/components/Feedback';
import { GoogleButton } from '@/components/GoogleButton';
import api from '@/lib/api';
import type { User } from '@/lib/types';

/**
 * Inscription — Sprint 2 :
 * - jeton d'invitation optionnel (QR / lien de voisin) : le résidence est
 *   pré-rempli et le jeton est consommé (usage unique) côté serveur.
 * - les nouveaux comptes sont PENDING jusqu'à validation par un admin
 *   (sauf emails déclarés administrateurs).
 */
function InscriptionForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const invitationToken = searchParams.get('invitationToken') ?? '';
  const { setUser, refresh } = useAuth();

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [neighborhood, setNeighborhood] = useState('');
  const [building, setBuilding] = useState('');
  const [floor, setFloor] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [pending, setPending] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const data = await api<{ user: User }>('/auth/register', {
        method: 'POST',
        body: JSON.stringify({
          firstName,
          lastName,
          email,
          password,
          neighborhood: neighborhood || undefined,
          building: building || undefined,
          floor: floor || undefined,
          invitationToken: invitationToken || undefined,
        }),
      });
      setUser(data.user);
      void refresh();
      if (data.user.status === 'PENDING') {
        setPending(true);
        return;
      }
      router.push('/');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Inscription impossible');
    } finally {
      setSubmitting(false);
    }
  };

  if (pending) {
    return (
      <div className="mx-auto max-w-md px-4 py-16">
        <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <div className="text-4xl">⏳</div>
          <h1 className="mt-3 text-xl font-bold text-slate-900">Compte en attente de validation</h1>
          <p className="mt-2 text-sm text-slate-600">
            Un administrateur doit valider votre inscription avant que vous puissiez
            déposer des annonces ou écrire à vos voisins. Vous serez notifié par email.
          </p>
          <Link
            href="/"
            className="mt-6 inline-block rounded-lg bg-brand-600 px-4 py-3 font-semibold text-white hover:bg-brand-700"
          >
            Revenir à l&apos;accueil
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md px-4 py-12">
      <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <h1 className="text-2xl font-bold text-slate-900">Inscription</h1>
        <p className="mt-1 text-sm text-slate-600">
          {invitationToken
            ? 'Rejoignez votre résidence 🏢'
            : 'Entraide et partage de proximité 🤝'}
        </p>

        <GoogleButton label="S'inscrire avec Google" />

        <div className="my-5 flex items-center gap-3 text-xs text-slate-400">
          <span className="h-px flex-1 bg-slate-200" />
          ou créer un compte par email
          <span className="h-px flex-1 bg-slate-200" />
        </div>

        <form onSubmit={(event) => void handleSubmit(event)} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <input
              type="text"
              required
              minLength={2}
              maxLength={50}
              autoComplete="given-name"
              value={firstName}
              onChange={(event) => setFirstName(event.target.value)}
              placeholder="Prénom"
              className="w-full rounded-lg border border-slate-300 px-4 py-3 focus:border-brand-500 focus:outline-none"
            />
            <input
              type="text"
              required
              minLength={2}
              maxLength={50}
              autoComplete="family-name"
              value={lastName}
              onChange={(event) => setLastName(event.target.value)}
              placeholder="Nom"
              className="w-full rounded-lg border border-slate-300 px-4 py-3 focus:border-brand-500 focus:outline-none"
            />
          </div>
          <input
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="vous@exemple.fr"
            className="w-full rounded-lg border border-slate-300 px-4 py-3 focus:border-brand-500 focus:outline-none"
          />
          <input
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Mot de passe (8 caractères min.)"
            className="w-full rounded-lg border border-slate-300 px-4 py-3 focus:border-brand-500 focus:outline-none"
          />
          <input
            type="text"
            required
            maxLength={120}
            value={neighborhood}
            onChange={(event) => setNeighborhood(event.target.value)}
            placeholder="Résidence / immeuble (ex. Les Cèdres)"
            className="w-full rounded-lg border border-slate-300 px-4 py-3 focus:border-brand-500 focus:outline-none"
          />
          <div className="grid grid-cols-2 gap-3">
            <input
              type="text"
              maxLength={20}
              value={building}
              onChange={(event) => setBuilding(event.target.value)}
              placeholder="Bâtiment (ex. B, optionnel)"
              className="w-full rounded-lg border border-slate-300 px-4 py-3 focus:border-brand-500 focus:outline-none"
            />
            <input
              type="text"
              maxLength={20}
              value={floor}
              onChange={(event) => setFloor(event.target.value)}
              placeholder="Étage (ex. 3e, optionnel)"
              className="w-full rounded-lg border border-slate-300 px-4 py-3 focus:border-brand-500 focus:outline-none"
            />
          </div>
          <p className="text-xs text-slate-400">
            Bâtiment et étage : facultatifs, pour aider vos voisins à vous trouver (cela peut être
            masqué sur vos publications depuis votre profil).
          </p>
          <ErrorMessage message={error} />
          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-lg bg-brand-600 px-4 py-3 font-semibold text-white shadow-sm hover:bg-brand-700 disabled:opacity-50"
          >
            {submitting ? 'Création…' : 'Créer mon compte'}
          </button>
        </form>

        <p className="mt-5 text-center text-sm text-slate-600">
          Déjà inscrit ?{' '}
          <Link href="/connexion" className="font-semibold text-brand-600 hover:underline">
            Connectez-vous
          </Link>
        </p>
      </div>
    </div>
  );
}

export default function InscriptionPage() {
  return (
    <Suspense fallback={null}>
      <InscriptionForm />
    </Suspense>
  );
}
