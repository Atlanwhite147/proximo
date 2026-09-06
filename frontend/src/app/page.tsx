'use client';

import Link from 'next/link';
import { LatestListings } from '@/components/LatestListings';
import { LatestIncidents } from '@/components/LatestIncidents';
import { useAuth } from '@/components/AuthProvider';

/**
 * Accueil « vie de résidence » (style Citylity) :
 * - bannière de la résidence de l'utilisateur (ou CTA rejoindre)
 * - accès rapides : annonces, signalements, inviter un voisin
 * - fil des dernières annonces de la résidence
 */
export default function HomePage() {
  const { user, isAdmin } = useAuth();

  return (
    <div className="space-y-6">
      {/* ─── Bannière résidence ───────────────────────────── */}
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-brand-600 via-brand-600 to-emerald-700 px-6 py-10 text-white shadow-lg sm:px-10">
        <div className="absolute -right-8 -top-8 text-[120px] opacity-15" aria-hidden>
          🏢
        </div>
        {user ? (
          <>
            <p className="text-sm font-medium text-brand-100">Votre résidence</p>
            <h1 className="mt-1 text-2xl font-bold sm:text-3xl">
              {user.residenceName ?? 'Rejoignez votre résidence'}
            </h1>
            <p className="mt-2 max-w-xl text-sm text-brand-50">
              Annonces entre voisins, signalements au syndic, invités — tout ce
              qui fait vivre votre immeuble, au même endroit.
            </p>
            <div className="mt-5 flex flex-wrap gap-2.5">
              <Link
                href="/annonces/nouvelle"
                className="rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-brand-700 shadow hover:bg-brand-50"
              >
                + Publier dans la résidence
              </Link>
              {user.status === 'ACTIVE' && (
                <Link
                  href="/annonces/nouvelle?categorie=SIGNALEMENT"
                  className="rounded-xl border border-white/40 px-4 py-2.5 text-sm font-semibold text-white hover:bg-white/10"
                >
                  Signaler un incident
                </Link>
              )}
            </div>
          </>
        ) : (
          <>
            <p className="text-sm font-medium text-brand-100">Espace résidence</p>
            <h1 className="mt-1 text-2xl font-bold sm:text-3xl">
              Bonjour, content de vous revoir
            </h1>
            <p className="mt-2 max-w-xl text-sm text-brand-50">
              Connectez-vous pour retrouver les annonces et signalements de votre résidence.
            </p>
            <div className="mt-5 flex flex-wrap gap-2.5">
              <Link
                href="/connexion"
                className="rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-brand-700 shadow hover:bg-brand-50"
              >
                Se connecter
              </Link>
              <Link
                href="/inscription"
                className="rounded-xl border border-white/40 px-4 py-2.5 text-sm font-semibold text-white hover:bg-white/10"
              >
                Créer un compte
              </Link>
            </div>
          </>
        )}
      </section>

      {/* ─── Mention discrète (visiteurs sans résidence) ───── */}
      {!user && (
        <p className="text-center text-sm text-slate-500">
          Votre résidence n&apos;est pas équipée ?{' '}
          <Link href="/decouvrir" className="font-semibold text-brand-600 hover:underline">
            Découvrir Proximo →
          </Link>
        </p>
      )}

      {/* ─── Accès rapides ─────────────────────────────────── */}
      {user && user.status === 'ACTIVE' && (
        <section className="grid grid-cols-3 gap-3">
          {[
            { href: '/annonces', icon: '📦', label: 'Annonces' },
            { href: '/annonces?categorie=SIGNALEMENT', icon: '🛠️', label: 'Signalements' },
            { href: '/inviter', icon: '📲', label: 'Inviter un voisin' },
          ].map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="flex flex-col items-center gap-1.5 rounded-2xl border border-slate-200 bg-white px-3 py-4 text-center shadow-sm transition hover:border-brand-300 hover:shadow"
            >
              <span className="text-2xl">{item.icon}</span>
              <span className="text-xs font-semibold text-slate-700">{item.label}</span>
            </Link>
          ))}
        </section>
      )}

      {/* ─── Fil des annonces (réservé aux membres validés) ── */}
      {user?.status === 'ACTIVE' && (
        <section>
          <div className="mb-3 flex items-end justify-between">
            <h2 className="text-lg font-bold text-slate-900">Dernières annonces</h2>
            <Link href="/annonces" className="text-sm font-medium text-brand-600 hover:underline">
              Tout voir →
            </Link>
          </div>
          <LatestListings />
        </section>
      )}

      {/* ─── Derniers signalements (réservé aux membres validés) ── */}
      {user?.status === 'ACTIVE' && (
        <section>
          <div className="mb-3 flex items-end justify-between">
            <h2 className="text-lg font-bold text-slate-900">🛠️ Signalements en cours</h2>
            <Link
              href="/annonces?categorie=SIGNALEMENT"
              className="text-sm font-medium text-brand-600 hover:underline"
            >
              Tout voir →
            </Link>
          </div>
          <LatestIncidents />
        </section>
      )}

      {user?.status === 'PENDING' && (
        <p className="rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-center text-sm font-medium text-amber-800">
          ⏳ Votre compte est en attente de validation par un administrateur.
        </p>
      )}

      {isAdmin && (
        <p className="text-center text-xs text-slate-400">
          Espace administrateur :{' '}
          <Link href="/admin" className="font-medium text-brand-600 hover:underline">
            gestion des membres, signalements et invitations
          </Link>
        </p>
      )}
    </div>
  );
}
