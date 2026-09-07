import {
  BadRequestException,
  Controller,
  Get,
  NotFoundException,
  Query,
  Req,
  Res,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { PrismaService } from '../prisma/prisma.service';
import { OAUTH_STATE_COOKIE } from './auth.constants';
import { AuthService } from './auth.service';
import { GoogleOAuthService } from './google-oauth.service';

const FRONTEND_URL = process.env.FRONTEND_URL ?? 'http://localhost:3000';

/**
 * Flux Google OAuth2 : /api/auth/google → Google → /api/auth/google/callback.
 * En cas de 2FA actif sur le compte, le navigateur est redirigé vers
 * `/connexion?2fa=1` avec le cookie `two_factor_token` posé.
 */
@Controller('auth/google')
export class GoogleOAuthController {
  constructor(
    private readonly googleOAuth: GoogleOAuthService,
    private readonly authService: AuthService,
    private readonly prisma: PrismaService,
  ) {}

  @Get()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  async redirect(
    @Res({ passthrough: true }) response: Response,
    @Query('residenceCode') residenceCode?: string,
    @Query('invitationToken') invitationToken?: string,
  ) {
    if (!this.googleOAuth.enabled) {
      throw new NotFoundException('Connexion Google non configurée');
    }

    // Un code fourni est vérifié immédiatement (retour rapide sur /inscription).
    // Pas de code fourni → la vérification est différée au callback : c'est le
    // cas du LOGIN (compte existant), où aucun code ne doit être demandé.
    if (residenceCode !== undefined && residenceCode !== '') {
      const submitted = (residenceCode ?? '').trim();
      if (!submitted) {
        throw new BadRequestException(
          'Code de résidence invalide. Demandez-le à votre syndic ou à un voisin.',
        );
      }
      const residence = await this.prisma.residence.findFirst({
        where: { code: { equals: submitted, mode: 'insensitive' } },
        select: { id: true },
      });
      if (!residence) {
        throw new BadRequestException(
          'Code de résidence invalide. Demandez-le à votre syndic ou à un voisin.',
        );
      }
    }

    const { url, state } = this.googleOAuth.buildAuthorizationUrl(
      residenceCode?.trim() || undefined,
      invitationToken?.trim() || undefined,
    );
    this.googleOAuth.setStateCookie(response, state);
    return { url };
  }

  @Get('callback')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  async callback(
    @Query('code') code: string | undefined,
    @Query('state') state: string | undefined,
    @Req() request: Request,
    @Res() response: Response,
  ) {
    const expectedState: string | undefined = request.cookies?.[OAUTH_STATE_COOKIE];
    this.googleOAuth.clearStateCookie(response);

    if (!code || !state) {
      return response.redirect(`${FRONTEND_URL}/connexion?error=google`);
    }

    try {
      const profile = await this.googleOAuth.exchangeCode(code, expectedState, state);
      const residenceCode = this.googleOAuth.residenceCodeFromState(state);
      const invitationToken = this.googleOAuth.invitationTokenFromState(state);
      const user = await this.googleOAuth.findOrCreateUser(profile, residenceCode, invitationToken);
      const publicUser = this.authService.toPublicUser(user);

      // 2FA obligatoire pour les administrateurs : étape supplémentaire.
      if (publicUser.totpEnabled) {
        await this.authService.issueTwoFactorToken(response, publicUser);
        return response.redirect(`${FRONTEND_URL}/connexion?2fa=1`);
      }

      await this.authService.issueSession(response, publicUser, { rememberMe: false });
      return response.redirect(`${FRONTEND_URL}/auth/callback`);
    } catch (err) {
      // Code de résidence / invitation refusés à la création de compte :
      // message dédié. Autres erreurs : échec Google générique.
      if (err instanceof BadRequestException) {
        return response.redirect(`${FRONTEND_URL}/connexion?error=code`);
      }
      return response.redirect(`${FRONTEND_URL}/connexion?error=google`);
    }
  }
}
