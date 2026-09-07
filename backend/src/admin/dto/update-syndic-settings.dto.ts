import { IsBoolean, IsEmail, IsOptional, IsString, Matches, MaxLength } from 'class-validator';
import { Transform } from 'class-transformer';

/**
 * Réglages de la résidence (nom, agence, email de réception des signalements)
 * + notifications par email, gérés par l'admin de SA résidence (ou le
 * superadmin pour toutes). `residenceCode` : superadmin uniquement.
 */
export class UpdateSyndicSettingsDto {
  @IsOptional()
  @IsString({ message: 'Nom d’agence invalide' })
  @MaxLength(120, { message: 'Nom d’agence trop long' })
  agencyName?: string;

  @IsOptional()
  @IsEmail({}, { message: 'Email du syndic invalide' })
  @MaxLength(160, { message: 'Email trop long' })
  email?: string;

  @IsOptional()
  @IsString({ message: 'Nom de résidence invalide' })
  @MaxLength(120, { message: 'Nom de résidence trop long' })
  residenceName?: string;

  @IsOptional()
  @IsString({ message: 'Code de résidence invalide' })
  @Matches(/^[A-Za-z0-9-]{4,32}$/, {
    message: 'Code de résidence invalide (4 à 32 caractères, lettres, chiffres, tirets)',
  })
  residenceCode?: string;

  /** Envoyer un email à l'agence (syndicEmail) à chaque nouveau signalement. */
  @IsOptional()
  @Transform(({ value }) => (value === 'true' || value === true ? true : false))
  @IsBoolean({ message: 'Option de notification invalide' })
  notifyAgencyOnIncident?: boolean;

  /** Prévenir les habitants par email à chaque nouveau signalement. */
  @IsOptional()
  @Transform(({ value }) => (value === 'true' || value === true ? true : false))
  @IsBoolean({ message: 'Option de notification invalide' })
  notifyResidentsOnIncident?: boolean;

  /** Envoyer aux habitants les annonces quand l'auteur coche « notifier la résidence ». */
  @IsOptional()
  @Transform(({ value }) => (value === 'true' || value === true ? true : false))
  @IsBoolean({ message: 'Option de notification invalide' })
  notifyResidentsOnListing?: boolean;
}
