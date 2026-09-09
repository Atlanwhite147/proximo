import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Conditions Générales d’Utilisation — Proximo',
  description:
    'Conditions générales d’utilisation du service Proximo : comptes, règles d’usage, responsabilités, suspension et droit applicable.',
};

/**
 * Conditions Générales d'Utilisation (CGU) — service Proximo.
 * Document opposable entre l'éditeur et les utilisateurs du service.
 */
export default function CguPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <h1 className="text-2xl font-bold text-slate-900">
        Conditions Générales d&apos;Utilisation
      </h1>
      <p className="mt-2 text-sm text-slate-500">
        Dernière mise à jour : septembre 2026 — Service Proximo
      </p>

      <div className="mt-6 space-y-6 text-sm leading-relaxed text-slate-700">
        <section>
          <h2 className="font-semibold text-slate-900">1. Objet</h2>
          <p className="mt-2">
            Les présentes conditions générales d&apos;utilisation (CGU) encadrent
            l&apos;accès et l&apos;utilisation du service Proximo, une plateforme de
            vie de résidence permettant aux habitants d&apos;une même résidence de
            publier des annonces, de signaler des incidents, d&apos;échanger des
            messages et de gérer des invitations. L&apos;utilisation du service
            implique l&apos;acceptation pleine et entière des présentes CGU.
          </p>
        </section>

        <section>
          <h2 className="font-semibold text-slate-900">2. Définitions</h2>
          <p className="mt-2">
            « Éditeur » : la personne physique ou morale qui édite le service
            Proximo, identifiée dans les{' '}
            <Link href="/mentions-legales" className="text-brand-600 hover:underline">
              mentions légales
            </Link>
            . « Utilisateur » : toute personne disposant d&apos;un compte sur une
            résidence. « Résidence » : l&apos;espace privé créé par un administrateur
            et accessible aux habitants munis du code d&apos;accès.
          </p>
        </section>

        <section>
          <h2 className="font-semibold text-slate-900">3. Accès au service et création de compte</h2>
          <p className="mt-2">
            L&apos;accès au service nécessite la création d&apos;un compte avec une
            adresse email valide et le code d&apos;accès de la résidence (ou une
            invitation). L&apos;utilisateur s&apos;engage à fournir des informations
            exactes et à les maintenir à jour. Chaque compte est personnel :
            l&apos;utilisateur est responsable de la confidentialité de son mot de
            passe et de toute activité réalisée depuis son compte. La création
            d&apos;un compte est soumise à validation par un administrateur de la
            résidence.
          </p>
        </section>

        <section>
          <h2 className="font-semibold text-slate-900">4. Fonctionnement et responsabilité de la résidence</h2>
          <p className="mt-2">
            Chaque résidence est administrée par un ou plusieurs administrateurs
            (habitants ou syndic) qui valident les comptes et modèrent les
            contenus. Proximo ne peut être tenu responsable de la gestion
            interne d&apos;une résidence, ni des décisions prises par ses
            administrateurs.
          </p>
        </section>

        <section>
          <h2 className="font-semibold text-slate-900">5. Règles d&apos;usage et contenus publiés</h2>
          <p className="mt-2">
            L&apos;utilisateur s&apos;engage à utiliser le service de manière licite et
            respectueuse. Il est notamment interdit de publier :
          </p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>des contenus illicites, diffamatoires, injurieux, discriminatoires ou portant atteinte à la vie privée d&apos;autrui ;</li>
            <li>des contenus à caractère commercial ou publicitaire sans lien avec la vie de la résidence ;</li>
            <li>des contenus portant atteinte aux droits de propriété intellectuelle de tiers ;</li>
            <li>des informations inexactes, en particulier dans les signalements d&apos;incidents ;</li>
            <li>toute tentative d&apos;accès aux comptes d&apos;autres utilisateurs ou de perturbation du service.</li>
          </ul>
          <p className="mt-2">
            L&apos;utilisateur reste seul responsable des contenus qu&apos;il publie
            (annonces, commentaires, signalements, messages). Les échanges entre
            habitants (prêts, dons, services) relèvent de la seule responsabilité
            des utilisateurs concernés : Proximo n&apos;est qu&apos;un outil de mise en
            relation et n&apos;intervient pas dans les transactions.
          </p>
        </section>

        <section>
          <h2 className="font-semibold text-slate-900">6. Modération et suspension</h2>
          <p className="mt-2">
            Les administrateurs de la résidence et l&apos;éditeur peuvent retirer
            tout contenu contraire aux présentes CGU. En cas de manquement
            répété ou grave, l&apos;éditeur ou l&apos;administrateur peut suspendre ou
            supprimer le compte de l&apos;utilisateur concerné, sans préjudice des
            actions en justice éventuelles.
          </p>
        </section>

        <section>
          <h2 className="font-semibold text-slate-900">7. Propriété intellectuelle</h2>
          <p className="mt-2">
            Le logiciel Proximo est un logiciel libre distribué sous licence
            Apache 2.0, dont le code source est public. Les contenus publiés par
            les utilisateurs leur appartiennent ; en les publiant, l&apos;utilisateur
            concède à la résidence et à l&apos;éditeur une licence non exclusive de
            stockage et d&apos;affichage nécessaire au fonctionnement du service.
          </p>
        </section>

        <section>
          <h2 className="font-semibold text-slate-900">8. Données personnelles</h2>
          <p className="mt-2">
            Le traitement des données personnelles est décrit dans la{' '}
            <Link href="/confidentialite" className="text-brand-600 hover:underline">
              politique de confidentialité
            </Link>
            , conforme au RGPD. L&apos;utilisateur peut à tout moment demander la
            suppression de son compte et de ses données.
          </p>
        </section>

        <section>
          <h2 className="font-semibold text-slate-900">9. Disponibilité du service</h2>
          <p className="mt-2">
            L&apos;éditeur s&apos;efforce d&apos;assurer une disponibilité maximale du
            service, sans garantie d&apos;absence d&apos;interruption (maintenances,
            incidents techniques, opérations de sauvegarde). Le service est
            fourni « en l&apos;état », sans garantie d&apos;aucune sorte.
          </p>
        </section>

        <section>
          <h2 className="font-semibold text-slate-900">10. Responsabilité</h2>
          <p className="mt-2">
            Dans la limite permise par la loi, la responsabilité de l&apos;éditeur
            ne saurait être engagée pour les dommages indirects (perte de
            données, préjudice commercial…) ou pour les conséquences de
            l&apos;utilisation d&apos;un service hébergé par la résidence elle-même
            lorsqu&apos;elle a choisi l&apos;installation en autonomie.
          </p>
        </section>

        <section>
          <h2 className="font-semibold text-slate-900">11. Modification des CGU</h2>
          <p className="mt-2">
            Les présentes CGU peuvent être modifiées à tout moment. Les
            utilisateurs en seront informés par le service ; la poursuite de
            l&apos;utilisation après modification vaut acceptation des nouvelles
            conditions.
          </p>
        </section>

        <section>
          <h2 className="font-semibold text-slate-900">12. Droit applicable et litiges</h2>
          <p className="mt-2">
            Les présentes CGU sont soumises au droit français. En cas de
            litige, les parties s&apos;efforceront de trouver une solution amiable.
            À défaut, les tribunaux français compétents seront saisis, sous
            réserve des règles de compétence applicables, notamment pour les
            consommateurs (médiation de la consommation).
          </p>
        </section>

        <section>
          <h2 className="font-semibold text-slate-900">13. Contact</h2>
          <p className="mt-2">
            Pour toute question relative aux présentes CGU :{' '}
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
