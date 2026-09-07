'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { Spinner } from '@/components/Feedback';
import { useAuth } from '@/components/AuthProvider';

/**
 * Garde d'accès : l'application est réservée aux comptes VALIDÉS (ACTIVE).
 * - non connecté → redirection /connexion
 * - compte PENDING ou SUSPENDED → écran « accès en attente »
 * Le backend applique la même règle (StatusGuard) : cette garde n'est
 * qu'une couche d'interface.
 */
export function RequireAccount({ children, next }: { children: React.ReactNode; next?: string }) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.replace(next ? `/connexion?next=${encodeURIComponent(next)}` : '/connexion');
    }
  }, [loading, user, router, next]);

  if (loading) {
    return (
      <div className="py-16">
        <Spinner label="Vérification du compte…" />
      </div>
    );
  }

  if (!user) {
    return null; // redirection en cours
  }

  if (user.status !== 'ACTIVE') {
    return (
      <div className="mx-auto max-w-md px-4 py-16">
        <div className="ds-card p-8 text-center">
          <div className="text-4xl">{user.status === 'SUSPENDED' ? '🚫' : '⏳'}</div>
          <h1 className="mt-3 text-xl font-bold text-slate-900">
            {user.status === 'SUSPENDED'
              ? 'Compte suspendu'
              : 'Compte en attente de validation'}
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            {user.status === 'SUSPENDED'
              ? 'Votre compte a été suspendu par un administrateur. Contactez la gestion de la résidence.'
              : 'Votre inscription doit être validée par un administrateur avant d’accéder à la résidence.'}
          </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
