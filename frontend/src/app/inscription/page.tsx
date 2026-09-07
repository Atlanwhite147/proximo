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
  const [residenceCode, setResidenceCode] = useState('');
  const [building, setBuilding] = useState('');
  const [floor, setFloor] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [pending, setPending] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    // Le code de résidence est obligatoire (sauf via un lien d'invitation QR).
    if (!invitationToken && !residenceCode.trim()) {
      setError(
        'Saisissez le code de résidence. Demandez-le à votre syndic ou à un voisin.',
      );
      return;
    }
    setSubmitting(true);
    try {
      const data = await api<{ user: User }>('/auth/register', {
        method: 'POST',
        body: JSON.stringify({
          firstName,
          lastName,
          email,
          password,
          residenceCode: residenceCode.trim() || undefined,
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
        <div className="ds-card p-8 text-center">
          <div className="text-4xl">⏳</div>
          <h1 className="mt-3 text-xl font-bold text-slate-900">Compte en attente de validation</h1>
          <p className="mt-2 text-sm text-slate-600">
            Un administrateur doit valider votre inscription avant que vous puissiez
            déposer des annonces ou écrire à vos voisins. Vous serez notifié par email.
          </p>
          <Link
            href="/"
            className="btn-primary mt-6 inline-flex w-auto"
          >
            Revenir à l&apos;accueil
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md px-4 py-12">
      <div className="ds-card p-8">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-gradient text-2xl text-white shadow-glow">
          🤝
        </div>
        <h1 className="mt-4 font-display text-3xl font-normal text-foreground">Inscription</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {invitationToken
            ? 'Rejoignez votre résidence 🏢'
            : 'Entraide et partage de proximité 🤝'}
        </p>

        <form onSubmit={(event) => void handleSubmit(event)} className="mt-6 space-y-4">
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
              className="input-field "
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
              className="input-field "
            />
          </div>
          <input
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="vous@exemple.fr"
            className="input-field "
          />
          <input
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Mot de passe (8 caractères min.)"
            className="input-field "
          />
          {invitationToken ? (
            <div className="rounded-xl border border-primary-100 bg-primary-50 px-4 py-3 text-sm text-primary-700">
              🏢 Vous rejoignez la résidence via votre invitation.
            </div>
          ) : (
            <div>
              <input
                type="text"
                required
                maxLength={32}
                autoCapitalize="characters"
                value={residenceCode}
                onChange={(event) => setResidenceCode(event.target.value)}
                placeholder="Code de résidence (ex. GERLAND-2026)"
                className="input-field "
              />
              <p className="mt-1.5 text-xs text-muted-foreground">
                🔑 Le code vous a été donné par votre syndic ou un voisin.
              </p>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <input
              type="text"
              maxLength={20}
              value={building}
              onChange={(event) => setBuilding(event.target.value)}
              placeholder="Bâtiment (ex. B, optionnel)"
              className="input-field "
            />
            <input
              type="text"
              maxLength={20}
              value={floor}
              onChange={(event) => setFloor(event.target.value)}
              placeholder="Étage (ex. 3e, optionnel)"
              className="input-field "
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
            className="btn-primary"
          >
            {submitting ? 'Création…' : 'Créer mon compte'}
          </button>
        </form>

        <div className="my-5 flex items-center gap-3 text-xs text-slate-400">
          <span className="h-px flex-1 bg-slate-200" />
          ou continuer avec Google
          <span className="h-px flex-1 bg-slate-200" />
        </div>
        <GoogleButton
          label="S'inscrire avec Google"
          residenceCode={residenceCode.trim() || undefined}
          invitationToken={invitationToken || undefined}
          required={!invitationToken}
        />

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
