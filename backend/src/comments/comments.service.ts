import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCommentDto } from './dto/create-comment.dto';

/** Commentaire public avec auteur (données affichables). */
export interface CommentWithAuthor {
  id: string;
  content: string;
  createdAt: Date;
  updatedAt: Date;
  author: {
    id: string;
    firstName: string;
    lastName: string;
    /** Rôle de l'auteur : sert au badge « Agence » affiché à côté du nom. */
    role: string;
    /** Nom de l'agence quand l'auteur est un compte de rôle AGENCE. */
    agency: { name: string } | null;
    showDetails: boolean;
    building: string | null;
    floor: string | null;
  };
}

/** Acteur d'un commentaire : identité relue en base, jamais depuis le jeton. */
export interface CommentActor {
  id: string;
  role: string;
  residenceId?: string | null;
}

/**
 * Discussion publique attachée à une annonce ou un signalement.
 * Visible par tous les habitants (statut ACTIVE), suppression réservée
 * à l'auteur ou à un administrateur.
 */
@Injectable()
export class CommentsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Vérifie que l'acteur a le droit d'écrire sur cette résidence : sa propre
   * résidence, ou une résidence gérée par son agence pour un compte AGENCE.
   * Un refus renvoie « introuvable » pour ne rien révéler d'une autre résidence.
   */
  private async assertResidenceAccess(
    actor: CommentActor,
    residenceId: string | null,
  ): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { id: actor.id },
      select: { role: true, status: true, residenceId: true, agencyId: true },
    });
    if (!user || user.status !== 'ACTIVE') {
      throw new ForbiddenException('Compte inactif');
    }
    if (user.role === 'SUPERADMIN') return;
    if (residenceId && user.residenceId === residenceId) return;
    if (user.role === 'AGENCE' && user.agencyId && residenceId) {
      const link = await this.prisma.agencyResidence.findFirst({
        where: { agencyId: user.agencyId, residenceId },
        select: { id: true },
      });
      if (link) return;
    }
    throw new NotFoundException('Cible introuvable');
  }

  /** Liste les commentaires d'une annonce (chronologique). */
  async listForListing(listingId: string, actor: CommentActor): Promise<CommentWithAuthor[]> {
    const listing = await this.prisma.listing.findUnique({ where: { id: listingId } });
    if (!listing) throw new NotFoundException('Annonce introuvable');
    await this.assertResidenceAccess(actor, listing.residenceId);
    return this.list({ listingId });
  }

  /** Liste les commentaires d'un signalement (chronologique). */
  async listForIncident(incidentId: string, actor: CommentActor): Promise<CommentWithAuthor[]> {
    const incident = await this.prisma.incident.findUnique({ where: { id: incidentId } });
    if (!incident) throw new NotFoundException('Signalement introuvable');
    await this.assertResidenceAccess(actor, incident.residenceId);
    return this.list({ incidentId });
  }

  private async list(where: {
    listingId?: string;
    incidentId?: string;
  }): Promise<CommentWithAuthor[]> {
    const comments = await this.prisma.comment.findMany({
      where,
      orderBy: { createdAt: 'asc' },
      include: {
        author: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            role: true,
            agency: { select: { name: true } },
            showDetails: true,
            building: true,
            floor: true,
          },
        },
      },
    });
    return comments;
  }

  /** Crée un commentaire sur l'annonce ou le signalement ciblé. */
  async create(actor: CommentActor, dto: CreateCommentDto): Promise<CommentWithAuthor> {
    const authorId = actor.id;
    const { listingId, incidentId, content } = dto;
    if (!listingId && !incidentId) {
      throw new BadRequestException('Précisez une annonce ou un signalement');
    }
    if (listingId && incidentId) {
      throw new BadRequestException('Un seul type de cible à la fois');
    }

    // La cible doit exister ET appartenir au périmètre de l'auteur (sa
    // résidence, ou une résidence gérée par son agence si son rôle est AGENCE).
    if (listingId) {
      const listing = await this.prisma.listing.findUnique({ where: { id: listingId } });
      if (!listing) throw new NotFoundException('Annonce introuvable');
      await this.assertResidenceAccess(actor, listing.residenceId);
    }
    if (incidentId) {
      const incident = await this.prisma.incident.findUnique({ where: { id: incidentId } });
      if (!incident) throw new NotFoundException('Signalement introuvable');
      await this.assertResidenceAccess(actor, incident.residenceId);
    }

    const comment = await this.prisma.comment.create({
      data: {
        content: content.trim(),
        authorId,
        ...(listingId ? { listingId } : {}),
        ...(incidentId ? { incidentId } : {}),
      },
      include: {
        author: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            role: true,
            agency: { select: { name: true } },
            showDetails: true,
            building: true,
            floor: true,
          },
        },
      },
    });

    // Un commentaire de l'agence ou d'un habitant sur un signalement entre
    // dans l'historique du dossier (badge agence côté interface).
    if (incidentId) {
      const author = await this.prisma.user.findUnique({
        where: { id: authorId },
        select: {
          firstName: true,
          lastName: true,
          role: true,
          agency: { select: { name: true } },
        },
      });
      const isAgency = author?.role === 'AGENCE';
      try {
        await this.prisma.incidentEvent.create({
          data: {
            incidentId,
            type: 'COMMENTED',
            actorType: isAgency ? 'AGENCE' : author?.role === 'ADMIN' ? 'ADMIN' : 'RESIDENT',
            actorId: authorId,
            actorLabel: isAgency
              ? `${author?.agency?.name ?? 'Agence'}, ${author?.firstName ?? ''} ${author?.lastName ?? ''}`.trim()
              : `${author?.firstName ?? ''} ${author?.lastName ?? ''}`.trim(),
            note: content.trim().slice(0, 280),
          },
        });
      } catch {
        // Le journal ne doit jamais empêcher la publication d'un commentaire.
      }
    }
    return comment;
  }

  /** Supprime un commentaire (auteur ou admin). */
  async remove(commentId: string, user: { id: string; role: string }): Promise<void> {
    const comment = await this.prisma.comment.findUnique({ where: { id: commentId } });
    if (!comment) throw new NotFoundException('Commentaire introuvable');
    if (comment.authorId !== user.id && user.role !== 'ADMIN') {
      throw new ForbiddenException('Vous ne pouvez pas supprimer ce commentaire');
    }
    await this.prisma.comment.delete({ where: { id: commentId } });
  }
}
