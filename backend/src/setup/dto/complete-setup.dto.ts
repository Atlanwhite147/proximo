import { Transform } from 'class-transformer';
import { IsEmail, IsOptional, IsString, Length, Matches, MaxLength } from 'class-validator';

/**
 * Configuration initiale (premier lancement).
 * `agencyName` et `syndicEmail` sont optionnels : sans agence renseignée,
 * les signalements utilisent les valeurs par défaut du service.
 */
export class CompleteSetupDto {
  @IsEmail({}, { message: 'Adresse email invalide' })
  @MaxLength(254, { message: 'Adresse email trop longue' })
  adminEmail!: string;

  @IsString({ message: 'Mot de passe requis' })
  @Length(8, 128, { message: 'Le mot de passe doit contenir entre 8 et 128 caractères' })
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).+$/, {
    message: 'Le mot de passe doit contenir une minuscule, une majuscule et un chiffre',
  })
  adminPassword!: string;

  @IsString({ message: 'Prénom requis' })
  @Length(1, 50, { message: 'Prénom invalide' })
  firstName!: string;

  @IsString({ message: 'Nom requis' })
  @Length(1, 50, { message: 'Nom invalide' })
  lastName!: string;

  @IsString({ message: 'Nom de résidence requis' })
  @Length(1, 120, { message: 'Nom de résidence invalide' })
  residenceName!: string;

  /** Code d'accès de la résidence (généré depuis le nom si absent). */
  @IsOptional()
  @IsString({ message: 'Code de résidence invalide' })
  @Length(1, 32, { message: 'Code de résidence invalide' })
  residenceCode?: string;

  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString({ message: 'Nom d’agence invalide' })
  @MaxLength(120, { message: 'Nom d’agence trop long' })
  agencyName?: string;

  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsEmail({}, { message: 'Email du syndic invalide' })
  @MaxLength(254, { message: 'Email du syndic trop long' })
  syndicEmail?: string;
}
