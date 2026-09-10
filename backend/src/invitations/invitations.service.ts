import { Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import * as qrcode from 'qrcode';
import { PrismaService } from '../prisma/prisma.service';
import { CreateInvitationDto } from './dto/create-invitation.dto';

const DEFAULT_TTL_HOURS = 72;
const APP_URL = process.env.APP_URL ?? 'http://localhost:3000';

/** Cache mémoire des URLs raccourcies (token → lien court, 12 h). */
const shortUrlCache = new Map<string, { short: string; at: number }>();
const SHORT_URL_TTL_MS = 12 * 60 * 60 * 1000;

/**
 * Raccourcit une URL via TinyURL (repli is.gd). Sans clé API, timeout court.
 * Retourne l'URL d'origine si les deux services échouent (dégradation douce).
 */
async function shortenWithService(longUrl: string): Promise<string | null> {
  const encoded = encodeURIComponent(longUrl);
  const services = [
    `https://tinyurl.com/api-create.php?url=${encoded}`,
    `https://is.gd/create.php?format=simple&url=${encoded}`,
  ];
  for (const endpoint of services) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 4_000);
      const response = await fetch(endpoint, { signal: controller.signal });
      clearTimeout(timer);
      if (!response.ok) continue;
      const text = (await response.text()).trim();
      if (text.startsWith('http') && !text.includes(' ')) return text;
    } catch {
      /* service injoignable → essayer le suivant */
    }
  }
  return null;
}

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
        neighborhood: dto.neighborhood?.trim() ?? '',
        createdById,
        residenceId,
        expiresAt: new Date(Date.now() + expiresInHours * 3_600_000),
        ...(dto.multiUse !== undefined ? { multiUse: dto.multiUse } : {}),
      },
    });

    const url = `${APP_URL}/rejoindre?token=${token}`;
    return this.serialize(invitation, token, url);
  }

  /** Forme de réponse commune (création et réutilisation). */
  private serialize(
    invitation: { id: string; neighborhood: string; expiresAt: Date; multiUse: boolean },
    token: string,
    url: string,
  ) {
    return {
      id: invitation.id,
      token,
      url,
      qrUrl: `${process.env.API_URL ?? '/api'}/invitations/${token}/qr.png`,
      neighborhood: invitation.neighborhood,
      expiresAt: invitation.expiresAt,
      multiUse: invitation.multiUse,
    };
  }

  /**
   * Invitation prête à partager pour ce membre : réutilise la sienne encore
   * valable (au moins 12 h restantes), sinon en crée une. Objectif : le
   * partage doit être immédiat, sans étape « générer » préalable.
   */
  async getOrCreateMine(createdById: string, dto: CreateInvitationDto) {
    const creator = await this.prisma.user.findUnique({
      where: { id: createdById },
      select: { residenceId: true },
    });

    // Marge de 12 h : on ne réutilise pas un lien sur le point d'expirer.
    const marge = new Date(Date.now() + 12 * 3_600_000);
    const existante = await this.prisma.invitation.findFirst({
      where: {
        createdById,
        residenceId: creator?.residenceId ?? null,
        expiresAt: { gt: marge },
        OR: [{ multiUse: true }, { usedAt: null }],
      },
      orderBy: { createdAt: 'desc' },
    });

    if (existante) {
      return this.serialize(
        existante,
        existante.token,
        `${APP_URL}/rejoindre?token=${existante.token}`,
      );
    }

    return this.create(createdById, { ...dto, expiresInHours: dto.expiresInHours ?? 72 });
  }

  /** État public d'une invitation (landing page avant inscription). */
  async getPublic(
    token: string,
  ): Promise<{ neighborhood: string; residenceName: string; expiresAt: Date; valid: boolean }> {
    const invitation = await this.prisma.invitation.findUnique({
      where: { token },
      include: { residence: { select: { name: true } } },
    });
    if (!invitation) {
      throw new NotFoundException("Jeton d'invitation invalide");
    }
    const valid = (!invitation.usedAt || invitation.multiUse) && invitation.expiresAt > new Date();
    return {
      neighborhood: invitation.neighborhood,
      residenceName: invitation.residence?.name ?? invitation.neighborhood,
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
    const invitations = await this.prisma.invitation.findMany({
      where: residenceId ? { residenceId } : undefined,
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: { createdBy: { select: { firstName: true, lastName: true } } },
    });
    // Ajoute les champs calculés (lien + QR) attendus par l'interface.
    const apiBase = process.env.API_URL ?? '/api';
    return invitations.map((invitation) => ({
      ...invitation,
      url: `${APP_URL}/rejoindre?token=${invitation.token}`,
      qrUrl: `${apiBase}/invitations/${invitation.token}/qr.png`,
    }));
  }

  /**
   * Lien court pour le partage (WhatsApp…) : TinyURL en priorité, is.gd en
   * repli, sinon l'URL complète (dégradation douce). Cache 12 h par token.
   */
  async getShortUrl(token: string): Promise<{ shortUrl: string }> {
    const invitation = await this.prisma.invitation.findUnique({
      where: { token },
      select: { id: true },
    });
    if (!invitation) {
      throw new NotFoundException("Jeton d'invitation invalide");
    }
    const longUrl = `${APP_URL}/rejoindre?token=${token}`;

    const cached = shortUrlCache.get(token);
    if (cached && Date.now() - cached.at < SHORT_URL_TTL_MS) {
      return { shortUrl: cached.short };
    }

    const short = (await shortenWithService(longUrl)) ?? longUrl;
    shortUrlCache.set(token, { short, at: Date.now() });
    // Borne la taille du cache (évite une fuite mémoire avec beaucoup de jetons).
    if (shortUrlCache.size > 500) {
      const oldest = [...shortUrlCache.entries()].sort((a, b) => a[1].at - b[1].at)[0];
      if (oldest) shortUrlCache.delete(oldest[0]);
    }
    return { shortUrl: short };
  }

  /** Supprime une invitation (administration). */
  async remove(invitationId: string): Promise<void> {
    const invitation = await this.prisma.invitation.findUnique({
      where: { id: invitationId },
      select: { id: true },
    });
    if (!invitation) {
      throw new NotFoundException('Invitation introuvable');
    }
    await this.prisma.invitation.delete({ where: { id: invitationId } });
  }
}
