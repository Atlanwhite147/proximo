'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import api from '@/lib/api';
import { ErrorMessage, SuccessMessage } from '@/components/Feedback';
import { Spinner } from '@/components/Feedback';

/**
 * Assistant d'installation (premier lancement).
 * Affiché uniquement tant qu'aucun administrateur n'existe
 * (GET /setup/status → required). Sinon, redirection vers l'accueil.
 */
type Step = 'account' | 'residence' | 'done';

export default function InstallPage() {
  const [status, setStatus] = useState<'loading' | 'required' | 'done' | 'error'>('loading');
  const [step, setStep] = useState<Step>('account');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Étape 1 : compte administrateur
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');

  // Étape 2 : résidence
  const [residenceName, setResidenceName] = useState('');
  const [agencyName, setAgencyName] = useState('');
  const [syndicEmail, setSyndicEmail] = useState('');

  useEffect(() => {
    api<{ required: boolean }>('/setup/status')
      .then((data) => setStatus(data.required ? 'required' : 'done'))
      .catch(() => setStatus('error'));
  }, []);

  if (status === 'loading') {
    return (
      <div className="mx-auto max-w-md py-16 text-center">
        <Spinner label="Vérification de l’installation…" />
      </div>
    );
  }

  if (status === 'done') {
    return (
      <div className="mx-auto max-w-md ds-card p-8 text-center">
        <p className="text-3xl">✅</p>
        <h1 className="mt-2 text-xl font-bold text-slate-900">Déjà installé</h1>
        <p className="mt-2 text-sm text-slate-500">
          Un administrateur existe déjà. L’assistant d’installation n’est plus disponible.
        </p>
        <Link
          href="/"
          className="btn-primary-sm rounded-xl px-5 mt-5"
        >
          Retour à l’accueil
        </Link>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="mx-auto max-w-md rounded-2xl border border-red-200 bg-red-50 p-8 text-center">
        <p className="font-semibold text-red-700">Impossible de vérifier l’installation</p>
        <p className="mt-2 text-sm text-red-600/80">
          Vérifiez que le serveur est bien démarré puis rechargez la page.
        </p>
      </div>
    );
  }

  const handleAccountSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    if (adminPassword.length < 8) {
      setError('Le mot de passe doit contenir au moins 8 caractères.');
      return;
    }
    setStep('residence');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleComplete = async (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await api('/setup/complete', {
        method: 'POST',
        body: JSON.stringify({
          adminEmail,
          adminPassword,
          firstName,
          lastName,
          residenceName,
          agencyName,
          syndicEmail,
        }),
      });
      setStep('done');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Installation impossible');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-slate-900">Bienvenue sur Proximo 🎉</h1>
        <p className="mt-1 text-sm text-slate-500">
          Quelques informations pour configurer votre résidence, moins de 2 minutes.
        </p>
      </div>

      {/* Indicateur d'étapes */}
      <ol className="flex items-center justify-center gap-2 text-xs font-medium">
        {(
          [
            ['account', 'Compte admin'],
            ['residence', 'Votre résidence'],
            ['done', 'Terminé'],
          ] as [Step, string][]
        ).map(([id, label], index) => (
          <li key={id} className="flex items-center gap-2">
            {index > 0 && <span className="text-slate-300">→</span>}
            <span
              className={`rounded-full px-3 py-1 ${
                step === id
                  ? 'bg-brand-600 text-white'
                  : ['residence', 'done'].includes(step) &&
                      (id === 'account' || (step === 'done' && id === 'residence'))
                    ? 'bg-brand-100 text-brand-700'
                    : 'bg-slate-100 text-slate-400'
              }`}
            >
              {label}
            </span>
          </li>
        ))}
      </ol>

      {step === 'account' && (
        <form
          onSubmit={handleAccountSubmit}
          className="space-y-4 ds-card p-6"
        >
          <h2 className="font-semibold text-slate-900">👑 Compte administrateur</h2>
          <p className="text-sm text-slate-500">
            C&apos;est le compte qui gérera la résidence (validation des voisins, signalements,
            invitations).
          </p>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="firstName" className="mb-1 block text-sm font-medium text-slate-700">
                Prénom
              </label>
              <input
                id="firstName"
                type="text"
                value={firstName}
                onChange={(event) => setFirstName(event.target.value)}
                required
                maxLength={50}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
              />
            </div>
            <div>
              <label htmlFor="lastName" className="mb-1 block text-sm font-medium text-slate-700">
                Nom
              </label>
              <input
                id="lastName"
                type="text"
                value={lastName}
                onChange={(event) => setLastName(event.target.value)}
                required
                maxLength={50}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label htmlFor="adminEmail" className="mb-1 block text-sm font-medium text-slate-700">
              Adresse email
            </label>
            <input
              id="adminEmail"
              type="email"
              value={adminEmail}
              onChange={(event) => setAdminEmail(event.target.value)}
              required
              placeholder="vous@exemple.fr"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
            />
          </div>

          <div>
            <label htmlFor="adminPassword" className="mb-1 block text-sm font-medium text-slate-700">
              Mot de passe
            </label>
            <input
              id="adminPassword"
              type="password"
              value={adminPassword}
              onChange={(event) => setAdminPassword(event.target.value)}
              required
              minLength={8}
              maxLength={128}
              placeholder="8 caractères minimum, avec majuscule et chiffre"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
            />
            <p className="mt-1 text-xs text-slate-400">
              Au moins 8 caractères, une majuscule et un chiffre. Vous pourrez activer la
              double authentification (2FA) plus tard dans le back-office.
            </p>
          </div>

          <ErrorMessage message={error} />
          <button
            type="submit"
            className="btn-primary"
          >
            Continuer →
          </button>
        </form>
      )}

      {step === 'residence' && (
        <form
          onSubmit={(event) => void handleComplete(event)}
          className="space-y-4 ds-card p-6"
        >
          <h2 className="font-semibold text-slate-900">🏢 Votre résidence</h2>
          <p className="text-sm text-slate-500">
            Ces informations s&apos;afficheront partout dans l&apos;application et serviront à
            contacter le syndic ou l&apos;agence lors des signalements.
          </p>

          <div>
            <label htmlFor="residenceName" className="mb-1 block text-sm font-medium text-slate-700">
              Nom de la résidence *
            </label>
            <input
              id="residenceName"
              type="text"
              value={residenceName}
              onChange={(event) => setResidenceName(event.target.value)}
              required
              maxLength={120}
              placeholder="Ex. Les Lilas, Le Clos Vert…"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="agencyName" className="mb-1 block text-sm font-medium text-slate-700">
                Agence / syndic (optionnel)
              </label>
              <input
                id="agencyName"
                type="text"
                value={agencyName}
                onChange={(event) => setAgencyName(event.target.value)}
                maxLength={120}
                placeholder="Ex. Foncia Gerland"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
              />
            </div>
            <div>
              <label htmlFor="syndicEmail" className="mb-1 block text-sm font-medium text-slate-700">
                Email du syndic (optionnel)
              </label>
              <input
                id="syndicEmail"
                type="email"
                value={syndicEmail}
                onChange={(event) => setSyndicEmail(event.target.value)}
                maxLength={254}
                placeholder="syndic@agence.fr"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => setStep('account')}
              className="rounded-xl border border-slate-300 px-5 py-3 text-sm font-semibold text-slate-600 hover:bg-slate-50"
            >
              ← Retour
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="btn-primary flex-1"
            >
              {submitting ? 'Installation en cours…' : 'Installer Proximo ✓'}
            </button>
          </div>

          <ErrorMessage message={error} />
        </form>
      )}

      {step === 'done' && (
        <div className="ds-card p-8 text-center">
          <p className="text-4xl">🎉</p>
          <h2 className="mt-3 text-xl font-bold text-slate-900">
            Proximo est installé !
          </h2>
          <p className="mt-2 text-sm text-slate-500">
            Votre résidence « <strong>{residenceName}</strong> » est prête. Connectez-vous avec
            votre compte administrateur pour inviter vos voisins.
          </p>
          <Link
            href="/connexion"
            className="btn-primary-sm rounded-xl px-6 mt-5"
          >
            Se connecter
          </Link>
        </div>
      )}
    </div>
  );
}
