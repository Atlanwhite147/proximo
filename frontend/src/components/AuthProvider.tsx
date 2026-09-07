'use client';

import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import api from '@/lib/api';
import type { User } from '@/lib/types';

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  refresh: () => Promise<void>;
  logout: () => Promise<void>;
  setUser: (user: User | null) => void;
  isAdmin: boolean;
  /** SUPERADMIN : gère toutes les résidences (plateforme). */
  isSuperAdmin: boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

/**
 * Contexte d'authentification : l'état utilisateur est restauré au
 * chargement via GET /auth/me (les tokens restent dans des cookies HTTP-only).
 *
 * Premier lancement : si aucun compte administrateur n'existe (installation
 * requise) et que personne n'est connecté, l'utilisateur est redirigé vers
 * l'assistant d'installation (/install).
 */
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const pathname = usePathname();
  const router = useRouter();

  const refresh = useCallback(async () => {
    try {
      const data = await api<{ user: User }>('/auth/me');
      setUser(data.user);
    } catch {
      setUser(null);
    }
  }, []);

  useEffect(() => {
    void refresh().finally(() => setLoading(false));
  }, [refresh]);

  // Rafraîchit le profil quand l'onglet redevient visible (l'admin peut avoir
  // validé le compte ailleurs) et, tant que le compte est PENDING, toutes les
  // 15 s : l'écran « en attente » se débloque dès la validation, sans F5.
  useEffect(() => {
    const sync = () => {
      if (!loading) void refresh();
    };
    window.addEventListener('focus', sync);
    // Polling uniquement pour les comptes PENDING (déblocage auto).
    const poll =
      user?.status === 'PENDING'
        ? window.setInterval(() => void refresh(), 15_000)
        : undefined;
    return () => {
      window.removeEventListener('focus', sync);
      if (poll) window.clearInterval(poll);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, user?.status]);

  // Assistant d'installation : redirection automatique au premier lancement.
  useEffect(() => {
    if (loading) return;
    if (user) return; // un compte existe déjà (et donc un admin a été créé)
    if (pathname === '/install') return; // déjà sur l'assistant
    api<{ required: boolean }>('/setup/status')
      .then((data) => {
        if (data.required) router.replace('/install');
      })
      .catch(() => {
        // API injoignable : on laisse la navigation normale.
      });
  }, [loading, user, pathname, router]);

  const logout = useCallback(async () => {
    try {
      await api('/auth/logout', { method: 'POST' });
    } finally {
      setUser(null);
    }
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        refresh,
        logout,
        setUser,
        isAdmin: user?.role === 'ADMIN' || user?.role === 'SUPERADMIN',
        isSuperAdmin: user?.role === 'SUPERADMIN',
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth doit être utilisé dans <AuthProvider>');
  }
  return context;
}
