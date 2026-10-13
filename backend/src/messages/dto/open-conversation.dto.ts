import { IsUUID } from 'class-validator';

/**
 * Ouverture (ou création) d'une conversation avec un voisin, SANS message :
 * le bouton « Message » de l'annuaire ouvre le fil ; l'utilisateur écrit
 * ensuite son propre message depuis la page de conversation.
 */
export class OpenConversationDto {
  @IsUUID('4', { message: 'Destinataire invalide' })
  recipientId!: string;
}
