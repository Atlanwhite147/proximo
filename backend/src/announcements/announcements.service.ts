import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateAnnouncementDto, CreateAnnouncementCommentDto } from './dto/create-announcement.dto';

/** Auteur d'un message tel qu'exposé aux habitants. */
const AUTHOR_SELECT = {
  id: true,
  firstName: true,
  lastName: true,
  role: true,
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
 * Messages prioritaires de la résidence (canal officiel) :
 * tout le monde les lit et les commente, seuls les rôles ADMIN et SUPERADMIN
 * en publient.
 */
@Injectable()
export class AnnouncementsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Message prioritaire appartenant à la résidence de l'habitant. */
  private async ownedOrFail(id: string, residenceId: string | null | undefined) {
    const announcement = await this.prisma.announcement.findUnique({ where: { id } });
    if (!announcement || announcement.residenceId !== residenceId) {
      throw new NotFoundException('Message introuvable');
    }
    return announcement;
  }

  private assertPublisher(user: User): void {
    if (user.role !== 'ADMIN' && user.role !== 'SUPERADMIN') {
      throw new ForbiddenException(
        'Seuls les administrateurs de la résidence peuvent publier un message prioritaire.',
      );
    }
  }

  /** Liste les messages (les plus récents d'abord). */
  async list(user: User, limit?: number) {
    const residenceId = user.residenceId ?? null;
    if (!residenceId) return { announcements: [] };

    const announcements = await this.prisma.announcement.findMany({
      where: { residenceId },
      orderBy: { createdAt: 'desc' },
      ...(limit && limit > 0 ? { take: Math.min(limit, 50) } : {}),
      include: {
        author: { select: AUTHOR_SELECT },
        _count: { select: { comments: true } },
      },
    });
    return { announcements };
  }

  /** Publication — ADMIN ou SUPERADMIN de la résidence. */
  async create(user: User, dto: CreateAnnouncementDto) {
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

    const announcement = await this.prisma.announcement.create({
      data: { title, body, authorId: user.id, residenceId },
      include: {
        author: { select: AUTHOR_SELECT },
        _count: { select: { comments: true } },
      },
    });
    return { announcement };
  }

  /** Suppression : auteur du message ou administrateur de la résidence. */
  async remove(id: string, user: User): Promise<void> {
    const announcement = await this.ownedOrFail(id, user.residenceId);
    const isAuthor = announcement.authorId === user.id;
    const isAdmin = user.role === 'ADMIN' || user.role === 'SUPERADMIN';
    if (!isAuthor && !isAdmin) {
      throw new ForbiddenException('Vous ne pouvez pas supprimer ce message');
    }
    await this.prisma.announcement.delete({ where: { id } });
  }

  /** Commentaires d'un message prioritaire (chronologique). */
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
