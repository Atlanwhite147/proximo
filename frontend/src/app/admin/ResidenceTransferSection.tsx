'use client';

import { useRef, useState } from 'react';
import { Download, RotateCcw, Upload } from 'lucide-react';

/**
 * Sauvegarde et transfert d'une résidence (superadmin).
 *
 * Export : un fichier `.proximo` chiffré (AES-256-GCM, clé dérivée d'une phrase
 * de passe) contenant habitants, annonces, signalements et leurs photos,
 * commentaires, conversations et invitations. Sans la phrase de passe, le
 * fichier est illisible — y compris par nous.
 *
 * Import : crée une NOUVELLE résidence à partir d'un fichier ; aucune donnée
 * existante n'est écrasée.
 */

interface ImportReport {
  residence: { id: string; name: string; code: string | null };
  imported: Record<string, number>;
  skipped: Record<string, number>;
  warnings: string[];
}

const MIN_PASSPHRASE = 12;

async function readError(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { message?: string | string[] };
    if (Array.isArray(body.message)) return body.message.join(' ');
    if (typeof body.message === 'string') return body.message;
  } catch {
    /* corps non JSON */
  }
  return `Erreur ${response.status}`;
}

/** Carte d'export, affichée dans le détail d'une résidence. */
export function ExportResidenceCard({ residenceId }: { residenceId: string }) {
  const [open, setOpen] = useState(false);
  const [passphrase, setPassphrase] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  const tooShort = passphrase.length > 0 && passphrase.length < MIN_PASSPHRASE;
  const mismatch = confirm.length > 0 && passphrase !== confirm;
  const ready = passphrase.length >= MIN_PASSPHRASE && passphrase === confirm;

  const run = async () => {
    setBusy(true);
    setError(null);
    setDone(null);
    try {
      const response = await fetch(`/api/admin/residences/${residenceId}/export`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ passphrase }),
      });
      if (!response.ok) {
        throw new Error(await readError(response));
      }
      // Le fichier ne transite jamais par ce navigateur : un lien à usage
      // unique part sur l'adresse du superadmin.
      const data = (await response.json()) as {
        email: string;
        expiresInHours: number;
        sizeBytes: number;
      };

      setDone(
        `Email envoyé à ${data.email} (${(data.sizeBytes / 1024).toFixed(0)} Ko) · lien valable ${data.expiresInHours} h`,
      );
      setPassphrase('');
      setConfirm('');
      setOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Export impossible');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="ds-card p-5">
      <p className="font-mono text-[11px] font-medium uppercase tracking-badge text-slate-400">
        ● Sauvegarde
      </p>
      <h3 className="mt-1 font-display text-lg">Exporter cette résidence</h3>
      <p className="mt-1 text-sm text-slate-500">
        Un seul fichier chiffré : habitants, annonces, signalements et photos,
        commentaires, conversations, invitations — restaurable sur ce serveur ou sur une
        autre instance.
      </p>
      <p className="mt-1 text-sm text-slate-500">
        Le fichier vous est envoyé <strong>par email</strong>, sous la forme d&apos;un lien à
        usage unique valable 24 h : il ne transite pas par ce navigateur et il est supprimé
        du serveur dès le téléchargement.
      </p>

      {!open ? (
        <button
          type="button"
          onClick={() => {
            setOpen(true);
            setError(null);
            setDone(null);
          }}
          className="btn-primary mt-4 inline-flex items-center gap-2"
        >
          <Download className="h-4 w-4" aria-hidden />
          Exporter
        </button>
      ) : (
        <div className="mt-4 space-y-3">
          <div>
            <label htmlFor="export-pass" className="block text-sm font-medium text-slate-700">
              Phrase de passe du fichier
            </label>
            <input
              id="export-pass"
              type="password"
              value={passphrase}
              onChange={(event) => setPassphrase(event.target.value)}
              className="input-field mt-1 font-mono"
              placeholder={`Au moins ${MIN_PASSPHRASE} caractères`}
              autoComplete="new-password"
            />
            <p className="mt-1 text-xs text-slate-500">
              Elle est la <strong>seule clé</strong> du fichier : sans elle, il est
              définitivement illisible. Conservez-la séparément du fichier.
            </p>
          </div>
          <div>
            <label htmlFor="export-pass2" className="block text-sm font-medium text-slate-700">
              Confirmer la phrase de passe
            </label>
            <input
              id="export-pass2"
              type="password"
              value={confirm}
              onChange={(event) => setConfirm(event.target.value)}
              className="input-field mt-1 font-mono"
              autoComplete="new-password"
            />
            {mismatch && <p className="mt-1 text-xs text-red-600">Les deux saisies diffèrent.</p>}
            {tooShort && (
              <p className="mt-1 text-xs text-red-600">
                {MIN_PASSPHRASE} caractères minimum.
              </p>
            )}
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void run()}
              disabled={!ready || busy}
              className="btn-primary disabled:opacity-50"
            >
              {busy ? 'Chiffrement…' : 'Générer le fichier'}
            </button>
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                setPassphrase('');
                setConfirm('');
                setError(null);
              }}
              className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700"
            >
              Annuler
            </button>
          </div>
        </div>
      )}

      {done && (
        <p className="mt-3 rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          ✅ {done}
          <br />
          Ouvrez cet email et suivez le lien pour récupérer le fichier (une seule fois).
        </p>
      )}
    </div>
  );
}

