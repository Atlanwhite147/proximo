'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import api from '@/lib/api';
import { useAuth } from '@/components/AuthProvider';
import { RequireAccount } from '@/components/RequireAccount';
import { Spinner } from '@/components/Feedback';

interface Neighbor {
  id: string;
  firstName: string;
  lastName: string;
  building: string | null;
  floor: string | null;
  role: string;
}

/**
 * Annuaire complet de la résidence : recherche par nom, contact direct.
 * Le dashboard n'affiche qu'un aperçu (6) — ici on liste tout.
 */
export default function VoisinsPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [neighbors, setNeighbors] = useState<Neighbor[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<{ neighbors: Neighbor[] }>('/users/neighbors')
      .then((data) => setNeighbors(data.neighbors))
      .catch(() => setError('Impossible de charger l’annuaire.'))
      .finally(() => setLoading(false));
  }, []);

  const contact = async (neighbor: Neighbor) => {
    try {
      const data = await api<{ conversationId: string }>('/messages', {
        method: 'POST',
        body: JSON.stringify({
          recipientId: neighbor.id,
          content: `Bonjour ${neighbor.firstName}, je vous contacte depuis l'annuaire de la résidence.`,
        }),
      });
      router.push(`/messages/${data.conversationId}`);
    } catch {
      /* silencieux */
    }
  };

  const q = query.trim().toLowerCase();
  const filtered = q
    ? neighbors.filter(
        (n) =>
          n.firstName.toLowerCase().includes(q) ||
          (n.lastName ?? '').toLowerCase().includes(q),
      )
    : neighbors;

  return (
    <RequireAccount>
      <div className="mx-auto max-w-2xl px-4 py-6">
        <div className="mb-4 flex items-end justify-between gap-3">
          <div>
            <p className="font-mono text-[11px] font-medium uppercase tracking-badge text-slate-400">
              ● Annuaire
            </p>
            <h1 className="mt-0.5 text-xl font-bold text-slate-900">
              Les habitants de {user?.residenceName ?? 'la résidence'}
            </h1>
            <p className="text-sm text-slate-500">
              {neighbors.length} habitant{neighbors.length > 1 ? 's' : ''} — écrivez-leur
              directement ou répondez à leurs annonces.
            </p>
          </div>
        </div>

        {/* Recherche */}
        <div className="relative mb-4">
          <span className="pointer-events-none absolute inset-y-0 left-3.5 flex items-center text-slate-400">
            🔍
          </span>
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Rechercher un voisin par son nom…"
            className="w-full rounded-xl border border-slate-300 bg-white py-2.5 pl-10 pr-4 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"
            aria-label="Rechercher un voisin"
          />
        </div>

        {loading && <Spinner label="Chargement de l’annuaire…" />}
        {error && <p className="text-sm text-red-600">{error}</p>}

        {!loading && !error && filtered.length === 0 && (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center">
            <p className="text-3xl">🔍</p>
            <p className="mt-2 font-medium text-slate-600">
              {q ? 'Aucun voisin ne correspond à cette recherche.' : 'L’annuaire est vide pour le moment.'}
            </p>
            {!q && (
              <Link
                href="/inviter"
                className="mt-4 inline-block rounded-xl bg-brand-gradient px-5 py-2.5 text-sm font-semibold text-white"
              >
                📲 Inviter un voisin
              </Link>
            )}
          </div>
        )}

        {!loading && !error && filtered.length > 0 && (
          <ul className="ds-card divide-y divide-slate-100">
            {filtered.map((neighbor) => (
              <li key={neighbor.id} className="flex items-center gap-3 px-4 py-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-gradient text-sm font-bold text-white">
                  {neighbor.firstName.charAt(0).toUpperCase()}
                  {neighbor.lastName?.charAt(0).toUpperCase() ?? ''}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold text-slate-800">
                    {neighbor.firstName} {neighbor.lastName}
                    {neighbor.role === 'ADMIN' && (
                      <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
                        Admin
                      </span>
                    )}
                  </span>
                  <span className="block truncate text-xs text-slate-400">
                    {neighbor.building && neighbor.floor
                      ? `Bât. ${neighbor.building} · Étage ${neighbor.floor}`
                      : neighbor.building
                        ? `Bât. ${neighbor.building}`
                        : neighbor.floor
                          ? `Étage ${neighbor.floor}`
                          : 'Voisin de la résidence'}
                  </span>
                </span>
                <button
                  type="button"
                  onClick={() => void contact(neighbor)}
                  className="shrink-0 rounded-lg border border-brand-200 bg-brand-50 px-3 py-1.5 text-xs font-semibold text-brand-700 transition-colors hover:bg-brand-100"
                >
                  💬 Message
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </RequireAccount>
  );
}
