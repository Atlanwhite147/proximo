'use client';

import { useState } from 'react';
import Link from 'next/link';

/**
 * Mot de passe oublié : demande un lien de réinitialisation par email.
 * La réponse est générique (que le compte existe ou non) pour ne pas
 * révéler quelles adresses sont inscrites.
 */
export default function MotDePasseOubliePage() {
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const response = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(data.message?.[0] ?? data.message ?? 'Une erreur est survenue. Réessayez dans un instant.');
        setSubmitting(false);
        return;
      }
      setDone(true);
    } catch {
      setError('Une erreur est survenue. Réessayez dans un instant.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-4 py-12">
      <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        {done ? (
          <div className="text-center">
            <div className="text-4xl">📬</div>
            <h1 className="mt-3 text-xl font-bold text-slate-900">Email envoyé</h1>
            <p className="mt-3 text-sm leading-relaxed text-slate-600">
              Si un compte existe avec cette adresse et un mot de passe, un lien de
              réinitialisation vient de vous être envoyé. Il est valable 1 heure.
            </p>
            <p className="mt-2 text-xs text-slate-400">
              Pensez à vérifier vos courriers indésirables.
            </p>
            <Link
              href="/connexion"
              className="mt-6 inline-block rounded-xl bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-700"
            >
              Retour à la connexion
            </Link>
          </div>
        ) : (
          <>
            <h1 className="text-xl font-bold text-slate-900">Mot de passe oublié</h1>
            <p className="mt-2 text-sm text-slate-600">
              Saisissez l&apos;adresse email de votre compte : nous vous enverrons un lien
              pour choisir un nouveau mot de passe.
            </p>

            {error && (
              <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="mt-6 space-y-4">
              <div>
                <label htmlFor="email" className="mb-1 block text-sm font-medium text-slate-700">
                  Adresse email
                </label>
                <input
                  id="email"
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"
                  placeholder="vous@exemple.fr"
                />
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full rounded-xl bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
              >
                {submitting ? 'Envoi…' : 'Envoyer le lien'}
              </button>
            </form>

            <p className="mt-6 text-center text-sm text-slate-600">
              <Link href="/connexion" className="font-semibold text-brand-600 hover:underline">
                ← Retour à la connexion
              </Link>
            </p>
          </>
        )}
      </div>
    </div>
  );
}
