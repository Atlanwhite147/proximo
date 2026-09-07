import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Res,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { Throttle } from '@nestjs/throttler';
import { IncidentAttachment } from '@prisma/client';
import { diskStorage } from 'multer';
import { mkdirSync } from 'fs';
import { extname, join } from 'path';
import type { Response } from 'express';
import { randomUUID } from 'crypto';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { StatusGuard } from '../common/guards/status.guard';
import { CreateIncidentDto } from './dto/create-incident.dto';
import { IncidentsService, uploadsDir } from './incidents.service';

/** Types MIME autorisés pour les pièces jointes (validés APRÈS multer). */
export const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp', 'application/pdf']);
export const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 Mo par fichier
export const MAX_FILES = 5;
const ALLOWED_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.pdf']);

/**
 * Signalements d'incidents — upload sécurisé :
 * types MIME restreints, taille limitée (5 Mo), nom de fichier unique côté
 * serveur (l'original n'est jamais utilisé comme chemin). La validation
 * finale a lieu dans le contrôleur (les fichiers rejetés sont supprimés).
 */
@Controller('incidents')
@UseGuards(JwtAuthGuard, StatusGuard)
export class IncidentsController {
  constructor(private readonly incidentsService: IncidentsService) {}

  @Post()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(
    FilesInterceptor('files', MAX_FILES, {
      storage: diskStorage({
        destination: (_req, _file, callback) => {
          mkdirSync(uploadsDir(), { recursive: true });
          callback(null, uploadsDir());
        },
        filename: (_req, file, callback) => {
          const extension = extname(file.originalname).toLowerCase();
          callback(null, `${randomUUID()}${extension}`);
        },
      }),
      limits: { fileSize: MAX_FILE_SIZE },
    }),
  )
  async create(
    @CurrentUser() user: { id: string; neighborhood?: string | null; residenceId?: string | null },
    @Body() dto: CreateIncidentDto,
    @UploadedFiles() files?: Express.Multer.File[],
  ) {
    // Validation stricte des fichiers reçus (MIME + extension) ;
    // les fichiers invalides sont supprimés du disque.
    const kept: Express.Multer.File[] = [];
    for (const file of files ?? []) {
      const extension = extname(file.originalname).toLowerCase();
      if (ALLOWED_MIME.has(file.mimetype) && ALLOWED_EXTENSIONS.has(extension)) {
        kept.push(file);
      } else {
        await this.incidentsService.removeUploadedFile(file.filename);
      }
    }
    if (files && files.length > 0 && kept.length === 0) {
      throw new BadRequestException('Type de fichier non autorisé (JPG, PNG, WEBP, PDF)');
    }

    const incident = await this.incidentsService.create(
      user.id,
      dto,
      kept,
      user.neighborhood ?? null,
      user.residenceId ?? null,
    );
    return { incident };
  }

  @Get()
  async all(@CurrentUser() user: { residenceId?: string | null }) {
    // Les habitants voient les signalements de LEUR résidence, SANS l'email
    // des auteurs (l'admin a son propre endpoint /admin/incidents).
    const incidents = await this.incidentsService.listPublic(user.residenceId ?? null);
    return { incidents };
  }

  @Patch(':id/resolve')
  @HttpCode(HttpStatus.OK)
  async resolve(@Param('id', ParseUUIDPipe) id: string) {
    const incident = await this.incidentsService.resolve(id);
    return { incident };
  }

  /** Détail public d'un signalement (visible par tous les habitants ACTIVE). */
  @Get(':id/public')
  async publicDetail(@Param('id', ParseUUIDPipe) id: string) {
    const incident = await this.incidentsService.findPublic(id);
    return { incident };
  }

  @Get(':id')
  async detail(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: { id: string; role: string },
  ) {
    const incident = await this.incidentsService.findForUser(id, user.id, user.role === 'ADMIN');
    return { incident };
  }

  /** Téléchargement d'une pièce jointe — auteur, admin OU habitant ACTIVE. */
  @Get(':id/attachments/:attachmentId')
  async download(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('attachmentId', ParseUUIDPipe) attachmentId: string,
    @CurrentUser() user: { id: string; role: string },
    @Res() response: Response,
  ) {
    // Habitants : le détail public autorise tout compte ACTIVE (pas d'email
    // exposé). Auteur/admin : accès complet via findForUser.
    const incident =
      user.role === 'ADMIN'
        ? await this.incidentsService.findForUser(id, user.id, true)
        : await this.incidentsService.findPublic(id);
    const attachment = (incident.attachments as IncidentAttachment[]).find(
      (a) => a.id === attachmentId,
    );
    if (!attachment) {
      throw new BadRequestException('Pièce jointe introuvable');
    }
    response.sendFile(join(uploadsDir(), attachment.path), (error) => {
      if (error) {
        response.status(404).end();
      }
    });
  }
}
