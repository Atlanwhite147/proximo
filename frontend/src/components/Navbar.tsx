'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import {
  Home,
  LogOut,
  MessageCircle,
  Package,
  Plus,
  Settings,
  User,
  type LucideIcon,
} from 'lucide-react';
import api from '@/lib/api';
import type { Conversation } from '@/lib/types';
import type { User as AppUser } from '@/lib/types';
import { useAuth } from './AuthProvider';
import { BetaIndicator } from './ui/beta-indicator';

/**
 * Navigation « app de résidence » :
 * - Desktop : header compact avec le nom de la résidence
 * - Mobile : barre d'onglets en bas d'écran (Accueil, Annonces, Messages,
 *   Signalements, Profil) — navigation type application résidentielle.
 */

const TABS: Array<{ href: string; label: string; icon: LucideIcon }> = [
  { href: '/', label: 'Accueil', icon: Home },
  { href: '/annonces', label: 'Annonces', icon: Package },
  { href: '/messages', label: 'Messages', icon: MessageCircle },
  { href: '/profil', label: 'Profil', icon: User },
];

/** Onglets du header desktop : Profil remplacé par le menu avatar. */
const DESKTOP_TABS = TABS.filter((tab) => tab.href !== '/profil');

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

/** Menu avatar (desktop) : Profil / Admin / Déconnexion. */
function UserMenu({
  user,
  isAdmin,
  onLogout,
}: {
  user: AppUser;
  isAdmin: boolean;
  onLogout: () => void;
}) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const initial = (user.firstName ?? 'U').charAt(0).toUpperCase();

  return (
    <div ref={menuRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-gradient text-sm font-bold text-white shadow-sm transition-transform hover:scale-105"
        title="Mon compte"
      >
        {initial}
      </button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 z-30 mt-2 w-48 overflow-hidden rounded-2xl border border-slate-200 bg-white py-1 shadow-lg"
        >
          <div className="border-b border-slate-100 px-4 py-2.5">
            <p className="truncate text-sm font-semibold text-slate-800">
              {user.firstName} {user.lastName}
            </p>
            <p className="truncate text-xs text-slate-400">{user.email}</p>
          </div>
          <Link
            href="/profil"
            role="menuitem"
            className="flex items-center gap-2.5 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
          >
            <User className="h-4 w-4 text-slate-400" strokeWidth={1.75} />
            Mon profil
          </Link>
          {isAdmin && (
            <Link
              href="/admin"
              role="menuitem"
              className="flex items-center gap-2.5 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
            >
              <Settings className="h-4 w-4 text-slate-400" strokeWidth={1.75} />
              Administration
            </Link>
          )}
          <button
            type="button"
            role="menuitem"
            onClick={onLogout}
            className="flex w-full items-center gap-2.5 px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50"
          >
            <LogOut className="h-4 w-4" strokeWidth={1.75} />
            Déconnexion
          </button>
        </div>
      )}
    </div>
  );
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
            {DESKTOP_TABS.filter((tab) => tab.href !== '/messages' || user).map((tab) => (
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
          </div>

          <div className="flex items-center gap-2">
            {loading ? null : user ? (
              <UserMenu isAdmin={isAdmin} onLogout={() => void handleLogout()} user={user} />
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
                  className="btn-primary-sm px-3"
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
            const Icon = tab.icon;
            // Bouton « + » central : inséré entre Annonces et Messages.
            if (tab.href === '/messages') {
              const fab = user?.status === 'ACTIVE';
              return (
                <div key="group-center" className="flex flex-1 items-stretch justify-around">
                  {fab && (
                    <Link
                      href="/annonces/nouvelle"
                      aria-label="Publier une annonce"
                      className="relative -mt-5 flex flex-1 flex-col items-center gap-0.5 py-1 text-[11px] font-semibold text-brand-700"
                    >
                      <span className="flex h-11 w-11 items-center justify-center rounded-full bg-brand-gradient text-white shadow-lg ring-4 ring-white active:scale-95">
                        <Plus className="h-6 w-6" strokeWidth={2.25} />
                      </span>
                      Publier
                    </Link>
                  )}
                  <Link
                    key={tab.href}
                    href={effectiveHref}
                    className={`relative flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] font-medium ${
                      active ? 'text-brand-700' : 'text-slate-400'
                    }`}
                  >
                    <Icon className="h-[22px] w-[22px]" strokeWidth={1.75} />
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
                </div>
              );
            }
            return (
              <Link
                key={tab.href}
                href={effectiveHref}
                className={`relative flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] font-medium ${
                  active ? 'text-brand-700' : 'text-slate-400'
                }`}
              >
                <Icon className="h-[22px] w-[22px]" strokeWidth={1.75} />
                {effectiveLabel}
                {active && (
                  <span className="absolute inset-x-6 top-0 h-0.5 rounded-full bg-brand-600" />
                )}
              </Link>
            );
          })}
          {/* Onglet Admin (mobile) : le lien du header est masqué sous md. */}
          {isAdmin && (
            <Link
              href="/admin"
              className={`relative flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] font-medium ${
                isTabActive('/admin') ? 'text-brand-700' : 'text-slate-400'
              }`}
            >
                <Settings className="h-[22px] w-[22px]" strokeWidth={1.75} />
                Admin
              {isTabActive('/admin') && (
                <span className="absolute inset-x-6 top-0 h-0.5 rounded-full bg-brand-600" />
              )}
            </Link>
          )}
        </div>
      </nav>
    </>
  );
}
