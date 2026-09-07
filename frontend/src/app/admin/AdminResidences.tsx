'use client';

import { useCallback, useEffect, useState } from 'react';
import api from '@/lib/api';
import { SectionLabel } from '@/components/ui/section-label';

interface AdminResidence {
  id: string;
  name: string;
  code: string | null;
  agencyName: string | null;
  syndicEmail: string | null;
  createdAt: string;
  _count?: { users: number; listings: number; incidents: number };
}

/**
 * Gestion des résidences — réservée au SUPERADMIN (toutes les résidences).
 */
export function AdminResidences() {
  const [residences, setResidences] = useState<AdminResidence[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Formulaire de création
  const [newName, setNewName] = useState('');
  const [newCode, setNewCode] = useState('');
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await api<{ residences: AdminResidence[] }>('/admin/residences');
      setResidences(data.residences);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Chargement impossible');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const create = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setSuccess(null);
    if (!newName.trim() || !newCode.trim()) {
      setError('Nom et code de résidence requis');
      return;
    }
    setCreating(true);
    try {
      await api('/admin/residences', {
        method: 'POST',
        body: JSON.stringify({ name: newName.trim(), code: newCode.trim() }),
      });
      setNewName('');
      setNewCode('');
      setSuccess('Résidence créée. Les habitants peuvent s’inscrire avec ce code.');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Création impossible');
    } finally {
      setCreating(false);
    }
  };

  if (loading) {
    return <p className="text-sm text-muted-foreground">Chargement des résidences…</p>;
  }

  return (
    <section className="ds-card p-6">
      <SectionLabel color="blue">Plateforme · Résidences</SectionLabel>
      <h2 className="mt-2 font-display text-xl">Toutes les résidences</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Chaque résidence a son code d&apos;accès (inscription email et Google).
      </p>

      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
      {success && <p className="mt-3 text-sm text-emerald-600">{success}</p>}

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {residences?.map((residence) => (
          <div key={residence.id} className="rounded-xl border border-border bg-slate-50 p-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-semibold text-foreground">{residence.name}</p>
                <p className="font-mono text-xs uppercase tracking-badge text-muted-foreground">
                  {residence.code ?? 'sans code'}
                </p>
              </div>
            </div>
            {residence.agencyName && (
              <p className="mt-1 text-xs text-muted-foreground">
                {residence.agencyName}
                {residence.syndicEmail ? ` · ${residence.syndicEmail}` : ''}
              </p>
            )}
            <div className="mt-2 flex gap-3 text-xs text-muted-foreground">
              <span>👥 {residence._count?.users ?? 0}</span>
              <span>📦 {residence._count?.listings ?? 0}</span>
              <span>🚨 {residence._count?.incidents ?? 0}</span>
            </div>
          </div>
        ))}
        {residences && residences.length === 0 && (
          <p className="text-sm text-muted-foreground">Aucune résidence pour le moment.</p>
        )}
      </div>

      <form onSubmit={(event) => void create(event)} className="mt-6 space-y-3">
        <p className="text-sm font-semibold text-foreground">➕ Créer une résidence</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <input
            type="text"
            required
            maxLength={120}
            value={newName}
            onChange={(event) => setNewName(event.target.value)}
            placeholder="Nom (ex. Les Cèdres)"
            className="input-field h-11 "
          />
          <input
            type="text"
            required
            maxLength={32}
            value={newCode}
            onChange={(event) => setNewCode(event.target.value)}
            placeholder="Code d'accès (ex. CEDRES-2026)"
            className="input-field h-11 "
          />
        </div>
        <button type="submit" disabled={creating} className="btn-primary-sm">
          {creating ? 'Création…' : 'Créer la résidence'}
        </button>
      </form>
    </section>
  );
}
