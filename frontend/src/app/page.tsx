'use client';

import Link from 'next/link';
import { LatestListings } from '@/components/LatestListings';
import { LatestIncidents } from '@/components/LatestIncidents';
import { useAuth } from '@/components/AuthProvider';
import { SectionLabel } from '@/components/ui/section-label';

/**
 * Accueil « vie de résidence » :
 * - bannière de la résidence de l'utilisateur (ou CTA rejoindre)
 * - accès rapides : annonces, signalements, inviter un voisin
 * - fil des dernières annonces de la résidence
 */
export default function HomePage() {
  const { user, isAdmin } = useAuth();

  return (
    <div className="space-y-6">
      {/* ─── Bannière résidence ───────────────────────────── */}
      <section className="glow-bg relative overflow-hidden rounded-3xl bg-brand-gradient px-6 py-10 text-white shadow-lg sm:px-10">
        <div
          aria-hidden
          className="absolute -right-10 -top-10 h-48 w-48 rounded-full bg-white/10 blur-2xl"
        />
        <div className="absolute -right-4 -top-4 text-[100px] opacity-20" aria-hidden>
          {user ? '🏢' : '🤝'}
        </div>
        {user ? (
          <>
            <p className="relative font-mono text-xs font-medium uppercase tracking-badge text-white/80">
              Votre résidence
            </p>
            <h1 className="relative mt-2 text-2xl font-bold sm:text-3xl">
              {user.residenceName ?? 'Rejoignez votre résidence'}
            </h1>
            <p className="relative mt-2 max-w-xl text-sm text-white/90">
              Annonces entre voisins, signalements au syndic, invités : tout ce
              qui fait vivre votre immeuble, au même endroit.
            </p>
            <div className="relative mt-6 flex flex-wrap gap-2.5">
              <Link
                href="/annonces/nouvelle"
                className="rounded-xl bg-white px-5 py-2.5 text-sm font-semibold text-primary-700 shadow hover:bg-primary-50"
              >
                + Publier dans la résidence
              </Link>
              {user.status === 'ACTIVE' && (
                <Link
                  href="/annonces/nouvelle?categorie=SIGNALEMENT"
                  className="rounded-xl border border-white/40 px-5 py-2.5 text-sm font-semibold text-white hover:bg-white/10"
                >
                  Signaler un incident
                </Link>
              )}
            </div>
          </>
        ) : (
          <>
            <p className="relative font-mono text-xs font-medium uppercase tracking-badge text-white/80">
              Bienvenue sur Proximo
            </p>
            <h1 className="relative mt-2 font-display text-3xl font-normal leading-tight sm:text-4xl">
              Votre résidence, <span className="text-white">connectée</span>
            </h1>
            <p className="relative mt-3 max-w-xl text-sm leading-relaxed text-white/90">
              Proximo rassemble les habitants d&apos;une même résidence : annonces
              entre voisins, signalements au syndic, discussions et invitations,
              le tout au même endroit, sans publicité.
            </p>
            <div className="relative mt-6 flex flex-wrap gap-2.5">
              <Link
                href="/connexion"
                className="rounded-xl bg-white px-5 py-2.5 text-sm font-semibold text-primary-700 shadow hover:bg-primary-50"
              >
                Se connecter
              </Link>
              <Link
                href="/inscription"
                className="rounded-xl border border-white/40 px-5 py-2.5 text-sm font-semibold text-white hover:bg-white/10"
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
          <Link href="/decouvrir" className="font-semibold text-primary hover:underline">
            Découvrir Proximo →
          </Link>
        </p>
      )}

      {/* ─── Fonctionnalités (visiteurs, pour donner envie) ── */}
      {!user && (
        <section className="space-y-5">
          <div className="text-center">
            <SectionLabel color="blue">Pourquoi Proximo ?</SectionLabel>
            <h2 className="mt-2 font-display text-2xl font-normal text-slate-900 sm:text-3xl">
              La vie de résidence, <span className="text-gradient">simplifiée</span>
            </h2>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {[
              {
                icon: '🔧',
                accent: '#0052FF',
                soft: 'bg-blue-50',
                title: 'Entraide entre voisins',
                text: 'Prêt de matériel, services, dons : trouvez ce qu’il vous faut à deux pas.',
              },
              {
                icon: '🛠️',
                accent: '#EF4444',
                soft: 'bg-red-50',
                title: 'Signalements au syndic',
                text: 'Fuite, ascenseur, dégradation… avec photos, suivis par toute la résidence.',
              },
              {
                icon: '💬',
                accent: '#6366F1',
                soft: 'bg-indigo-50',
                title: 'Discussions par sujet',
                text: 'Chaque annonce et signalement a son fil : questions et retours entre voisins.',
              },
              {
                icon: '🔒',
                accent: '#10B981',
                soft: 'bg-emerald-50',
                title: 'Réservé aux habitants',
                text: 'Accès validé par la résidence : pas de publicité, pas de données revendues.',
              },
            ].map((feature) => (
              <div
                key={feature.title}
                className="group flex items-start gap-3.5 rounded-2xl border border-border bg-card p-5 shadow-card transition-all duration-200 hover:-translate-y-0.5 hover:shadow-card-hover"
              >
                <span
                  aria-hidden
                  className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-xl ${feature.soft}`}
                >
                  {feature.icon}
                </span>
                <div>
                  <h3 className="font-sans font-semibold text-foreground">{feature.title}</h3>
                  <p className="mt-0.5 text-sm leading-relaxed text-muted-foreground">
                    {feature.text}
                  </p>
                </div>
              </div>
            ))}
          </div>
          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            <Link
              href="/inscription"
              className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-brand-gradient px-6 text-sm font-semibold text-white shadow-sm transition-all hover:shadow-glow"
            >
              Rejoindre ma résidence
            </Link>
            <Link
              href="/connexion"
              className="inline-flex h-12 items-center justify-center rounded-xl border border-slate-300 bg-white px-6 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50"
            >
              J&apos;ai déjà un compte
            </Link>
          </div>
        </section>
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
              className="flex flex-col items-center gap-1.5 ds-card ds-card-hover px-3 py-4 text-center"
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
            <div>
              <SectionLabel color="blue">● Annonces entre voisins</SectionLabel>
              <h2 className="mt-1 text-xl font-bold text-slate-900">Dernières annonces</h2>
            </div>
            <Link href="/annonces" className="text-sm font-medium text-primary hover:underline">
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
            <div>
              <SectionLabel color="amber">● Signalements syndic</SectionLabel>
              <h2 className="mt-1 text-xl font-bold text-slate-900">Signalements en cours</h2>
            </div>
            <Link
              href="/annonces?categorie=SIGNALEMENT"
              className="text-sm font-medium text-primary hover:underline"
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
