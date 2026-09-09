import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Politique de confidentialité — Proximo',
  description: 'Politique de confidentialité du service Proximo (RGPD).',
};

export default function ConfidentialitePage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <h1 className="text-2xl font-bold text-slate-900">Politique de confidentialité</h1>
      <p className="mt-2 text-sm text-slate-500">Dernière mise à jour : septembre 2026</p>

      <div className="mt-6 space-y-6 text-sm leading-relaxed text-slate-700">
        <section>
          <h2 className="font-semibold text-slate-900">1. Données collectées</h2>
          <p className="mt-2">
            Lors de la création d&apos;un compte : nom, prénom et adresse email.
            Si vous utilisez « Continuer avec Google », Google nous transmet
            votre nom et votre adresse email (nous ne recevons jamais votre mot
            de passe Google). Lors de l&apos;utilisation du service : annonces
            publiées, commentaires, signalements, messages privés, bâtiment et
            étage (si renseignés par l&apos;utilisateur). L&apos;adresse exacte des
            résidences n&apos;est jamais publiée aux habitants.
          </p>
          <p className="mt-2">
            <strong>Annuaire des voisins</strong> : votre prénom, nom et bâtiment/étage
            (si vous avez choisi de les afficher) peuvent être visibles des autres
            habitants via l&apos;annuaire de la résidence. L&apos;apparition dans cet
            annuaire est un <strong>choix</strong> : il est activé par défaut à
            l&apos;inscription (case décochable), et vous pouvez l&apos;activer ou le
            désactiver à tout moment depuis votre profil. Un habitant qui se retire
            de l&apos;annuaire n&apos;est plus listé et ne peut plus être contacté
            directement via celui-ci.
          </p>
        </section>

        <section>
          <h2 className="font-semibold text-slate-900">2. Finalités</h2>
          <p className="mt-2">
            Les données servent uniquement au fonctionnement du service : permettre
            les échanges entre habitants d’une même résidence, signaler les incidents
            au syndic, et assurer la sécurité du service. Elles ne sont jamais
            revendues ni utilisées à des fins publicitaires.
          </p>
        </section>

        <section>
          <h2 className="font-semibold text-slate-900">3. Base légale</h2>
          <p className="mt-2">
            Le traitement repose sur l’exécution du contrat de service (article 6.1.b
            du RGPD) et sur l’intérêt légitime de faire fonctionner la vie de
            résidence (article 6.1.f).
          </p>
        </section>

        <section>
          <h2 className="font-semibold text-slate-900">4. Conservation</h2>
          <p className="mt-2">
            Les comptes sont conservés tant que le compte est actif. La
            suppression du compte (Profil → supprimer mon compte) entraîne la
            suppression de vos données personnelles et de vos contenus sous 30
            jours. Les annonces sont conservées tant qu&apos;elles ne sont pas
            retirées par leur auteur ; les signalements « traités » sont purgés
            automatiquement après 48 h ; les messages privés sont conservés tant
            que les deux interlocuteurs ont un compte. Les sauvegardes
            techniques sont conservées 30 jours.
          </p>
        </section>

        <section>
          <h2 className="font-semibold text-slate-900">5. Sous-traitants</h2>
          <p className="mt-2">
            Les données sont hébergées en Europe par Oracle Cloud Infrastructure.
            Les emails transactionnels sont envoyés via Brevo (données limitées à
            l’adresse email). Le trafic transite par Cloudflare. Aucun de ces
            prestataires n’utilise vos données à ses propres fins.
          </p>
        </section>

        <section>
          <h2 className="font-semibold text-slate-900">6. Sécurité</h2>
          <p className="mt-2">
            Les mots de passe sont hachés (Argon2id), les sessions utilisent des
            cookies sécurisés, la connexion est chiffrée (HTTPS), et les accès
            administrateur sont protégés par une double authentification.
          </p>
        </section>

        <section>
          <h2 className="font-semibold text-slate-900">7. Vos droits</h2>
          <p className="mt-2">
            Conformément au RGPD, vous disposez d&apos;un droit d&apos;accès, de rectification,
            d&apos;effacement, de limitation, d&apos;opposition et de portabilité de vos
            données. Vous pouvez exercer ces droits à tout moment en écrivant à{' '}
            <a href="mailto:proximo@147.ovh" className="text-brand-600 hover:underline">
              proximo@147.ovh
            </a>
            , ou supprimer votre compte depuis l&apos;application (Profil → supprimer
            mon compte). Vous pouvez également introduire une réclamation auprès
            de la CNIL.
          </p>
        </section>

        <section>
          <h2 className="font-semibold text-slate-900">8. Cookies</h2>
          <p className="mt-2">
            Proximo n’utilise aucun cookie publicitaire ni de suivi. Seuls des cookies
            techniques de session (authentification) sont déposés.
          </p>
        </section>
      </div>
    </div>
  );
}
