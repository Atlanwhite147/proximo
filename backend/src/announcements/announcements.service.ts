import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { unlink } from 'fs/promises';
import { join } from 'path';
import { uploadsDir } from '../incidents/incidents.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateAnnouncementDto, CreateAnnouncementCommentDto } from './dto/create-announcement.dto';
import { UpdateAnnouncementDto } from './dto/update-announcement.dto';

/** Auteur d'une annonce tel qu'exposé aux habitants. */
const AUTHOR_SELECT = {
  id: true,
  firstName: true,
  lastName: true,
  role: true,
} as const;

/** Métadonnées d'une pièce jointe (le chemin sur disque n'est jamais exposé). */
const ATTACHMENT_SELECT = {
  id: true,
  filename: true,
  mimeType: true,
  size: true,
  createdAt: true,
} as const;

/** Champs renvoyés pour une annonce (liste, création, modification). */
const ANNOUNCEMENT_INCLUDE = {
  author: { select: AUTHOR_SELECT },
  attachments: { select: ATTACHMENT_SELECT, orderBy: { createdAt: 'asc' } },
  _count: { select: { comments: true } },
} as const;

const COMMENT_INCLUDE = {
  author: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
      role: true,
      showDetails: true,
      building: true,
      floor: true,
    },
  },
} as const;

type User = { id: string; role: string; residenceId?: string | null };

/**
 * Annonces officielles de la résidence : tout le monde les lit et les
 * commente, seuls les rôles ADMIN et SUPERADMIN en publient. L'auteur ou un
 * administrateur peut corriger, joindre des fichiers ou supprimer une annonce.
 */
