import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  Res,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';
import { randomUUID } from 'crypto';
import { mkdirSync } from 'fs';
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { StatusGuard } from '../common/guards/status.guard';
import { uploadsDir } from '../incidents/incidents.service';
import { AnnouncementsService } from './announcements.service';
import { CreateAnnouncementDto, CreateAnnouncementCommentDto } from './dto/create-announcement.dto';
import { UpdateAnnouncementDto } from './dto/update-announcement.dto';

/** Pièces jointes acceptées : images et PDF (mêmes règles que les signalements). */
const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp', 'application/pdf']);
const ALLOWED_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.pdf']);
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 Mo par fichier
const MAX_FILES = 5;

/** Stockage : nom unique généré côté serveur, jamais le nom d'origine. */
const announcementStorage = diskStorage({
  destination: (_req, _file, callback) => {
    mkdirSync(uploadsDir(), { recursive: true });
    callback(null, uploadsDir());
  },
  filename: (_req, file, callback) => {
    callback(null, `${randomUUID()}${extname(file.originalname).toLowerCase()}`);
  },
});

type RequestUser = { id: string; role: string; residenceId?: string | null };

/**
 * Annonces officielles de la résidence : lecture et commentaires pour tous les
 * habitants, publication réservée aux rôles ADMIN / SUPERADMIN (contrôle fait
 * dans le service — pas d'exigence 2FA, ce n'est pas une action sensible).
 */
@Controller('announcements')
@UseGuards(JwtAuthGuard, StatusGuard)
export class AnnouncementsController {
  constructor(private readonly announcementsService: AnnouncementsService) {}

  /**
   * Filtre les fichiers reçus (MIME + extension) et supprime du disque ceux qui
   * ne sont pas autorisés : rien ne reste derrière un envoi refusé.
   */
  private async keepValidFiles(files?: Express.Multer.File[]) {
    const kept: Express.Multer.File[] = [];
    for (const file of files ?? []) {
      const extension = extname(file.originalname).toLowerCase();
      if (ALLOWED_MIME.has(file.mimetype) && ALLOWED_EXTENSIONS.has(extension)) {
        kept.push(file);
      } else {
        await this.announcementsService.removeUploadedFile(file.filename);
      }
    }
    if (files && files.length > 0 && kept.length === 0) {
      throw new BadRequestException('Type de fichier non autorisé (JPG, PNG, WEBP, PDF)');
    }
    return kept;
  }

  @Get()
  async list(@CurrentUser() user: RequestUser, @Query('limit') limit?: string) {
    const parsed = Number(limit);
    return this.announcementsService.list(user, Number.isFinite(parsed) ? parsed : undefined);
  }

  @Post()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @UseInterceptors(
    FilesInterceptor('files', MAX_FILES, {
      storage: announcementStorage,
      limits: { fileSize: MAX_FILE_SIZE },
    }),
  )
  async create(
    @CurrentUser() user: RequestUser,
    @Body() dto: CreateAnnouncementDto,
    @UploadedFiles() files?: Express.Multer.File[],
  ) {
    const kept = await this.keepValidFiles(files);
    return this.announcementsService.create(user, dto, kept);
  }

  /** Modification a posteriori (auteur ou administrateur). */
  @Patch(':id')
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  async update(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Body() dto: UpdateAnnouncementDto,
  ) {
    return this.announcementsService.update(id, user, dto);
  }

  /** Ajout de pièces jointes à une annonce existante. */
  @Post(':id/attachments')
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @UseInterceptors(
    FilesInterceptor('files', MAX_FILES, {
      storage: announcementStorage,
      limits: { fileSize: MAX_FILE_SIZE },
    }),
  )
  async addAttachments(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @UploadedFiles() files?: Express.Multer.File[],
  ) {
    const kept = await this.keepValidFiles(files);
    return this.announcementsService.addAttachments(id, user, kept);
  }

  /** Retrait d'une pièce jointe. */
  @Delete(':id/attachments/:attachmentId')
  @HttpCode(HttpStatus.OK)
  async removeAttachment(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Param('attachmentId') attachmentId: string,
  ) {
    return this.announcementsService.removeAttachment(id, attachmentId, user);
  }

  /** Sert le fichier (réservé aux habitants de la résidence). */
  @Get(':id/attachments/:attachmentId')
  async getAttachment(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Param('attachmentId') attachmentId: string,
    @Res() response: Response,
  ) {
    const attachment = await this.announcementsService.getAttachment(id, attachmentId, user);
    response.sendFile(join(uploadsDir(), attachment.path), (error) => {
      if (error) response.status(404).end();
    });
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    await this.announcementsService.remove(id, user);
  }

  @Get(':id/comments')
  async listComments(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    return this.announcementsService.listComments(id, user);
  }

  @Post(':id/comments')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  async addComment(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Body() dto: CreateAnnouncementCommentDto,
  ) {
    return this.announcementsService.addComment(id, user, dto);
  }
}
