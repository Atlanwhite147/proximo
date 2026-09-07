import Link from 'next/link';
import type { Metadata } from 'next';
import { SectionLabel } from '@/components/ui/section-label';

export const metadata: Metadata = {
  title: 'Découvrir Proximo · La vie de votre résidence',
  description:
    'Annonces entre voisins, signalements au syndic avec photos, discussions, invitations par QR code. Proximo est une plateforme open source pour votre résidence.',
};

const FUNCTIONNALITES = [
  {
    icon: '📦',
    title: 'Annonces entre voisins',
    text: 'Prêt de matériel (perceuse, échelle…), services (aide déménagement, garde de chat), dons, avis aux résidents. Publiez en 30 secondes.',
  },
  {
    icon: '🛠️',
    title: 'Signalements au syndic',
    text: 'Fuite, ascenseur, dégradation… avec photos. L’agence reçoit un email récapitulatif automatique avec les pièces jointes, et tout le monde suit le statut.',
  },
  {
    icon: '💬',
    title: 'Discussions par annonce',
    text: 'Chaque annonce et chaque signalement a son fil de commentaires : questions, précisions et retours entre voisins, sans spam.',
  },
  {
    icon: '📲',
    title: 'Invitations par QR code',
    text: 'Chaque habitant invite ses voisins en 10 secondes avec un QR code. Pas de liste d’emails à gérer : la résidence grandit d’elle-même.',
  },
  {
    icon: '🔒',
    title: 'Vie privée protégée',
    text: 'Jamais d’adresse exacte ni de coordonnées exposées. Comptes validés par un administrateur, messages privés 1-1, sessions sécurisées.',
  },
  {
    icon: '🌱',
    title: 'Open source & sans pub',
    text: 'Aucune publicité, aucune revente de données. Le code est libre sur GitHub et chacun peut l’héberger pour sa résidence.',
  },
];

const ETAPES = [
  {
    num: '1',
    title: 'On installe Proximo',
    text: 'Une personne de la résidence crée l’espace (2 minutes), puis l’ouvre aux autres habitants.',
  },
  {
    num: '2',
    title: 'On invite les voisins',
    text: 'Un QR code à partager dans l’ascenseur ou sur le panneau : chacun rejoint avec son email ou son compte Google.',
  },
  {
    num: '3',
    title: 'La résidence s’anime',
    text: 'Annonces, entraide, signalements suivis : la vie d’immeuble redevient simple et collective.',
  },
];

export default function DiscoverPage() {
  return (
    <div className="space-y-14 pb-10">
      {/* ─── Héros ─────────────────────────────────────────── */}
      <section className="glow-bg relative overflow-hidden rounded-3xl bg-brand-gradient px-6 py-16 text-center text-white shadow-lg sm:px-10">
        <div
          aria-hidden
          className="absolute -left-16 -top-16 h-56 w-56 rounded-full bg-white/10 blur-3xl"
        />
        <div
          aria-hidden
          className="absolute -bottom-16 -right-10 h-64 w-64 rounded-full bg-white/10 blur-3xl"
        />
        <div className="absolute -left-4 -top-4 text-[120px] opacity-10" aria-hidden>
          🏢
        </div>
        <div className="absolute -bottom-8 -right-4 text-[120px] opacity-10" aria-hidden>
          🤝
        </div>
        <p className="relative font-mono text-xs font-semibold uppercase tracking-badge text-white/80">
          Open source · Sans publicité
        </p>
        <h1 className="relative mx-auto mt-4 max-w-2xl font-display text-3xl font-normal leading-tight sm:text-5xl">
          Et si votre immeuble avait sa propre plateforme ?
        </h1>
        <p className="relative mx-auto mt-5 max-w-xl text-sm leading-relaxed text-white/90 sm:text-base">
          Proximo connecte les habitants d’une même résidence : prêt de matériel,
          entraide, signalements au syndic, avis aux voisins, au même endroit,
          à l’échelle de votre immeuble.
        </p>
        <div className="relative mt-9 flex flex-wrap items-center justify-center gap-3">
          <a
            href="mailto:proximo@147.ovh?subject=Équiper%20ma%20résidence%20avec%20Proximo"
            className="inline-flex h-12 items-center justify-center rounded-xl bg-white px-7 text-sm font-semibold text-primary-700 shadow hover:bg-primary-50"
          >
            Équiper ma résidence
          </a>
          <Link
            href="/inscription"
            className="inline-flex h-12 items-center justify-center rounded-xl border border-white/40 px-7 text-sm font-semibold text-white hover:bg-white/10"
          >
            J’ai un code d’invitation
          </Link>
        </div>
      </section>

      {/* ─── Fonctionnalités ───────────────────────────────── */}
      <section>
        <div className="text-center">
          <SectionLabel color="blue">Fonctionnalités</SectionLabel>
          <h2 className="mt-2 font-display text-3xl font-normal text-slate-900">
            Ce que Proximo change au quotidien
          </h2>
        </div>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FUNCTIONNALITES.map((feature) => (
            <div
              key={feature.title}
              className="ds-card ds-card-hover p-6"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary-50 text-2xl">
                {feature.icon}
              </div>
              <h3 className="mt-4 font-sans text-lg font-semibold text-slate-900">
                {feature.title}
              </h3>
              <p className="mt-1.5 text-sm leading-relaxed text-slate-600">{feature.text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ─── Comment ça marche ─────────────────────────────── */}
      <section className="relative overflow-hidden rounded-3xl bg-slate-900 px-6 py-12 text-white sm:px-10">
        <div
          aria-hidden
          className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-primary/20 blur-3xl"
        />
        <div className="relative text-center">
          <SectionLabel color="amber">Comment ça marche</SectionLabel>
          <h2 className="mt-2 font-display text-3xl font-normal">Trois étapes, zéro friction</h2>
        </div>
        <div className="relative mt-10 grid gap-8 sm:grid-cols-3">
          {ETAPES.map((step) => (
            <div key={step.num} className="text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-gradient font-mono text-xl font-bold text-white shadow-glow">
                {step.num}
              </div>
              <h3 className="mt-4 font-sans text-lg font-semibold">{step.title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-slate-300">{step.text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ─── Fait par des habitants ────────────────────────── */}
      <section className="mx-auto max-w-2xl text-center">
        <div className="text-4xl">🌿</div>
        <h2 className="mt-3 text-2xl font-bold text-slate-900">
          Une initiative d’habitants, pas d’une entreprise
        </h2>
        <p className="mt-3 text-sm leading-relaxed text-slate-600">
          Proximo est né d&apos;un constat simple : les habitants d&apos;une résidence
          n&apos;avaient plus d&apos;outil simple pour échanger entre voisins et suivre
          les sujets de l&apos;immeuble. Le projet est{' '}
          <strong>open source</strong> : le code est public sur{' '}
          <a
            href="https://github.com/bounette14701-oss/proximo"
            target="_blank"
            rel="noreferrer"
            className="font-medium text-brand-600 hover:underline"
          >
            GitHub
          </a>{' '}
          et chacun peut l&apos;héberger pour sa propre résidence, sans abonnement
          ni publicité. Il est encore jeune : les retours des premiers habitants
          le font grandir.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <a
            href="mailto:proximo@147.ovh?subject=Équiper%20ma%20résidence%20avec%20Proximo"
            className="btn-primary-sm rounded-xl px-6"
          >
            ✉️ Proposer Proximo à ma résidence
          </a>
          <Link
            href="/"
            className="rounded-xl border border-slate-300 px-6 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-100"
          >
            ← Retour à l’accueil
          </Link>
        </div>
      </section>
    </div>
  );
}
