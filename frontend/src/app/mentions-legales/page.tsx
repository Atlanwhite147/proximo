import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Mentions légales — Proximo',
  description: 'Mentions légales du service Proximo (éditeur, hébergement, propriété intellectuelle).',
};

export default function MentionsLegalesPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <h1 className="text-2xl font-bold text-slate-900">Mentions légales</h1>
      <p className="mt-2 text-sm text-slate-500">Dernière mise à jour : septembre 2026</p>

      <div className="mt-6 space-y-6 text-sm leading-relaxed text-slate-700">
        <section>
          <h2 className="font-semibold text-slate-900">Éditeur du service</h2>
          <p className="mt-2">
            Le service Proximo est édité par :
          </p>
          <p className="mt-2 rounded-xl bg-slate-50 p-4">
            <strong>Alban Ciclet</strong>
            <br />
            Lyon, France
            <br />
            Contact :{' '}
            <a href="mailto:proximo@147.ovh" className="text-brand-600 hover:underline">
              proximo@147.ovh
            </a>
          </p>
        </section>

        <section>
          <h2 className="font-semibold text-slate-900">Directeur de la publication</h2>
          <p className="mt-2">
            Alban Ciclet —{' '}
            <a href="mailto:proximo@147.ovh" className="text-brand-600 hover:underline">
              proximo@147.ovh
            </a>
          </p>
        </section>

        <section>
          <h2 className="font-semibold text-slate-900">Hébergement</h2>
          <p className="mt-2">
            Le service est hébergé par <strong>Oracle Cloud Infrastructure</strong> (Oracle
            Corporation), datacenter situé à Paris (Île-de-France), en France
            (Union européenne), et distribué via <strong>Cloudflare, Inc.</strong>{' '}
            (réseau de diffusion et de protection), dont le siège est aux
            États-Unis. Les données sont traitées dans l&apos;Union européenne.
          </p>
        </section>

        <section>
          <h2 className="font-semibold text-slate-900">Propriété intellectuelle</h2>
          <p className="mt-2">
            Proximo est un logiciel libre distribué sous licence Apache 2.0. Le
            code source est disponible sur{' '}
            <a
              href="https://github.com/Atlanwhite147/proximo"
              target="_blank"
              rel="noreferrer"
              className="text-brand-600 hover:underline"
            >
              GitHub
            </a>
            . Les marques et éléments graphiques du service sont protégés ; les
            contenus publiés par les utilisateurs restent la propriété de leurs
            auteurs.
          </p>
        </section>

        <section>
          <h2 className="font-semibold text-slate-900">Conditions d&apos;utilisation</h2>
          <p className="mt-2">
            L&apos;utilisation du service est régie par les{' '}
            <Link href="/cgu" className="text-brand-600 hover:underline">
              conditions générales d&apos;utilisation
            </Link>{' '}
            et la{' '}
            <Link href="/confidentialite" className="text-brand-600 hover:underline">
              politique de confidentialité
            </Link>
            .
          </p>
        </section>

        <section>
          <h2 className="font-semibold text-slate-900">Responsabilité</h2>
          <p className="mt-2">
            Proximo met en relation les habitants d&apos;une même résidence.
            L&apos;éditeur ne saurait être tenu responsable du contenu publié par les
            utilisateurs (annonces, commentaires, signalements, messages), qui
            restent seuls responsables de leurs publications. Les échanges et
            services entre habitants (prêts, dons, entraide) relèvent de la seule
            responsabilité des personnes concernées.
          </p>
        </section>

        <section>
          <h2 className="font-semibold text-slate-900">Données personnelles</h2>
          <p className="mt-2">
            Le traitement des données personnelles est décrit dans la{' '}
            <Link href="/confidentialite" className="text-brand-600 hover:underline">
              politique de confidentialité
            </Link>{' '}
            (conforme au RGPD). Pour exercer vos droits (accès, rectification,
            effacement…) :{' '}
            <a href="mailto:proximo@147.ovh" className="text-brand-600 hover:underline">
              proximo@147.ovh
            </a>
            .
          </p>
        </section>
      </div>
    </div>
  );
}
