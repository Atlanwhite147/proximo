import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ACCESS_TOKEN_COOKIE } from '../../auth/auth.constants';

export interface JwtPayload {
  sub: string;
  email: string;
  role: string;
  status: string;
  residenceId: string | null;
  totpEnabled: boolean;
  twoFactorVerified: boolean;
  type: 'access';
}

/**
 * Garde d'authentification : valide le JWT porté par le cookie HTTP-only
 * `access_token` et attache l'utilisateur courant à `req.user`.
 * Aucun token n'est stocké côté client JS : uniquement des cookies.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly jwtService: JwtService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Record<string, any>>();
    const token: string | undefined = request.cookies?.[ACCESS_TOKEN_COOKIE];

    if (!token) {
      throw new UnauthorizedException('Authentification requise');
    }

    try {
      const payload = await this.jwtService.verifyAsync<JwtPayload>(token, {
        secret: process.env.JWT_ACCESS_SECRET,
      });
      if (payload.type !== 'access' || !payload.sub) {
        throw new Error('Payload invalide');
      }
      request.user = {
        id: payload.sub,
        email: payload.email,
        role: payload.role,
        status: payload.status,
        residenceId: payload.residenceId ?? null,
        totpEnabled: payload.totpEnabled,
        twoFactorVerified: payload.twoFactorVerified,
      };
      return true;
    } catch {
      throw new UnauthorizedException('Session expirée ou invalide');
    }
  }
}
