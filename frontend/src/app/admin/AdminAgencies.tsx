"use client";

import { useCallback, useEffect, useState } from "react";
import { Plus, Trash2, UserPlus } from "lucide-react";
import api from "@/lib/api";
import { Spinner } from "@/components/Feedback";

/**
 * Console des agences (superadministrateur) : créer une agence, lui rattacher
 * des résidences, créer ses comptes (email et mot de passe défini par lien) et
 * les révoquer. Un compte agence voit les signalements des résidences
 * rattachées, et d'aucune autre.
 */
interface AgencyMember {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  status: string;
  lastSeenAt: string | null;
  createdAt: string;
}

interface Agency {
  id: string;
  name: string;
  contactEmail: string | null;
  createdAt: string;
  residences: Array<{ id: string; name: string; code: string | null }>;
  members: AgencyMember[];
}

interface ResidenceOption {
  id: string;
  name: string;
  code?: string | null;
}

export function AdminAgencies() {
  const [agencies, setAgencies] = useState<Agency[] | null>(null);
  const [residences, setResidences] = useState<ResidenceOption[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [newName, setNewName] = useState("");
  const [newContact, setNewContact] = useState("");
  const [newResidences, setNewResidences] = useState<string[]>([]);
  const [drafts, setDrafts] = useState<Record<string, string[]>>({});
  const [memberDrafts, setMemberDrafts] = useState<
    Record<string, { email: string; firstName: string; lastName: string }>
  >({});

  const load = useCallback(async () => {
    try {
      const [agencyData, residenceData] = await Promise.all([
        api<{ agencies: Agency[] }>("/admin/agencies"),
        api<{ residences: ResidenceOption[] }>("/admin/residences"),
      ]);
      setAgencies(agencyData.agencies);
      setResidences(residenceData.residences);
      setError(null);
    } catch (err) {
      setAgencies([]);
      setError(err instanceof Error ? err.message : "Chargement impossible");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const toggleResidence = (list: string[], id: string) =>
    list.includes(id) ? list.filter((item) => item !== id) : [...list, id];

  const createAgency = async () => {
    if (!newName.trim()) {
      setError("Le nom de l'agence est requis");
      return;
    }
    setBusy(true);
    setError(null);
    setSuccess(null);
    try {
      await api("/admin/agencies", {
        method: "POST",
        body: JSON.stringify({
          name: newName.trim(),
          contactEmail: newContact.trim() || undefined,
          residenceIds: newResidences,
        }),
      });
      setNewName("");
      setNewContact("");
      setNewResidences([]);
      setSuccess("Agence créée");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Création impossible");
    } finally {
      setBusy(false);
    }
  };

  const saveScope = async (agency: Agency) => {
    setBusy(true);
    setError(null);
    setSuccess(null);
    try {
      await api(`/admin/agencies/${agency.id}`, {
        method: "PATCH",
        body: JSON.stringify({ residenceIds: drafts[agency.id] ?? [] }),
      });
      setSuccess("Périmètre mis à jour");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Mise à jour impossible");
    } finally {
      setBusy(false);
    }
  };

  const addMember = async (agency: Agency) => {
    const draft = memberDrafts[agency.id] ?? {
      email: "",
      firstName: "",
      lastName: "",
    };
    if (
      !draft.email.trim() ||
      !draft.firstName.trim() ||
      !draft.lastName.trim()
    ) {
      setError("Email, prénom et nom sont requis pour créer un compte");
      return;
    }
    setBusy(true);
    setError(null);
    setSuccess(null);
    try {
      await api(`/admin/agencies/${agency.id}/members`, {
        method: "POST",
        body: JSON.stringify({
          email: draft.email.trim(),
          firstName: draft.firstName.trim(),
          lastName: draft.lastName.trim(),
        }),
      });
      setMemberDrafts((prev) => ({
        ...prev,
        [agency.id]: { email: "", firstName: "", lastName: "" },
      }));
      setSuccess(
        "Compte créé. Le titulaire reçoit un email pour définir son mot de passe (lien valable 1 heure).",
      );
      await load();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Création du compte impossible",
      );
    } finally {
      setBusy(false);
    }
  };

  const removeMember = async (agency: Agency, member: AgencyMember) => {
    if (
      !window.confirm(`Retirer le compte ${member.email} ? Il sera suspendu.`)
    )
      return;
    setBusy(true);
    setError(null);
    try {
      await api(`/admin/agencies/${agency.id}/members/${member.id}`, {
        method: "DELETE",
      });
      setSuccess("Compte retiré et suspendu");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Retrait impossible");
    } finally {
      setBusy(false);
    }
  };

  const removeAgency = async (agency: Agency) => {
    if (
      !window.confirm(
        `Supprimer l'agence ${agency.name} ? Ses comptes seront suspendus. Les signalements ne sont pas supprimés.`,
      )
    ) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await api(`/admin/agencies/${agency.id}`, { method: "DELETE" });
      setSuccess("Agence supprimée");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Suppression impossible");
    } finally {
      setBusy(false);
    }
  };

  if (agencies === null) {
    return (
      <div className="py-10">
        <Spinner label="Chargement des agences…" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {error && (
        <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      )}
      {success && (
        <p className="rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          {success}
        </p>
      )}

      <section className="ds-card p-5">
        <h2 className="font-semibold text-slate-900">Créer une agence</h2>
        <p className="mt-0.5 text-sm text-slate-500">
          L’agence regroupe des résidences. Ses comptes voient les signalements
          de toutes ses résidences, et d’aucune autre.
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="text-sm text-slate-700">
            Nom de l’agence
            <input
              value={newName}
              onChange={(event) => setNewName(event.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
              placeholder="Agence Gerland"
            />
          </label>
          <label className="text-sm text-slate-700">
            Email de contact (facultatif)
            <input
              value={newContact}
              onChange={(event) => setNewContact(event.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
              placeholder="contact@agence.fr"
            />
          </label>
        </div>

        <p className="mt-4 text-sm font-medium text-slate-700">
          Résidences gérées
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          {residences.length === 0 ? (
            <p className="text-sm text-slate-500">
              Aucune résidence sur la plateforme.
            </p>
          ) : (
            residences.map((residence) => (
              <button
                key={residence.id}
                type="button"
                onClick={() =>
                  setNewResidences((list) =>
                    toggleResidence(list, residence.id),
                  )
                }
                className={`rounded-full px-3 py-1.5 text-sm font-medium transition ${
                  newResidences.includes(residence.id)
                    ? "bg-brand-600 text-white"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                {residence.name}
              </button>
            ))
          )}
        </div>

        <button
          type="button"
          disabled={busy}
          onClick={() => void createAgency()}
          className="mt-4 inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
        >
          <Plus className="h-4 w-4" aria-hidden />
          Créer l’agence
        </button>
      </section>

      {agencies.length === 0 ? (
        <p className="text-sm text-slate-500">Aucune agence pour le moment.</p>
      ) : (
        agencies.map((agency) => {
          const scope =
            drafts[agency.id] ?? agency.residences.map((item) => item.id);
          const draft = memberDrafts[agency.id] ?? {
            email: "",
            firstName: "",
            lastName: "",
          };
          return (
            <section key={agency.id} className="ds-card p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold text-slate-900">
                    {agency.name}
                  </h2>
                  <p className="text-sm text-slate-500">
                    {agency.contactEmail ?? "sans email de contact"} ·{" "}
                    {agency.members.length} compte(s) ·{" "}
                    {agency.residences.length} résidence(s)
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => void removeAgency(agency)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 px-3 py-1.5 text-sm font-semibold text-red-600 hover:bg-red-50"
                >
                  <Trash2 className="h-4 w-4" aria-hidden />
                  Supprimer l’agence
                </button>
              </div>

              <p className="mt-4 text-sm font-medium text-slate-700">
                Résidences gérées
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {residences.map((residence) => (
                  <button
                    key={residence.id}
                    type="button"
                    onClick={() =>
                      setDrafts((prev) => ({
                        ...prev,
                        [agency.id]: toggleResidence(scope, residence.id),
                      }))
                    }
                    className={`rounded-full px-3 py-1.5 text-sm font-medium transition ${
                      scope.includes(residence.id)
                        ? "bg-brand-600 text-white"
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                    }`}
                  >
                    {residence.name}
                  </button>
                ))}
              </div>
              <button
                type="button"
                disabled={busy}
                onClick={() => void saveScope(agency)}
                className="mt-3 rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
              >
                Enregistrer le périmètre
              </button>

              <p className="mt-5 text-sm font-medium text-slate-700">
                Comptes de l’agence
              </p>
              {agency.members.length === 0 ? (
                <p className="mt-1 text-sm text-slate-500">Aucun compte.</p>
              ) : (
                <ul className="mt-2 divide-y divide-slate-100">
                  {agency.members.map((member) => (
                    <li
                      key={member.id}
                      className="flex flex-wrap items-center gap-2 py-2"
                    >
                      <span className="text-sm text-slate-800">
                        {member.firstName} {member.lastName}
                      </span>
                      <span className="text-xs text-slate-500">
                        {member.email}
                      </span>
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                          member.status === "ACTIVE"
                            ? "bg-emerald-50 text-emerald-700"
                            : "bg-slate-100 text-slate-600"
                        }`}
                      >
                        {member.status === "ACTIVE"
                          ? "actif"
                          : member.status.toLowerCase()}
                      </span>
                      <button
                        type="button"
                        onClick={() => void removeMember(agency, member)}
                        className="ml-auto text-xs font-semibold text-red-600 hover:underline"
                      >
                        Retirer
                      </button>
                    </li>
                  ))}
                </ul>
              )}

              <div className="mt-3 grid gap-2 sm:grid-cols-3">
                <input
                  value={draft.firstName}
                  onChange={(event) =>
                    setMemberDrafts((prev) => ({
                      ...prev,
                      [agency.id]: { ...draft, firstName: event.target.value },
                    }))
                  }
                  placeholder="Prénom"
                  className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
                />
                <input
                  value={draft.lastName}
                  onChange={(event) =>
                    setMemberDrafts((prev) => ({
                      ...prev,
                      [agency.id]: { ...draft, lastName: event.target.value },
                    }))
                  }
                  placeholder="Nom"
                  className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
                />
                <input
                  value={draft.email}
                  onChange={(event) =>
                    setMemberDrafts((prev) => ({
                      ...prev,
                      [agency.id]: { ...draft, email: event.target.value },
                    }))
                  }
                  placeholder="gestion@agence.fr"
                  className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
                />
              </div>
              <button
                type="button"
                disabled={busy}
                onClick={() => void addMember(agency)}
                className="mt-3 inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
              >
                <UserPlus className="h-4 w-4" aria-hidden />
                Créer le compte et envoyer le lien
              </button>
            </section>
          );
        })
      )}
    </div>
  );
}
