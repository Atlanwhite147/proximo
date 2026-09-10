'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { Download } from 'lucide-react';
import api from '@/lib/api';
import { RequireAccount } from '@/components/RequireAccount';
import { SectionLabel } from '@/components/ui/section-label';
import { Spinner } from '@/components/Feedback';

/**
 * Page de téléchargement d'un export de résidence, ouverte depuis le lien
 * reçu par email.
 *
 * Trois garde-fous : session superadmin obligatoire (le lien seul ne suffit
 * pas), usage unique, et expiration au bout de 24 h. Le fichier est supprimé
 * du serveur dès qu'il a été servi.
 */

interface ExportInfo {
  residenceName: string;
  filename: string;
  sizeBytes: number;
  expiresAt: string;
  downloadedAt: string | null;
  expired: boolean;
  used: boolean;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
}

function TransfertView({ token }: { token: string }) {
  const [info, setInfo] = useState<ExportInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [downloaded, setDownloaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    api<ExportInfo>(`/admin/residences/exports/${token}`)
      .then((data) => {
        if (!cancelled) setInfo(data);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Lien invalide');
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  const download = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/admin/residences/exports/${token}/download`, {
        credentials: 'include',
      });
      if (!response.ok) {
        let message = `Erreur ${response.status}`;
        try {
          const body = (await response.json()) as { message?: string };
          if (body.message) message = body.message;
        } catch {
          /* corps non JSON */
        }
        throw new Error(message);
      }
      const blob = await response.blob();
      const disposition = response.headers.get('Content-Disposition') ?? '';
      const filename =
        /filename="([^"]+)"/.exec(disposition)?.[1] ?? info?.filename ?? 'residence.proximo';

      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);

      setDownloaded(true);
      setInfo((prev) => (prev ? { ...prev, used: true, downloadedAt: new Date().toISOString() } : prev));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Téléchargement impossible');
    } finally {
      setBusy(false);
    }
  }, [token, info?.filename]);

  if (!info && !error) {
    return (
      <div className="py-16">
        <Spinner label="Vérification du lien…" />
      </div>
    );
  }

  return (
    <section className="mx-auto max-w-lg">
      <div className="ds-card p-6">
        {error ? (
          <>
            <SectionLabel color="blue">Export de résidence</SectionLabel>
            <h1 className="mt-2 font-display text-xl">Lien inutilisable</h1>
            <p className="mt-2 text-sm text-slate-600">{error}</p>
            <p className="mt-3 text-sm text-slate-500">
              Demandez un nouvel export depuis la console (Résidences → votre résidence →
              Exporter), puis utilisez le lien du nouvel email.
            </p>
            <p className="mt-2 rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-800">
              ⚠️ Les emails Proximo peuvent être classés en <strong>spam</strong> : pensez à
              vérifier votre dossier de courriers indésirables.
            </p>
            <Link href="/admin" className="btn-primary mt-4 inline-block">
              Retour à la console
            </Link>
          </>
        ) : info && (info.used || info.expired) ? (
          <>
            <SectionLabel color="blue">Export de résidence</SectionLabel>
            <h1 className="mt-2 font-display text-xl">
              {downloaded ? 'Téléchargement terminé' : 'Ce lien n’est plus valable'}
            </h1>
            <p className="mt-2 text-sm text-slate-600">
              {downloaded
                ? 'Le fichier a été téléchargé et supprimé du serveur (usage unique).'
                : info.expired
                  ? 'Le lien a expiré (validité 24 h) ou a déjà été utilisé : le fichier a été supprimé du serveur.'
                  : 'Ce lien a déjà été utilisé : le fichier a été supprimé du serveur.'}
            </p>
            <Link href="/admin" className="btn-primary mt-4 inline-block">
              Retour à la console
            </Link>
          </>
        ) : info ? (
          <>
            <SectionLabel color="blue">Export de résidence</SectionLabel>
            <h1 className="mt-2 font-display text-xl">{info.residenceName}</h1>
            <p className="mt-2 text-sm text-slate-600">
              Votre export chiffré est prêt : {formatSize(info.sizeBytes)} — habitants, annonces,
              signalements et photos, commentaires, conversations, invitations.
            </p>
            <p className="mt-2 text-sm text-amber-700">
              Lien à usage unique, valable jusqu’au{' '}
              {new Date(info.expiresAt).toLocaleString('fr-FR')}. Le fichier est supprimé du
              serveur dès le téléchargement.
            </p>
            <button
              type="button"
              onClick={() => void download()}
              disabled={busy}
              className="btn-primary mt-4 inline-flex items-center gap-2 disabled:opacity-50"
            >
              <Download className="h-4 w-4" aria-hidden />
              {busy ? 'Téléchargement…' : "Télécharger l'export"}
            </button>
            <p className="mt-3 text-xs text-slate-500">
              Ouvrez-le avec la phrase de passe choisie au moment de l’export : sans elle, le
              fichier est illisible.
            </p>
          </>
        ) : null}
      </div>
    </section>
  );
}

export default function TransfertPage({ params }: { params: { token: string } }) {
  return (
    <RequireAccount next={`/transfert/${params.token}`}>
      <TransfertView token={params.token} />
    </RequireAccount>
  );
}
