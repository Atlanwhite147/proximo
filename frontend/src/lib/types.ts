/**
 * Types partagés — miroir des réponses de l'API (Sprint 2 inclus).
 */

export type UserRole = 'USER' | 'ADMIN' | 'SUPERADMIN';
export type UserStatus = 'PENDING' | 'ACTIVE' | 'SUSPENDED';

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  neighborhood: string | null;
  building: string | null;
  floor: string | null;
  showDetails: boolean;
  /** ID de la résidence de rattachement (multi-résidences). */
  residenceId: string | null;
  residenceName: string | null;
  role: UserRole;
  status: UserStatus;
  totpEnabled: boolean;
  emailNotifications: boolean;
  createdAt: string;
}

export type ListingCategory = 'TOOL' | 'SERVICE' | 'DONATION' | 'NOTICE' | 'OTHER';
export type ListingStatus = 'OPEN' | 'RESERVED' | 'CLOSED';

export interface ListingOwner {
  id: string;
  firstName: string;
  neighborhood: string | null;
  building?: string | null;
  floor?: string | null;
  showDetails?: boolean;
}

export interface Listing {
  id: string;
  title: string;
  description: string;
  category: ListingCategory;
  status: ListingStatus;
  neighborhood: string;
  residenceName?: string | null;
  distanceKm?: number;
  commentCount?: number;
  isOwner: boolean;
  createdAt: string;
  owner: ListingOwner;
}

export interface ListingPage {
  items: Listing[];
  total: number;
  page: number;
  limit: number;
}

export interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  content: string;
  readAt: string | null;
  createdAt: string;
}

export interface Conversation {
  id: string;
  otherUser: ListingOwner;
  lastMessage: Message | null;
  unreadCount: number;
  updatedAt: string;
}

// ─── Sprint 2 : signalements d'incidents ─────────────────────

export type IncidentCategory = 'WATER_LEAK' | 'ELEVATOR' | 'DAMAGE' | 'OTHER';
export type IncidentStatus = 'OPEN' | 'IN_PROGRESS' | 'RESOLVED';

export interface IncidentAttachment {
  id: string;
  filename: string;
  mimeType: string;
  size: number;
  createdAt: string;
}

export interface IncidentUser {
  firstName: string;
  lastName: string;
  email: string;
  building?: string | null;
  floor?: string | null;
  showDetails?: boolean;
}

export interface Incident {
  id: string;
  title: string;
  category: IncidentCategory;
  description: string;
  status: IncidentStatus;
  neighborhood?: string | null;
  createdAt: string;
  updatedAt: string;
  attachments: IncidentAttachment[];
  user?: IncidentUser;
  _count?: { comments: number };
}

// ─── Commentaires publics (annonces & signalements) ──────────

export interface CommentAuthor {
  id: string;
  firstName: string;
  lastName: string;
  showDetails: boolean;
  building?: string | null;
  floor?: string | null;
}

export interface Comment {
  id: string;
  content: string;
  createdAt: string;
  updatedAt: string;
  author: CommentAuthor;
}

// ─── Sprint 2 : invitations ──────────────────────────────────

export interface Invitation {
  id: string;
  token: string;
  url: string;
  qrUrl: string;
  neighborhood: string;
  expiresAt: string;
  createdAt?: string;
  usedAt?: string | null;
  createdBy?: { firstName: string; lastName: string };
}

// ─── Sprint 2 : administration ───────────────────────────────

export interface AdminUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  neighborhood: string | null;
  role: UserRole;
  status: UserStatus;
  totpEnabled: boolean;
  createdAt: string;
}

export interface SyndicSettings {
  id: number;
  agencyName: string | null;
  email: string | null;
  residenceName?: string | null;
  residenceCode?: string | null;
  updatedAt: string;
}

/** Réglages d'envoi d'emails (admin) — les secrets ne sont jamais renvoyés. */
export interface EmailSettings {
  id: number;
  mode: 'brevo' | 'smtp' | 'log';
  fromName: string;
  fromEmail: string;
  brevoConfigured: boolean;
  smtpConfigured: boolean;
  smtpHost: string | null;
  smtpPort: number | null;
  smtpSecure: boolean;
  smtpUser: string | null;
  incidentNotificationsEnabled: boolean;
  listingNotificationsEnabled: boolean;
  effectiveMode: 'brevo' | 'smtp' | 'log';
}

export const CATEGORY_LABELS: Record<ListingCategory, string> = {
  TOOL: 'Prêt de matériel',
  SERVICE: 'Service entre voisins',
  DONATION: 'Don',
  NOTICE: 'Avis aux résidents',
  OTHER: 'Autre',
};

export const CATEGORY_EMOJI: Record<ListingCategory, string> = {
  TOOL: '🔧',
  SERVICE: '🤝',
  DONATION: '🎁',
  NOTICE: '📢',
  OTHER: '📦',
};

export const STATUS_LABELS: Record<ListingStatus, string> = {
  OPEN: 'Disponible',
  RESERVED: 'Réservée',
  CLOSED: 'Clôturée',
};

export const INCIDENT_CATEGORY_LABELS: Record<IncidentCategory, string> = {
  WATER_LEAK: '💧 Fuite d’eau',
  ELEVATOR: '🛗 Panne d’ascenseur',
  DAMAGE: '🏚️ Dégradation',
  OTHER: '📋 Autre',
};

export const INCIDENT_STATUS_LABELS: Record<IncidentStatus, string> = {
  OPEN: '🟡 Nouveau',
  IN_PROGRESS: '🔵 En cours',
  RESOLVED: '🟢 Résolu',
};

export const USER_STATUS_LABELS: Record<UserStatus, string> = {
  PENDING: '⏳ En attente',
  ACTIVE: '✅ Actif',
  SUSPENDED: '🚫 Suspendu',
};
