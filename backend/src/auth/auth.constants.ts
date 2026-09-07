/**
 * Noms des cookies HTTP-only utilisés par l'API.
 * Le refresh token est restreint au chemin /api/auth : il n'est envoyé
 * par le navigateur que sur les appels d'authentification.
 */
export const ACCESS_TOKEN_COOKIE = 'access_token';
export const REFRESH_TOKEN_COOKIE = 'refresh_token';
/** Cookie transitoire portant le token de pré-validation 2FA (5 min). */
export const TWO_FACTOR_TOKEN_COOKIE = 'two_factor_token';
/** Cookie transitoire anti-CSRF du flux OAuth (state). */
export const OAUTH_STATE_COOKIE = 'oauth_state';

export const ACCESS_TOKEN_TTL_DEFAULT = 900; // 15 minutes
export const REFRESH_TOKEN_TTL_DEFAULT = 2_592_000; // 30 jours (session classique)
export const REFRESH_TOKEN_TTL_LONG = 7_776_000; // 90 jours (« Se souvenir de moi »)
export const TWO_FACTOR_TOKEN_TTL = 300; // 5 minutes

export const ROLE_USER = 'USER';
export const ROLE_ADMIN = 'ADMIN';
export const ROLE_SUPERADMIN = 'SUPERADMIN';
export const STATUS_PENDING = 'PENDING';
export const STATUS_ACTIVE = 'ACTIVE';
export const STATUS_SUSPENDED = 'SUSPENDED';
