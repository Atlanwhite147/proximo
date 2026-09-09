'use client';

import { useCallback, useEffect, useState } from 'react';
import api from '@/lib/api';
import { SectionLabel } from '@/components/ui/section-label';
import { cn } from '@/lib/utils';
import {
  INCIDENT_CATEGORY_LABELS,
  INCIDENT_STATUS_LABELS,
  USER_STATUS_LABELS,
  type AdminUser,
  type Incident,
  type Invitation,
  type Listing,
  type ListingOwner,
} from '@/lib/types';

interface AdminResidence {
  id: string;
  name: string;
  code: string | null;
  agencyName: string | null;
  syndicEmail: string | null;
  notifyAgencyOnIncident?: boolean;
  notifyResidentsOnIncident?: boolean;
  notifyResidentsOnListing?: boolean;
  createdAt: string;
  membersActive?: number;
  membersPending?: number;
  _count?: { users: number; listings: number; incidents: number; invitations: number };
}

type DetailTab = 'members' | 'listings' | 'incidents' | 'invitations';

const tabLabels: Record<DetailTab, string> = {
  members: '👥 Membres',
  listings: '📦 Annonces',
  incidents: '🚨 Signalements',
  invitations: '📲 Invitations',
};

/**
 * Gestion des résidences — réservée au SUPERADMIN (toutes les résidences).
 * Chaque carte affiche les compteurs ; un clic ouvre le détail (membres,
 * annonces, signalements, invitations) et permet modifier/supprimer.
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

  // Détail d'une résidence sélectionnée
  const [selected, setSelected] = useState<AdminResidence | null>(null);
  const [tab, setTab] = useState<DetailTab>('members');

  // Édition de la résidence sélectionnée
  const [editName, setEditName] = useState('');
  const [editCode, setEditCode] = useState('');
  const [editAgency, setEditAgency] = useState('');
  const [editSyndicEmail, setEditSyndicEmail] = useState('');
  const [editNotifyAgency, setEditNotifyAgency] = useState(true);
  const [editNotifyIncident, setEditNotifyIncident] = useState(true);
  const [editNotifyListing, setEditNotifyListing] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

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

  const openDetail = (residence: AdminResidence) => {
    setSelected(residence);
    setTab('members');
    setEditName(residence.name);
    setEditCode(residence.code ?? '');
    setEditAgency(residence.agencyName ?? '');
    setEditSyndicEmail(residence.syndicEmail ?? '');
    setEditNotifyAgency(residence.notifyAgencyOnIncident ?? true);
    setEditNotifyIncident(residence.notifyResidentsOnIncident ?? true);
    setEditNotifyListing(residence.notifyResidentsOnListing ?? true);
    setError(null);
    setSuccess(null);
  };

  const closeDetail = () => {
    setSelected(null);
    void load();
  };

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

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selected) return;
    setError(null);
    setSuccess(null);
    setSaving(true);
    try {
      const data = await api<{ residence: AdminResidence }>(`/admin/residences/${selected.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          name: editName.trim(),
          code: editCode.trim(),
          agencyName: editAgency.trim() || undefined,
          syndicEmail: editSyndicEmail.trim() || undefined,
          notifyAgencyOnIncident: editNotifyAgency,
          notifyResidentsOnIncident: editNotifyIncident,
          notifyResidentsOnListing: editNotifyListing,
        }),
      });
      setSuccess('Résidence mise à jour.');
      setSelected((prev) => ({ ...prev!, ...data.residence }));
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Enregistrement impossible');
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!selected) return;
    if (!window.confirm(`Supprimer la résidence « ${selected.name} » ?`)) return;
    setError(null);
    setSuccess(null);
    setDeleting(true);
    try {
      await api(`/admin/residences/${selected.id}`, { method: 'DELETE' });
      setSelected(null);
      setSuccess(`Résidence « ${selected.name} » supprimée.`);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Suppression impossible');
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return <p className="text-sm text-muted-foreground">Chargement des résidences…</p>;
  }

  // ─── Vue détaillée d'une résidence ──────────────────────────
  if (selected) {
    return (
      <ResidenceDetail
        residence={selected}
        tab={tab}
        setTab={setTab}
        editName={editName}
        setEditName={setEditName}
        editCode={editCode}
        setEditCode={setEditCode}
        editAgency={editAgency}
        setEditAgency={setEditAgency}
        editSyndicEmail={editSyndicEmail}
        setEditSyndicEmail={setEditSyndicEmail}
        editNotifyAgency={editNotifyAgency}
        setEditNotifyAgency={setEditNotifyAgency}
        editNotifyIncident={editNotifyIncident}
        setEditNotifyIncident={setEditNotifyIncident}
        editNotifyListing={editNotifyListing}
        setEditNotifyListing={setEditNotifyListing}
        saving={saving}
        onSave={save}
        deleting={deleting}
        onDelete={remove}
        onBack={closeDetail}
        error={error}
        success={success}
        setError={setError}
        setSuccess={setSuccess}
      />
    );
  }

  // ─── Liste des résidences ───────────────────────────────────
  return (
    <section className="ds-card p-6">
      <SectionLabel color="blue">Plateforme · Résidences</SectionLabel>
      <h2 className="mt-2 font-display text-xl">Toutes les résidences</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Chaque résidence a son code d&apos;accès (inscription email et Google).
        Cliquez sur une résidence pour la gérer.
      </p>

      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
      {success && <p className="mt-3 text-sm text-emerald-600">{success}</p>}

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {residences?.map((residence) => (
          <button
            key={residence.id}
            type="button"
            onClick={() => openDetail(residence)}
            className="rounded-xl border border-border bg-slate-50 p-4 text-left transition hover:border-primary-300 hover:shadow-card-hover"
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-semibold text-foreground">{residence.name}</p>
                <p className="font-mono text-xs uppercase tracking-badge text-muted-foreground">
                  {residence.code ?? 'sans code'}
                </p>
              </div>
              <span className="text-muted-foreground">⚙️</span>
            </div>
            {residence.agencyName && (
              <p className="mt-1 text-xs text-muted-foreground">
                {residence.agencyName}
                {residence.syndicEmail ? ` · ${residence.syndicEmail}` : ''}
              </p>
            )}
            <div className="mt-2 flex flex-wrap gap-3 text-xs text-muted-foreground">
              <span className="text-emerald-600">
                👥 {residence.membersActive ?? 0} actifs
              </span>
              <span className="text-amber-600">
                ⏳ {residence.membersPending ?? 0} en attente
              </span>
              <span>📦 {residence._count?.listings ?? 0}</span>
              <span>🚨 {residence._count?.incidents ?? 0}</span>
              <span>📲 {residence._count?.invitations ?? 0}</span>
            </div>
          </button>
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
            placeholder="Code d'accès (ex. MA-RESID-2026)"
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

// ─── Détail d'une résidence ─────────────────────────────────────

function ResidenceDetail({
  residence,
  tab,
  setTab,
  editName,
  setEditName,
  editCode,
  setEditCode,
  editAgency,
  setEditAgency,
  editSyndicEmail,
  setEditSyndicEmail,
  editNotifyAgency,
  setEditNotifyAgency,
  editNotifyIncident,
  setEditNotifyIncident,
  editNotifyListing,
  setEditNotifyListing,
  saving,
  onSave,
  deleting,
  onDelete,
  onBack,
  error,
  success,
  setError,
  setSuccess,
}: {
  residence: AdminResidence;
  tab: DetailTab;
  setTab: (tab: DetailTab) => void;
  editName: string;
  setEditName: (v: string) => void;
  editCode: string;
  setEditCode: (v: string) => void;
  editAgency: string;
  setEditAgency: (v: string) => void;
  editSyndicEmail: string;
  setEditSyndicEmail: (v: string) => void;
  editNotifyAgency: boolean;
  setEditNotifyAgency: (v: boolean) => void;
  editNotifyIncident: boolean;
  setEditNotifyIncident: (v: boolean) => void;
  editNotifyListing: boolean;
  setEditNotifyListing: (v: boolean) => void;
  saving: boolean;
  onSave: (event: React.FormEvent) => void;
  deleting: boolean;
  onDelete: () => void;
  onBack: () => void;
  error: string | null;
  success: string | null;
  setError: (v: string | null) => void;
  setSuccess: (v: string | null) => void;
}) {
  const [members, setMembers] = useState<AdminUser[] | null>(null);
  const [listings, setListings] = useState<Listing[] | null>(null);
  const [incidents, setIncidents] = useState<Incident[] | null>(null);
  const [invitations, setInvitations] = useState<Invitation[] | null>(null);
  const [loadingData, setLoadingData] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoadingData(true);
    setError(null);
    const params = new URLSearchParams({ residenceId: residence.id });
    const queries: Array<[DetailTab, Promise<unknown>]> = [
      ['members', api(`/admin/users?${params}`)],
      ['listings', api(`/admin/listings?${params}`)],
      ['incidents', api(`/admin/incidents?${params}`)],
      ['invitations', api(`/admin/invitations?${params}`)],
    ];
    Promise.all(queries.map(([, p]) => p))
      .then(([m, l, i, inv]) => {
        if (cancelled) return;
        setMembers((m as { users: AdminUser[] }).users);
        setListings((l as { listings: Listing[] }).listings);
        setIncidents((i as { incidents: Incident[] }).incidents);
        setInvitations((inv as { invitations: Invitation[] }).invitations);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Chargement impossible');
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingData(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [residence.id]);

  return (
    <section className="ds-card p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <button
            type="button"
            onClick={onBack}
            className="text-sm font-medium text-brand-600 hover:underline"
          >
            ← Toutes les résidences
          </button>
          <h2 className="mt-1 font-display text-xl">{residence.name}</h2>
          <p className="font-mono text-xs uppercase tracking-badge text-muted-foreground">
            {residence.code ?? 'sans code'}
          </p>
        </div>
        <button
          type="button"
          onClick={onDelete}
          disabled={deleting}
          className="rounded-lg border border-red-200 px-3.5 py-2 text-sm font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50"
        >
          {deleting ? 'Suppression…' : '🗑 Supprimer'}
        </button>
      </div>

      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
      {success && <p className="mt-3 text-sm text-emerald-600">{success}</p>}

      {/* Réglages de la résidence (paramètres syndic) */}
      <form
        onSubmit={(event) => onSave(event)}
        className="mt-5 rounded-xl border border-border bg-slate-50 p-4"
      >
        <p className="text-xs font-mono uppercase tracking-badge text-muted-foreground">
          🏢 Paramètres de la résidence
        </p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <div>
            <label className="text-xs font-medium text-slate-600">Nom de la résidence</label>
            <input
              type="text"
              maxLength={120}
              value={editName}
              onChange={(event) => setEditName(event.target.value)}
              className="input-field mt-1 h-10 "
            />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-600">Code d&apos;accès</label>
            <input
              type="text"
              maxLength={32}
              value={editCode}
              onChange={(event) => setEditCode(event.target.value)}
              className="input-field mt-1 h-10 "
            />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-600">Agence (syndic)</label>
            <input
              type="text"
              maxLength={120}
              value={editAgency}
              onChange={(event) => setEditAgency(event.target.value)}
              placeholder="ex. Evotion"
              className="input-field mt-1 h-10 "
            />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-600">
              Email de l&apos;agence (syndic)
            </label>
            <input
              type="email"
              maxLength={254}
              value={editSyndicEmail}
              onChange={(event) => setEditSyndicEmail(event.target.value)}
              placeholder="agence@exemple.fr"
              className="input-field mt-1 h-10 "
            />
          </div>
        </div>
        <div className="mt-3 flex items-center gap-3">
          <button type="submit" disabled={saving} className="btn-primary-sm">
            {saving ? 'Enregistrement…' : 'Enregistrer les paramètres'}
          </button>
        </div>

        {/* Notifications par email de la résidence */}
        <div className="mt-5 border-t border-border pt-4">
          <p className="text-xs font-semibold text-foreground">Notifications par email</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Emails envoyés automatiquement pour cette résidence (agence + habitants).
            Les habitants peuvent aussi désactiver leurs notifications dans leur profil.
          </p>
          <div className="mt-3 space-y-2">
            <label className="flex items-start justify-between gap-3 rounded-xl border border-border bg-white px-4 py-2.5">
              <span>
                <span className="block text-sm font-medium text-foreground">
                  Signalement envoyé à l&apos;agence
                </span>
                <span className="block text-xs text-muted-foreground">
                  Description et photos, à l&apos;adresse de l&apos;agence ci-dessus.
                </span>
              </span>
              <input
                type="checkbox"
                role="switch"
                checked={editNotifyAgency}
                onChange={(event) => setEditNotifyAgency(event.target.checked)}
                className="h-5 w-9 shrink-0 cursor-pointer appearance-none rounded-full bg-slate-300 transition checked:bg-brand-600"
                aria-label="Emails à l'agence pour les signalements"
              />
            </label>
            <label className="flex items-start justify-between gap-3 rounded-xl border border-border bg-white px-4 py-2.5">
              <span>
                <span className="block text-sm font-medium text-foreground">
                  Nouveau signalement aux habitants
                </span>
                <span className="block text-xs text-muted-foreground">
                  Email à tous les habitants à la déclaration d&apos;un signalement.
                </span>
              </span>
              <input
                type="checkbox"
                role="switch"
                checked={editNotifyIncident}
                onChange={(event) => setEditNotifyIncident(event.target.checked)}
                className="h-5 w-9 shrink-0 cursor-pointer appearance-none rounded-full bg-slate-300 transition checked:bg-brand-600"
                aria-label="Emails de signalement aux habitants"
              />
            </label>
            <label className="flex items-start justify-between gap-3 rounded-xl border border-border bg-white px-4 py-2.5">
              <span>
                <span className="block text-sm font-medium text-foreground">
                  Nouvelle annonce aux habitants
                </span>
                <span className="block text-xs text-muted-foreground">
                  Email aux habitants quand un voisin coche « notifier la résidence ».
                </span>
              </span>
              <input
                type="checkbox"
                role="switch"
                checked={editNotifyListing}
                onChange={(event) => setEditNotifyListing(event.target.checked)}
                className="h-5 w-9 shrink-0 cursor-pointer appearance-none rounded-full bg-slate-300 transition checked:bg-brand-600"
                aria-label="Emails d'annonce aux habitants"
              />
            </label>
          </div>
        </div>
      </form>

      {/* Onglets de contenu */}
      <div className="mt-5 flex flex-wrap gap-2">
        {(Object.keys(tabLabels) as DetailTab[]).map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={cn(
              'rounded-lg px-3.5 py-2 text-sm font-medium transition',
              tab === key
                ? 'bg-brand-600 text-white'
                : 'text-slate-600 hover:bg-slate-100',
            )}
          >
            {tabLabels[key]}
          </button>
        ))}
      </div>

      <div className="mt-4">
        {loadingData ? (
          <p className="text-sm text-muted-foreground">Chargement…</p>
        ) : tab === 'members' ? (
          <MembersList members={members} />
        ) : tab === 'listings' ? (
          <ListingsList listings={listings} />
        ) : tab === 'incidents' ? (
          <IncidentsList incidents={incidents} />
        ) : (
          <InvitationsList invitations={invitations} />
        )}
      </div>
    </section>
  );
}

