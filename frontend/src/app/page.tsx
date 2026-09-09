'use client';

import Link from 'next/link';
import { DashboardHome } from '@/components/DashboardHome';
import { useAuth } from '@/components/AuthProvider';
import { SectionLabel } from '@/components/ui/section-label';

/**
 * Accueil :
 * - membre ACTIVE  → DashboardHome (vie de la résidence : indicateurs,
 *                    fil d'activité unifié, messagerie, invitation)
 * - membre PENDING → message d'attente de validation
 * - visiteur       → hero marketing + contenu SEO (Google)
 */
export default function HomePage() {
  const { user, isAdmin } = useAuth();

  return (
    <div className="space-y-6">
      {/* ─── Membres ACTIVE : tableau de bord de la résidence ─ */}
      {user && user.status === 'ACTIVE' && <DashboardHome />}

      {/* ─── Membres PENDING : en attente de validation ─────── */}
      {user?.status === 'PENDING' && (
        <section className="glow-bg relative overflow-hidden rounded-3xl bg-brand-gradient px-6 py-10 text-white shadow-lg sm:px-10">
          <div aria-hidden className="absolute -right-8 -top-8 h-40 w-40 rounded-full bg-white/10 blur-2xl" />
          <p className="relative font-mono text-xs font-medium uppercase tracking-badge text-white/80">
            Votre résidence
          </p>
          <h1 className="relative mt-2 text-2xl font-bold sm:text-3xl">
            {user.residenceName ?? 'Bienvenue sur Proximo'}
          </h1>
          <p className="relative mt-3 max-w-xl rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm font-medium text-amber-800">
            ⏳ Votre compte est en attente de validation par un administrateur.
            Vous recevrez un email dès qu&apos;il sera actif.
          </p>
        </section>
      )}

      {/* ─── Visiteurs : hero marketing ─────────────────────── */}
      {!user && (
        <section className="glow-bg relative overflow-hidden rounded-3xl bg-brand-gradient px-6 py-10 text-white shadow-lg sm:px-10">
          <div
            aria-hidden
            className="absolute -right-10 -top-10 h-48 w-48 rounded-full bg-white/10 blur-2xl"
          />
          <div className="absolute -right-4 -top-4 text-[100px] opacity-20" aria-hidden>
            🤝
          </div>
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
        </section>
      )}

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

      {/* ─── Contenu public (SEO) : fonctionnement + FAQ ───── */}
      {!user && (
        <>
          <section className="ds-card p-6 sm:p-8">
            <SectionLabel color="blue">● Comment ça marche</SectionLabel>
            <h2 className="mt-2 text-xl font-bold text-slate-900 sm:text-2xl">
              Une application pour rapprocher les habitants d&apos;une même résidence
            </h2>
            <div className="mt-5 grid gap-4 sm:grid-cols-3">
              {[
                {
                  step: '1',
                  title: 'Créez la résidence',
                  text: 'Un habitant crée l’espace de son immeuble et reçoit un code d’accès unique à partager à ses voisins, en main propre ou par QR code.',
                },
                {
                  step: '2',
                  title: 'Vos voisins rejoignent',
                  text: 'Chaque habitant s’inscrit avec le code de la résidence (email ou Google). Un administrateur valide les comptes : seuls les vrais habitants entrent.',
                },
                {
                  step: '3',
                  title: 'La vie de l’immeuble au même endroit',
                  text: 'Annonces (prêt, don, service), signalements au syndic avec photos, discussions et invitations : tout circule dans un espace privé et sans publicité.',
                },
              ].map((item) => (
                <div key={item.step} className="rounded-2xl border border-slate-100 bg-slate-50/60 p-5">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-gradient text-sm font-bold text-white">
                    {item.step}
                  </span>
                  <h3 className="mt-3 font-semibold text-slate-900">{item.title}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-slate-600">{item.text}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="ds-card p-6 sm:p-8">
            <SectionLabel color="blue">● Questions fréquentes</SectionLabel>
            <h2 className="mt-2 text-xl font-bold text-slate-900 sm:text-2xl">
              Proximo, l&apos;entraide entre voisins expliquée
            </h2>
            <div className="mt-5 space-y-4">
              {[
                {
                  q: 'Proximo est-il gratuit pour les habitants ?',
                  a: 'Oui. Proximo est un projet open source : le code est public sur GitHub. Les habitants d’une résidence utilisent les annonces, les signalements et les discussions sans frais.',
                },
                {
                  q: 'Qui peut rejoindre une résidence sur Proximo ?',
                  a: 'Uniquement les habitants : l’inscription demande le code d’accès de la résidence (distribué par un voisin ou l’administrateur), puis un administrateur valide chaque compte. Pas de publicité, pas de données personnelles revendues.',
                },
                {
                  q: 'À quoi servent les signalements ?',
                  a: 'Fuite d’eau, ascenseur en panne, dégradation dans les parties communes : chaque signalement peut inclure des photos et est notifié à l’agence ou au syndic configuré par la résidence.',
                },
                {
                  q: 'Proximo remplace-t-il le groupe WhatsApp de l’immeuble ?',
                  a: 'Proximo organise ce que WhatsApp ne fait pas : des annonces structurées (prêt, don, service), des fils de discussion par sujet et des signalements suivis — sans mélanger vie privée et vie d’immeuble.',
                },
              ].map((item) => (
                <div key={item.q} className="rounded-2xl border border-slate-100 bg-slate-50/60 p-5">
                  <h3 className="font-semibold text-slate-900">{item.q}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-slate-600">{item.a}</p>
                </div>
              ))}
            </div>
          </section>
        </>
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
