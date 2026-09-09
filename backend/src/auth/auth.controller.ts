import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RefreshGuard } from '../common/guards/refresh.guard';
import { TWO_FACTOR_TOKEN_COOKIE } from './auth.constants';
import { AuthService, PublicUser } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { VerifyTotpDto } from './dto/verify-totp.dto';
import { TwoFactorService } from './two-factor.service';

/** Requête enrichie par RefreshGuard (`req.refreshToken`). */
interface RefreshRequest extends Request {
  refreshToken?: { id: string; userId: string };
}

/** Réponse de connexion : peut demander l'étape 2FA. */
interface LoginResponse {
  user?: PublicUser;
  requiresTwoFactor?: boolean;
}

/**
 * Routes d'authentification. Débit fortement limité (anti brute-force).
 * Flux 2FA administrateur :
 *   login (admin + TOTP actif) → { requiresTwoFactor: true } + cookie
 *   `two_factor_token` → POST /auth/2fa/verify-login { code } → session complète.
 */
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly twoFactorService: TwoFactorService,
  ) {}

  @Post('register')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @HttpCode(HttpStatus.CREATED)
  async register(@Body() dto: RegisterDto, @Res({ passthrough: true }) response: Response) {
    const { user } = await this.authService.register(dto);
    await this.authService.issueSession(response, user);
    return { user };
  }

  @Post('login')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<LoginResponse> {
    const { user } = await this.authService.login(dto);

    // 2FA obligatoire : pas de session complète, émission d'un jeton de
    // pré-validation à usage unique (cookie HTTP-only, 5 min).
    if (user.totpEnabled) {
      await this.authService.issueTwoFactorToken(response, user);
      return { user, requiresTwoFactor: true };
    }

    await this.authService.issueSession(response, user, { rememberMe: dto.rememberMe });
    return { user };
  }

  /** Mot de passe oublié — envoie un lien de réinitialisation par email. */
  @Post('forgot-password')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @HttpCode(HttpStatus.OK)
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.requestPasswordReset(dto.email);
  }

  /** Réinitialise le mot de passe avec le jeton reçu par email. */
  @Post('reset-password')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @HttpCode(HttpStatus.OK)
  async resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto.token, dto.password);
  }

  /** Deuxième étape de connexion : vérification du code TOTP. */
  @Post('2fa/verify-login')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @HttpCode(HttpStatus.OK)
  async verifyTwoFactorLogin(
    @Body() dto: VerifyTotpDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<LoginResponse> {
    const twoFactorToken: string | undefined = request.cookies?.[TWO_FACTOR_TOKEN_COOKIE];
    if (!twoFactorToken) {
      return { requiresTwoFactor: true };
    }

    try {
      const userId = await this.twoFactorService.verifyLogin(twoFactorToken, dto.code);
      const user = await this.authService.toPublicUserOrThrow(userId);
      await this.authService.issueSession(response, user, { twoFactorVerified: true });
      this.authService.clearTwoFactorToken(response);
      return { user };
    } catch {
      return { requiresTwoFactor: true };
    }
  }

  /** Génère un secret TOTP et affiche le QR code (administrateur connecté). */
  @Post('2fa/setup')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async setupTwoFactor(@CurrentUser() user: { id: string }) {
    return this.twoFactorService.setup(user.id);
  }

  /** Confirme l'activation du 2FA avec un premier code. */
  @Post('2fa/confirm')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async confirmTwoFactor(@CurrentUser() user: { id: string }, @Body() dto: VerifyTotpDto) {
    return this.twoFactorService.confirm(user.id, dto.code);
  }

  /** Désactive le 2FA (un code valide est requis). */
  @Post('2fa/disable')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async disableTwoFactor(@CurrentUser() user: { id: string }, @Body() dto: VerifyTotpDto) {
    return this.twoFactorService.disable(user.id, dto.code);
  }

  @Post('refresh')
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @UseGuards(RefreshGuard)
  @HttpCode(HttpStatus.OK)
  async refresh(@Req() request: RefreshRequest, @Res({ passthrough: true }) response: Response) {
    const refreshToken = request.refreshToken as { id: string; userId: string };
    const user = await this.authService.toPublicUserOrThrow(refreshToken.userId);
    // Rotation : l'ancien refresh est révoqué, une nouvelle paire est émise.
    await this.authService.issueSession(response, user, {
      twoFactorVerified: true,
      previousRefreshTokenId: refreshToken.id,
    });
    return { user };
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(@Req() request: RefreshRequest, @Res({ passthrough: true }) response: Response) {
    const refreshToken = request.refreshToken as { id: string } | undefined;
    if (refreshToken) {
      await this.authService.revokeRefreshToken(refreshToken.id);
    }
    this.authService.clearAuthCookies(response);
    return { success: true };
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async me(@CurrentUser() user: { id: string }) {
    return { user: await this.authService.toPublicUserOrThrow(user.id) };
  }
}