function MembersList({ members }: { members: AdminUser[] | null }) {
  if (!members) return null;
  if (members.length === 0) {
    return <p className="text-sm text-muted-foreground">Aucun membre dans cette résidence.</p>;
  }
  return (
    <ul className="space-y-2">
      {members.map((member) => (
        <li
          key={member.id}
          className="flex items-center justify-between rounded-xl border border-border px-4 py-3"
        >
          <div>
            <p className="text-sm font-medium text-foreground">
              {member.firstName} {member.lastName}
              {member.role === 'ADMIN' && (
                <span className="ml-2 rounded bg-indigo-100 px-2 py-0.5 text-xs text-indigo-700">
                  admin
                </span>
              )}
              {member.role === 'SUPERADMIN' && (
                <span className="ml-2 rounded bg-violet-100 px-2 py-0.5 text-xs text-violet-700">
                  superadmin
                </span>
              )}
            </p>
            <p className="text-xs text-muted-foreground">{member.email}</p>
          </div>
          <span
            className={cn(
              'rounded-full px-2.5 py-1 text-xs font-medium',
              member.status === 'ACTIVE' && 'bg-emerald-100 text-emerald-700',
              member.status === 'PENDING' && 'bg-amber-100 text-amber-700',
              member.status === 'SUSPENDED' && 'bg-red-100 text-red-700',
            )}
          >
            {USER_STATUS_LABELS[member.status] ?? member.status}
          </span>
        </li>
      ))}
    </ul>
  );
}

