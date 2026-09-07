'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';

/**
 * BetaIndicator — badge d'environnement BÊTA (hautement discret).
 * Affiché uniquement sur Bproximo (l'instance bêta), détecté par hostname :
 * - bproximo.147.ovh / *.bproximo.* → BÊTA TEST (ambre, dot pulsant)
 * - sinon → null (prod : aucun badge)
 * Surcharge possible via `NEXT_PUBLIC_APP_ENV=beta` au build.
 */
export function isBetaEnvironment(): boolean {
  if (process.env.NEXT_PUBLIC_APP_ENV === 'beta') return true;
  if (typeof window !== 'undefined') {
    const host = window.location.hostname;
    return host.startsWith('bproximo') || host.includes('.beta.') || host.includes('beta.');
  }
  return false;
}

export function BetaIndicator({ className }: { className?: string }) {
  const [isBeta, setIsBeta] = useState(false);

  useEffect(() => {
    setIsBeta(isBetaEnvironment());
  }, []);

  if (!isBeta) return null;

  return (
    <span
      title="Instance bêta de test — les données peuvent être réinitialisées"
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-0.5 font-mono text-[10px] font-medium uppercase tracking-badge text-amber-600',
        className,
      )}
    >
      <span aria-hidden className="relative flex h-1.5 w-1.5">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-500 opacity-60" />
        <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-amber-500" />
      </span>
      BÊTA TEST
    </span>
  );
}
