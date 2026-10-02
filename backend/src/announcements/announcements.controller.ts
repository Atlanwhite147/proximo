import {
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
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { StatusGuard } from '../common/guards/status.guard';
import { AnnouncementsService } from './announcements.service';
import { CreateAnnouncementDto, CreateAnnouncementCommentDto } from './dto/create-announcement.dto';
import { UpdateAnnouncementDto } from './dto/update-announcement.dto';

type RequestUser = { id: string; role: string; residenceId?: string | null };

/**
 * Messages prioritaires de la résidence : lecture et commentaires pour tous
 * les habitants, publication réservée aux rôles ADMIN / SUPERADMIN (contrôle
 * fait dans le service — pas d'exigence 2FA, ce n'est pas une action sensible).
 */
@Controller('announcements')
@UseGuards(JwtAuthGuard, StatusGuard)
export class AnnouncementsController {
  constructor(private readonly announcementsService: AnnouncementsService) {}

  @Get()
  async list(@CurrentUser() user: RequestUser, @Query('limit') limit?: string) {
    const parsed = Number(limit);
    return this.announcementsService.list(user, Number.isFinite(parsed) ? parsed : undefined);
  }

  @Post()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  async create(@CurrentUser() user: RequestUser, @Body() dto: CreateAnnouncementDto) {
    return this.announcementsService.create(user, dto);
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
