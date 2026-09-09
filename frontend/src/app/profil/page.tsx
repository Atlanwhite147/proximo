'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/components/AuthProvider';
import { ErrorMessage } from '@/components/Feedback';
import { formatLocation } from '@/lib/format';
import api from '@/lib/api';
import {
  CATEGORY_EMOJI,
  CATEGORY_LABELS,
  STATUS_LABELS,
  type Listing,
  type User,
} from '@/lib/types';
import { RequireAccount } from '@/components/RequireAccount';

/**
 * Profil : réglages de notification par email, double authentification
 * (administrateurs), et gestion de ses annonces.
 */
export default function ProfilPage() {
  const { user, refresh, isAdmin, logout } = useAuth();

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [building, setBuilding] = useState('');
  const [floor, setFloor] = useState('');
  const [showDetails, setShowDetails] = useState(true);
  const [showInDirectory, setShowInDirectory] = useState(true);
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [listings, setListings] = useState<Listing[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // 2FA
  const [totpSetup, setTotpSetup] = useState<{ secret: string; qrDataUrl: string } | null>(null);
  const [totpCode, setTotpCode] = useState('');
  const [totpEnabled, setTotpEnabled] = useState(false);

  useEffect(() => {
    if (!user) return;
    setFirstName(user.firstName);
    setLastName(user.lastName);
    setBuilding(user.building ?? '');
    setFloor(user.floor ?? '');
    setShowDetails(user.showDetails ?? true);
    setShowInDirectory(user.showInDirectory ?? true);
    setEmailNotifications(user.emailNotifications ?? true);
    setTotpEnabled(user.totpEnabled ?? false);
    api<{ listings: Listing[] }>('/listings/mine')
      .then((data) => setListings(data.listings))
      .catch(() => setListings([]));
  }, [user]);

  const handleSave = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setSuccess(null);
    try {
      const data = await api<{ user: User }>('/users/me', {
        method: 'PATCH',
        body: JSON.stringify({
          firstName,
          lastName,
          building,
          floor,
          showDetails,
          showInDirectory,
          emailNotifications,
        }),
      });
      setSuccess('Réglages enregistrés.');
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Enregistrement impossible');
    }
  };

  const startTwoFactor = async () => {
    setError(null);
    setSuccess(null);
    try {
      const data = await api<{ secret: string; qrDataUrl: string }>('/auth/2fa/setup', {
        method: 'POST',
      });
      setTotpSetup(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Configuration impossible');
    }
  };

  const confirmTwoFactor = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setSuccess(null);
    try {
      await api('/auth/2fa/confirm', {
        method: 'POST',
        body: JSON.stringify({ code: totpCode }),
      });
      setTotpSetup(null);
      setTotpCode('');
      setTotpEnabled(true);
      setSuccess('Double authentification activée ✓');
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Code incorrect');
    }
  };

  const disableTwoFactor = async () => {
    const code = window.prompt('Saisissez votre code actuel pour désactiver le 2FA :');
    if (!code) return;
    setError(null);
    setSuccess(null);
    try {
      await api('/auth/2fa/disable', {
        method: 'POST',
        body: JSON.stringify({ code }),
      });
      setTotpEnabled(false);
      setSuccess('Double authentification désactivée.');
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Code incorrect');
    }
  };

  const closeListing = async (id: string) => {
    setError(null);
    try {
      await api(`/listings/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'CLOSED' }),
      });
      setListings((current) =>
        current.map((listing) =>
          listing.id === id ? { ...listing, status: 'CLOSED' } : listing,
        ),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Action impossible');
    }
  };

  if (!user) {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center">
        <p className="text-slate-500">
          <Link href="/connexion" className="text-brand-600 hover:underline">
            Connectez-vous
          </Link>{' '}
          pour voir votre profil.
        </p>
      </div>
    );
  }

  return (
    <RequireAccount>
    <div className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="text-2xl font-bold text-slate-900">
        Bonjour, {user.firstName} 👋
      </h1>
      <p className="mt-1 text-sm text-slate-600">{user.email}</p>
      {(user.building || user.floor) && (
        <p className="mt-1 text-sm text-slate-500">
          📍 {[user.building && `Bâtiment ${user.building}`, user.floor && `étage ${user.floor}`].filter(Boolean).join(' · ')}
        </p>
      )}
      {user.status === 'PENDING' && (
        <p className="mt-3 rounded-xl bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800">
          ⏳ Votre compte est en attente de validation par un administrateur.
        </p>
      )}

      <div className="mt-6 grid gap-6 md:grid-cols-2">
        {/* ─── Réglages ─────────────────────────────────────── */}
        <section className="ds-card p-5">
          <h2 className="font-semibold text-slate-900">Réglages</h2>
          <form onSubmit={(event) => void handleSave(event)} className="mt-4 space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <input
                type="text"
                required
                value={firstName}
                onChange={(event) => setFirstName(event.target.value)}
                className="input-field h-11 "
              />
              <input
                type="text"
                required
                value={lastName}
                onChange={(event) => setLastName(event.target.value)}
                className="input-field h-11 "
              />
            </div>
            <div className="rounded-xl border border-border bg-slate-50 px-4 py-3">
              <p className="text-xs font-mono uppercase tracking-badge text-muted-foreground">
                🏢 Résidence
              </p>
              <p className="mt-0.5 text-sm font-medium text-foreground">
                {user?.residenceName ?? 'Non rattachée'}
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <input
                type="text"
                maxLength={20}
                value={building}
                onChange={(event) => setBuilding(event.target.value)}
                placeholder="Bâtiment (ex. B, optionnel)"
                className="input-field h-11 "
              />
              <input
                type="text"
                maxLength={20}
                value={floor}
                onChange={(event) => setFloor(event.target.value)}
                placeholder="Étage (ex. 3e, optionnel)"
                className="input-field h-11 "
              />
            </div>
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={showDetails}
                onChange={(event) => setShowDetails(event.target.checked)}
                className="rounded border-slate-300 text-brand-600 focus:ring-brand-500"
              />
              Afficher mon bâtiment et mon étage sur mes publications
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={showInDirectory}
                onChange={(event) => setShowInDirectory(event.target.checked)}
                className="rounded border-slate-300 text-brand-600 focus:ring-brand-500"
              />
              <span>
                Apparaître dans l&apos;annuaire des voisins
                <span className="block text-xs text-slate-400">
                  Décochez pour rester invisible dans l&apos;annuaire (les autres voisins
                  ne pourront pas vous écrire directement).
                </span>
              </span>
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={emailNotifications}
                onChange={(event) => setEmailNotifications(event.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-brand-600"
              />
              Recevoir les notifications par email (messages, statuts des signalements)
            </label>
            <ErrorMessage message={error} />
            {success && <p className="text-sm font-medium text-brand-600">{success}</p>}
            <button
              type="submit"
              className="btn-primary-sm px-5"
            >
              Enregistrer
            </button>
          </form>
        </section>

        {/* ─── Sécurité (2FA administrateur) ────────────────── */}
        {isAdmin && (
          <section className="ds-card p-5">
            <h2 className="font-semibold text-slate-900">Sécurité du compte admin</h2>
            <p className="mt-1 text-sm text-slate-500">
              Double authentification (TOTP : Google Authenticator, Authy…)
            </p>
            <div className="mt-4">
              {totpEnabled ? (
                <div className="flex items-center justify-between rounded-xl bg-brand-50 px-4 py-3">
                  <span className="text-sm font-medium text-brand-800">
                    ✅ 2FA active
                  </span>
                  <button
                    type="button"
                    onClick={() => void disableTwoFactor()}
                    className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50"
                  >
                    Désactiver
                  </button>
                </div>
              ) : totpSetup ? (
                <div className="space-y-3">
                  <p className="text-sm text-slate-600">
                    1. Scannez ce QR code avec votre application
                    d&apos;authentification :
                  </p>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={totpSetup.qrDataUrl}
                    alt="QR code TOTP"
                    width={160}
                    height={160}
                    className="mx-auto rounded-lg border border-slate-200"
                  />
                  <p className="break-all rounded-lg bg-slate-50 p-2 text-center font-mono text-xs text-slate-500">
                    {totpSetup.secret}
                  </p>
                  <p className="text-sm text-slate-600">
                    2. Saisissez le code à 6 chiffres pour confirmer :
                  </p>
                  <form onSubmit={(event) => void confirmTwoFactor(event)} className="flex gap-2">
                    <input
                      type="text"
                      inputMode="numeric"
                      required
                      maxLength={6}
                      pattern="\d{6}"
                      value={totpCode}
                      onChange={(event) => setTotpCode(event.target.value)}
                      placeholder="123456"
                      className="input-field h-11 flex-1 text-center tracking-[0.4em]"
                    />
                    <button
                      type="submit"
                      disabled={totpCode.length !== 6}
                      className="btn-primary-sm"
                    >
                      Activer
                    </button>
                  </form>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => void startTwoFactor()}
                  className="btn-primary-sm"
                >
                  Activer la double authentification
                </button>
              )}
            </div>
          </section>
        )}
      </div>

      {/* ─── Mes annonces ───────────────────────────────────── */}
      <section className="mt-8">
        <h2 className="text-lg font-semibold text-slate-900">Mes annonces</h2>
        {listings.length === 0 ? (
          <p className="mt-3 rounded-xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">
            Aucune annonce.{' '}
            <Link href="/annonces/nouvelle" className="text-brand-600 hover:underline">
              Déposez-en une
            </Link>
            .
          </p>
        ) : (
          <ul className="mt-3 space-y-3">
            {listings.map((listing) => (
              <li
                key={listing.id}
                className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
              >
                <div>
                  <p className="font-semibold text-slate-900">
                    {CATEGORY_EMOJI[listing.category]} {listing.title}
                  </p>
                  <p className="text-xs text-slate-400">
                    {CATEGORY_LABELS[listing.category]} ·{' '}
                    {formatLocation(
                      listing.residenceName,
                      listing.neighborhood,
                      listing.owner.building,
                      listing.owner.floor,
                      listing.owner.showDetails,
                    )}{' '}
                    · {STATUS_LABELS[listing.status]}
                  </p>
                </div>
                {listing.status !== 'CLOSED' && (
                  <button
                    type="button"
                    onClick={() => void closeListing(listing.id)}
                    className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                  >
                    Clôturer
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* ─── Zone dangereuse ────────────────────────────────── */}
      <section className="mt-8 rounded-2xl border border-red-200 bg-red-50/50 p-5">
        <h2 className="font-semibold text-red-700">Supprimer mon compte</h2>
        <p className="mt-1 text-sm text-red-600/80">
          Supprime définitivement votre compte, vos annonces, signalements et messages. Cette action
          est irréversible.
        </p>
        <button
          type="button"
          onClick={() => {
            if (
              !window.confirm(
                'Supprimer définitivement votre compte ? Cette action est irréversible.',
              )
            )
              return;
            api('/users/me', { method: 'DELETE' })
              .then(async () => {
                await logout();
                window.location.href = '/';
              })
              .catch((err) =>
                setError(err instanceof Error ? err.message : 'Suppression impossible'),
              );
          }}
          className="mt-3 rounded-lg border border-red-300 px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-100"
        >
          Supprimer définitivement
        </button>
      </section>
    </div>
      </RequireAccount>
  );
}
