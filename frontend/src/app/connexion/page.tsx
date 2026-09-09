'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { ErrorMessage } from '@/components/Feedback';
import { GoogleButton } from '@/components/GoogleButton';
import api from '@/lib/api';
import type { User } from '@/lib/types';

/**
 * Connexion — Sprint 2 :
 * - « Se souvenir de moi » (refresh token longue durée, cookie HTTP-only)
 * - « Continuer avec Google » (OAuth2 / OpenID Connect)
 * - Étape 2FA TOTP pour les administrateurs (code à 6 chiffres)
 */
function ConnexionForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  // Anti-redirection ouverte : `next` doit être un chemin interne (commence
  // par `/`, mais pas `//` ni `/\`), jamais une URL absolue.
  const rawNext = searchParams.get('next') ?? '/';
  const next =
    rawNext.startsWith('/') && !rawNext.startsWith('//') && !rawNext.startsWith('/\\')
      ? rawNext
      : '/';
  const needsTwoFactor = searchParams.get('2fa') === '1';
  const googleError = searchParams.get('error') === 'google';
  const codeError = searchParams.get('error') === 'code';
  const { setUser, refresh } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [twoFactorCode, setTwoFactorCode] = useState('');
  const [showTwoFactor, setShowTwoFactor] = useState(needsTwoFactor);
  const [error, setError] = useState<string | null>(
    codeError
      ? 'Code de résidence invalide. Demandez-le à votre syndic ou à un voisin.'
      : googleError
        ? 'La connexion Google a échoué. Réessayez.'
        : null,
  );
  const [submitting, setSubmitting] = useState(false);

  // Après le callback Google avec 2FA, le cookie two_factor_token est posé.
  useEffect(() => {
    if (needsTwoFactor) setShowTwoFactor(true);
  }, [needsTwoFactor]);

  const handleLogin = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const data = await api<{ user: User; requiresTwoFactor?: boolean }>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password, rememberMe }),
      });
      if (data.requiresTwoFactor) {
        setShowTwoFactor(true);
        return;
      }
      setUser(data.user);
      void refresh();
      router.push(next);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Connexion impossible');
    } finally {
      setSubmitting(false);
    }
  };

  const handleTwoFactor = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const data = await api<{ user: User }>('/auth/2fa/verify-login', {
        method: 'POST',
        body: JSON.stringify({ code: twoFactorCode }),
      });
      setUser(data.user);
      void refresh();
      router.push(next);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Code invalide');
    } finally {
      setSubmitting(false);
    }
  };

  const handleGoogle = () => {
    // L'API répond par l'URL d'autorisation Google (le state anti-CSRF
    // est posé en cookie HTTP-only côté serveur).
    api<{ url: string }>('/auth/google')
      .then((data) => {
        window.location.href = data.url;
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Google indisponible'));
  };

  if (showTwoFactor) {
    return (
      <div className="mx-auto max-w-md px-4 py-12">
        <div className="glow-bg rounded-3xl border border-border bg-card p-8 shadow-card">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-gradient text-2xl text-white shadow-glow">
            🔐
          </div>
          <h1 className="mt-5 font-display text-3xl font-normal text-foreground">
            Double authentification
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            Saisissez le code à 6 chiffres de votre application
            d&apos;authentification (Google Authenticator, Authy…).
          </p>
          <form onSubmit={(event) => void handleTwoFactor(event)} className="mt-6 space-y-4">
            <input
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              required
              maxLength={6}
              pattern="\d{6}"
              value={twoFactorCode}
              onChange={(event) => setTwoFactorCode(event.target.value)}
              placeholder="123456"
              className="input-field text-center text-2xl tracking-[0.5em] "
            />
            <ErrorMessage message={error} />
            <button
              type="submit"
              disabled={submitting || twoFactorCode.length !== 6}
              className="btn-primary"
            >
              {submitting ? 'Vérification…' : 'Vérifier et me connecter'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md px-4 py-12">
      <div className="glow-bg rounded-3xl border border-border bg-card p-8 shadow-card">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-gradient text-2xl text-white shadow-glow">
          🤝
        </div>
        <h1 className="mt-5 font-display text-3xl font-normal text-foreground">Connexion</h1>
        <p className="mt-1 text-sm text-muted-foreground">Heureux de vous revoir 👋</p>

        <GoogleButton />

        <div className="my-5 flex items-center gap-3 text-xs text-muted-foreground">
          <span className="h-px flex-1 bg-border" />
          ou avec votre adresse email
          <span className="h-px flex-1 bg-border" />
        </div>

        <form onSubmit={(event) => void handleLogin(event)} className="space-y-4">
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
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Mot de passe"
            className="input-field "
          />
          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2 text-sm text-slate-600">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(event) => setRememberMe(event.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-brand-600"
              />
              Se souvenir de moi (90 jours)
            </label>
            <Link
              href="/mot-de-passe-oublie"
              className="text-sm font-medium text-brand-600 hover:underline"
            >
              Mot de passe oublié ?
            </Link>
          </div>
          <ErrorMessage message={error} />
          <button
            type="submit"
            disabled={submitting}
            className="btn-primary"
          >
            {submitting ? 'Connexion…' : 'Se connecter'}
          </button>
        </form>

        <p className="mt-5 text-center text-sm text-slate-600">
          Pas encore de compte ?{' '}
          <Link href="/inscription" className="font-semibold text-brand-600 hover:underline">
            Inscrivez-vous
          </Link>
        </p>
      </div>
    </div>
  );
}

export default function ConnexionPage() {
  return (
    <Suspense fallback={null}>
      <ConnexionForm />
    </Suspense>
  );
}
