import {
  BadRequestException,
  ForbiddenException,
  GoneException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  createCipheriv,
  createDecipheriv,
  createHash,
  pbkdf2Sync,
  randomBytes,
  randomUUID,
} from 'crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, unlinkSync, writeFileSync } from 'fs';
import { basename, join } from 'path';
import { gunzipSync, gzipSync } from 'zlib';
import { EmailService } from '../email/email.service';
import { PrismaService } from '../prisma/prisma.service';
import { uploadsDir } from '../incidents/incidents.service';

/**
 * Transfert de résidence (export / import) — SUPERADMIN uniquement.
 *
 * Fichier produit : conteneur binaire autonome, lisible par personne sans la
 * phrase de passe.
 *   MAGIC(8) | sel(16) | IV(12) | tagGCM(16) | chiffré( AES-256-GCM( gzip(JSON) ) )
 * La clé est dérivée de la phrase de passe (PBKDF2-SHA256, 600 000 itérations).
 *
 * Ce qui est inclus : résidence (réglages), habitants, annonces, signalements
 * et leurs photos, commentaires, conversations et messages, invitations.
 * Ce qui est VOLONTAIREMENT exclu : jetons de session, jetons de réinitialisation,
 * secrets 2FA (totpSecret), et tout secret de plateforme (JWT, Brevo, Stripe,
 * DATABASE_URL) — un export ne doit jamais pouvoir servir à compromettre le serveur.
 */

const MAGIC = Buffer.from('PROXIMO1', 'utf8');
const MAGIC_LEN = MAGIC.length;
const SALT_LEN = 16;
const IV_LEN = 12;
const TAG_LEN = 16;
const KEY_LEN = 32;
const PBKDF2_ITERATIONS = 600_000;

export const TRANSFER_FORMAT = 'proximo-residence';
export const TRANSFER_VERSION = 1;
export const MIN_PASSPHRASE = 12;
/** Durée de vie du lien de téléchargement envoyé par email. */
export const EXPORT_LINK_HOURS = 24;
/** Garde-fou mémoire : au-delà, l'export dépasserait la RAM de la VM. */
const MAX_EXPORT_BYTES = 300 * 1024 * 1024;

/**
 * Dossier des exports en attente de téléchargement : dans le volume persistant
 * (survit aux redéploiements) mais dans un sous-dossier que RIEN ne sert en
 * statique — les pièces jointes sont servies par identifiant, jamais par
 * chemin arbitraire.
 */
function exportsDir(): string {
  return join(uploadsDir(), '_exports');
}

type Collection =
  | 'users'
  | 'listings'
  | 'incidents'
  | 'attachments'
  | 'comments'
  | 'conversations'
  | 'messages'
  | 'invitations'
  | 'files';

interface TransferFile {
  path: string;
  size: number;
  base64: string;
}

interface TransferPayload {
  format: string;
  version: number;
  exportedAt: string;
  exportedBy: string;
  checksums: Partial<Record<Collection, string>>;
  residence: Record<string, unknown>;
  users: Record<string, unknown>[];
  listings: Record<string, unknown>[];
  incidents: Record<string, unknown>[];
  attachments: Record<string, unknown>[];
  comments: Record<string, unknown>[];
  conversations: Record<string, unknown>[];
  messages: Record<string, unknown>[];
  invitations: Record<string, unknown>[];
  files: TransferFile[];
}

export interface ImportOptions {
  passphrase: string;
  /** Nouveau nom (sinon celui du fichier, suffixé en cas de collision). */
  residenceName?: string;
  /** Nouveau code d'accès (sinon celui du fichier ; jamais réutilisé tel quel en cas de collision). */
  residenceCode?: string;
  /**
   * Sort des emails déjà présents sur l'instance :
   *  - `rename` (défaut) : l'import reste complet, l'email devient `local+import-xxxx@domaine`
   *  - `skip` : l'habitant en conflit et ses contenus sont ignorés
   */
  emailConflict?: 'rename' | 'skip';
}

