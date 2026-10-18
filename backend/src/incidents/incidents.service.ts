import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Incident, IncidentAttachment } from '@prisma/client';
import { mkdir, unlink, writeFile } from 'fs/promises';
import { join } from 'path';
import { EmailService } from '../email/email.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateIncidentDto } from './dto/create-incident.dto';
import { IncidentStatus } from './dto/update-incident-status.dto';

/** Répertoire de stockage des pièces jointes (volume Docker /data/uploads). */
export function uploadsDir(): string {
  return process.env.UPLOAD_DIR ?? join(process.cwd(), 'uploads');
}

/**
 * Signalements d'incidents envoyés au syndic / à l'agence.
 * Les pièces jointes sont stockées sur disque (volume Docker), jamais en base ;
 * la base ne conserve que les métadonnées (nom original, type MIME, taille).
 */
/** Acteur d'une action sur un signalement (rôle et résidence relus en base). */
export interface IncidentActor {
  id: string;
  role: string;
  residenceId?: string | null;
}

/** Conservation recommandée d'un dossier clos avant toute purge (12 mois). */
export const RETENTION_DAYS = 365;

/** Signalement tel qu'archivé au moment de la purge. */
interface ArchivableIncident {
  id: string;
  title: string;
  category: string;
  status: string;
  userId: string;
  residenceId: string | null;
  createdAt: Date;
  updatedAt: Date;
  attachments: Array<{ filename: string; path: string; size: number }>;
}

@Injectable()
export class IncidentsService {
  private readonly logger = new Logger(IncidentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly emailService: EmailService,
  ) {}

  /**
   * Autorise ou refuse l'accès à un signalement.
   * L'utilisateur est RELU en base : le jeton n'est jamais une source de vérité
   * pour le rôle ni pour la résidence. Un refus renvoie « introuvable » afin de
   * ne pas révéler l'existence d'un dossier appartenant à une autre résidence.
   * Correctif du 18/10/2026 : auparavant, la clôture, la réouverture et la
   * lecture du détail public n'appliquaient aucun contrôle de résidence.
   */
  /**
   * Périmètre de résidences d'une agence. Un compte de rôle AGENCE accède aux
   * signalements de toutes les résidences rattachées à son agence, et à elles
   * seules. Le périmètre est lu en base à chaque appel (jamais depuis le jeton).
   */
  private async agencyResidenceIds(agencyId: string | null | undefined): Promise<string[]> {
    if (!agencyId) return [];
    const links = await this.prisma.agencyResidence.findMany({
      where: { agencyId },
      select: { residenceId: true },
    });
    return links.map((link) => link.residenceId);
  }

