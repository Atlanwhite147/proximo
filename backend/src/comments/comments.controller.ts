import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { StatusGuard } from '../common/guards/status.guard';
import { CommentsService } from './comments.service';
import { CreateCommentDto } from './dto/create-comment.dto';

/**
 * Discussions publiques attachées aux annonces et signalements.
 * Routes protégées (JWT + statut ACTIVE) — lecture et écriture réservées
 * aux habitants de la résidence.
 */
@Controller('comments')
@UseGuards(JwtAuthGuard, StatusGuard)
export class CommentsController {
  constructor(private readonly commentsService: CommentsService) {}

  /** Commentaires d'une annonce. */
  @Get('listing/:listingId')
  async listForListing(
    @Param('listingId', ParseUUIDPipe) listingId: string,
    @CurrentUser() user: { residenceId?: string | null },
  ) {
    const comments = await this.commentsService.listForListing(listingId, user.residenceId);
    return { comments };
  }

  /** Commentaires d'un signalement. */
  @Get('incident/:incidentId')
  async listForIncident(
    @Param('incidentId', ParseUUIDPipe) incidentId: string,
    @CurrentUser() user: { residenceId?: string | null },
  ) {
    const comments = await this.commentsService.listForIncident(incidentId, user.residenceId);
    return { comments };
  }

  /** Publie un commentaire (sur une annonce OU un signalement). */
  @Post()
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @HttpCode(HttpStatus.CREATED)
  async create(
    @CurrentUser() user: { id: string; residenceId?: string | null },
    @Body() dto: CreateCommentDto,
  ) {
    const comment = await this.commentsService.create(user.id, user.residenceId, dto);
    return { comment };
  }

  /** Supprime un commentaire (auteur ou admin). */
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: { id: string; role: string },
  ) {
    await this.commentsService.remove(id, user);
  }
}