export interface ImportReport {
  residence: { id: string; name: string; code: string | null };
  imported: Record<string, number>;
  skipped: Record<string, number>;
  warnings: string[];
}

@Injectable()
export class ResidenceTransferService {
  private readonly logger = new Logger(ResidenceTransferService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly email: EmailService,
  ) {}

  // ─────────────────────────────────────────────────────────────
  // EXPORT
  // ─────────────────────────────────────────────────────────────

  async exportResidence(
    residenceId: string,
    passphrase: string,
    exportedBy: string,
  ): Promise<{
    buffer: Buffer;
    filename: string;
    residenceName: string;
    summary: Record<string, number>;
  }> {
    if (passphrase.length < MIN_PASSPHRASE) {
      throw new BadRequestException(
        `La phrase de passe doit contenir au moins ${MIN_PASSPHRASE} caractères.`,
      );
    }

    const residence = await this.prisma.residence.findUnique({ where: { id: residenceId } });
    if (!residence) {
      throw new NotFoundException('Résidence introuvable.');
    }

    const users = await this.prisma.user.findMany({
      where: { residenceId },
      orderBy: { createdAt: 'asc' },
    });
    const listings = await this.prisma.listing.findMany({
      where: { residenceId },
      orderBy: { createdAt: 'asc' },
    });
    const incidents = await this.prisma.incident.findMany({
      where: { residenceId },
      orderBy: { createdAt: 'asc' },
      include: { attachments: true },
    });
    const listingIds = listings.map((l) => l.id);
    const incidentIds = incidents.map((i) => i.id);
    const userIds = users.map((u) => u.id);

    const comments = await this.prisma.comment.findMany({
      where: {
        OR: [{ listingId: { in: listingIds } }, { incidentId: { in: incidentIds } }],
      },
      orderBy: { createdAt: 'asc' },
    });
    // Seules les conversations entre deux habitants de CETTE résidence.
    const conversations = await this.prisma.conversation.findMany({
      where: { userAId: { in: userIds }, userBId: { in: userIds } },
      orderBy: { createdAt: 'asc' },
    });
    const messages = await this.prisma.message.findMany({
      where: { conversationId: { in: conversations.map((c) => c.id) } },
      orderBy: { createdAt: 'asc' },
    });
    const invitations = await this.prisma.invitation.findMany({
      where: { residenceId },
      orderBy: { createdAt: 'asc' },
    });

    // Photos : lues depuis le volume, embarquées en base64 dans l'archive.
    const files: TransferFile[] = [];
    const attachments = incidents.flatMap((i) => i.attachments);
    for (const attachment of attachments) {
      const safe = basename(attachment.path);
      const full = join(uploadsDir(), safe);
      if (existsSync(full)) {
        files.push({
          path: safe,
          size: attachment.size,
          base64: readFileSync(full).toString('base64'),
        });
      }
    }

    const payload: TransferPayload = {
      format: TRANSFER_FORMAT,
      version: TRANSFER_VERSION,
      exportedAt: new Date().toISOString(),
      exportedBy,
      residence: {
        name: residence.name,
        code: residence.code,
        agencyName: residence.agencyName,
        syndicEmail: residence.syndicEmail,
        notifyAgencyOnIncident: residence.notifyAgencyOnIncident,
        notifyResidentsOnIncident: residence.notifyResidentsOnIncident,
        notifyResidentsOnListing: residence.notifyResidentsOnListing,
      },
      // Les hashs argon2id sont conservés (irréversibles) : les habitants
      // gardent leur mot de passe. `totpSecret` est exclu par construction.
      users: users.map((u) => ({
        id: u.id,
        email: u.email,
        passwordHash: u.passwordHash,
        googleId: u.googleId,
        firstName: u.firstName,
        lastName: u.lastName,
        neighborhood: u.neighborhood,
        building: u.building,
        floor: u.floor,
        showDetails: u.showDetails,
        showInDirectory: u.showInDirectory,
        role: u.role,
        status: u.status,
        emailNotifications: u.emailNotifications,
        createdAt: u.createdAt.toISOString(),
      })),
      listings: listings.map((l) => ({
        id: l.id,
        title: l.title,
        description: l.description,
        category: l.category,
        status: l.status,
        lat: l.lat,
        lng: l.lng,
        address: l.address,
        neighborhood: l.neighborhood,
        ownerId: l.ownerId,
        createdAt: l.createdAt.toISOString(),
      })),
      incidents: incidents.map((i) => ({
        id: i.id,
        title: i.title,
        category: i.category,
        description: i.description,
        status: i.status,
        userId: i.userId,
        createdAt: i.createdAt.toISOString(),
        updatedAt: i.updatedAt.toISOString(),
      })),
      attachments: attachments.map((a) => ({
        id: a.id,
        incidentId: a.incidentId,
        filename: a.filename,
        mimeType: a.mimeType,
        size: a.size,
        path: basename(a.path),
        createdAt: a.createdAt.toISOString(),
      })),
      comments: comments.map((c) => ({
        id: c.id,
        content: c.content,
        listingId: c.listingId,
        incidentId: c.incidentId,
        authorId: c.authorId,
        createdAt: c.createdAt.toISOString(),
      })),
      conversations: conversations.map((c) => ({
        id: c.id,
        userAId: c.userAId,
        userBId: c.userBId,
        createdAt: c.createdAt.toISOString(),
      })),
      messages: messages.map((m) => ({
        id: m.id,
        conversationId: m.conversationId,
        senderId: m.senderId,
        content: m.content,
        readAt: m.readAt ? m.readAt.toISOString() : null,
        createdAt: m.createdAt.toISOString(),
      })),
      invitations: invitations.map((i) => ({
        id: i.id,
        token: i.token,
        neighborhood: i.neighborhood,
        createdById: i.createdById,
        expiresAt: i.expiresAt.toISOString(),
        usedAt: i.usedAt ? i.usedAt.toISOString() : null,
        multiUse: i.multiUse,
        createdAt: i.createdAt.toISOString(),
      })),
      files,
      checksums: {},
    };

    payload.checksums = this.checksums(payload);

    const archive = gzipSync(Buffer.from(JSON.stringify(payload), 'utf8'), { level: 9 });
    if (archive.length > MAX_EXPORT_BYTES) {
      throw new BadRequestException(
        "L'export est trop volumineux pour ce serveur. Exportez les photos séparément.",
      );
    }

    const buffer = this.encrypt(archive, passphrase);
    const slug = residence.name
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .toLowerCase()
      .slice(0, 40);
    const date = new Date().toISOString().slice(0, 10);
    const filename = `proximo-${slug || 'residence'}-${date}.proximo`;

    this.logger.log(
      `Export résidence « ${residence.name} » par ${exportedBy} : ${users.length} habitants, ${listings.length} annonces, ${incidents.length} signalements, ${files.length} photos (${(buffer.length / 1024).toFixed(0)} Ko)`,
    );

    return {
      buffer,
      filename,
      residenceName: residence.name,
      summary: {
        habitants: users.length,
        annonces: listings.length,
        signalements: incidents.length,
        commentaires: comments.length,
        messages: messages.length,
        invitations: invitations.length,
        photos: files.length,
        octets: buffer.length,
      },
    };
  }

