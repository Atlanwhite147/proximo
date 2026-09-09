import { IsBoolean, IsEmail, IsOptional, IsString, Length, Matches, MaxLength } from 'class-validator';

/**
 * Inscription. Validation stricte côté serveur (class-validator).
 * `invitationToken` : lien d'invitation QR (optionnel) — pré-remplit le
 * quartier et consomme le jeton à usage unique.
 */
export class RegisterDto {
  @IsEmail({}, { message: 'Adresse email invalide' })
  @MaxLength(254, { message: 'Adresse email trop longue' })
  email!: string;

  @IsOptional()
  @IsString({ message: 'Mot de passe requis' })
  @Length(8, 128, { message: 'Le mot de passe doit contenir entre 8 et 128 caractères' })
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).+$/, {
    message: 'Le mot de passe doit contenir une minuscule, une majuscule et un chiffre',
  })
  password?: string;

  @IsString({ message: 'Prénom requis' })
  @Length(1, 50, { message: 'Prénom invalide' })
  firstName!: string;

  @IsString({ message: 'Nom requis' })
  @Length(1, 50, { message: 'Nom invalide' })
  lastName!: string;

  @IsOptional()
  @IsString({ message: 'Quartier invalide' })
  @MaxLength(120, { message: 'Quartier trop long' })
  neighborhood?: string;

  @IsOptional()
  @IsString({ message: 'Code de résidence invalide' })
  @MaxLength(32, { message: 'Code de résidence invalide' })
  residenceCode?: string;

  @IsOptional()
  @IsString({ message: 'Bâtiment invalide' })
  @MaxLength(20, { message: 'Bâtiment trop long' })
  building?: string;

  @IsOptional()
  @IsString({ message: 'Étage invalide' })
  @MaxLength(20, { message: 'Étage trop long' })
  floor?: string;

  @IsOptional()
  @IsString({ message: 'Jeton d’invitation invalide' })
  @MaxLength(64, { message: 'Jeton d’invitation invalide' })
  invitationToken?: string;

  /** Choix RGPD : apparaître dans l'annuaire des voisins (défaut : oui). */
  @IsOptional()
  @IsBoolean({ message: 'Visibilité invalide' })
  showInDirectory?: boolean;
}
