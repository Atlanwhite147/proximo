'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import api from '@/lib/api';
import type { Conversation } from '@/lib/types';
import { useAuth } from './AuthProvider';
import { BetaIndicator } from './ui/beta-indicator';

/**
 * Navigation « app de résidence » :
 * - Desktop : header compact avec le nom de la résidence
 * - Mobile : barre d'onglets en bas d'écran (Accueil, Annonces, Messages,
 *   Signalements, Profil) — navigation type application résidentielle.
 */

const TABS = [
  { href: '/', label: 'Accueil', icon: '🏠' },
  { href: '/annonces', label: 'Annonces', icon: '📦' },
  { href: '/messages', label: 'Messages', icon: '💬' },
  { href: '/profil', label: 'Profil', icon: '👤' },
];

function useUnreadCount(user: unknown, pathname: string): number {
  const [unread, setUnread] = useState(0);
  useEffect(() => {
    if (!user) {
      setUnread(0);
      return;
    }
    let active = true;
    api<{ conversations: Conversation[] }>('/messages')
      .then((data) => {
        if (active) {
          setUnread(data.conversations.reduce((sum, c) => sum + c.unreadCount, 0));
        }
      })
      .catch(() => {
        if (active) setUnread(0);
      });
    return () => {
      active = false;
    };
  }, [user, pathname]);
  return unread;
}

export function Navbar() {
  const { user, loading, logout, isAdmin } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const unread = useUnreadCount(user, pathname);

  const handleLogout = async () => {
    await logout();
    router.push('/');
    router.refresh();
  };

  const isTabActive = (href: string) =>
    href === '/' ? pathname === '/' : pathname.startsWith(href);

  return (
    <>
      {/* ─── Header (desktop + mobile) ─────────────────────── */}
      <header className="sticky top-0 z-20 border-b border-border bg-white/95 backdrop-blur">
        <nav className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3">
          <Link href="/" className="flex items-center gap-2 text-lg font-bold text-foreground">
            <span
              aria-hidden
              className="flex h-8 w-8 items-center justify-center rounded-xl bg-brand-gradient text-base text-white"
            >
              🤝
            </span>
            Proximo
            <BetaIndicator />
            {user?.residenceName && (
              <span className="hidden rounded-full bg-brand-50 px-2.5 py-0.5 text-xs font-medium text-brand-700 sm:inline">
                {user.residenceName}
              </span>
            )}
          </Link>

          {/* Liens desktop */}
          <div className="hidden items-center gap-1 md:flex">
            {TABS.filter((tab) => tab.href !== '/messages' || user).map((tab) => (
              <Link
                key={tab.href}
                href={tab.href}
                className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                  isTabActive(tab.href)
                    ? 'bg-primary-50 text-primary-700'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                {tab.label}
                {tab.href === '/messages' && unread > 0 && (
                  <span className="ml-1 rounded-full bg-brand-gradient px-2 py-0.5 text-xs font-semibold text-white">
                    {unread}
                  </span>
                )}
              </Link>
            ))}
            {isAdmin && (
              <Link
                href="/admin"
                className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                  isTabActive('/admin')
                    ? 'bg-primary-50 text-primary-700'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                Admin
              </Link>
            )}
          </div>

          <div className="flex items-center gap-2">
            {loading ? null : user ? (
              <button
                type="button"
                onClick={() => void handleLogout()}
                className="rounded-lg px-3 py-2 text-sm font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-800"
              >
                Déconnexion
              </button>
            ) : (
              <>
                <Link
                  href="/connexion"
                  className="rounded-lg px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100"
                >
                  Connexion
                </Link>
                <Link
                  href="/inscription"
                  className="rounded-lg bg-brand-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-brand-700"
                >
                  Rejoindre
                </Link>
              </>
            )}
          </div>
        </nav>
      </header>

      {/* ─── Tab bar mobile (en bas d'écran) ───────────────── */}
      <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-slate-200 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden">
        <div className="mx-auto flex max-w-md items-stretch justify-around">
          {TABS.map((tab) => {
            // Non connecté : l'onglet Profil devient un accès Connexion
            // (sinon l'utilisateur atterrit sur /profil → redirigé).
            const isProfile = tab.href === '/profil';
            const effectiveHref = !user && isProfile ? '/connexion' : tab.href;
            const effectiveLabel = !user && isProfile ? 'Connexion' : tab.label;
            const active = isTabActive(effectiveHref);
            return (
              <Link
                key={tab.href}
                href={effectiveHref}
                className={`relative flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] font-medium ${
                  active ? 'text-brand-700' : 'text-slate-400'
                }`}
              >
                <span className="text-xl leading-none">{tab.icon}</span>
                {effectiveLabel}
                {tab.href === '/messages' && unread > 0 && (
                  <span className="absolute right-1/2 top-1 translate-x-3 rounded-full bg-brand-600 px-1.5 text-[10px] font-bold text-white">
                    {unread}
                  </span>
                )}
                {active && (
                  <span className="absolute inset-x-6 top-0 h-0.5 rounded-full bg-brand-600" />
                )}
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
