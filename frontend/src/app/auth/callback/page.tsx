'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import api from '@/lib/api';
import { useAuth } from '@/components/AuthProvider';
import type { User } from '@/lib/types';

/** Délai au-delà duquel on cesse d'attendre et on propose une issue. */
const DELAI_MAX_MS = 10_000;

/**
 * Retour de connexion Google : le callback backend a posé les cookies de
 * session, cette page vérifie la session puis repart vers l'accueil.
 *
 * Robustesse (cette page ne doit JAMAIS bloquer l'utilisateur) :
 *  - les issues de secours sont dans le HTML initial, donc visibles même si
 *    le JavaScript ne s'exécute pas (extension, réseau filtré, JS coupé) ;
 *  - la vérification de session est un flux déterministe (une requête, une
 *    décision) : plus de dépendance à un re-render qui peut ne jamais arriver ;
 *  - au-delà de 10 s, un échec explicite est affiché au lieu d'un écran figé ;
 *  - le client API borne chaque requête dans le temps (voir lib/api.ts).
 */
export default function AuthCallbackPage() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const [echec, setEchec] = useState(false);

  useEffect(() => {
    if (loading) return;
    if (user) {
      router.replace('/');
      return;
    }

    let annule = false;
    // Filet de sécurité : on n'attend pas indéfiniment une réponse du serveur.
    const filet = window.setTimeout(() => {
      if (!annule) setEchec(true);
    }, DELAI_MAX_MS);

    void (async () => {
      // Dernière vérification directe : la session a pu être posée juste après
      // le chargement du contexte.
      try {
        const data = await api<{ user: User }>('/auth/me');
        if (annule) return;
        if (data.user) {
          window.clearTimeout(filet);
          router.replace('/');
          return;
        }
      } catch {
        // Pas de session : on bascule sur l'écran d'échec ci-dessous.
      }
      if (annule) return;
      window.clearTimeout(filet);
      setEchec(true);
    })();

    return () => {
      annule = true;
      window.clearTimeout(filet);
    };
  }, [loading, user, router]);

  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4">
      <div className="w-full max-w-sm text-center">
        {echec ? (
          <>
            <p className="text-3xl">😕</p>
            <h1 className="mt-3 text-lg font-bold text-slate-900">
              La connexion Google n&apos;a pas abouti
            </h1>
            <p className="mt-2 text-sm text-slate-500">
              La session n&apos;a pas pu être ouverte. Réessayez, ou connectez-vous avec
              votre adresse email et votre mot de passe.
            </p>
            <div className="mt-5 flex flex-col gap-2">
              <Link
                href="/connexion"
                className="rounded-xl bg-brand-gradient px-5 py-2.5 text-sm font-semibold text-white"
              >
                Réessayer de me connecter
              </Link>
              <Link
                href="/"
                className="rounded-xl border border-slate-300 px-5 py-2.5 text-sm font-semibold text-slate-700"
              >
                Continuer vers l&apos;accueil
              </Link>
            </div>
          </>
        ) : (
          <>
            <span
              className="mx-auto block h-6 w-6 animate-spin rounded-full border-2 border-slate-300 border-t-brand-600"
              aria-hidden
            />
            <p className="mt-4 text-sm font-medium text-slate-600" role="status">
              Connexion Google en cours…
            </p>
            {/* Liens présents dans le HTML initial : si le JavaScript ne
                s'exécute pas, l'utilisateur garde une porte de sortie. */}
            <div className="mt-6 border-t border-slate-100 pt-4">
              <p className="text-xs text-slate-400">Ça prend plus de temps que prévu ?</p>
              <div className="mt-2 flex flex-wrap items-center justify-center gap-3 text-sm">
                <Link href="/" className="font-semibold text-brand-600 hover:underline">
                  Continuer vers l&apos;accueil
                </Link>
                <span className="text-slate-300" aria-hidden>
                  ·
                </span>
                <Link href="/connexion" className="font-semibold text-brand-600 hover:underline">
                  Se reconnecter
                </Link>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