  private async authorizeIncident(
    incident: { userId: string; residenceId: string | null },
    actor: IncidentActor,
  ): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { id: actor.id },
      select: { id: true, role: true, status: true, residenceId: true, agencyId: true },
    });
    if (!user || user.status !== 'ACTIVE') {
      throw new ForbiddenException('Compte inactif');
    }
    const isSuperadmin = user.role === 'SUPERADMIN';
    const isAuthor = incident.userId === user.id;
    if (incident.residenceId) {
      if (isSuperadmin || user.residenceId === incident.residenceId) return;
      if (user.role === 'AGENCE') {
        const scope = await this.agencyResidenceIds(user.agencyId);
        if (scope.includes(incident.residenceId)) return;
      }
      throw new NotFoundException('Signalement introuvable');
    }
    // Signalement sans résidence (données antérieures au multi-résidences) :
    // seuls l'auteur et le superadministrateur y accèdent.
    if (isSuperadmin || isAuthor) return;
    throw new NotFoundException('Signalement introuvable');
  }

  /**
   * Libellé d'un acteur pour le journal d'audit. Un compte agence est nommé par
   * son agence, ce qui rend l'historique lisible pour l'habitant.
   */
  private async actorIdentity(userId: string): Promise<{ label: string; actorType: string }> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        firstName: true,
        lastName: true,
        role: true,
        agency: { select: { name: true } },
      },
    });
    if (!user) return { label: 'inconnu', actorType: 'SYSTEME' };
    const name = `${user.firstName} ${user.lastName}`.trim();
    if (user.role === 'AGENCE') {
      return {
        label: user.agency?.name ? `${user.agency.name}, ${name}` : `Agence, ${name}`,
        actorType: 'AGENCE',
      };
    }
    const actorType =
      user.role === 'SUPERADMIN' ? 'SUPERADMIN' : user.role === 'ADMIN' ? 'ADMIN' : 'RESIDENT';
    return { label: name, actorType };
  }

  /**
   * Écrit un événement d'audit. Un échec d'écriture est journalisé mais ne fait
   * jamais échouer l'action métier déjà réalisée.
   */
  private async logEvent(params: {
    incidentId: string;
    type: string;
    actorId?: string | null;
    actorType?: string;
    actorLabel?: string | null;
    fromStatus?: string | null;
    toStatus?: string | null;
    note?: string | null;
  }): Promise<void> {
    try {
      await this.prisma.incidentEvent.create({
        data: {
          incidentId: params.incidentId,
          type: params.type,
          actorType: params.actorType ?? 'SYSTEME',
          actorId: params.actorId ?? null,
          actorLabel: params.actorLabel ?? null,
          fromStatus: params.fromStatus ?? null,
          toStatus: params.toStatus ?? null,
          note: params.note ?? null,
        },
      });
    } catch (error) {
      this.logger.error(`Journal d'audit (${params.type}) : ${String(error)}`);
    }
  }

  /** Préfixe lisible d'une résidence : trois lettres de son code, sinon de son nom. */
  private referencePrefix(code: string | null, name: string | null): string {
    const source = (code?.trim() || name?.trim() || 'PROX').toUpperCase();
    const letters = source.replace(/[^A-Z0-9]/g, '');
    return (letters.slice(0, 3) || 'PRO').padEnd(3, 'X');
  }

  /** Référence lisible et unique : PROX-<préfixe>-<année>-<séquence>. */
  private async buildReference(residenceId: string | null): Promise<string> {
    const residence = residenceId
      ? await this.prisma.residence.findUnique({
          where: { id: residenceId },
          select: { code: true, name: true },
        })
      : null;
    const prefix = this.referencePrefix(residence?.code ?? null, residence?.name ?? null);
    const year = new Date().getFullYear();
    const start = `PROX-${prefix}-${year}-`;
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const count = await this.prisma.incident.count({
        where: { reference: { startsWith: start } },
      });
      const candidate = `${start}${String(count + 1 + attempt).padStart(5, '0')}`;
      const clash = await this.prisma.incident.findFirst({
        where: { reference: candidate },
        select: { id: true },
      });
      if (!clash) return candidate;
    }
    return `${start}${Date.now().toString().slice(-5)}`;
  }

  /** Échappement CSV minimal (séparateur point-virgule). */
  private csvCell(value: unknown): string {
    const text = value === null || value === undefined ? '' : String(value);
    return /[";\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  }

  /** Construit le CSV d'archive d'un lot de signalements. */
  private buildArchiveCsv(incidents: ArchivableIncident[]): string {
    const lines: string[] = [
      'identifiant;titre;categorie;statut;residence;declarant;cree_le;maj_le;pieces;fichiers',
    ];
    for (const incident of incidents) {
      lines.push(
        [
          this.csvCell(incident.id),
          this.csvCell(incident.title),
          this.csvCell(incident.category),
          this.csvCell(incident.status),
          this.csvCell(incident.residenceId),
          this.csvCell(incident.userId),
          this.csvCell(incident.createdAt.toISOString()),
          this.csvCell(incident.updatedAt.toISOString()),
          this.csvCell(incident.attachments.length),
          this.csvCell(incident.attachments.map((a) => a.filename).join(' | ')),
        ].join(';'),
      );
    }
    return `${lines.join('\n')}\n`;
  }

  /**
   * Purge des dossiers clos, sous contrôle humain.
   * Sans `confirm`, la méthode se contente de compter (simulation) et ne
   * supprime rien. Avec `confirm`, elle écrit d'abord une archive CSV de tous
   * les dossiers concernés, puis supprime les fichiers et les lignes.
   * Remplace la purge automatique à 48 h, qui détruisait la preuve du syndic.
   */
  async purgeResolvedIncidents(
    actor: IncidentActor,
    options: { olderThanDays?: number; confirm?: boolean } = {},
  ): Promise<{
    eligible: number;
    purged: number;
    archivePath: string | null;
    olderThanDays: number;
  }> {
    const user = await this.prisma.user.findUnique({
      where: { id: actor.id },
      select: { id: true, role: true, status: true, residenceId: true },
    });
    if (!user || user.status !== 'ACTIVE') {
      throw new ForbiddenException('Compte inactif');
    }
    const isSuperadmin = user.role === 'SUPERADMIN';
    if (!isSuperadmin && user.role !== 'ADMIN') {
      throw new ForbiddenException('Purge réservée à l’administration');
    }
    if (!isSuperadmin && !user.residenceId) {
      throw new ForbiddenException('Administrateur sans résidence : purge impossible');
    }
    const days = Math.max(30, options.olderThanDays ?? RETENTION_DAYS);
    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const stale = (await this.prisma.incident.findMany({
      where: {
        status: 'RESOLVED',
        updatedAt: { lt: cutoff },
        ...(isSuperadmin ? {} : { residenceId: user.residenceId as string }),
      },
      include: { attachments: true },
    })) as unknown as ArchivableIncident[];

    if (!options.confirm || stale.length === 0) {
      return { eligible: stale.length, purged: 0, archivePath: null, olderThanDays: days };
    }

    const archiveDir = join(uploadsDir(), '..', 'archives');
    await mkdir(archiveDir, { recursive: true });
    const archivePath = join(
      archiveDir,
      `signalements-archive-${new Date().toISOString().replace(/[:.]/g, '-')}.csv`,
    );
    await writeFile(archivePath, this.buildArchiveCsv(stale), 'utf8');

    for (const incident of stale) {
      for (const attachment of incident.attachments) {
        await this.removeUploadedFile(attachment.path.split('/').pop() ?? attachment.path);
      }
    }
    await this.prisma.incident.deleteMany({ where: { id: { in: stale.map((i) => i.id) } } });
    // Trace de la purge : l'archive CSV (qui contient chaque dossier et sa
    // reference) et ce journal applicatif. Un evenement en base ne servirait a
    // rien, la suppression du dossier emportant ses evenements par cascade.
    this.logger.log(
      `Purge de ${stale.length} signalement(s) clos (> ${days} j) par ${actor.id}, archive ${archivePath}`,
    );
    return { eligible: stale.length, purged: stale.length, archivePath, olderThanDays: days };
  }

  /**
   * Marque un signalement comme traité.
   * Réservé aux comptes ACTIVE de LA résidence du signalement (ou SUPERADMIN).
   * Correctif du 18/10/2026 : la résidence et le rôle ne sont plus ignorés.
   */
  async resolve(incidentId: string, actor: IncidentActor): Promise<Incident> {
    const incident = await this.prisma.incident.findUnique({ where: { id: incidentId } });
    if (!incident) {
      throw new NotFoundException('Signalement introuvable');
    }
    await this.authorizeIncident(incident, actor);
    if (incident.status === 'RESOLVED') {
      throw new BadRequestException('Ce signalement est déjà marqué comme traité');
    }
    const updated = await this.prisma.incident.update({
      where: { id: incidentId },
      data: { status: 'RESOLVED' },
    });
    const who = await this.actorIdentity(actor.id);
    await this.logEvent({
      incidentId,
      type: 'STATUS_CHANGED',
      actorId: actor.id,
      actorType: who.actorType,
      actorLabel: who.label,
      fromStatus: incident.status,
      toStatus: 'RESOLVED',
    });
    // L'auteur est prévenu (si l'émetteur du statut est quelqu'un d'autre).
    const author = await this.prisma.user.findUnique({
      where: { id: incident.userId },
      select: { email: true, emailNotifications: true },
    });
    if (author?.emailNotifications) {
      await this.emailService.sendIncidentStatusUpdate(
        author.email,
        incident.title,
        'RESOLVED',
        'Signalement marqué comme traité par un résident.',
      );
    }
    return updated;
  }

  /**
   * Rouvre un signalement marqué « Résolu » par erreur.
   * N'importe quel résident ACTIVE peut corriger : un « traité » par erreur
   * repasse en cours (OPEN) au lieu d'être purgé après 48 h.
   */
  async reopen(incidentId: string, actor: IncidentActor): Promise<Incident> {
    const incident = await this.prisma.incident.findUnique({ where: { id: incidentId } });
    if (!incident) {
      throw new NotFoundException('Signalement introuvable');
    }
    await this.authorizeIncident(incident, actor);
    if (incident.status !== 'RESOLVED') {
      throw new BadRequestException('Seul un signalement marqué comme traité peut être rouvert');
    }
    const updated = await this.prisma.incident.update({
      where: { id: incidentId },
      data: { status: 'OPEN' },
    });
    const who = await this.actorIdentity(actor.id);
    await this.logEvent({
      incidentId,
      type: 'STATUS_CHANGED',
      actorId: actor.id,
      actorType: who.actorType,
      actorLabel: who.label,
      fromStatus: incident.status,
      toStatus: 'OPEN',
    });
    // L'auteur est prévenu du retour en cours de traitement.
    const author = await this.prisma.user.findUnique({
      where: { id: incident.userId },
      select: { email: true, emailNotifications: true },
    });
    if (author?.emailNotifications) {
      await this.emailService.sendIncidentStatusUpdate(
        author.email,
        incident.title,
        'OPEN',
        'Signalement rouvert : il redevient visible dans les signalements en cours.',
      );
    }
    return updated;
  }

  /** Suppression par un administrateur (fichiers joints nettoyés). */
  async adminRemove(incidentId: string): Promise<void> {
    const incident = await this.prisma.incident.findUnique({
      where: { id: incidentId },
      include: { attachments: true },
    });
    if (!incident) {
      throw new NotFoundException('Signalement introuvable');
    }
    for (const attachment of incident.attachments) {
      await this.removeUploadedFile(attachment.path.split('/').pop() ?? attachment.path);
    }
    await this.prisma.incident.delete({ where: { id: incidentId } });
  }

  /** Crée un signalement + pièces jointes, puis prévient le syndic par email. */
  async create(
    userId: string,
    dto: CreateIncidentDto,
    files: Express.Multer.File[],
    userNeighborhood: string | null,
    residenceId?: string | null,
  ): Promise<Incident & { attachments: IncidentAttachment[] }> {
    await mkdir(uploadsDir(), { recursive: true });

    const reference = await this.buildReference(residenceId ?? null);
    const incident = await this.prisma.incident.create({
      data: {
        title: dto.title.trim(),
        category: dto.category,
        description: dto.description.trim(),
        userId,
        residenceId: residenceId ?? null,
        reference,
      },
    });
    const author = await this.actorIdentity(userId);
    await this.logEvent({
      incidentId: incident.id,
      type: 'CREATED',
      actorId: userId,
      actorType: author.actorType,
      actorLabel: author.label,
      toStatus: 'OPEN',
    });

    // Préférence « afficher mes détails » choisie au dépôt → profil.
    if (dto.showDetails !== undefined) {
      await this.prisma.user.update({
        where: { id: userId },
        data: { showDetails: dto.showDetails },
      });
    }

    const attachments: IncidentAttachment[] = [];
    for (const file of files) {
      const attachment = await this.prisma.incidentAttachment.create({
        data: {
          incidentId: incident.id,
          filename: file.originalname,
          mimeType: file.mimetype,
          size: file.size,
          path: file.filename, // nom unique généré par multer
        },
      });
      attachments.push(attachment);
    }

    await this.notifySyndic(incident, attachments, dto.neighborhood ?? userNeighborhood, userId);

    // Notifier les habitants de la résidence (mail groupé, non bloquant).
    const reporter = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { firstName: true },
    });
    await this.emailService.sendIncidentToResidents(
      incident,
      reporter?.firstName ?? '',
      attachments.map((a) => ({ filename: a.filename, path: a.path })),
      residenceId ?? null,
    );

    return { ...incident, attachments };
  }

  /** Mes signalements (déclarant). */
  async listMine(userId: string): Promise<Array<Incident & { attachments: IncidentAttachment[] }>> {
    return this.prisma.incident.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: { attachments: { orderBy: { createdAt: 'asc' } } },
    });
  }

  /**
   * Détail d'un signalement : déclarant, ou compte de la même résidence, ou
   * SUPERADMIN. Correctif du 18/10/2026 : un administrateur d'une autre
   * résidence n'y a plus accès (le drapeau `isAdmin` suffisait auparavant).
   */
  async findForUser(incidentId: string, actor: IncidentActor) {
    const incident = await this.prisma.incident.findUnique({
      where: { id: incidentId },
      include: { attachments: { orderBy: { createdAt: 'asc' } } },
    });
    if (!incident) {
      throw new NotFoundException('Signalement introuvable');
    }
    await this.authorizeIncident(incident, actor);
    return incident;
  }

  /**
   * Détail d'un signalement visible par les habitants ACTIVE de LA MÊME
   * résidence (correctif du 18/10/2026 : aucun filtre de résidence avant).
   */
  async findPublic(
    incidentId: string,
    actor: IncidentActor,
  ): Promise<
    Incident & {
      attachments: IncidentAttachment[];
      user: { firstName: string; lastName: string } | null;
      _count: { comments: number };
    }
  > {
    const incident = await this.prisma.incident.findUnique({
      where: { id: incidentId },
      include: {
        attachments: { orderBy: { createdAt: 'asc' } },
        user: {
          select: {
            firstName: true,
            lastName: true,
            role: true,
            agency: { select: { name: true } },
          },
        },
        _count: { select: { comments: true } },
      },
    });
    if (!incident) throw new NotFoundException('Signalement introuvable');
    await this.authorizeIncident(incident, actor);
    return incident;
  }

  /** Tous les signalements (administration). */
  async listAll(
    status?: string,
    residenceId?: string | null,
  ): Promise<
    Array<
      Incident & {
        attachments: IncidentAttachment[];
        user: {
          firstName: string;
          lastName: string;
          email: string;
          building: string | null;
          floor: string | null;
          showDetails: boolean;
        };
        _count: { comments: number };
      }
    >
  > {
    return this.prisma.incident.findMany({
      where: {
        ...(status ? { status } : {}),
        ...(residenceId ? { residenceId } : {}),
      },
      orderBy: { createdAt: 'desc' },
      include: {
        attachments: { orderBy: { createdAt: 'asc' } },
        user: {
          select: {
            firstName: true,
            lastName: true,
            email: true,
            role: true,
            building: true,
            floor: true,
            showDetails: true,
            agency: { select: { name: true } },
          },
        },
        _count: { select: { comments: true } },
      },
    });
  }

  /**
   * Signalements visibles par un habitant : ceux de SA résidence, et rien
   * d'autre. Correctif du 18/10/2026 : la construction précédente
   * (`where: residenceId ? { residenceId } : undefined`) transformait un
   * compte sans résidence en accès global à toute la plateforme.
   */
  async listPublic(actor: IncidentActor): Promise<
    Array<
      Incident & {
        attachments: IncidentAttachment[];
        user: {
          firstName: string;
          lastName: string;
          building: string | null;
          floor: string | null;
          showDetails: boolean;
        };
        _count: { comments: number };
      }
    >
  > {
    const user = await this.prisma.user.findUnique({
      where: { id: actor.id },
      select: { role: true, status: true, residenceId: true, agencyId: true },
    });
    if (!user || user.status !== 'ACTIVE') {
      throw new ForbiddenException('Compte inactif');
    }
    let where: { residenceId?: string | { in: string[] } } | undefined;
    if (user.role === 'SUPERADMIN') {
      where = {};
    } else if (user.role === 'AGENCE') {
      const scope = await this.agencyResidenceIds(user.agencyId);
      if (scope.length === 0) return [];
      where = { residenceId: { in: scope } };
    } else if (user.residenceId) {
      where = { residenceId: user.residenceId };
    } else {
      return [];
    }
    return this.prisma.incident.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        attachments: { orderBy: { createdAt: 'asc' } },
        user: {
          select: {
            firstName: true,
            lastName: true,
            role: true,
            building: true,
            floor: true,
            showDetails: true,
            agency: { select: { name: true } },
          },
        },
        _count: { select: { comments: true } },
        residence: { select: { id: true, name: true } },
      },
    });
  }

  /**
   * Change le statut d'un signalement.
   * Avec un acteur, le contrôle d'appartenance est appliqué (agence, habitant,
   * administrateur) et le changement est attribué dans l'historique. Sans
   * acteur, l'appel provient du back-office, qui a déjà contrôlé le périmètre.
   */
  async updateStatus(
    incidentId: string,
    status: IncidentStatus,
    actor?: IncidentActor,
    note?: string | null,
  ): Promise<Incident> {
    const incident = await this.prisma.incident.findUnique({
      where: { id: incidentId },
      include: { user: true },
    });
    if (!incident) {
      throw new NotFoundException('Signalement introuvable');
    }
    if (actor) {
      await this.authorizeIncident(incident, actor);
    }

    const updated = await this.prisma.incident.update({
      where: { id: incidentId },
      data: { status },
    });

    if (actor) {
      const who = await this.actorIdentity(actor.id);
      await this.logEvent({
        incidentId,
        type: 'STATUS_CHANGED',
        actorId: actor.id,
        actorType: who.actorType,
        actorLabel: who.label,
        fromStatus: incident.status,
        toStatus: status,
        note: note ?? null,
      });
    } else {
      await this.logEvent({
        incidentId,
        type: 'STATUS_CHANGED',
        actorType: 'ADMIN',
        fromStatus: incident.status,
        toStatus: status,
        note: 'Changement de statut depuis la console',
      });
    }

    if (incident.user.emailNotifications) {
      await this.emailService.sendIncidentStatusUpdate(incident.user.email, incident.title, status);
    }
    return updated;
  }

  /**
   * Dossier complet d'un signalement, au format CSV, destiné à l'agence ou à
   * l'assureur : métadonnées, historique de statut, commentaires et pièces
   * jointes. C'est la preuve exportable promise par la feuille de route.
   */
  async exportCsv(incidentId: string, actor: IncidentActor): Promise<string> {
    const incident = await this.prisma.incident.findUnique({
      where: { id: incidentId },
      include: {
        attachments: { orderBy: { createdAt: 'asc' } },
        comments: { orderBy: { createdAt: 'asc' } },
        user: {
          select: {
            firstName: true,
            lastName: true,
            email: true,
            role: true,
            building: true,
            floor: true,
            showDetails: true,
            agency: { select: { name: true } },
          },
        },
        residence: { select: { name: true, agencyName: true } },
      },
    });
    if (!incident) {
      throw new NotFoundException('Signalement introuvable');
    }
    await this.authorizeIncident(incident, actor);

    const lines: string[] = ['champ;valeur'];
    const row = (label: string, value: unknown) =>
      lines.push(`${this.csvCell(label)};${this.csvCell(value)}`);
    row('identifiant', incident.id);
    row('titre', incident.title);
    row('categorie', incident.category);
    row('statut', incident.status);
    row('residence', incident.residence?.name ?? 'non rattachée');
    row('agence', incident.residence?.agencyName ?? '');
    row('declare_le', incident.createdAt.toISOString());
    row('derniere_maj', incident.updatedAt.toISOString());
    row('declarant', `${incident.user.firstName} ${incident.user.lastName}`);
    row(
      'lot',
      incident.user.showDetails
        ? [incident.user.building, incident.user.floor].filter(Boolean).join(' ')
        : 'non communiqué',
    );
    row('description', incident.description);
    row('pieces_jointes', incident.attachments.map((a) => a.filename).join(' | '));
    lines.push('');
    lines.push('historique;date;contenu');
    for (const comment of incident.comments) {
      lines.push(
        [
          this.csvCell(comment.authorId === incident.userId ? 'declarant' : 'suivi'),
          this.csvCell(comment.createdAt.toISOString()),
          this.csvCell(comment.content),
        ].join(';'),
      );
    }
    lines.push('');
    lines.push('export_genere_le;' + this.csvCell(new Date().toISOString()));
    const who = await this.actorIdentity(actor.id);
    await this.logEvent({
      incidentId,
      type: 'EXPORTED',
      actorId: actor.id,
      actorType: who.actorType,
      actorLabel: who.label,
    });
    return `${lines.join('\n')}\n`;
  }

  /** Résout le chemin absolu d'une pièce jointe. */
  attachmentPath(attachment: IncidentAttachment): string {
    return join(uploadsDir(), attachment.path);
  }

  /** Supprime les fichiers d'un signalement (cascade). */
  async removeFiles(incidentId: string): Promise<void> {
    const attachments = await this.prisma.incidentAttachment.findMany({
      where: { incidentId },
    });
    for (const attachment of attachments) {
      try {
        await unlink(this.attachmentPath(attachment));
      } catch {
        // Fichier déjà absent : sans gravité.
      }
    }
  }

  /** Supprime un fichier uploadé (fichiers rejetés par la validation). */
  async removeUploadedFile(filename: string): Promise<void> {
    try {
      await unlink(join(uploadsDir(), filename));
    } catch {
      // Fichier déjà absent : sans gravité.
    }
  }

  private async notifySyndic(
    incident: Incident,
    attachments: IncidentAttachment[],
    neighborhood: string | null,
    reporterId: string,
  ): Promise<void> {
    // Multi-résidences : l'email de l'agence est celui de LA résidence du
    // signalement (Residence.syndicEmail). Repli env SYNDIC_EMAIL (dev).
    const residence = incident.residenceId
      ? await this.prisma.residence.findUnique({
          where: { id: incident.residenceId },
          select: {
            name: true,
            agencyName: true,
            syndicEmail: true,
            notifyAgencyOnIncident: true,
          },
        })
      : null;
    const syndicEmail = residence?.syndicEmail?.trim() || process.env.SYNDIC_EMAIL?.trim();
    if (!syndicEmail) {
      return; // Aucun destinataire configuré : rien à envoyer.
    }
    if (residence && !residence.notifyAgencyOnIncident) {
      this.logger.log(
        `Emails à l'agence désactivés pour la résidence ${residence.name} (skippés).`,
      );
      return;
    }

    const reporter = await this.prisma.user.findUnique({
      where: { id: reporterId },
      select: {
        firstName: true,
        lastName: true,
        email: true,
        building: true,
        floor: true,
        showDetails: true,
      },
    });
    if (!reporter) return;

    // Détails d'appartement affichés à l'agence uniquement si l'habitant
    // a coché « afficher mes détails » (vie privée).
    const contactDetails =
      reporter.showDetails && (reporter.building || reporter.floor)
        ? [reporter.building, reporter.floor].filter(Boolean).join(' · ')
        : null;

    await this.emailService.sendIncidentToSyndic(
      syndicEmail,
      {
        title: incident.title,
        category: incident.category,
        description: incident.description,
        neighborhood: neighborhood ?? 'Non précisé',
      },
      {
        firstName: reporter.firstName,
        lastName: reporter.lastName,
        email: reporter.email,
        contactDetails,
      },
      attachments.map((a) => ({ filename: a.filename, path: a.path })),
      residence ? { name: residence.name, agencyName: residence.agencyName } : null,
    );
  }
}
