import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateProfileDto } from './dto/update-profile.dto';

/**
 * Profil public d'un voisin : uniquement les informations nécessaires
 * à la mise en relation. Jamais d'adresse, de coordonnées ni d'email.
 */
export interface PublicProfile {
  id: string;
  firstName: string;
  neighborhood: string | null;
}

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async getProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        neighborhood: true,
        role: true,
        status: true,
        totpEnabled: true,
        emailNotifications: true,
        createdAt: true,
        listings: {
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            title: true,
            category: true,
            status: true,
            neighborhood: true,
            createdAt: true,
          },
        },
      },
    });
    return user;
  }

  /** Met à jour le profil et les réglages de notification. */
  /** Suppression définitive du compte et de toutes ses données. */
  async deleteAccount(userId: string): Promise<void> {
    // Pièces jointes des signalements (fichiers sur disque).
    const incidents = await this.prisma.incident.findMany({
      where: { userId },
      include: { attachments: true },
    });
    await this.prisma.incidentAttachment.deleteMany({
      where: { incidentId: { in: incidents.map((i) => i.id) } },
    });
    await this.prisma.incident.deleteMany({ where: { userId } });
    await this.prisma.refreshToken.deleteMany({ where: { userId } });
    await this.prisma.listing.deleteMany({ where: { ownerId: userId } });
    await this.prisma.invitation.deleteMany({ where: { createdById: userId } });
    // Conversations (les messages sont supprimés en cascade).
    await this.prisma.conversation.deleteMany({
      where: { OR: [{ userAId: userId }, { userBId: userId }] },
    });
    await this.prisma.user.delete({ where: { id: userId } });
  }

  async updateProfile(userId: string, dto: UpdateProfileDto) {
    const data: Record<string, unknown> = {};
    if (dto.firstName !== undefined) data.firstName = dto.firstName.trim();
    if (dto.lastName !== undefined) data.lastName = dto.lastName.trim();
    if (dto.neighborhood !== undefined) {
      data.neighborhood = dto.neighborhood.trim() || null;
    }
    if (dto.building !== undefined) data.building = dto.building.trim() || null;
    if (dto.floor !== undefined) data.floor = dto.floor.trim() || null;
    if (dto.showDetails !== undefined) data.showDetails = dto.showDetails;
    if (dto.emailNotifications !== undefined) data.emailNotifications = dto.emailNotifications;

    // Changement d'email : uniquement pour les comptes à mot de passe
    // (les comptes Google sont liés à l'identité vérifiée).
    if (dto.email !== undefined) {
      const current = await this.prisma.user.findUnique({ where: { id: userId } });
      if (current?.passwordHash) {
        const normalized = dto.email.toLowerCase().trim();
        const conflict = await this.prisma.user.findUnique({ where: { email: normalized } });
        if (conflict && conflict.id !== userId) {
          throw new BadRequestException('Cet email est déjà utilisé');
        }
        data.email = normalized;
      } else {
        throw new BadRequestException(
          'Adresse email non modifiable sur un compte Google (utilisez votre identité Google)',
        );
      }
    }

    const user = await this.prisma.user.update({
      where: { id: userId },
      data,
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        neighborhood: true,
        role: true,
        status: true,
        totpEnabled: true,
        emailNotifications: true,
        createdAt: true,
      },
    });
    return user;
  }

  async getPublicProfile(userId: string): Promise<PublicProfile | null> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, firstName: true, neighborhood: true },
    });
    return user;
  }

  /**
   * Indicateurs de vie de la résidence de l'utilisateur (dashboard) :
   * habitants actifs, annonces, signalements ouverts — pour lutter contre
   * le « sentiment de vide » d'une application communautaire.
   */
  async getResidenceStats(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { residenceId: true },
    });
    if (!user?.residenceId) {
      return { activeResidents: 0, listingsCount: 0, openIncidentsCount: 0 };
    }
    const residenceId = user.residenceId;
    const [activeResidents, listingsCount, openIncidentsCount] = await Promise.all([
      this.prisma.user.count({ where: { residenceId, status: 'ACTIVE' } }),
      this.prisma.listing.count({ where: { residenceId } }),
      this.prisma.incident.count({ where: { residenceId, status: { in: ['OPEN', 'IN_PROGRESS'] } } }),
    ]);
    return { activeResidents, listingsCount, openIncidentsCount };
  }

  /**
   * Annuaire de la résidence : voisins ACTIVE (hors soi-même), sans email.
   * Le bâtiment/étage n'est renvoyé que si le voisin a coché « afficher
   * mes détails » (showDetails). Tri par prénom.
   */
  async getNeighbors(userId: string) {
    const me = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { residenceId: true },
    });
    if (!me?.residenceId) {
      return { neighbors: [] };
    }
    const neighbors = await this.prisma.user.findMany({
      where: { residenceId: me.residenceId, status: 'ACTIVE', id: { not: userId } },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        building: true,
        floor: true,
        showDetails: true,
        role: true,
        createdAt: true,
      },
      orderBy: { firstName: 'asc' },
    });
    // Confidentialité : on ne renvoie building/floor que si showDetails.
    const safe = neighbors.map(({ showDetails, building, floor, ...rest }) => ({
      ...rest,
      building: showDetails ? building : null,
      floor: showDetails ? floor : null,
    }));
    return { neighbors: safe };
  }
}