/** Bouton + formulaire d'import, affiché dans la console des résidences. */
export function ImportResidenceButton({ onImported }: { onImported: () => void }) {
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [passphrase, setPassphrase] = useState('');
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [conflict, setConflict] = useState<'rename' | 'skip'>('rename');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<ImportReport | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const reset = () => {
    setFile(null);
    setPassphrase('');
    setName('');
    setCode('');
    setConflict('rename');
    setError(null);
    setReport(null);
    if (inputRef.current) inputRef.current.value = '';
  };

  const run = async () => {
    if (!file) {
      setError('Choisissez un fichier .proximo');
      return;
    }
    setBusy(true);
    setError(null);
    setReport(null);
    try {
      const form = new FormData();
      form.append('file', file);
      form.append('passphrase', passphrase);
      if (name.trim()) form.append('residenceName', name.trim());
      if (code.trim()) form.append('residenceCode', code.trim());
      form.append('emailConflict', conflict);

      const response = await fetch('/api/admin/residences/import', {
        method: 'POST',
        credentials: 'include',
        body: form,
      });
      if (!response.ok) {
        throw new Error(await readError(response));
      }
      setReport((await response.json()) as ImportReport);
      onImported();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import impossible');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-4">
      {!open ? (
        <button
          type="button"
          onClick={() => {
            setOpen(true);
            reset();
          }}
          className="inline-flex items-center gap-2 rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
        >
          <Upload className="h-4 w-4" aria-hidden />
          Importer une résidence
        </button>
      ) : (
        <div className="ds-card p-5">
          <p className="font-mono text-[11px] font-medium uppercase tracking-badge text-slate-400">
            ● Restauration
          </p>
          <h3 className="mt-1 font-display text-lg">Importer un fichier de résidence</h3>
          <p className="mt-1 text-sm text-slate-500">
            Le fichier crée une <strong>nouvelle résidence</strong> : rien n&apos;est écrasé.
          </p>

          <div className="mt-4 space-y-3">
            <div>
              <label htmlFor="import-file" className="block text-sm font-medium text-slate-700">
                Fichier .proximo
              </label>
              <input
                id="import-file"
                ref={inputRef}
                type="file"
                accept=".proximo,application/octet-stream"
                onChange={(event) => setFile(event.target.files?.[0] ?? null)}
                className="mt-1 block w-full text-sm text-slate-600"
              />
            </div>
            <div>
              <label htmlFor="import-pass" className="block text-sm font-medium text-slate-700">
                Phrase de passe
              </label>
              <input
                id="import-pass"
                type="password"
                value={passphrase}
                onChange={(event) => setPassphrase(event.target.value)}
                className="input-field mt-1 font-mono"
                autoComplete="off"
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label htmlFor="import-name" className="block text-sm font-medium text-slate-700">
                  Nom (facultatif)
                </label>
                <input
                  id="import-name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  className="input-field mt-1"
                  placeholder="Nom d'origine"
                />
              </div>
              <div>
                <label htmlFor="import-code" className="block text-sm font-medium text-slate-700">
                  Code d&apos;accès (facultatif)
                </label>
                <input
                  id="import-code"
                  value={code}
                  onChange={(event) => setCode(event.target.value)}
                  className="input-field mt-1 font-mono"
                  placeholder="Code d'origine"
                />
              </div>
            </div>
            <div>
              <label htmlFor="import-conflict" className="block text-sm font-medium text-slate-700">
                Habitants dont l&apos;email existe déjà
              </label>
              <select
                id="import-conflict"
                value={conflict}
                onChange={(event) => setConflict(event.target.value as 'rename' | 'skip')}
                className="input-field mt-1"
              >
                <option value="rename">Renommer l&apos;email (import complet)</option>
                <option value="skip">Ignorer ces habitants</option>
              </select>
            </div>

            {error && <p className="text-sm text-red-600">{error}</p>}

            {report && (
              <div className="rounded-xl bg-emerald-50 p-4 text-sm text-emerald-800">
                <p className="font-semibold">
                  ✅ Résidence « {report.residence.name} » restaurée
                  {report.residence.code ? ` · code ${report.residence.code}` : ''}
                </p>
                <ul className="mt-2 space-y-0.5">
                  {Object.entries(report.imported).map(([key, value]) => (
                    <li key={key}>
                      {value} {key}
                    </li>
                  ))}
                </ul>
                {report.warnings.length > 0 && (
                  <details className="mt-2">
                    <summary className="cursor-pointer font-medium">
                      {report.warnings.length} avertissement(s)
                    </summary>
                    <ul className="mt-1 space-y-0.5 text-xs">
                      {report.warnings.slice(0, 20).map((warning, index) => (
                        <li key={index}>· {warning}</li>
                      ))}
                    </ul>
                  </details>
                )}
              </div>
            )}

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => void run()}
                disabled={busy || !file || passphrase.length < MIN_PASSPHRASE}
                className="btn-primary disabled:opacity-50"
              >
                {busy ? 'Restauration…' : 'Restaurer la résidence'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  reset();
                }}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700"
              >
                <RotateCcw className="h-4 w-4" aria-hidden />
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
