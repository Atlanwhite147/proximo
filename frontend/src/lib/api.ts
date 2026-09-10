/**
 * Client API Proximo.
 * - Cookies HTTP-only : aucun token manipulé côté JavaScript.
 * - Rafraîchissement automatique : si une requête échoue en 401,
 *   on tente /auth/refresh une fois puis on rejoue la requête.
 * - Délai maximal : aucune requête ne peut rester en attente indéfiniment
 *   (un backend lent provoquait des écrans bloqués, notamment au retour de
 *   la connexion Google).
 * - Erreurs normalisées en ApiError (message lisible pour l'utilisateur).
 */

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? '/api';

/** Délai maximal par défaut (uploads d'images : plus généreux). */
const TIMEOUT_MS = 20_000;
const TIMEOUT_UPLOAD_MS = 60_000;

export class ApiError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

async function rawFetch(path: string, options: RequestInit = {}): Promise<Response> {
  const headers = new Headers(options.headers);
  // JSON par défaut, SAUF pour FormData (le navigateur pose lui-même le
  // header multipart avec sa frontière — un Content-Type forcé le casserait).
  if (options.body && !headers.has('Content-Type') && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  // Délai maximal : on respecte le signal fourni par l'appelant s'il existe.
  // `AbortSignal.timeout`/`any` sont récents : sur un navigateur plus ancien on
  // continue sans délai plutôt que de faire échouer toutes les requêtes.
  let signal = options.signal;
  if (typeof AbortSignal.timeout === 'function') {
    const timeout = AbortSignal.timeout(
      options.body instanceof FormData ? TIMEOUT_UPLOAD_MS : TIMEOUT_MS,
    );
    signal =
      signal && typeof AbortSignal.any === 'function'
        ? AbortSignal.any([signal, timeout])
        : (signal ?? timeout);
  }

  return fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
    credentials: 'include',
    ...(signal ? { signal } : {}),
  });
}

function extractMessage(body: unknown, fallback: string): string {
  if (!body || typeof body !== 'object') return fallback;
  const message = (body as { message?: unknown }).message;
  if (Array.isArray(message)) return message.join(' ');
  if (typeof message === 'string') return message;
  return fallback;
}

export async function api<T = unknown>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  let response: Response;
  try {
    response = await rawFetch(path, options);
  } catch (error) {
    // Délai dépassé ou réseau coupé : message actionnable plutôt qu'un
    // écran qui tourne sans fin.
    if (error instanceof DOMException && error.name === 'TimeoutError') {
      throw new ApiError(408, 'Le serveur met trop de temps à répondre. Réessayez.');
    }
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new ApiError(499, 'Requête interrompue.');
    }
    throw new ApiError(0, 'Connexion impossible. Vérifiez votre réseau.');
  }

  // Session expirée : tentative de rafraîchissement (une seule fois, hors routes /auth).
  if (response.status === 401 && !path.startsWith('/auth/')) {
    const refresh = await rawFetch('/auth/refresh', { method: 'POST' }).catch(() => null);
    if (refresh?.ok) {
      response = await rawFetch(path, options);
    }
  }

  if (!response.ok) {
    let body: unknown = null;
    try {
      body = await response.json();
    } catch {
      // corps non JSON
    }
    throw new ApiError(
      response.status,
      extractMessage(body, `Erreur ${response.status}`),
    );
  }

  if (response.status === 204) {
    return null as T; // suppression (pas de corps)
  }

  return (await response.json()) as T;
}

export default api;
