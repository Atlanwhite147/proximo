import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Mentions légales — Proximo',
  description: 'Mentions légales du service Proximo.',
};

export default function MentionsLegalesPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <h1 className="text-2xl font-bold text-slate-900">Mentions légales</h1>

      <div className="mt-6 space-y-6 text-sm leading-relaxed text-slate-700">
        <section>
          <h2 className="font-semibold text-slate-900">Éditeur</h2>
          <p className="mt-2">
            Le service Proximo est édité par <strong>[Prénom Nom — à compléter]</strong>.
            <br />
            Contact : <a href="mailto:bounette14701@gmail.com" className="text-brand-600 hover:underline">bounette14701@gmail.com</a>
          </p>
        </section>

        <section>
          <h2 className="font-semibold text-slate-900">Hébergement</h2>
          <p className="mt-2">
            Le service est hébergé par <strong>Oracle Cloud Infrastructure</strong> (Oracle
            Corporation), datacenter situé dans l’Union européenne, et distribué via
            <strong> Cloudflare, Inc.</strong> (réseau de diffusion et protection).
          </p>
        </section>

        <section>
          <h2 className="font-semibold text-slate-900">Propriété intellectuelle</h2>
          <p className="mt-2">
            Proximo est un logiciel libre distribué sous licence Apache 2.0. Le code
            source est disponible sur{' '}
            <a
              href="https://github.com/Atlanwhite147/proximo"
              target="_blank"
              rel="noreferrer"
              className="text-brand-600 hover:underline"
            >
              GitHub
            </a>
            .
          </p>
        </section>

        <section>
          <h2 className="font-semibold text-slate-900">Responsabilité</h2>
          <p className="mt-2">
            Proximo met en relation les habitants d’une même résidence. L’éditeur ne
            saurait être tenu responsable du contenu publié par les utilisateurs
            (annonces, commentaires, signalements), qui restent seuls responsables de
            leurs publications.
          </p>
        </section>

        <section>
          <h2 className="font-semibold text-slate-900">Données personnelles</h2>
          <p className="mt-2">
            Le traitement des données personnelles est décrit dans la{' '}
            <a href="/confidentialite" className="text-brand-600 hover:underline">
              politique de confidentialité
            </a>
            .
          </p>
        </section>
      </div>
    </div>
  );
}
