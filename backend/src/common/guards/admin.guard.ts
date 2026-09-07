import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';

/**
 * Accès back-office : rôle ADMIN (résidence) ou SUPERADMIN (toutes les
 * résidences) requis, et 2FA vérifiée dans la session si le TOTP est
 * activé sur le compte. Le flag `twoFactorVerified` est porté par le
 * JWT access (posé uniquement après vérification du code).
 */
@Injectable()
export class AdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Record<string, any>>();
    const user = request.user as
      { role?: string; totpEnabled?: boolean; twoFactorVerified?: boolean } | undefined;

    if (!user || (user.role !== 'ADMIN' && user.role !== 'SUPERADMIN')) {
      throw new ForbiddenException('Accès réservé aux administrateurs');
    }
    if (user.totpEnabled && !user.twoFactorVerified) {
      throw new ForbiddenException('Double authentification requise');
    }
    return true;
  }
}