  // ─────────────────────────────────────────────────────────────
  // EXPORT PAR EMAIL (lien à usage unique)
  // ─────────────────────────────────────────────────────────────

  private tokenHash(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  /** Supprime les exports expirés ou déjà servis (fichiers + lignes). */
  async purgeExpiredExports(): Promise<number> {
    const stale = await this.prisma.residenceExport.findMany({
      where: { OR: [{ expiresAt: { lt: new Date() } }, { downloadedAt: { not: null } }] },
      select: { id: true },
    });
    if (stale.length === 0) return 0;
    for (const row of stale) {
      const path = join(exportsDir(), `${row.id}.proximo`);
      if (existsSync(path)) unlinkSync(path);
    }
    const result = await this.prisma.residenceExport.deleteMany({
      where: { id: { in: stale.map((row) => row.id) } },
    });

    // Fichiers orphelins (ligne supprimée directement en base, incident) :
    // un export ne doit jamais rester indéfiniment sur le disque.
    let orphans = 0;
    if (existsSync(exportsDir())) {
      const vivants = new Set(
        (await this.prisma.residenceExport.findMany({ select: { id: true } })).map((row) => row.id),
      );
      for (const file of readdirSync(exportsDir())) {
        if (!vivants.has(file.replace(/\.proximo$/, ''))) {
          unlinkSync(join(exportsDir(), file));
          orphans += 1;
        }
      }
    }
    if (orphans > 0) {
      this.logger.warn(`${orphans} fichier(s) d'export orphelin(s) supprimé(s)`);
    }

    return result.count + orphans;
  }

  /**
   * Export envoyé par EMAIL : le fichier ne transite jamais par le navigateur,
   * il reste sur le serveur et seul un lien à usage unique (valable
   * EXPORT_LINK_HOURS) part vers l'adresse du superadmin demandeur.
   */
  async requestExport(
    residenceId: string,
    passphrase: string,
    user: { id: string; email: string; firstName?: string },
  ): Promise<{
    email: string;
    expiresAt: Date;
    expiresInHours: number;
    sizeBytes: number;
    filename: string;
  }> {
    const { buffer, filename, residenceName } = await this.exportResidence(
      residenceId,
      passphrase,
      user.email,
    );

    await this.purgeExpiredExports();

    const token = randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + EXPORT_LINK_HOURS * 3_600_000);
    const record = await this.prisma.residenceExport.create({
      data: {
        tokenHash: this.tokenHash(token),
        residenceId,
        residenceName,
        filename,
        sizeBytes: buffer.length,
        createdById: user.id,
        createdByEmail: user.email,
        expiresAt,
      },
    });

    mkdirSync(exportsDir(), { recursive: true });
    writeFileSync(join(exportsDir(), `${record.id}.proximo`), buffer);

    const appUrl = process.env.APP_URL ?? 'http://localhost:3000';
    await this.email.sendResidenceExport(
      user.email,
      user.firstName,
      residenceName,
      `${appUrl}/transfert/${token}`,
      EXPORT_LINK_HOURS,
    );

    this.logger.log(
      `Export « ${residenceName} » (${(buffer.length / 1024).toFixed(0)} Ko) envoyé à ${user.email} (lien ${EXPORT_LINK_HOURS} h)`,
    );

    return {
      email: user.email,
      expiresAt,
      expiresInHours: EXPORT_LINK_HOURS,
      sizeBytes: buffer.length,
      filename,
    };
  }

