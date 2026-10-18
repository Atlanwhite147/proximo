"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  Clock,
  Download,
  RotateCcw,
  Loader2,
} from "lucide-react";
import Link from "next/link";
import api from "@/lib/api";
import { useAuth } from "@/components/AuthProvider";
import { RequireAccount } from "@/components/RequireAccount";
import { Spinner } from "@/components/Feedback";
import { formatRelativeDate } from "@/lib/format";
import { INCIDENT_STATUS_LABELS } from "@/lib/types";
import type { Incident, IncidentStatus } from "@/lib/types";

/**
 * Espace agence : les signalements de toutes les résidences gérées, dans une
 * seule liste. Un compte de rôle AGENCE y prend en charge, résout, réouvre et
 * exporte un dossier. Le périmètre (multi-résidences) est appliqué par le
 * serveur : cette page n'affiche que ce que l'API renvoie.
 */
type Filter = "TOUS" | IncidentStatus;

const FILTERS: Array<{ key: Filter; label: string }> = [
  { key: "TOUS", label: "Tous" },
  { key: "OPEN", label: "Nouveaux" },
  { key: "IN_PROGRESS", label: "En cours" },
  { key: "RESOLVED", label: "Résolus" },
];

export default function AgencyPage() {
  const { user, isAgency, loading: authLoading } = useAuth();
  const [incidents, setIncidents] = useState<Incident[] | null>(null);
  const [filter, setFilter] = useState<Filter>("TOUS");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    api<{ incidents: Incident[] }>("/incidents")
      .then((data) => setIncidents(data.incidents))
      .catch((err) => {
        setIncidents([]);
        setError(err instanceof Error ? err.message : "Chargement impossible");
      });
  }, []);

  useEffect(() => {
    if (isAgency) load();
  }, [isAgency, load]);

  const changeStatus = async (incident: Incident, status: IncidentStatus) => {
    setBusyId(incident.id);
    setError(null);
    try {
      const data = await api<{ incident: Incident }>(
        `/incidents/${incident.id}/status`,
        {
          method: "PATCH",
          body: JSON.stringify({ status }),
        },
      );
      setIncidents((current) =>
        (current ?? []).map((item) =>
          item.id === incident.id ? { ...item, ...data.incident } : item,
        ),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Mise à jour impossible");
    } finally {
      setBusyId(null);
    }
  };

  const visible = useMemo(
    () =>
      (incidents ?? []).filter(
        (incident) => filter === "TOUS" || incident.status === filter,
      ),
    [incidents, filter],
  );

  const counts = useMemo(() => {
    const all = incidents ?? [];
    return {
      total: all.length,
      open: all.filter((incident) => incident.status === "OPEN").length,
      progress: all.filter((incident) => incident.status === "IN_PROGRESS")
        .length,
    };
  }, [incidents]);

  if (authLoading) {
    return (
      <div className="py-16">
        <Spinner label="Vérification du compte…" />
      </div>
    );
  }

  if (user && !isAgency) {
    return (
      <div className="mx-auto max-w-md px-4 py-16">
        <div className="ds-card p-8 text-center">
          <h1 className="text-lg font-bold text-slate-900">Espace agence</h1>
          <p className="mt-2 text-sm text-slate-600">
            Cet espace est réservé aux comptes d’agence ou de syndic
            gestionnaire.
          </p>
          <Link
            href="/"
            className="mt-4 inline-block text-sm font-semibold text-brand-700"
          >
            Retour à l’accueil
          </Link>
        </div>
      </div>
    );
  }

  return (
    <RequireAccount next="/agence">
      <div className="mx-auto max-w-5xl px-4 py-8">
        <header className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Signalements</h1>
            <p className="mt-1 text-sm text-slate-500">
              Toutes les résidences gérées, les plus anciens d’abord.
            </p>
          </div>
          <div className="flex gap-4 text-right text-sm">
            <div>
              <p className="text-lg font-bold text-slate-900">{counts.total}</p>
              <p className="text-xs text-slate-500">dossiers</p>
            </div>
            <div>
              <p className="text-lg font-bold text-amber-600">{counts.open}</p>
              <p className="text-xs text-slate-500">nouveaux</p>
            </div>
            <div>
              <p className="text-lg font-bold text-sky-600">
                {counts.progress}
              </p>
              <p className="text-xs text-slate-500">en cours</p>
            </div>
          </div>
        </header>

        <div className="mt-5 flex flex-wrap gap-2">
          {FILTERS.map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => setFilter(item.key)}
              className={`rounded-full px-3 py-1.5 text-sm font-medium transition ${
                filter === item.key
                  ? "bg-brand-600 text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        {error && (
          <p className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </p>
        )}

        {incidents === null ? (
          <div className="py-10">
            <Spinner label="Chargement des signalements…" />
          </div>
        ) : visible.length === 0 ? (
          <div className="ds-card mt-5 p-8 text-center text-sm text-slate-500">
            Aucun dossier dans cette vue.
          </div>
        ) : (
          <ul className="mt-5 space-y-3">
            {visible.map((incident) => (
              <li key={incident.id} className="ds-card p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-mono text-xs font-semibold text-slate-500">
                      {incident.reference ?? "référence à venir"}
                    </p>
                    <h2 className="mt-0.5 font-semibold text-slate-900">
                      {incident.title}
                    </h2>
                    <p className="mt-1 text-xs text-slate-500">
                      {incident.residence?.name
                        ? `${incident.residence.name} · `
                        : ""}
                      ouvert {formatRelativeDate(incident.createdAt)}
                      {incident._count
                        ? ` · ${incident._count.comments} message(s)`
                        : ""}
                    </p>
                  </div>
                  <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">
                    {INCIDENT_STATUS_LABELS[incident.status]}
                  </span>
                </div>

                <p className="mt-2 line-clamp-3 whitespace-pre-wrap text-sm text-slate-700">
                  {incident.description}
                </p>

                <div className="mt-3 flex flex-wrap items-center gap-2">
                  {incident.status === "OPEN" && (
                    <button
                      type="button"
                      disabled={busyId === incident.id}
                      onClick={() => void changeStatus(incident, "IN_PROGRESS")}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-sky-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-sky-700 disabled:opacity-60"
                    >
                      {busyId === incident.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                      ) : (
                        <Clock className="h-4 w-4" aria-hidden />
                      )}
                      Prendre en charge
                    </button>
                  )}
                  {incident.status !== "RESOLVED" && (
                    <button
                      type="button"
                      disabled={busyId === incident.id}
                      onClick={() => void changeStatus(incident, "RESOLVED")}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
                    >
                      <CheckCircle2 className="h-4 w-4" aria-hidden />
                      Marquer comme résolu
                    </button>
                  )}
                  {incident.status === "RESOLVED" && (
                    <button
                      type="button"
                      disabled={busyId === incident.id}
                      onClick={() => void changeStatus(incident, "OPEN")}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                    >
                      <RotateCcw className="h-4 w-4" aria-hidden />
                      Réouvrir
                    </button>
                  )}
                  <a
                    href={`/api/incidents/${incident.id}/export`}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    <Download className="h-4 w-4" aria-hidden />
                    Exporter le dossier
                  </a>
                  <Link
                    href={`/signalements/${incident.id}`}
                    className="ml-auto text-sm font-semibold text-brand-700 hover:underline"
                  >
                    Ouvrir la discussion
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </RequireAccount>
  );
}
