import { IsBoolean, IsEmail, IsOptional, IsString, MaxLength } from 'class-validator';

/**
 * Mise à jour du profil / réglages de notification.
 */
export class UpdateProfileDto {
  @IsOptional()
  @IsString({ message: 'Prénom invalide' })
  @MaxLength(50, { message: 'Prénom trop long' })
  firstName?: string;

  @IsOptional()
  @IsString({ message: 'Nom invalide' })
  @MaxLength(50, { message: 'Nom trop long' })
  lastName?: string;

  @IsOptional()
  @IsString({ message: 'Quartier invalide' })
  @MaxLength(120, { message: 'Quartier trop long' })
  neighborhood?: string;

  @IsOptional()
  @IsString({ message: 'Bâtiment invalide' })
  @MaxLength(20, { message: 'Bâtiment trop long' })
  building?: string;

  @IsOptional()
  @IsString({ message: 'Étage invalide' })
  @MaxLength(20, { message: 'Étage trop long' })
  floor?: string;

  @IsOptional()
  @IsBoolean({ message: 'Visibilité invalide' })
  showDetails?: boolean;

  @IsOptional()
  @IsBoolean({ message: 'Visibilité invalide' })
  showInDirectory?: boolean;

  @IsOptional()
  @IsEmail({}, { message: 'Adresse email invalide' })
  @MaxLength(254, { message: 'Adresse email trop longue' })
  email?: string;

  @IsOptional()
  emailNotifications?: boolean;
}
