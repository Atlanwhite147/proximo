'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { ErrorMessage, Spinner } from '@/components/Feedback';
import api from '@/lib/api';
import { AdminResidences } from './AdminResidences';
import {
  INCIDENT_CATEGORY_LABELS,
  INCIDENT_STATUS_LABELS,
  STATUS_LABELS,
  USER_STATUS_LABELS,
  type AdminUser,
  type BrevoQuotaInfo,
  type EmailOutboxInfo,
  type EmailSettings,
  type Incident,
  type IncidentStatus,
  type Invitation,
  type Listing,
  type SyndicSettings,
} from '@/lib/types';

type Tab = 'stats' | 'users' | 'listings' | 'incidents' | 'invitations' | 'settings';

/** Statistiques globales du back-office. */
interface AdminStats {
  members: number;
  pending: number;
  incidents: number;
  incidentsOpen: number;
  invitationsActive: number;
}

/**
 * Back-office administrateur (2FA obligatoire, vérifiée par l'API) :
 * - validation / suspension / suppression des membres
 * - modération des signalements (statuts)
 * - génération d'invitations + QR codes
 * - réglages du syndic / de l'agence
 */
export default function AdminPage() {
  const { isAdmin, isSuperAdmin, user } = useAuth();
  const [tab, setTab] = useState<Tab>('stats');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Statistiques
  const [stats, setStats] = useState<AdminStats | null>(null);

  // Utilisateurs
  const [users, setUsers] = useState<AdminUser[] | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  // Annonces (modération)
  const [listings, setListings] = useState<Listing[] | null>(null);

  // Signalements
  const [incidents, setIncidents] = useState<Incident[] | null>(null);

  // Invitations
  const [invitations, setInvitations] = useState<Invitation[] | null>(null);
  const [invNeighborhood, setInvNeighborhood] = useState('');
  const [invHours, setInvHours] = useState(72);

  // Réglages syndic
  const [settings, setSettings] = useState<SyndicSettings | null>(null);
  const [agencyName, setAgencyName] = useState('');
  const [syndicEmail, setSyndicEmail] = useState('');
  const [residenceName, setResidenceName] = useState('');

  // Réglages email
  const [emailSettings, setEmailSettings] = useState<EmailSettings | null>(null);
  const [emailMode, setEmailMode] = useState<'brevo' | 'smtp' | 'log'>('brevo');
  const [emailFromName, setEmailFromName] = useState('');
  const [emailFrom, setEmailFrom] = useState('');
  const [brevoApiKey, setBrevoApiKey] = useState('');
  const [smtpHost, setSmtpHost] = useState('');
  const [smtpPort, setSmtpPort] = useState(587);
  const [smtpSecure, setSmtpSecure] = useState(false);
  const [smtpUser, setSmtpUser] = useState('');
  const [smtpPass, setSmtpPass] = useState('');
  const [incidentNotifEnabled, setIncidentNotifEnabled] = useState(true);
  const [listingNotifEnabled, setListingNotifEnabled] = useState(true);
  const [agencyNotifEnabled, setAgencyNotifEnabled] = useState(true);
  const [emailSaving, setEmailSaving] = useState(false);
  const [emailTesting, setEmailTesting] = useState(false);
  const [emailFlushing, setEmailFlushing] = useState(false);
  // Quota Brevo + file d'attente (superadmin)
  const [brevoInfo, setBrevoInfo] = useState<BrevoQuotaInfo>({ remaining: null, limit: null });
  const [outboxInfo, setOutboxInfo] = useState<EmailOutboxInfo>({
    pending: 0,
    oldestCreatedAt: null,
    lastError: null,
  });

  const loadUsers = useCallback(() => {
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    if (statusFilter) params.set('status', statusFilter);
    api<{ users: AdminUser[] }>(`/admin/users?${params.toString()}`)
      .then((data) => setUsers(data.users))
      .catch(() => setUsers([]));
  }, [search, statusFilter]);

  const loadIncidents = useCallback(() => {
    api<{ incidents: Incident[] }>('/admin/incidents')
      .then((data) => setIncidents(data.incidents))
      .catch(() => setIncidents([]));
  }, []);

  const loadInvitations = useCallback(() => {
    api<{ invitations: Invitation[] }>('/admin/invitations')
      .then((data) => setInvitations(data.invitations))
      .catch(() => setInvitations([]));
  }, []);

  const loadStats = useCallback(() => {
    api<{ stats: AdminStats }>('/admin/stats')
      .then((data) => setStats(data.stats))
      .catch(() => setStats(null));
  }, []);

  const loadListings = useCallback(() => {
    api<{ listings: Listing[] }>('/admin/listings')
      .then((data) => setListings(data.listings))
      .catch(() => setListings([]));
  }, []);

  const loadSettings = useCallback(() => {
    api<{ settings: SyndicSettings }>('/admin/settings')
      .then((data) => {
        setSettings(data.settings);
        setAgencyName(data.settings.agencyName ?? '');
        setSyndicEmail(data.settings.email ?? '');
        setResidenceName(data.settings.residenceName ?? '');
        setAgencyNotifEnabled(data.settings.notifyAgencyOnIncident ?? true);
        setIncidentNotifEnabled(data.settings.notifyResidentsOnIncident ?? true);
        setListingNotifEnabled(data.settings.notifyResidentsOnListing ?? true);
      })
      .catch(() => setSettings(null));
  }, []);

  const loadEmailSettings = useCallback(() => {
    api<{
      settings: EmailSettings;
      brevo?: BrevoQuotaInfo;
      outbox?: EmailOutboxInfo;
    }>('/admin/email-settings')
      .then((data) => {
        setEmailSettings(data.settings);
        setEmailMode(data.settings.mode);
        setEmailFromName(data.settings.fromName);
        setEmailFrom(data.settings.fromEmail);
        setSmtpHost(data.settings.smtpHost ?? '');
        setSmtpPort(data.settings.smtpPort ?? 587);
        setSmtpSecure(data.settings.smtpSecure);
        setSmtpUser(data.settings.smtpUser ?? '');
        setBrevoApiKey('');
        setSmtpPass('');
        setBrevoInfo(data.brevo ?? { remaining: null, limit: null });
        setOutboxInfo(
          data.outbox ?? { pending: 0, oldestCreatedAt: null, lastError: null },
        );
      })
      .catch(() => setEmailSettings(null));
  }, []);

  useEffect(() => {
    loadStats();
    if (tab === 'users') loadUsers();
    if (tab === 'listings') loadListings();
    if (tab === 'incidents') loadIncidents();
    if (tab === 'invitations') loadInvitations();
    if (tab === 'settings') {
      loadSettings();
      // L'envoi d'emails (Brevo/SMTP) est une config plateforme : superadmin seul.
      if (isSuperAdmin) loadEmailSettings();
    }
  }, [tab, loadStats, loadUsers, loadListings, loadIncidents, loadInvitations, loadSettings, loadEmailSettings, isSuperAdmin]);

  if (!isAdmin) {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center">
        <div className="text-4xl">🔒</div>
        <h1 className="mt-3 text-xl font-bold text-slate-900">Accès réservé</h1>
        <p className="mt-2 text-sm text-slate-600">Cette section est réservée aux administrateurs.</p>
      </div>
    );
  }

  const patchUser = async (id: string, data: { status?: string; role?: string }) => {
    setError(null);
    setSuccess(null);
    try {
      await api(`/admin/users/${id}`, { method: 'PATCH', body: JSON.stringify(data) });
      setSuccess('Utilisateur mis à jour.');
      loadUsers();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Mise à jour impossible');
    }
  };

  const deleteUser = async (id: string, email: string) => {
    if (!window.confirm(`Supprimer définitivement ${email} ?`)) return;
    setError(null);
    setSuccess(null);
    try {
      await api(`/admin/users/${id}`, { method: 'DELETE' });
      setSuccess('Compte supprimé.');
      loadUsers();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Suppression impossible');
    }
  };

  const patchIncident = async (id: string, status: IncidentStatus) => {
    setError(null);
    try {
      await api(`/admin/incidents/${id}`, { method: 'PATCH', body: JSON.stringify({ status }) });
      loadIncidents();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Mise à jour impossible');
    }
  };

  const createInvitation = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setSuccess(null);
    try {
      await api('/invitations', {
        method: 'POST',
        body: JSON.stringify({
          ...(invNeighborhood.trim() ? { neighborhood: invNeighborhood.trim() } : {}),
          expiresInHours: invHours,
        }),
      });
      setInvNeighborhood('');
      setSuccess('Invitation créée : imprimez le QR code ou partagez le lien.');
      loadInvitations();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Création impossible');
    }
  };

  /** Supprime une invitation : le lien et le QR deviennent inutilisables. */
  const deleteInvitation = async (invitation: Invitation) => {
    setError(null);
    setSuccess(null);
    if (
      !window.confirm(
        `Supprimer l'invitation « ${invitation.neighborhood || 'sans nom'} » ? Le lien et le QR code ne fonctionneront plus.`,
      )
    )
      return;
    try {
      await api(`/admin/invitations/${invitation.id}`, { method: 'DELETE' });
      setSuccess('Invitation supprimée.');
      loadInvitations();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Suppression impossible');
    }
  };

  const saveSettings = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setSuccess(null);
    try {
      await api('/admin/settings', {
        method: 'PATCH',
        body: JSON.stringify({
          agencyName,
          email: syndicEmail,
          residenceName,
          notifyAgencyOnIncident: agencyNotifEnabled,
          notifyResidentsOnIncident: incidentNotifEnabled,
          notifyResidentsOnListing: listingNotifEnabled,
        }),
      });
      setSuccess('Réglages enregistrés.');
      loadSettings();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Enregistrement impossible');
    }
  };

  const saveEmailSettings = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setSuccess(null);
    setEmailSaving(true);
    try {
      const data = await api<{ settings: EmailSettings }>('/admin/email-settings', {
        method: 'PATCH',
        body: JSON.stringify({
          mode: emailMode,
          fromName: emailFromName,
          fromEmail: emailFrom,
          ...(brevoApiKey ? { brevoApiKey } : {}),
          smtpHost,
          smtpPort,
          smtpSecure,
          smtpUser,
          ...(smtpPass ? { smtpPass } : {}),
        }),
      });
      setEmailSettings(data.settings);
      setBrevoApiKey('');
      setSmtpPass('');
      setSuccess('Réglages email enregistrés.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Enregistrement impossible');
    } finally {
      setEmailSaving(false);
    }
  };

  const testEmailSettings = async () => {
    setError(null);
    setSuccess(null);
    setEmailTesting(true);
    try {
      const data = await api<{ sent: boolean; mode: string }>('/admin/email-settings/test', {
        method: 'POST',
      });
      setSuccess(
        `Email de test envoyé à ${user?.email ?? 'votre adresse'} (mode : ${data.mode}).`,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Envoi impossible');
    } finally {
      setEmailTesting(false);
    }
  };

  const flushEmailOutbox = async () => {
    setError(null);
    setSuccess(null);
    setEmailFlushing(true);
    try {
      const data = await api<{ flushed: number; outbox: EmailOutboxInfo }>(
        '/admin/email-settings/flush',
        { method: 'POST' },
      );
      setOutboxInfo(data.outbox);
      setSuccess(
        data.flushed > 0
          ? `${data.flushed} email(s) en attente renvoyé(s).`
          : 'Aucun email en attente à renvoyer.',
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Renvoi impossible');
    } finally {
      setEmailFlushing(false);
    }
  };

  const tabClass = (value: Tab) =>
    `rounded-lg px-4 py-2 text-sm font-medium ${
      tab === value ? 'bg-brand-600 text-white' : 'text-slate-600 hover:bg-slate-100'
    }`;

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <h1 className="text-2xl font-bold text-slate-900">Administration</h1>
      <p className="mt-1 text-sm text-slate-600">
        Connecté en tant que {user?.firstName} {user?.lastName}{' '}
        {isSuperAdmin ? '(superadmin)' : '(2FA vérifiée) ✓'}
      </p>

      {isSuperAdmin && (
        <div className="mt-6">
          <AdminResidences />
        </div>
      )}

      <div className="mt-6 flex flex-wrap gap-2">
        <button type="button" className={tabClass('stats')} onClick={() => setTab('stats')}>
          📊 Vue d&apos;ensemble
        </button>
        <button type="button" className={tabClass('users')} onClick={() => setTab('users')}>
          👥 Membres
        </button>
        <button type="button" className={tabClass('listings')} onClick={() => setTab('listings')}>
          📦 Annonces
        </button>
        <button type="button" className={tabClass('incidents')} onClick={() => setTab('incidents')}>
          🛠️ Signalements
        </button>
        <button type="button" className={tabClass('invitations')} onClick={() => setTab('invitations')}>
          📲 Invitations
        </button>
        <button type="button" className={tabClass('settings')} onClick={() => setTab('settings')}>
          ⚙️ Syndic
        </button>
      </div>

      <ErrorMessage message={error} />
      {success && <p className="mt-3 text-sm font-medium text-brand-600">{success}</p>}

      {/* ─── Vue d'ensemble ─────────────────────────────────── */}
      {tab === 'stats' && (
        <section className="mt-6">
          {!stats ? (
            <Spinner />
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
              {[
                { label: 'Membres', value: stats.members, icon: '👥' },
                { label: 'En attente', value: stats.pending, icon: '⏳' },
                { label: 'Signalements', value: stats.incidents, icon: '🛠️' },
                { label: 'Ouverts', value: stats.incidentsOpen, icon: '🟡' },
                { label: 'Invitations actives', value: stats.invitationsActive, icon: '📲' },
              ].map((card) => (
                <button
                  key={card.label}
                  type="button"
                  onClick={() => {
                    if (card.label === 'Membres' || card.label === 'En attente') setTab('users');
                    if (card.label === 'Signalements' || card.label === 'Ouverts') setTab('incidents');
                    if (card.label === 'Invitations actives') setTab('invitations');
                  }}
                  className="ds-card ds-card-hover p-4 text-left"
                >
                  <span className="text-2xl">{card.icon}</span>
                  <p className="mt-2 text-2xl font-bold text-slate-900">{card.value}</p>
                  <p className="text-xs font-medium text-slate-500">{card.label}</p>
                </button>
              ))}
            </div>
          )}
          <p className="mt-6 rounded-2xl border border-dashed border-slate-300 bg-white/60 p-5 text-sm text-slate-500">
            Actions rapides :{' '}
            <button type="button" onClick={() => setTab('users')} className="font-medium text-brand-600 hover:underline">
              valider les membres en attente
            </button>
            {' · '}
            <button type="button" onClick={() => setTab('invitations')} className="font-medium text-brand-600 hover:underline">
              générer une invitation QR
            </button>
            {' · '}
            <button type="button" onClick={() => setTab('settings')} className="font-medium text-brand-600 hover:underline">
              configurer le syndic
            </button>
          </p>
        </section>
      )}

      {/* ─── Membres ─────────────────────────────────────────── */}
      {tab === 'users' && (
        <section className="mt-6">
          <div className="flex flex-wrap gap-2">
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Rechercher par nom ou email…"
              className="flex-1 rounded-lg border border-slate-300 px-4 py-2.5 focus:border-brand-500 focus:outline-none"
            />
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
              className="input-field h-11 "
            >
              <option value="">Tous les statuts</option>
              <option value="PENDING">En attente</option>
              <option value="ACTIVE">Actifs</option>
              <option value="SUSPENDED">Suspendus</option>
            </select>
          </div>
          {!users ? (
            <Spinner />
          ) : (
            <ul className="mt-4 space-y-3">
              {users.map((member) => (
                <li
                  key={member.id}
                  className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="font-semibold text-slate-900">
                        {member.firstName} {member.lastName}
                        {member.role === 'ADMIN' && (
                          <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
                            Admin
                          </span>
                        )}
                      </p>
                      <p className="text-sm text-slate-500">{member.email}</p>
                      <p className="text-xs text-slate-400">
                        {member.neighborhood ?? 'Résidence non précisée'} ·{' '}
                        {new Date(member.createdAt).toLocaleDateString('fr-FR')}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">
                        {USER_STATUS_LABELS[member.status]}
                      </span>
                      {member.status === 'PENDING' && (
                        <button
                          type="button"
                          onClick={() => void patchUser(member.id, { status: 'ACTIVE' })}
                          className="btn-primary-sm px-3 py-1.5 text-xs"
                        >
                          Valider
                        </button>
                      )}
                      {member.status === 'ACTIVE' && (
                        <button
                          type="button"
                          onClick={() => void patchUser(member.id, { status: 'SUSPENDED' })}
                          className="rounded-lg border border-amber-300 px-3 py-1.5 text-xs font-semibold text-amber-700 hover:bg-amber-50"
                        >
                          Suspendre
                        </button>
                      )}
                      {member.status === 'SUSPENDED' && (
                        <button
                          type="button"
                          onClick={() => void patchUser(member.id, { status: 'ACTIVE' })}
                          className="btn-primary-sm px-3 py-1.5 text-xs"
                        >
                          Réactiver
                        </button>
                      )}
                      {member.role === 'ADMIN' && member.id !== user?.id ? (
                        <button
                          type="button"
                          onClick={() => {
                            if (!window.confirm(`Retirer les droits admin de ${member.email} ?`)) return;
                            void patchUser(member.id, { role: 'USER' });
                          }}
                          className="rounded-lg border border-amber-300 px-3 py-1.5 text-xs font-semibold text-amber-700 hover:bg-amber-50"
                        >
                          Rétrograder
                        </button>
                      ) : (
                        member.role === 'USER' && (
                          <button
                            type="button"
                            onClick={() => {
                              if (!window.confirm(`Élever ${member.email} en administrateur ?`)) return;
                              void patchUser(member.id, { role: 'ADMIN' });
                            }}
                            className="rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-700"
                          >
                            Élever en admin
                          </button>
                        )
                      )}
                      <button
                        type="button"
                        onClick={() => void deleteUser(member.id, member.email)}
                        className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50"
                      >
                        Supprimer
                      </button>
                    </div>
                  </div>
                </li>
              ))}
              {users.length === 0 && (
                <p className="rounded-xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">
                  Aucun membre trouvé.
                </p>
              )}
            </ul>
          )}
        </section>
      )}

      {/* ─── Annonces (modération) ─────────────────────────── */}
      {tab === 'listings' && (
        <section className="mt-6">
          {!listings ? (
            <Spinner />
          ) : (
            <ul className="space-y-3">
              {listings.map((listing) => (
                <li
                  key={listing.id}
                  className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="font-semibold text-slate-900">
                        {listing.title}
                        <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
                          {STATUS_LABELS[listing.status]}
                        </span>
                      </p>
                      <p className="text-sm text-slate-500">
                        {listing.owner.firstName} · 📍 {listing.neighborhood}
                      </p>
                      <p className="text-xs text-slate-400">
                        {new Date(listing.createdAt).toLocaleDateString('fr-FR')}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        if (!window.confirm(`Supprimer l'annonce « ${listing.title} » ?`)) return;
                        api(`/admin/listings/${listing.id}`, { method: 'DELETE' })
                          .then(() => {
                            setListings((current) =>
                              (current ?? []).filter((item) => item.id !== listing.id),
                            );
                            setSuccess('Annonce supprimée.');
                          })
                          .catch((err) =>
                            setError(err instanceof Error ? err.message : 'Suppression impossible'),
                          );
                      }}
                      className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50"
                    >
                      Supprimer
                    </button>
                  </div>
                </li>
              ))}
              {listings.length === 0 && (
                <p className="rounded-xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">
                  Aucune annonce.
                </p>
              )}
            </ul>
          )}
        </section>
      )}

      {/* ─── Signalements ────────────────────────────────────── */}
      {tab === 'incidents' && (
        <section className="mt-6">
          {!incidents ? (
            <Spinner />
          ) : (
            <ul className="space-y-3">
              {incidents.map((incident) => (
                <li
                  key={incident.id}
                  className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="font-semibold text-slate-900">{incident.title}</p>
                      <p className="text-sm text-slate-500">
                        {incident.user?.firstName} {incident.user?.lastName} (
                        {incident.user?.email})
                      </p>
                      <p className="text-xs text-slate-400">
                        {INCIDENT_CATEGORY_LABELS[incident.category]} ·{' '}
                        {new Date(incident.createdAt).toLocaleDateString('fr-FR')} ·{' '}
                        {incident.attachments.length} pièce
                        {incident.attachments.length > 1 ? 's' : ''}
                      </p>
                      <p className="mt-1 text-sm text-slate-600">{incident.description}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {(
                        ['OPEN', 'IN_PROGRESS', 'RESOLVED'] as IncidentStatus[]
                      ).map((status) => (
                        <button
                          key={status}
                          type="button"
                          onClick={() => void patchIncident(incident.id, status)}
                          className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${
                            incident.status === status
                              ? 'bg-brand-600 text-white'
                              : 'border border-slate-300 text-slate-600 hover:bg-slate-50'
                          }`}
                        >
                          {INCIDENT_STATUS_LABELS[status]}
                        </button>
                      ))}
                      <button
                        type="button"
                        onClick={() => {
                          if (!window.confirm(`Supprimer le signalement « ${incident.title} » ?`)) return;
                          api(`/admin/incidents/${incident.id}`, { method: 'DELETE' })
                            .then(() => {
                              setIncidents((current) =>
                                (current ?? []).filter((item) => item.id !== incident.id),
                              );
                              setSuccess('Signalement supprimé.');
                            })
                            .catch((err) =>
                              setError(err instanceof Error ? err.message : 'Suppression impossible'),
                            );
                        }}
                        className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50"
                      >
                        Supprimer
                      </button>
                    </div>
                  </div>
                </li>
              ))}
              {incidents.length === 0 && (
                <p className="rounded-xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">
                  Aucun signalement.
                </p>
              )}
            </ul>
          )}
        </section>
      )}

      {/* ─── Invitations ─────────────────────────────────────── */}
      {tab === 'invitations' && (
        <section className="mt-6">
          <form
            onSubmit={(event) => void createInvitation(event)}
            className="ds-card p-5"
          >
            <div className="flex flex-wrap items-end gap-3">
              <div className="flex-1">
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  Référence <span className="font-normal text-slate-400">(facultatif)</span>
                </label>
                <input
                  type="text"
                  maxLength={120}
                  value={invNeighborhood}
                  onChange={(event) => setInvNeighborhood(event.target.value)}
                  placeholder="Ex. Famille Martin — Bât. B"
                  className="input-field h-11 "
                />
                <p className="mt-1 text-xs text-slate-400">
                  Pour identifier l&apos;invitation dans la liste (imprimé sur le QR).
                </p>
              </div>
              <div className="w-32">
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  Validité (h)
                </label>
                <input
                  type="number"
                  min={1}
                  max={168}
                  value={invHours}
                  onChange={(event) => setInvHours(Number(event.target.value))}
                  className="input-field h-11 "
                />
              </div>
              <button
                type="submit"
                className="btn-primary-sm px-5"
              >
                Générer l&apos;invitation
              </button>
            </div>
          </form>

          {!invitations ? (
            <Spinner />
          ) : (
            <ul className="mt-4 space-y-3">
              {invitations.map((invitation) => (
                <li
                  key={invitation.id}
                  className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="font-semibold text-slate-900">
                        {invitation.neighborhood || 'Invitation'}
                        {invitation.usedAt && (
                          <span className="ml-2 rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
                            Utilisée
                          </span>
                        )}
                      </p>
                      <p className="text-xs text-slate-400">
                        Créée par {invitation.createdBy?.firstName}{' '}
                        {invitation.createdBy?.lastName} · expire le{' '}
                        {new Date(invitation.expiresAt).toLocaleDateString('fr-FR')}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <img
                        src={invitation.qrUrl}
                        alt={`QR code ${invitation.neighborhood || 'invitation'}`}
                        width={64}
                        height={64}
                        className="rounded-md border border-slate-200"
                      />
                      <div className="text-right text-xs text-slate-500">
                        <a
                          href={invitation.url}
                          target="_blank"
                          rel="noreferrer"
                          className="block max-w-[180px] truncate text-brand-600 hover:underline"
                        >
                          {invitation.url}
                        </a>
                        <div className="mt-1 flex justify-end gap-3">
                          <button
                            type="button"
                            onClick={() => {
                              void navigator.clipboard.writeText(invitation.url);
                            }}
                            className="font-medium text-slate-600 hover:underline"
                          >
                            Copier le lien
                          </button>
                          <button
                            type="button"
                            onClick={() => void deleteInvitation(invitation)}
                            className="font-medium text-red-500 hover:underline"
                          >
                            Supprimer
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </li>
              ))}
              {invitations.length === 0 && (
                <p className="rounded-xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">
                  Aucune invitation pour le moment.
                </p>
              )}
            </ul>
          )}
        </section>
      )}

      {/* ─── Syndic ──────────────────────────────────────────── */}
      {tab === 'settings' && (
        <section className="mt-6">
          <form
            onSubmit={(event) => void saveSettings(event)}
            className="ds-card p-5"
          >
            <h2 className="font-semibold text-slate-900">Agence / syndic de gestion</h2>
            <p className="mt-1 text-sm text-slate-500">
              Les signalements d&apos;incidents sont envoyés à cette adresse.
            </p>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  Nom de la résidence
                </label>
                <input
                  type="text"
                  maxLength={120}
                  value={residenceName}
                  onChange={(event) => setResidenceName(event.target.value)}
                  placeholder="Ex. Résidence Les Cèdres"
                  className="input-field h-11 "
                />
                <p className="mt-1 text-xs text-slate-400">
                  Affiché dans toute l&apos;interface et les emails (en-tête, annonces, invitations).
                </p>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  Nom de l&apos;agence
                </label>
                <input
                  type="text"
                  maxLength={120}
                  value={agencyName}
                  onChange={(event) => setAgencyName(event.target.value)}
                  placeholder="Ex. Syndic Lyon 7e"
                  className="input-field h-11 "
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  Email de réception
                </label>
                <input
                  type="email"
                  value={syndicEmail}
                  onChange={(event) => setSyndicEmail(event.target.value)}
                  placeholder="contact@syndic.fr"
                  className="input-field h-11 "
                />
              </div>
            </div>

            {/* ─── Notifications par email (cette résidence) ── */}
            <div className="mt-6 border-t border-slate-100 pt-5">
              <h3 className="text-sm font-semibold text-slate-900">
                Notifications par email
              </h3>
              <p className="mt-0.5 text-xs text-slate-500">
                Emails envoyés automatiquement pour cette résidence. Chaque habitant
                peut aussi désactiver ses notifications dans son profil.
              </p>
              <div className="mt-3 space-y-3">
                <label className="flex items-start justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <span>
                    <span className="block text-sm font-medium text-slate-800">
                      Signalement envoyé à l&apos;agence
                    </span>
                    <span className="block text-xs text-slate-500">
                      Description et photos du signalement, à l&apos;adresse de réception
                      ci-dessus.
                    </span>
                  </span>
                  <input
                    type="checkbox"
                    role="switch"
                    checked={agencyNotifEnabled}
                    onChange={(event) => setAgencyNotifEnabled(event.target.checked)}
                    className="h-5 w-9 shrink-0 cursor-pointer appearance-none rounded-full bg-slate-300 transition checked:bg-brand-600"
                    aria-label="Activer les emails à l'agence"
                  />
                </label>
                <label className="flex items-start justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <span>
                    <span className="block text-sm font-medium text-slate-800">
                      Nouveau signalement aux habitants
                    </span>
                    <span className="block text-xs text-slate-500">
                      Email à tous les habitants à la déclaration d&apos;un signalement.
                    </span>
                  </span>
                  <input
                    type="checkbox"
                    role="switch"
                    checked={incidentNotifEnabled}
                    onChange={(event) => setIncidentNotifEnabled(event.target.checked)}
                    className="h-5 w-9 shrink-0 cursor-pointer appearance-none rounded-full bg-slate-300 transition checked:bg-brand-600"
                    aria-label="Activer les emails de signalement aux habitants"
                  />
                </label>
                <label className="flex items-start justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <span>
                    <span className="block text-sm font-medium text-slate-800">
                      Nouvelle annonce aux habitants
                    </span>
                    <span className="block text-xs text-slate-500">
                      Email aux habitants quand un voisin coche « notifier la résidence ».
                    </span>
                  </span>
                  <input
                    type="checkbox"
                    role="switch"
                    checked={listingNotifEnabled}
                    onChange={(event) => setListingNotifEnabled(event.target.checked)}
                    className="h-5 w-9 shrink-0 cursor-pointer appearance-none rounded-full bg-slate-300 transition checked:bg-brand-600"
                    aria-label="Activer les emails d'annonce aux habitants"
                  />
                </label>
              </div>
            </div>
            <button
              type="submit"
              className="btn-primary-sm px-5 mt-4"
            >
              Enregistrer
            </button>
          </form>

          {/* Envoi d'emails : configuration plateforme, réservée au superadmin */}
          {isSuperAdmin && (
          <form
            onSubmit={(event) => void saveEmailSettings(event)}
            className="mt-6 ds-card p-5"
          >
            <h2 className="font-semibold text-slate-900">Envoi d&apos;emails</h2>
            <p className="mt-1 text-sm text-slate-500">
              Configuration de l&apos;expéditeur des notifications (invitations, messages,
              signalements). Les clés ne sont jamais affichées après enregistrement.
            </p>

            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Mode d&apos;envoi</label>
                <select
                  value={emailMode}
                  onChange={(event) => setEmailMode(event.target.value as 'brevo' | 'smtp' | 'log')}
                  className="input-field h-11 "
                >
                  <option value="brevo">Brevo (API, recommandé)</option>
                  <option value="smtp">SMTP générique</option>
                  <option value="log">Journal (aucun envoi)</option>
                </select>
                <p className="mt-1 text-xs text-slate-400">
                  Mode actif :{' '}
                  <strong>
                    {emailSettings?.effectiveMode === 'brevo'
                      ? 'Brevo'
                      : emailSettings?.effectiveMode === 'smtp'
                        ? 'SMTP'
                        : 'Journal (aucun envoi)'}
                  </strong>
                </p>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Nom de l&apos;expéditeur</label>
                <input
                  type="text"
                  maxLength={120}
                  value={emailFromName}
                  onChange={(event) => setEmailFromName(event.target.value)}
                  placeholder="Ex. Résidence Les Cèdres"
                  className="input-field h-11 "
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Email de l&apos;expéditeur</label>
                <input
                  type="email"
                  maxLength={160}
                  value={emailFrom}
                  onChange={(event) => setEmailFrom(event.target.value)}
                  placeholder="no-reply@residence.fr"
                  className="input-field h-11 "
                />
              </div>
            </div>

            {emailMode === 'brevo' && (
              <div className="mt-4">
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  Clé API Brevo{' '}
                  {emailSettings?.brevoConfigured && (
                    <span className="ml-1 rounded bg-green-50 px-1.5 py-0.5 text-xs font-medium text-green-700">
                      ✓ configurée
                    </span>
                  )}
                </label>
                <input
                  type="password"
                  autoComplete="new-password"
                  value={brevoApiKey}
                  onChange={(event) => setBrevoApiKey(event.target.value)}
                  placeholder={
                    emailSettings?.brevoConfigured
                      ? '•••••••• (laisser vide pour conserver)'
                      : 'xkeysib-…'
                  }
                  className="input-field h-11 "
                />
              </div>
            )}

            {emailMode === 'smtp' && (
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Serveur SMTP</label>
                  <input
                    type="text"
                    value={smtpHost}
                    onChange={(event) => setSmtpHost(event.target.value)}
                    placeholder="smtp.exemple.fr"
                    className="input-field h-11 "
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Port</label>
                  <input
                    type="number"
                    min={1}
                    max={65535}
                    value={smtpPort}
                    onChange={(event) => setSmtpPort(Number(event.target.value))}
                    className="input-field h-11 "
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Utilisateur</label>
                  <input
                    type="text"
                    autoComplete="off"
                    value={smtpUser}
                    onChange={(event) => setSmtpUser(event.target.value)}
                    placeholder="login@exemple.fr"
                    className="input-field h-11 "
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Mot de passe</label>
                  <input
                    type="password"
                    autoComplete="new-password"
                    value={smtpPass}
                    onChange={(event) => setSmtpPass(event.target.value)}
                    placeholder={
                      emailSettings?.smtpConfigured
                        ? '•••••••• (laisser vide pour conserver)'
                        : 'mot de passe'
                    }
                    className="input-field h-11 "
                  />
                </div>
                <label className="flex items-center gap-2 text-sm text-slate-700 sm:col-span-2">
                  <input
                    type="checkbox"
                    checked={smtpSecure}
                    onChange={(event) => setSmtpSecure(event.target.checked)}
                    className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                  />
                  Connexion sécurisée (SSL/TLS, port 465)
                </label>
              </div>
            )}

            {/* ─── Quota Brevo & file d'attente ─────────────── */}
            {emailMode === 'brevo' && (
              <div className="mt-6 border-t border-slate-100 pt-5">
                <h3 className="text-sm font-semibold text-slate-900">
                  Quota Brevo (offre gratuite)
                </h3>
                {brevoInfo.remaining !== null ? (
                  <p className="mt-1 text-xs text-slate-500">
                    Emails restants aujourd&apos;hui :{' '}
                    <strong
                      className={
                        brevoInfo.remaining <= 0
                          ? 'text-red-600'
                          : brevoInfo.remaining < 30
                            ? 'text-amber-600'
                            : 'text-slate-700'
                      }
                    >
                      {brevoInfo.remaining}
                    </strong>{' '}
                    / {brevoInfo.limit ?? 300}
                    {brevoInfo.remaining <= 0
                      ? ' : quota atteint, les prochains emails seront mis en attente.'
                      : ''}
                  </p>
                ) : (
                  <p className="mt-1 text-xs text-slate-400">
                    Compteur non disponible (API Brevo injoignable).
                  </p>
                )}
                {outboxInfo.pending > 0 ? (
                  <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
                    <p className="text-sm font-medium text-amber-800">
                      {outboxInfo.pending} email(s) en attente
                    </p>
                    <p className="mt-0.5 text-xs text-amber-700">
                      Quota Brevo atteint au moment de l&apos;envoi. Renvoi automatique dès la
                      réinitialisation du compteur (tentative toutes les 10 minutes).
                      {outboxInfo.oldestCreatedAt
                        ? ` · En attente depuis le ${new Date(
                            outboxInfo.oldestCreatedAt,
                          ).toLocaleString('fr-FR')}`
                        : ''}
                      {outboxInfo.lastError
                        ? ` · Dernière erreur : ${outboxInfo.lastError}`
                        : ''}
                    </p>
                    <button
                      type="button"
                      disabled={emailFlushing}
                      onClick={() => void flushEmailOutbox()}
                      className="mt-2 rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-700 disabled:opacity-50"
                    >
                      {emailFlushing ? 'Renvoi…' : 'Renvoyer maintenant'}
                    </button>
                  </div>
                ) : (
                  <p className="mt-1 text-xs text-slate-400">
                    Aucun email en attente.
                  </p>
                )}
              </div>
            )}

            <div className="mt-5 flex flex-wrap items-center gap-3">
              <button
                type="submit"
                disabled={emailSaving}
                className="btn-primary-sm px-5"
              >
                {emailSaving ? 'Enregistrement…' : 'Enregistrer'}
              </button>
              <button
                type="button"
                disabled={emailTesting}
                onClick={() => void testEmailSettings()}
                className="rounded-lg border border-brand-200 px-5 py-2.5 font-semibold text-brand-700 hover:bg-brand-50 disabled:opacity-50"
              >
                {emailTesting ? 'Envoi…' : 'Envoyer un email de test'}
              </button>
            </div>
          </form>
          )}
        </section>
      )}
    </div>
  );
}
