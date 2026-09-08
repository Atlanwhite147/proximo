'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';

type Platform = 'ios' | 'android' | 'other';

function detectPlatform(): Platform {
  if (typeof navigator === 'undefined') return 'other';
  const ua = navigator.userAgent;
  if (/iPad|iPhone|iPod/.test(ua)) return 'ios';
  if (/Android/.test(ua)) return 'android';
  return 'other';
}

/**
 * Aide « Ajouter à l'écran d'accueil » (mobile).
 * Petit encart dépliable avec les étapes selon la plateforme :
 * - iOS Safari : Partager → Sur l'écran d'accueil
 * - Android Chrome : menu ⋮ → Ajouter à l'écran d'accueil
 * - Autres : favoris / écran d'accueil générique
 */
export function AddToHomeScreen({ className }: { className?: string }) {
  const [open, setOpen] = useState(false);
  const [platform, setPlatform] = useState<Platform>('other');

  useEffect(() => {
    setPlatform(detectPlatform());
  }, []);

  return (
    <div
      className={cn(
        'overflow-hidden rounded-xl border border-primary-100 bg-primary-50/70',
        className,
      )}
    >
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
      >
        <span className="text-sm font-medium text-primary-800">
          📲 Ajouter Proximo à l&apos;écran d&apos;accueil
        </span>
        <span
          className={cn(
            'flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary-100 text-sm font-semibold text-primary-700 transition-transform',
            open && 'rotate-45',
          )}
        >
          +
        </span>
      </button>

      {open && (
        <div className="border-t border-primary-100 px-4 pb-4 pt-3 text-sm text-slate-600">
          <p className="font-medium text-slate-800">
            {platform === 'ios' && 'Sur iPhone / iPad (Safari) :'}
            {platform === 'android' && 'Sur Android (Chrome) :'}
            {platform === 'other' && 'Depuis le menu de votre navigateur :'}
          </p>

          {platform === 'ios' && (
            <ol className="mt-2 list-decimal space-y-1.5 pl-5">
              <li>
                Touchez <strong>Partager</strong>{' '}
                <span className="whitespace-nowrap">(carré avec une flèche ↑)</span> dans la barre
                Safari.
              </li>
              <li>
                Choisissez <strong>Sur l&apos;écran d&apos;accueil</strong>.
              </li>
              <li>
                Touchez <strong>Ajouter</strong> : l&apos;icône Proximo apparaît sur votre écran,
                comme une appli.
              </li>
            </ol>
          )}

          {platform === 'android' && (
            <ol className="mt-2 list-decimal space-y-1.5 pl-5">
              <li>
                Touchez le menu <strong>⋮</strong> (en haut à droite de Chrome).
              </li>
              <li>
                Choisissez <strong>Ajouter à l&apos;écran d&apos;accueil</strong>.
              </li>
              <li>
                Touchez <strong>Ajouter</strong> : l&apos;icône Proximo apparaît sur votre écran,
                comme une appli.
              </li>
            </ol>
          )}

          {platform === 'other' && (
            <p className="mt-2">
              Cherchez <strong>« Ajouter à l&apos;écran d&apos;accueil »</strong> ou{' '}
              <strong>« Ajouter aux favoris »</strong> : vous gardez ainsi un accès direct à
              Proximo, sans repasser par le lien.
            </p>
          )}

          <p className="mt-3 text-xs text-muted-foreground">
            💡 Vous n&apos;avez pas besoin d&apos;installer quoi que ce soit : Proximo fonctionne
            directement dans le navigateur. Ce raccourci ouvre simplement l&apos;application plus
            vite.
          </p>
        </div>
      )}
    </div>
  );
}
