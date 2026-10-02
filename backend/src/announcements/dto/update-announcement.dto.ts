import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

/** Modification a posteriori d'une annonce officielle (auteur ou admin). */
export class UpdateAnnouncementDto {
  @IsOptional()
  @IsString({ message: 'Titre invalide' })
  @MinLength(3, { message: 'Le titre doit contenir au moins 3 caractères' })
  @MaxLength(120, { message: 'Titre trop long (120 caractères max.)' })
  title?: string;

  @IsOptional()
  @IsString({ message: 'Message invalide' })
  @MinLength(1, { message: 'Le message ne peut pas être vide' })
  @MaxLength(4000, { message: 'Message trop long (4000 caractères max.)' })
  body?: string;
}
