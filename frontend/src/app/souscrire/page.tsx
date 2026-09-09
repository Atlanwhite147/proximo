import Link from 'next/link';

/**
 * Phase test : la souscription en ligne n'est pas ouverte.
 * L'accès se fait sur demande (contact direct).
 */
export default function SouscrirePage() {
  return (
    <div className="mx-auto max-w-md px-4 py-16">
      <div className="ds-card p-8 text-center">
        <div className="text-4xl">🏢</div>
        <h1 className="mt-3 text-xl font-bold text-slate-900">Accès sur demande</h1>
        <p className="mt-2 text-sm leading-relaxed text-slate-600">
          La souscription en ligne n’est pas encore ouverte. Si votre résidence
          souhaite rejoindre Proximo, écrivez-nous et nous vous répondons sous 24 h.
        </p>
        <a
          href="mailto:proximo@147.ovh"
          className="btn-primary mt-6 inline-flex w-auto px-6"
        >
          Nous contacter
        </a>
        <p className="mt-3">
          <Link href="/" className="text-sm font-medium text-brand-600 hover:underline">
            Revenir à l’accueil
          </Link>
        </p>
      </div>
    </div>
  );
}