  /** État d'un export pour la page de téléchargement (ne consomme pas le lien). */
  async exportInfo(token: string, userId: string) {
    const record = await this.prisma.residenceExport.findUnique({
      where: { tokenHash: this.tokenHash(token) },
    });
    if (!record) throw new NotFoundException('Lien invalide.');
    if (record.createdById !== userId) {
      throw new ForbiddenException('Ce lien ne correspond pas à votre compte.');
    }
    return {
      residenceName: record.residenceName,
      filename: record.filename,
      sizeBytes: record.sizeBytes,
      expiresAt: record.expiresAt,
      downloadedAt: record.downloadedAt,
      expired: record.expiresAt.getTime() < Date.now(),
      used: record.downloadedAt !== null,
    };
  }

  /**
   * Téléchargement : usage unique. Le fichier est supprimé du serveur
   * immédiatement après avoir été servi.
   */
  async downloadExport(
    token: string,
    userId: string,
  ): Promise<{ buffer: Buffer; filename: string }> {
    const record = await this.prisma.residenceExport.findUnique({
      where: { tokenHash: this.tokenHash(token) },
    });
    if (!record) throw new NotFoundException('Lien invalide.');
    if (record.createdById !== userId) {
      throw new ForbiddenException('Ce lien ne correspond pas à votre compte.');
    }
    if (record.downloadedAt) {
      throw new GoneException('Ce lien a déjà été utilisé (usage unique).');
    }
    if (record.expiresAt.getTime() < Date.now()) {
      throw new GoneException('Ce lien a expiré. Demandez un nouvel export.');
    }
    const path = join(exportsDir(), `${record.id}.proximo`);
    if (!existsSync(path)) {
      throw new NotFoundException('Fichier introuvable : demandez un nouvel export.');
    }
    const buffer = readFileSync(path);
    await this.prisma.residenceExport.update({
      where: { id: record.id },
      data: { downloadedAt: new Date(), deletedAt: new Date() },
    });
    unlinkSync(path);
    this.logger.log(`Export « ${record.residenceName} » téléchargé par ${record.createdByEmail}`);
    return { buffer, filename: record.filename };
  }

