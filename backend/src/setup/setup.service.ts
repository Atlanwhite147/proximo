import { ConflictException, ForbiddenException, Injectable } from '@nestjs/common';
import * as argon2 from 'argon2';
import { PrismaService } from '../prisma/prisma.service';
import { CompleteSetupDto } from './dto/complete-setup.dto';

/**
 * Installation initiale (premier lancement) :
 *  - `GET /setup/status`  → l'installation est-elle requise ?
 *  - `POST /setup/complete` → crée l'administrateur + la résidence (singleton
 *    SyndicSettings), en une seule transaction.
 *
 * Sécurité : tant qu'aucun administrateur n'existe, n'importe qui peut
 * finaliser l'installation (c'est la fenêtre d'installation). Dès qu'un
 * admin est créé, l'endpoint est verrouillé (403).
 */
@Injectable()
export class SetupService {
  constructor(private readonly prisma: PrismaService) {}

  /** L'installation est requise tant qu'aucun administrateur n'existe. */
  async isRequired(): Promise<boolean> {
    const adminCount = await this.prisma.user.count({
      where: { role: { in: ['ADMIN', 'SUPERADMIN'] } },
    });
    return adminCount === 0;
  }

  /**
   * Crée le compte administrateur (ACTIVE) et configure la résidence.
   * Transactionnel : soit tout passe, soit rien.
   */
  async complete(dto: CompleteSetupDto): Promise<{ adminEmail: string }> {
    if ((await this.isRequired()) === false) {
      throw new ForbiddenException(
        'L’installation est déjà terminée — un administrateur existe déjà.',
      );
    }

    const email = dto.adminEmail.toLowerCase().trim();

    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) {
      throw new ConflictException('Un compte existe déjà avec cet email');
    }

    const passwordHash = await argon2.hash(dto.adminPassword, {
      type: argon2.argon2id,
      memoryCost: 19_456,
      timeCost: 2,
      parallelism: 1,
    });

    const agencyName = dto.agencyName?.trim() || dto.residenceName.trim();
    const syndicEmail = dto.syndicEmail?.trim() || email;

    await this.prisma.$transaction(async (tx) => {
      // Résidence initiale : le code d'accès est dérivé du nom si absent.
      const residenceCode =
        dto.residenceCode?.trim() ||
        dto.residenceName
          .trim()
          .toUpperCase()
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .replace(/[^A-Z0-9]+/g, '-')
          .replace(/^-+|-+$/g, '') ||
        'PROXIMO';

      const residence = await tx.residence.upsert({
        where: { id: 'r-default' },
        create: {
          id: 'r-default',
          name: dto.residenceName.trim(),
          code: residenceCode,
          agencyName,
          syndicEmail,
        },
        update: {
          name: dto.residenceName.trim(),
          code: residenceCode,
          agencyName,
          syndicEmail,
        },
      });

      await tx.user.create({
        data: {
          email,
          passwordHash,
          firstName: dto.firstName.trim(),
          lastName: dto.lastName.trim(),
          neighborhood: dto.residenceName.trim(),
          residenceId: residence.id,
          role: 'ADMIN',
          status: 'ACTIVE',
        },
      });

      // Rétro-compat : le singleton SyndicSettings reste alimenté (lectures
      // historiques de l'email agence), mais la source de vérité devient
      // la table Residence.
      await tx.syndicSettings.upsert({
        where: { id: 1 },
        create: { id: 1, agencyName, email: syndicEmail, residenceName: dto.residenceName.trim() },
        update: { agencyName, email: syndicEmail, residenceName: dto.residenceName.trim() },
      });
    });

    return { adminEmail: email };
  }
}
