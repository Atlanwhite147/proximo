import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * Vérifie que le compte de l'utilisateur est ACTIVE.
 * Le statut est RELU en base à chaque requête (et non depuis le JWT) :
 * dès qu'un administrateur valide un compte PENDING, la session en cours
 * passe ACTIVE sans attendre l'expiration du jeton (15 min).
 */
@Injectable()
export class StatusGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Record<string, any>>();
    const user = request.user as { id?: string; status?: string } | undefined;

    if (!user?.id) {
      throw new ForbiddenException('Compte introuvable');
    }

    // Statut frais depuis la base (le JWT peut être périmé sur ce point).
    let status = user.status;
    try {
      const fresh = await this.prisma.user.findUnique({
        where: { id: user.id },
        select: { status: true },
      });
      if (fresh) status = fresh.status;
    } catch {
      // Base injoignable : on retombe sur le statut du JWT.
    }

    if (status === 'SUSPENDED') {
      throw new ForbiddenException('Compte suspendu. Contactez un administrateur.');
    }
    if (status === 'PENDING') {
      throw new ForbiddenException('Compte en attente de validation par un administrateur.');
    }
    return true;
  }
}
