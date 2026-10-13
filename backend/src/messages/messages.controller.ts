import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { StatusGuard } from '../common/guards/status.guard';
import { CreateMessageDto } from './dto/create-message.dto';
import { OpenConversationDto } from './dto/open-conversation.dto';
import { MessagesService } from './messages.service';

/**
 * Messagerie entre voisins — routes protégées et fortement limitées en débit.
 */
@Controller('messages')
@UseGuards(JwtAuthGuard, StatusGuard)
export class MessagesController {
  constructor(private readonly messagesService: MessagesService) {}

  @Post()
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @HttpCode(HttpStatus.CREATED)
  async send(@CurrentUser() user: { id: string }, @Body() dto: CreateMessageDto) {
    return this.messagesService.send(user.id, dto);
  }

  /**
   * Ouvre (ou crée) la conversation avec un voisin SANS envoyer de message.
   * Déclaré avant les routes à paramètre (`:id`) pour ne pas être intercepté.
   */
  @Post('conversations')
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @HttpCode(HttpStatus.OK)
  async openConversation(@CurrentUser() user: { id: string }, @Body() dto: OpenConversationDto) {
    return this.messagesService.openConversation(user.id, dto);
  }

  @Get()
  async conversations(@CurrentUser() user: { id: string }) {
    const conversations = await this.messagesService.listConversations(user.id);
    return { conversations };
  }

  @Get(':id')
  async messages(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: { id: string },
    @Query('limit') limit?: string,
  ) {
    const parsedLimit = Math.min(Number(limit) || 50, 100);
    return this.messagesService.listMessages(id, user.id, parsedLimit);
  }

  @Post(':id/read')
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @HttpCode(HttpStatus.OK)
  async markRead(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: { id: string }) {
    return this.messagesService.markRead(id, user.id);
  }
}
