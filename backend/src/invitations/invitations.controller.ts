import {
  Body,
  Controller,
  Get,
  Header,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { StatusGuard } from '../common/guards/status.guard';
import { CreateInvitationDto } from './dto/create-invitation.dto';
import { InvitationsService } from './invitations.service';

/**
 * Invitations : création (membre actif), consultation publique du jeton
 * et génération du QR code PNG.
 */
@Controller('invitations')
export class InvitationsController {
  constructor(private readonly invitationsService: InvitationsService) {}

  @Post()
  @UseGuards(JwtAuthGuard, StatusGuard)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @HttpCode(HttpStatus.CREATED)
  async create(@CurrentUser() user: { id: string }, @Body() dto: CreateInvitationDto) {
    return this.invitationsService.create(user.id, dto);
  }

  /**
   * Invitation prête à partager : renvoie celle du membre si elle est encore
   * valable, sinon en crée une. Utilisée par le widget « Inviter un voisin »
   * pour que le partage soit possible sans étape préalable.
   */
  @Post('mine')
  @UseGuards(JwtAuthGuard, StatusGuard)
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @HttpCode(HttpStatus.OK)
  async mine(@CurrentUser() user: { id: string }, @Body() dto: CreateInvitationDto) {
    return this.invitationsService.getOrCreateMine(user.id, dto);
  }

  /** État public du jeton (utilisé par la page /rejoindre). */
  @Get(':token')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  async get(@Param('token') token: string) {
    return this.invitationsService.getPublic(token);
  }

  /** Lien court (TinyURL) pour le partage WhatsApp. */
  @Get(':token/short-url')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  async shortUrl(@Param('token') token: string) {
    return this.invitationsService.getShortUrl(token);
  }

  /** QR code PNG de l'invitation. */
  @Get(':token/qr.png')
  @Header('Content-Type', 'image/png')
  @Header('Cache-Control', 'public, max-age=300')
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  async qrCode(@Param('token') token: string, @Res() response: Response) {
    const buffer = await this.invitationsService.qrCode(token);
    response.send(buffer);
  }
}
