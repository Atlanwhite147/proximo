import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Découvrir Proximo — La vie de votre résidence',
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
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-brand-600 via-brand-600 to-emerald-700 px-6 py-14 text-center text-white shadow-lg sm:px-10">
        <div className="absolute -left-8 -top-8 text-[140px] opacity-10" aria-hidden>
          🏢
        </div>
        <div className="absolute -bottom-10 -right-6 text-[140px] opacity-10" aria-hidden>
          🤝
        </div>
        <p className="text-sm font-semibold uppercase tracking-widest text-brand-100">
          Open source · Sans publicité
        </p>
        <h1 className="mx-auto mt-3 max-w-2xl text-3xl font-bold sm:text-4xl">
          Et si votre immeuble avait sa propre plateforme ?
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-brand-50">
          Proximo connecte les habitants d’une même résidence : prêt de matériel,
          entraide, signalements au syndic, avis aux voisins — au même endroit,
          à l’échelle de votre immeuble.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <a
            href="mailto:proximo@147.ovh?subject=Équiper%20ma%20résidence%20avec%20Proximo"
            className="rounded-xl bg-white px-6 py-3 text-sm font-semibold text-brand-700 shadow hover:bg-brand-50"
          >
            Équiper ma résidence
          </a>
          <Link
            href="/inscription"
            className="rounded-xl border border-white/40 px-6 py-3 text-sm font-semibold text-white hover:bg-white/10"
          >
            J’ai un code d’invitation
          </Link>
        </div>
      </section>

      {/* ─── Fonctionnalités ───────────────────────────────── */}
      <section>
        <h2 className="text-center text-2xl font-bold text-slate-900">
          Ce que Proximo change au quotidien
        </h2>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FUNCTIONNALITES.map((feature) => (
            <div
              key={feature.title}
              className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
            >
              <div className="text-3xl">{feature.icon}</div>
              <h3 className="mt-3 font-semibold text-slate-900">{feature.title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-slate-600">{feature.text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ─── Comment ça marche ─────────────────────────────── */}
      <section className="rounded-3xl bg-slate-50 px-6 py-10 sm:px-10">
        <h2 className="text-center text-2xl font-bold text-slate-900">Comment ça marche</h2>
        <div className="mt-8 grid gap-6 sm:grid-cols-3">
          {ETAPES.map((step) => (
            <div key={step.num} className="text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-brand-600 text-lg font-bold text-white">
                {step.num}
              </div>
              <h3 className="mt-3 font-semibold text-slate-900">{step.title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-slate-600">{step.text}</p>
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
          Proximo est né d’un constat simple : après l’arrêt de Citylity, il
          manquait un outil aux résidences. Le projet est{' '}
          <strong>open source</strong> — le code est public sur{' '}
          <a
            href="https://github.com/bounette14701-oss/proximo"
            target="_blank"
            rel="noreferrer"
            className="font-medium text-brand-600 hover:underline"
          >
            GitHub
          </a>{' '}
          — et chacun peut l’héberger pour sa propre résidence, sans abonnement
          ni publicité. Il est encore jeune : les retours des premiers habitants
          le font grandir.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <a
            href="mailto:proximo@147.ovh?subject=Équiper%20ma%20résidence%20avec%20Proximo"
            className="rounded-xl bg-brand-600 px-6 py-3 text-sm font-semibold text-white shadow hover:bg-brand-700"
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
