import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

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

  /**
   * Résidence destinataire : utilisée par le superadministrateur et par un
   * compte agence (qui publie dans une de ses résidences). Le format n'est pas
   * imposé (les résidences existantes ont des identifiants textuels) : la
   * résidence est vérifiée en base, et le périmètre de l'agence avec elle.
   */
  @IsOptional()
  @IsString({ message: 'Identifiant de résidence invalide' })
  @MaxLength(120, { message: 'Identifiant de résidence trop long' })
  residenceId?: string;
}

/** Commentaire d'un message prioritaire (ouvert à tous les habitants). */
export class CreateAnnouncementCommentDto {
  @IsString({ message: 'Commentaire invalide' })
  @MinLength(1, { message: 'Le commentaire ne peut pas être vide' })
  @MaxLength(1000, { message: 'Commentaire trop long (1000 caractères max.)' })
  content!: string;
}
