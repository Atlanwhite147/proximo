import { Controller, Get, ForbiddenException, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { StatusGuard } from '../common/guards/status.guard';
import { PrismaService } from '../prisma/prisma.service';
import { ROLE_AGENCE } from '../auth/auth.constants';

/**
 * Identité du compte agence connecté : nom de l'agence et résidences gérées.
 * Sert à l'espace agence et au formulaire de publication d'annonce, qui doit
 * savoir dans quelle résidence publier. Le périmètre est lu en base.
 */
@Controller('agency')
@UseGuards(JwtAuthGuard, StatusGuard)
export class AgencySelfController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('me')
  async me(@CurrentUser() user: { id: string; role?: string }) {
    const account = await this.prisma.user.findUnique({
      where: { id: user.id },
      select: {
        role: true,
        status: true,
        firstName: true,
        lastName: true,
        agencyId: true,
        agency: { select: { id: true, name: true, contactEmail: true } },
      },
    });
    if (!account || account.status !== 'ACTIVE') {
      throw new ForbiddenException('Compte inactif');
    }
    if (account.role !== ROLE_AGENCE || !account.agencyId) {
      throw new ForbiddenException('Espace réservé aux comptes d’agence');
    }
    const links = await this.prisma.agencyResidence.findMany({
      where: { agencyId: account.agencyId },
      include: { residence: { select: { id: true, name: true, code: true } } },
    });
    return {
      agency: {
        id: account.agencyId,
        name: account.agency?.name ?? 'Agence',
        contactEmail: account.agency?.contactEmail ?? null,
      },
      member: { firstName: account.firstName, lastName: account.lastName },
      residences: links.map((link) => link.residence),
    };
  }
}
