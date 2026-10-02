import { IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';

/** Publication d'un message prioritaire (réservée aux admins). */
export class CreateAnnouncementDto {
  @IsString({ message: 'Titre invalide' })
  @MinLength(3, { message: 'Le titre doit contenir au moins 3 caractères' })
  @MaxLength(120, { message: 'Titre trop long (120 caractères max.)' })
  title!: string;

  @IsString({ message: 'Message invalide' })
  @MinLength(1, { message: 'Le message ne peut pas être vide' })
  @MaxLength(4000, { message: 'Message trop long (4000 caractères max.)' })
  body!: string;

  /** SUPERADMIN uniquement : publier pour une autre résidence. */
  @IsOptional()
  @IsUUID('4', { message: 'Identifiant de résidence invalide' })
  residenceId?: string;
}

/** Commentaire d'un message prioritaire (ouvert à tous les habitants). */
export class CreateAnnouncementCommentDto {
  @IsString({ message: 'Commentaire invalide' })
  @MinLength(1, { message: 'Le commentaire ne peut pas être vide' })
  @MaxLength(1000, { message: 'Commentaire trop long (1000 caractères max.)' })
  content!: string;
}