  // ─────────────────────────────────────────────────────────────
  // IMPORT
  // ─────────────────────────────────────────────────────────────

  async importResidence(file: Buffer, options: ImportOptions): Promise<ImportReport> {
    if (!file || file.length < MAGIC_LEN + SALT_LEN + IV_LEN + TAG_LEN + 1) {
      throw new BadRequestException('Fichier manquant ou incomplet.');
    }
    if (options.passphrase.length < MIN_PASSPHRASE) {
      throw new BadRequestException(
        `La phrase de passe doit contenir au moins ${MIN_PASSPHRASE} caractères.`,
      );
    }

    const archive = this.decrypt(file, options.passphrase);

    let payload: TransferPayload;
    try {
      payload = JSON.parse(gunzipSync(archive).toString('utf8')) as TransferPayload;
    } catch {
      throw new BadRequestException('Contenu illisible : archive corrompue.');
    }

    if (payload.format !== TRANSFER_FORMAT) {
      throw new BadRequestException("Ce fichier n'est pas un export de résidence Proximo.");
    }
    if (payload.version > TRANSFER_VERSION) {
      throw new BadRequestException(
        `Export créé par une version plus récente (v${payload.version}). Mettez à jour Proximo.`,
      );
    }

    const checksums = this.checksums(payload);
    for (const [key, expected] of Object.entries(payload.checksums ?? {})) {
      if (checksums[key as Collection] !== expected) {
        throw new BadRequestException(
          `Intégrité compromise (${key}) : le fichier a été altéré après l'export.`,
        );
      }
    }

    const warnings: string[] = [];
    const skipped: Record<string, number> = {};
    const imported: Record<string, number> = {};

    // ── Résidence cible : jamais de doublon de nom ni de code ──
    const wantedName = (options.residenceName ?? String(payload.residence.name ?? '')).trim();
    if (!wantedName) {
      throw new BadRequestException("Le nom de la résidence est absent de l'export.");
    }
    let name = wantedName;
    if (await this.prisma.residence.findUnique({ where: { name } })) {
      name = `${wantedName} (copie ${new Date().toISOString().slice(0, 10)})`;
    }
    const wantedCode = (options.residenceCode ?? (payload.residence.code as string | null) ?? '')
      .toString()
      .trim();
    let code = wantedCode || null;
    if (code && (await this.prisma.residence.findUnique({ where: { code } }))) {
      code = `${code}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
      warnings.push(`Code d'accès déjà utilisé : le nouveau code est « ${code} ».`);
    }

    const residenceId = randomUUID();
    const idMap = new Map<string, string>();
    const newId = (old: string): string => {
      const existing = idMap.get(old);
      if (existing) return existing;
      const fresh = randomUUID();
      idMap.set(old, fresh);
      return fresh;
    };

    // ── Habitants : conflits d'email (la colonne est unique) ──
    const conflictMode = options.emailConflict ?? 'rename';
    const usersToCreate: Record<string, unknown>[] = [];
    const ignoredUsers = new Set<string>();
    for (const raw of payload.users ?? []) {
      const email = String(raw.email ?? '').toLowerCase();
      if (!email) continue;
      const clash = await this.prisma.user.findUnique({ where: { email } });
      if (clash) {
        if (conflictMode === 'skip') {
          ignoredUsers.add(String(raw.id));
          warnings.push(`Habitant ignoré (email déjà utilisé) : ${email}`);
          continue;
        }
        const [local, domain] = email.split('@');
        const unique = `${local}+import-${randomUUID().slice(0, 4)}@${domain}`;
        warnings.push(`Email déjà utilisé : ${email} → ${unique}`);
        usersToCreate.push(this.userRow(raw, newId(String(raw.id)), residenceId, unique));
        continue;
      }
      usersToCreate.push(this.userRow(raw, newId(String(raw.id)), residenceId, email));
    }
    skipped.habitants = ignoredUsers.size;

    const keep = (raw: Record<string, unknown>): boolean =>
      !ignoredUsers.has(String(raw.ownerId ?? raw.userId ?? raw.authorId ?? raw.senderId ?? ''));

    const listingRows = (payload.listings ?? [])
      .filter((l) => keep(l) && idMap.has(String(l.ownerId)))
      .map((l) => ({
        id: newId(String(l.id)),
        title: String(l.title),
        description: String(l.description),
        category: String(l.category),
        status: String(l.status ?? 'OPEN'),
        lat: Number(l.lat ?? 0),
        lng: Number(l.lng ?? 0),
        address: String(l.address ?? ''),
        neighborhood: String(l.neighborhood ?? ''),
        ownerId: newId(String(l.ownerId)),
        residenceId,
        createdAt: this.date(l.createdAt) ?? new Date(),
        updatedAt: this.date(l.createdAt) ?? new Date(),
      }));

    const incidentRows = (payload.incidents ?? [])
      .filter((i) => keep(i) && idMap.has(String(i.userId)))
      .map((i) => ({
        id: newId(String(i.id)),
        title: String(i.title),
        category: String(i.category),
        description: String(i.description),
        status: String(i.status ?? 'OPEN'),
        userId: newId(String(i.userId)),
        residenceId,
        createdAt: this.date(i.createdAt) ?? new Date(),
        updatedAt: this.date(i.updatedAt) ?? this.date(i.createdAt) ?? new Date(),
      }));

    const attachmentRows = (payload.attachments ?? [])
      .filter((a) => idMap.has(String(a.incidentId)))
      .map((a) => ({
        id: newId(String(a.id)),
        incidentId: newId(String(a.incidentId)),
        filename: String(a.filename),
        mimeType: String(a.mimeType),
        size: Number(a.size ?? 0),
        path: basename(String(a.path)),
        createdAt: this.date(a.createdAt) ?? new Date(),
      }));

    const commentRows = (payload.comments ?? [])
      .filter((c) => idMap.has(String(c.authorId)))
      .filter(
        (c) =>
          (c.listingId && idMap.has(String(c.listingId))) ||
          (c.incidentId && idMap.has(String(c.incidentId))),
      )
      .map((c) => ({
        id: newId(String(c.id)),
        content: String(c.content),
        listingId: c.listingId ? newId(String(c.listingId)) : null,
        incidentId: c.incidentId ? newId(String(c.incidentId)) : null,
        authorId: newId(String(c.authorId)),
        createdAt: this.date(c.createdAt) ?? new Date(),
        updatedAt: this.date(c.createdAt) ?? new Date(),
      }));

    const conversationRows = (payload.conversations ?? [])
      .filter((c) => idMap.has(String(c.userAId)) && idMap.has(String(c.userBId)))
      .map((c) => ({
        id: newId(String(c.id)),
        userAId: newId(String(c.userAId)),
        userBId: newId(String(c.userBId)),
        createdAt: this.date(c.createdAt) ?? new Date(),
        updatedAt: this.date(c.createdAt) ?? new Date(),
      }));

    const messageRows = (payload.messages ?? [])
      .filter((m) => idMap.has(String(m.conversationId)) && idMap.has(String(m.senderId)))
      .map((m) => ({
        id: newId(String(m.id)),
        conversationId: newId(String(m.conversationId)),
        senderId: newId(String(m.senderId)),
        content: String(m.content),
        readAt: this.date(m.readAt),
        createdAt: this.date(m.createdAt) ?? new Date(),
      }));

    // Les jetons d'invitation sont conservés (QR déjà imprimés) SAUF si le
    // jeton existe déjà sur l'instance : on en régénère un dans ce cas.
    const invitationRows: Record<string, unknown>[] = [];
    for (const raw of payload.invitations ?? []) {
      if (!idMap.has(String(raw.createdById))) continue;
      let token = String(raw.token);
      if (await this.prisma.invitation.findUnique({ where: { token } })) {
        token = randomUUID().replace(/-/g, '');
        warnings.push("Un jeton d'invitation existait déjà : il a été régénéré (QR à réimprimer).");
      }
      invitationRows.push({
        id: newId(String(raw.id)),
        token,
        neighborhood: String(raw.neighborhood ?? ''),
        createdById: newId(String(raw.createdById)),
        residenceId,
        expiresAt: this.date(raw.expiresAt) ?? new Date(),
        usedAt: this.date(raw.usedAt),
        multiUse: Boolean(raw.multiUse),
        createdAt: this.date(raw.createdAt) ?? new Date(),
      });
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.residence.create({
        data: {
          id: residenceId,
          name,
          code,
          agencyName: (payload.residence.agencyName as string | null) ?? null,
          syndicEmail: (payload.residence.syndicEmail as string | null) ?? null,
          notifyAgencyOnIncident: payload.residence.notifyAgencyOnIncident !== false,
          notifyResidentsOnIncident: payload.residence.notifyResidentsOnIncident !== false,
          notifyResidentsOnListing: payload.residence.notifyResidentsOnListing !== false,
        },
      });
      if (usersToCreate.length) await tx.user.createMany({ data: usersToCreate as never });
      if (listingRows.length) await tx.listing.createMany({ data: listingRows });
      if (incidentRows.length) await tx.incident.createMany({ data: incidentRows });
      if (attachmentRows.length) await tx.incidentAttachment.createMany({ data: attachmentRows });
      if (commentRows.length) await tx.comment.createMany({ data: commentRows });
      if (conversationRows.length) await tx.conversation.createMany({ data: conversationRows });
      if (messageRows.length) await tx.message.createMany({ data: messageRows });
      if (invitationRows.length) await tx.invitation.createMany({ data: invitationRows as never });
    });