function ListingsList({ listings }: { listings: Listing[] | null }) {
  if (!listings) return null;
  if (listings.length === 0) {
    return <p className="text-sm text-muted-foreground">Aucune annonce dans cette résidence.</p>;
  }
  return (
    <ul className="space-y-2">
      {listings.map((listing) => {
        const owner = listing.owner as ListingOwner & { lastName?: string; email?: string };
        return (
          <li key={listing.id} className="rounded-xl border border-border px-4 py-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-medium text-foreground">{listing.title}</p>
              <span className="text-xs text-muted-foreground">
                {listing.owner.firstName} {owner.lastName ?? ''}
              </span>
            </div>
            <p className="mt-0.5 text-xs text-muted-foreground line-clamp-1">
              {listing.description}
            </p>
          </li>
        );
      })}
    </ul>
  );
}

function IncidentsList({ incidents }: { incidents: Incident[] | null }) {
  if (!incidents) return null;
  if (incidents.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">Aucun signalement dans cette résidence.</p>
    );
  }
  return (
    <ul className="space-y-2">
      {incidents.map((incident) => (
        <li key={incident.id} className="rounded-xl border border-border px-4 py-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-medium text-foreground">{incident.title}</p>
            <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs text-red-700">
              {INCIDENT_STATUS_LABELS[incident.status] ?? incident.status}
            </span>
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground line-clamp-1">
            {INCIDENT_CATEGORY_LABELS[incident.category] ?? incident.category}
          </p>
        </li>
      ))}
    </ul>
  );
}

function InvitationsList({ invitations }: { invitations: Invitation[] | null }) {
  if (!invitations) return null;
  if (invitations.length === 0) {
    return <p className="text-sm text-muted-foreground">Aucune invitation pour cette résidence.</p>;
  }
  return (
    <ul className="space-y-2">
      {invitations.map((invitation) => (
        <li
          key={invitation.id}
          className="flex items-center justify-between rounded-xl border border-border px-4 py-3"
        >
          <div>
            <p className="text-sm font-medium text-foreground">
              {invitation.neighborhood || 'Invitation'}
            </p>
            <p className="text-xs text-muted-foreground">
              Par {invitation.createdBy?.firstName ?? 'inconnu'}{' '}
              {invitation.createdBy?.lastName ?? ''}
            </p>
          </div>
          <span
            className={cn(
              'rounded-full px-2.5 py-1 text-xs font-medium',
              invitation.usedAt
                ? 'bg-emerald-100 text-emerald-700'
                : 'bg-amber-100 text-amber-700',
            )}
          >
            {invitation.usedAt ? 'Utilisée' : 'En attente'}
          </span>
        </li>
      ))}
    </ul>
  );
}
