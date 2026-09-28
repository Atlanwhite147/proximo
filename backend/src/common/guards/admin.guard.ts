import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * Accès back-office : rôle ADMIN (résidence) ou SUPERADMIN (toutes les
 * résidences) requis, et 2FA vérifiée dans la session si le TOTP est
 * activé sur le compte. Le flag `twoFactorVerified` est porté par le
 * JWT access (posé uniquement après vérification du code).
 *
 * Le rôle, le statut et la résidence sont RELUS en base à chaque requête
 * (et non pris dans le JWT) : le jeton fige ces valeurs 15 minutes. Sans
 * cette relecture, un membre tout juste promu administrateur gardait un
 * jeton « USER » et se voyait refuser tout le back-office (403 silencieux
 * dans l'interface : « aucun membre trouvé » au lieu de la liste).
 */
@Injectable()
export class AdminGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Record<string, any>>();
    const session = request.user as
      | {
          id?: string;
          role?: string;
          status?: string;
          residenceId?: string | null;
          totpEnabled?: boolean;
          twoFactorVerified?: boolean;
        }
      | undefined;

    if (!session?.id) {
      throw new ForbiddenException('Accès réservé aux administrateurs');
    }

    // Rôle / statut / résidence frais depuis la base (le JWT peut être périmé).
    const fresh = await this.prisma.user
      .findUnique({
        where: { id: session.id },
        select: {
          id: true,
          email: true,
          role: true,
          status: true,
          residenceId: true,
          totpEnabled: true,
        },
      })
      .catch(() => null);

    const role = fresh?.role ?? session.role;
    if (role !== 'ADMIN' && role !== 'SUPERADMIN') {
      throw new ForbiddenException('Accès réservé aux administrateurs');
    }

    // On propage les valeurs fraîches : les contrôleurs scopent ensuite les
    // listes et les modifications sur la résidence RÉELLE de l'admin.
    if (fresh) {
      request.user = {
        ...session,
        id: fresh.id,
        email: fresh.email,
        role: fresh.role,
        status: fresh.status,
        residenceId: fresh.residenceId,
        totpEnabled: fresh.totpEnabled,
      };
    }

    const totpEnabled = fresh ? fresh.totpEnabled : session.totpEnabled;
    if (totpEnabled && !session.twoFactorVerified) {
      throw new ForbiddenException('Double authentification requise');
    }
    return true;
  }
}