@Injectable()
export class AnnouncementsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Annonce appartenant à la résidence de l'habitant. */
  private async ownedOrFail(id: string, residenceId: string | null | undefined) {
    const announcement = await this.prisma.announcement.findUnique({ where: { id } });
    if (!announcement || announcement.residenceId !== residenceId) {
      throw new NotFoundException('Annonce introuvable');
    }
    return announcement;
  }

  private assertPublisher(user: User): void {
    if (user.role !== 'ADMIN' && user.role !== 'SUPERADMIN') {
      throw new ForbiddenException(
        'Seuls les administrateurs de la résidence peuvent publier une annonce.',
      );
    }
  }

  /** Auteur de l'annonce OU administrateur de la résidence. */
  private assertCanManage(announcement: { authorId: string }, user: User): void {
    const isAuthor = announcement.authorId === user.id;
    const isAdmin = user.role === 'ADMIN' || user.role === 'SUPERADMIN';
    if (!isAuthor && !isAdmin) {
      throw new ForbiddenException('Vous ne pouvez pas modifier cette annonce');
    }
  }

  /** Enregistre les fichiers reçus en base (le binaire est déjà sur disque). */
  private async saveAttachments(announcementId: string, files: Express.Multer.File[]) {
    for (const file of files) {
      await this.prisma.announcementAttachment.create({
        data: {
          announcementId,
          filename: file.originalname,
          mimeType: file.mimetype,
          size: file.size,
          path: file.filename, // nom unique généré par multer
        },
      });
    }
  }

  /** Retire des fichiers du disque (silencieux s'ils sont déjà absents). */
  private async deleteFiles(paths: string[]): Promise<void> {
    for (const relative of paths) {
      try {
        await unlink(join(uploadsDir(), relative));
      } catch {
        /* fichier déjà absent : rien à faire */
      }
    }
  }

  /** Supprime un fichier rejeté par la validation du contrôleur. */
  async removeUploadedFile(relativePath: string): Promise<void> {
    await this.deleteFiles([relativePath]);
  }

  /** Annonce complète (auteur + pièces jointes + compteur de commentaires). */
  private findFull(id: string) {
    return this.prisma.announcement.findUnique({
      where: { id },
      include: ANNOUNCEMENT_INCLUDE,
    });
  }

  /** Liste les annonces (les plus récentes d'abord). */
  async list(user: User, limit?: number) {
    const residenceId = user.residenceId ?? null;
    if (!residenceId) return { announcements: [] };

    const announcements = await this.prisma.announcement.findMany({
      where: { residenceId },
      orderBy: { createdAt: 'desc' },
      ...(limit && limit > 0 ? { take: Math.min(limit, 50) } : {}),
      include: ANNOUNCEMENT_INCLUDE,
    });
    return { announcements };
  }

  /** Publication — ADMIN ou SUPERADMIN de la résidence. */
  async create(user: User, dto: CreateAnnouncementDto, files: Express.Multer.File[] = []) {
    this.assertPublisher(user);
    const title = dto.title?.trim();
    const body = dto.body?.trim();
    if (!title || !body) {
      throw new BadRequestException('Titre et message requis.');
    }

    // Un SUPERADMIN peut viser une autre résidence ; un ADMIN reste chez lui.
    let residenceId = user.residenceId ?? null;
    if (user.role === 'SUPERADMIN' && dto.residenceId) {
      const target = await this.prisma.residence.findUnique({ where: { id: dto.residenceId } });
      if (!target) throw new NotFoundException('Résidence introuvable');
      residenceId = target.id;
    }

    const created = await this.prisma.announcement.create({
      data: { title, body, authorId: user.id, residenceId },
    });
    if (files.length > 0) {
      await this.saveAttachments(created.id, files);
    }

    const announcement = await this.findFull(created.id);
    return { announcement: announcement ?? created };
  }

  /**
   * Modification a posteriori : auteur de l'annonce ou administrateur.
   * `updatedAt` est mis à jour par Prisma, sans aucune mention à l'écran.
   */
  async update(id: string, user: User, dto: UpdateAnnouncementDto) {
    const announcement = await this.ownedOrFail(id, user.residenceId);
    this.assertCanManage(announcement, user);

    const title = dto.title?.trim();
    const body = dto.body?.trim();
    if (title === undefined && body === undefined) {
      throw new BadRequestException('Aucune modification transmise');
    }
    if (title !== undefined && !title) {
      throw new BadRequestException('Le titre ne peut pas être vide');
    }
    if (body !== undefined && !body) {
      throw new BadRequestException('Le message ne peut pas être vide');
    }

    const updated = await this.prisma.announcement.update({
      where: { id },
      data: {
        ...(title !== undefined ? { title } : {}),
        ...(body !== undefined ? { body } : {}),
      },
      include: ANNOUNCEMENT_INCLUDE,
    });
    return { announcement: updated };
  }

  /** Suppression : auteur de l'annonce ou administrateur (+ fichiers). */
  async remove(id: string, user: User): Promise<void> {
    const announcement = await this.ownedOrFail(id, user.residenceId);
    this.assertCanManage(announcement, user);

    // Récupérer les chemins AVANT la suppression en cascade.
    const attachments = await this.prisma.announcementAttachment.findMany({
      where: { announcementId: id },
      select: { path: true },
    });
    await this.prisma.announcement.delete({ where: { id } });
    await this.deleteFiles(attachments.map((a) => a.path));
  }

  /** Ajoute des pièces jointes à une annonce existante. */
  async addAttachments(id: string, user: User, files: Express.Multer.File[]) {
    const announcement = await this.ownedOrFail(id, user.residenceId);
    this.assertCanManage(announcement, user);
    if (files.length === 0) {
      throw new BadRequestException('Aucun fichier reçu');
    }

    await this.saveAttachments(id, files);
    const updated = await this.findFull(id);
    return { announcement: updated };
  }

  /** Retire une pièce jointe (ligne en base + fichier sur disque). */
  async removeAttachment(id: string, attachmentId: string, user: User) {
    const announcement = await this.ownedOrFail(id, user.residenceId);
    this.assertCanManage(announcement, user);

    const attachment = await this.prisma.announcementAttachment.findFirst({
      where: { id: attachmentId, announcementId: id },
    });
    if (!attachment) throw new NotFoundException('Pièce jointe introuvable');

    await this.prisma.announcementAttachment.delete({ where: { id: attachment.id } });
    await this.deleteFiles([attachment.path]);

    const updated = await this.findFull(id);
    return { announcement: updated };
  }

  /** Pièce jointe à servir (vérifie l'appartenance à la résidence). */
  async getAttachment(id: string, attachmentId: string, user: User) {
    await this.ownedOrFail(id, user.residenceId);
    const attachment = await this.prisma.announcementAttachment.findFirst({
      where: { id: attachmentId, announcementId: id },
    });
    if (!attachment) throw new NotFoundException('Pièce jointe introuvable');
    return attachment;
  }

  /** Commentaires d'une annonce (chronologique). */
  async listComments(id: string, user: User) {
    await this.ownedOrFail(id, user.residenceId);
    const comments = await this.prisma.comment.findMany({
      where: { announcementId: id },
      orderBy: { createdAt: 'asc' },
      include: COMMENT_INCLUDE,
    });
    return { comments };
  }

  /** Ajout d'un commentaire : ouvert à TOUS les habitants de la résidence. */
  async addComment(id: string, user: User, dto: CreateAnnouncementCommentDto) {
    await this.ownedOrFail(id, user.residenceId);
    const content = dto.content?.trim();
    if (!content) throw new BadRequestException('Le commentaire ne peut pas être vide');

    const comment = await this.prisma.comment.create({
      data: { content, authorId: user.id, announcementId: id },
      include: COMMENT_INCLUDE,
    });
    return { comment };
  }
}
