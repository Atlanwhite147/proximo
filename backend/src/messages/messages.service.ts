import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Conversation, Message } from '@prisma/client';
import { EmailService } from '../email/email.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateMessageDto } from './dto/create-message.dto';

/**
 * Messagerie simple entre voisins : conversations 1-1, pagination,
 * marquage des messages reçus comme lus.
 * Un même couple d'utilisateurs n'a qu'une seule conversation
 * (clé unique sur les deux ids triés par ordre lexicographique).
 */
@Injectable()
export class MessagesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly emailService: EmailService,
  ) {}

  /** Envoie un message : crée la conversation si elle n'existe pas. */
  async send(
    senderId: string,
    dto: CreateMessageDto,
  ): Promise<{
    conversationId: string;
    message: Message;
  }> {
    if (dto.recipientId === senderId) {
      throw new BadRequestException('Vous ne pouvez pas vous écrire à vous-même');
    }

    // Anti-spam : aucun lien externe dans les messages.
    if (/https?:\/\//i.test(dto.content)) {
      throw new BadRequestException('Les liens ne sont pas autorisés dans les messages');
    }

    const recipient = await this.prisma.user.findUnique({
      where: { id: dto.recipientId },
      select: { id: true, residenceId: true },
    });
    if (!recipient) {
      throw new NotFoundException('Destinataire introuvable');
    }

    // Isolation multi-résidences : on n'écrit qu'aux habitants de SA résidence
    // (le SUPERADMIN reste libre pour la gestion de la plateforme).
    const sender = await this.prisma.user.findUnique({
      where: { id: senderId },
      select: { residenceId: true, role: true },
    });
    const sameResidence =
      !!sender?.residenceId &&
      !!recipient.residenceId &&
      sender.residenceId === recipient.residenceId;
    if (!sameResidence && sender?.role !== 'SUPERADMIN') {
      throw new NotFoundException('Destinataire introuvable');
    }

    const conversation = await this.ensureConversation(senderId, dto.recipientId);

    const message = await this.prisma.message.create({
      data: {
        conversationId: conversation.id,
        senderId,
        content: dto.content.trim(),
      },
    });

    await this.prisma.conversation.update({
      where: { id: conversation.id },
      data: { updatedAt: new Date() },
    });

    // Notification email au destinataire (si activée dans ses réglages).
    await this.notifyRecipient(senderId, dto.recipientId, message.content);

    return { conversationId: conversation.id, message };
  }

  /** Envoie un email de notification au destinataire (réglage utilisateur). */
  private async notifyRecipient(
    senderId: string,
    recipientId: string,
    content: string,
  ): Promise<void> {
    const recipient = await this.prisma.user.findUnique({
      where: { id: recipientId },
      select: { email: true, emailNotifications: true, firstName: true },
    });
    const sender = await this.prisma.user.findUnique({
      where: { id: senderId },
      select: { firstName: true },
    });
    if (!recipient?.emailNotifications || !sender) {
      return;
    }
    const preview = content.length > 120 ? `${content.slice(0, 120)}…` : content;
    await this.emailService.sendNewMessage(recipient.email, sender.firstName, preview);
  }

  /** Liste les conversations de l'utilisateur (avec dernier message et non-lus). */
  async listConversations(userId: string) {
    const conversations = await this.prisma.conversation.findMany({
      where: { OR: [{ userAId: userId }, { userBId: userId }] },
      orderBy: { updatedAt: 'desc' },
      include: {
        userA: { select: { id: true, firstName: true, neighborhood: true } },
        userB: { select: { id: true, firstName: true, neighborhood: true } },
        messages: { orderBy: { createdAt: 'desc' }, take: 1 },
        _count: {
          select: {
            messages: { where: { readAt: null, senderId: { not: userId } } },
          },
        },
      },
    });

    return conversations.map((conversation) => ({
      id: conversation.id,
      otherUser: conversation.userAId === userId ? conversation.userB : conversation.userA,
      lastMessage: conversation.messages[0] ?? null,
      unreadCount: conversation._count.messages,
      updatedAt: conversation.updatedAt,
    }));
  }

  /** Messages d'une conversation (participants uniquement) ; marque les reçus comme lus. */
  async listMessages(conversationId: string, userId: string, limit = 50) {
    const conversation = await this.getParticipantConversation(conversationId, userId);

    // Marque d'abord comme lus les messages reçus (pas les siens) :
    // la réponse reflète ainsi immédiatement l'état « lu ».
    await this.prisma.message.updateMany({
      where: { conversationId: conversation.id, senderId: { not: userId }, readAt: null },
      data: { readAt: new Date() },
    });

    const messages = await this.prisma.message.findMany({
      where: { conversationId: conversation.id },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    return { conversationId: conversation.id, messages: messages.reverse() };
  }

  /** Marque tous les messages reçus d'une conversation comme lus. */
  async markRead(conversationId: string, userId: string): Promise<{ success: true }> {
    const conversation = await this.getParticipantConversation(conversationId, userId);
    await this.prisma.message.updateMany({
      where: { conversationId: conversation.id, senderId: { not: userId }, readAt: null },
      data: { readAt: new Date() },
    });
    return { success: true };
  }

  /** Récupère (ou crée) la conversation entre deux utilisateurs. */
  private async ensureConversation(userId: string, otherId: string): Promise<Conversation> {
    const [userAId, userBId] = [userId, otherId].sort();
    return this.prisma.conversation.upsert({
      where: { userAId_userBId: { userAId, userBId } },
      create: { userAId, userBId },
      update: {},
    });
  }

  /** Vérifie que l'utilisateur est participant de la conversation. */
  private async getParticipantConversation(
    conversationId: string,
    userId: string,
  ): Promise<Conversation> {
    const conversation = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
    });
    if (!conversation) {
      throw new NotFoundException('Conversation introuvable');
    }
    if (conversation.userAId !== userId && conversation.userBId !== userId) {
      throw new ForbiddenException('Accès refusé à cette conversation');
    }
    return conversation;
  }
}
