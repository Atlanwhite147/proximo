import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomBytes } from 'crypto';
import * as argon2 from 'argon2';
import { PrismaService } from '../prisma/prisma.service';
import { AuthService } from '../auth/auth.service';
import { ROLE_AGENCE } from '../auth/auth.constants';
import { AddAgencyMemberDto, CreateAgencyDto, UpdateAgencyDto } from './dto/agency.dto';

/** Résidence rattachée à une agence, telle qu'affichée dans la console. */
export interface AgencyResidenceSummary {
  id: string;
  name: string;
  code: string | null;
}

/** Compte de rôle AGENCE rattaché à une agence. */
export interface AgencyMemberSummary {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  status: string;
  lastSeenAt: Date | null;
  createdAt: Date;
}

export interface AgencySummary {
  id: string;
  name: string;
  contactEmail: string | null;
  createdAt: Date;
  residences: AgencyResidenceSummary[];
  members: AgencyMemberSummary[];
}

/**
 * Agences et syndics gestionnaires : regroupement de résidences et comptes de
 * rôle AGENCE (email et mot de passe). Un compte agence accède aux
 * signalements de toutes les résidences rattachées, et à elles seules.
 * La gestion est réservée au superadministrateur (contrôleur).
 */
@Injectable()
export class AgenciesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authService: AuthService,
  ) {}

  /** Liste des agences avec leurs résidences et leurs comptes. */
  async list(): Promise<AgencySummary[]> {
    const agencies = await this.prisma.agency.findMany({
      orderBy: { name: 'asc' },
      include: {
        residences: {
          include: { residence: { select: { id: true, name: true, code: true } } },
        },
        members: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            status: true,
            lastSeenAt: true,
            createdAt: true,
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    });
    return agencies.map((agency) => ({
      id: agency.id,
      name: agency.name,
      contactEmail: agency.contactEmail,
      createdAt: agency.createdAt,
      residences: agency.residences.map((link) => link.residence),
      members: agency.members,
    }));
  }

  async getOne(agencyId: string): Promise<AgencySummary> {
    const all = await this.list();
    const found = all.find((agency) => agency.id === agencyId);
    if (!found) throw new NotFoundException('Agence introuvable');
    return found;
  }

  /** Crée une agence et, si fournie, son périmètre de résidences. */
  async create(actorId: string, dto: CreateAgencyDto): Promise<AgencySummary> {
    const agency = await this.prisma.agency.create({
      data: {
        name: dto.name.trim(),
        contactEmail: dto.contactEmail?.toLowerCase().trim() ?? null,
        createdById: actorId,
      },
    });
    if (dto.residenceIds?.length) {
      await this.setResidences(agency.id, dto.residenceIds);
    }
    return this.getOne(agency.id);
  }

  /** Met à jour le nom, le contact et le périmètre de résidences. */
  async update(agencyId: string, dto: UpdateAgencyDto): Promise<AgencySummary> {
    const agency = await this.prisma.agency.findUnique({ where: { id: agencyId } });
    if (!agency) throw new NotFoundException('Agence introuvable');
    await this.prisma.agency.update({
      where: { id: agencyId },
      data: {
        ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
        ...(dto.contactEmail !== undefined
          ? { contactEmail: dto.contactEmail.toLowerCase().trim() || null }
          : {}),
      },
    });
    if (dto.residenceIds) {
      await this.setResidences(agencyId, dto.residenceIds);
    }
    return this.getOne(agencyId);
  }

  /**
   * Supprime une agence. Les comptes ne sont pas supprimés : ils sont détachés
   * et suspendus, pour qu'aucun accès ne subsiste sans agence de rattachement.
   */
  async remove(agencyId: string): Promise<void> {
    const agency = await this.prisma.agency.findUnique({ where: { id: agencyId } });
    if (!agency) throw new NotFoundException('Agence introuvable');
    await this.prisma.user.updateMany({
      where: { agencyId },
      data: { agencyId: null, status: 'SUSPENDED' },
    });
    await this.prisma.agency.delete({ where: { id: agencyId } });
  }

  /**
   * Crée un compte de rôle AGENCE : email et mot de passe. Le mot de passe est
   * tiré au hasard puis jamais communiqué ; le titulaire le définit par le lien
   * envoyé à son adresse (flux de réinitialisation existant).
   */
  async addMember(agencyId: string, dto: AddAgencyMemberDto): Promise<AgencyMemberSummary> {
    const agency = await this.prisma.agency.findUnique({ where: { id: agencyId } });
    if (!agency) throw new NotFoundException('Agence introuvable');

    const email = dto.email.toLowerCase().trim();
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) {
      throw new ConflictException('Un compte existe déjà avec cette adresse email');
    }

    const temporaryPassword = randomBytes(24).toString('hex');
    const passwordHash = await argon2.hash(temporaryPassword);

    const member = await this.prisma.user.create({
      data: {
        email,
        firstName: dto.firstName.trim(),
        lastName: dto.lastName.trim(),
        passwordHash,
        role: ROLE_AGENCE,
        status: 'ACTIVE',
        agencyId,
        // Un compte agence ne reçoit pas les emails destinés aux habitants.
        emailNotifications: false,
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        status: true,
        lastSeenAt: true,
        createdAt: true,
      },
    });

    // Email de définition du mot de passe (lien valable une heure).
    await this.authService.requestPasswordReset(email);
    return member;
  }

  /** Retire un compte de l'agence : détaché et suspendu, jamais supprimé. */
  async removeMember(agencyId: string, userId: string): Promise<void> {
    const member = await this.prisma.user.findFirst({ where: { id: userId, agencyId } });
    if (!member) throw new NotFoundException('Compte introuvable dans cette agence');
    await this.prisma.user.update({
      where: { id: userId },
      data: { agencyId: null, status: 'SUSPENDED' },
    });
  }

  /** Remplace le périmètre de résidences d'une agence. */
  private async setResidences(agencyId: string, residenceIds: string[]): Promise<void> {
    const unique = [...new Set(residenceIds)];
    const found = await this.prisma.residence.findMany({
      where: { id: { in: unique } },
      select: { id: true },
    });
    if (found.length !== unique.length) {
      throw new BadRequestException('Une des résidences est introuvable');
    }
    await this.prisma.agencyResidence.deleteMany({ where: { agencyId } });
    if (unique.length > 0) {
      await this.prisma.agencyResidence.createMany({
        data: unique.map((residenceId) => ({ agencyId, residenceId })),
      });
    }
  }
}