    // Photos : écrites après la transaction (le disque n'est pas transactionnel).
    let writtenFiles = 0;
    if (payload.files?.length) {
      mkdirSync(uploadsDir(), { recursive: true });
      for (const f of payload.files) {
        const name = basename(f.path);
        try {
          writeFileSync(join(uploadsDir(), name), Buffer.from(f.base64, 'base64'));
          writtenFiles += 1;
        } catch {
          warnings.push(`Photo non restaurée : ${name}`);
        }
      }
    }

    imported.habitants = usersToCreate.length;
    imported.annonces = listingRows.length;
    imported.signalements = incidentRows.length;
    imported.commentaires = commentRows.length;
    imported.messages = messageRows.length;
    imported.invitations = invitationRows.length;
    imported.photos = writtenFiles;

    this.logger.log(
      `Import résidence « ${name} » : ${imported.habitants} habitants, ${imported.signalements} signalements, ${writtenFiles} photos`,
    );

    return { residence: { id: residenceId, name, code }, imported, skipped, warnings };
  }

  // ─────────────────────────────────────────────────────────────
  // Outils internes
  // ─────────────────────────────────────────────────────────────

  private userRow(
    raw: Record<string, unknown>,
    id: string,
    residenceId: string,
    email: string,
  ): Record<string, unknown> {
    return {
      id,
      email,
      passwordHash: (raw.passwordHash as string | null) ?? null,
      googleId: null, // un identifiant Google ne peut pas être dupliqué entre comptes
      firstName: String(raw.firstName ?? ''),
      lastName: String(raw.lastName ?? ''),
      neighborhood: (raw.neighborhood as string | null) ?? null,
      building: (raw.building as string | null) ?? null,
      floor: (raw.floor as string | null) ?? null,
      showDetails: raw.showDetails !== false,
      showInDirectory: raw.showInDirectory !== false,
      // Un import ne doit jamais créer un second SUPERADMIN : les rôles
      // plateforme sont ramenés à ADMIN (les admins de résidence restent admins).
      role: String(raw.role) === 'SUPERADMIN' ? 'ADMIN' : String(raw.role ?? 'USER'),
      status: String(raw.status ?? 'ACTIVE'),
      emailNotifications: raw.emailNotifications !== false,
      totpEnabled: false, // les secrets 2FA ne voyagent jamais dans un export
      residenceId,
      createdAt: this.date(raw.createdAt) ?? new Date(),
    };
  }

  private date(value: unknown): Date | null {
    if (!value) return null;
    const d = new Date(String(value));
    return Number.isNaN(d.getTime()) ? null : d;
  }

  /** Empreinte SHA-256 de chaque collection : détecte toute altération. */
  private checksums(payload: TransferPayload): Partial<Record<Collection, string>> {
    const keys: Collection[] = [
      'users',
      'listings',
      'incidents',
      'attachments',
      'comments',
      'conversations',
      'messages',
      'invitations',
      'files',
    ];
    const out: Partial<Record<Collection, string>> = {};
    for (const key of keys) {
      const value = (payload as unknown as Record<string, unknown>)[key] ?? [];
      out[key] = createHash('sha256').update(JSON.stringify(value)).digest('hex');
    }
    return out;
  }

  private encrypt(plain: Buffer, passphrase: string): Buffer {
    const salt = randomBytes(SALT_LEN);
    const iv = randomBytes(IV_LEN);
    const key = pbkdf2Sync(passphrase, salt, PBKDF2_ITERATIONS, KEY_LEN, 'sha256');
    const cipher = createCipheriv('aes-256-gcm', key, iv);
    const encrypted = Buffer.concat([cipher.update(plain), cipher.final()]);
    return Buffer.concat([MAGIC, salt, iv, cipher.getAuthTag(), encrypted]);
  }

  private decrypt(file: Buffer, passphrase: string): Buffer {
    if (!file.subarray(0, MAGIC_LEN).equals(MAGIC)) {
      throw new BadRequestException("Ce fichier n'est pas un export Proximo (en-tête inconnu).");
    }
    let offset = MAGIC_LEN;
    const salt = file.subarray(offset, (offset += SALT_LEN));
    const iv = file.subarray(offset, (offset += IV_LEN));
    const tag = file.subarray(offset, (offset += TAG_LEN));
    const data = file.subarray(offset);
    const key = pbkdf2Sync(passphrase, salt, PBKDF2_ITERATIONS, KEY_LEN, 'sha256');
    try {
      const decipher = createDecipheriv('aes-256-gcm', key, iv);
      decipher.setAuthTag(tag);
      return Buffer.concat([decipher.update(data), decipher.final()]);
    } catch {
      throw new BadRequestException('Phrase de passe incorrecte ou fichier altéré.');
    }
  }
}
