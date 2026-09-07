import { Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import * as qrcode from 'qrcode';
import { PrismaService } from '../prisma/prisma.service';
import { CreateInvitationDto } from './dto/create-invitation.dto';

const DEFAULT_TTL_HOURS = 72;
const APP_URL = process.env.APP_URL ?? 'http://localhost:3000';

/**
 * Invitations de voisinage : jeton aléatoire à usage unique, expirable,
 * lié à un quartier / une résidence, distribué via lien ou QR code.
 */
@Injectable()
export class InvitationsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(createdById: string, dto: CreateInvitationDto) {
    const token = randomUUID().replace(/-/g, '');
    const expiresInHours = dto.expiresInHours ?? DEFAULT_TTL_HOURS;

    // La résidence de l'invitation = celle de l'habitant qui invite
    // (multi-résidences : le jeton doit mener vers SA résidence).
    const creator = await this.prisma.user.findUnique({
      where: { id: createdById },
      select: { residenceId: true },
    });
    const residenceId = creator?.residenceId ?? null;

    const invitation = await this.prisma.invitation.create({
      data: {
        token,
        neighborhood: dto.neighborhood.trim(),
        createdById,
        residenceId,
        expiresAt: new Date(Date.now() + expiresInHours * 3_600_000),
      },
    });

    const url = `${APP_URL}/rejoindre?token=${token}`;
    return {
      id: invitation.id,
      token,
      url,
      qrUrl: `${process.env.API_URL ?? '/api'}/invitations/${token}/qr.png`,
      neighborhood: invitation.neighborhood,
      expiresAt: invitation.expiresAt,
    };
  }

  /** État public d'une invitation (landing page avant inscription). */
  async getPublic(
    token: string,
  ): Promise<{ neighborhood: string; expiresAt: Date; valid: boolean }> {
    const invitation = await this.prisma.invitation.findUnique({ where: { token } });
    if (!invitation) {
      throw new NotFoundException("Jeton d'invitation invalide");
    }
    const valid = !invitation.usedAt && invitation.expiresAt > new Date();
    return {
      neighborhood: invitation.neighborhood,
      expiresAt: invitation.expiresAt,
      valid,
    };
  }

  /** PNG du QR code pointant vers la page d'atterrissage. */
  async qrCode(token: string): Promise<Buffer> {
    await this.getPublic(token);
    return qrcode.toBuffer(`${APP_URL}/rejoindre?token=${token}`, {
      type: 'png',
      width: 480,
      margin: 1,
      errorCorrectionLevel: 'M',
    });
  }

  /** Liste des invitations (administration). */
  async listAll(residenceId?: string | null) {
    return this.prisma.invitation.findMany({
      where: residenceId ? { residenceId } : undefined,
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: { createdBy: { select: { firstName: true, lastName: true } } },
    });
  }
}
