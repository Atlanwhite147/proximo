import { IsArray, IsEmail, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

/** Création d'une agence : nom, contact facultatif, résidences gérées. */
export class CreateAgencyDto {
  @IsString({ message: 'Nom d’agence invalide' })
  @MinLength(2, { message: 'Nom d’agence trop court' })
  @MaxLength(120, { message: 'Nom d’agence trop long' })
  name!: string;

  @IsOptional()
  @IsEmail({}, { message: 'Email de contact invalide' })
  @MaxLength(160, { message: 'Email trop long' })
  contactEmail?: string;

  @IsOptional()
  @IsArray({ message: 'Liste de résidences invalide' })
  @IsString({ each: true })
  residenceIds?: string[];
}

/** Modification d'une agence : tous les champs sont facultatifs. */
export class UpdateAgencyDto {
  @IsOptional()
  @IsString({ message: 'Nom d’agence invalide' })
  @MinLength(2, { message: 'Nom d’agence trop court' })
  @MaxLength(120, { message: 'Nom d’agence trop long' })
  name?: string;

  @IsOptional()
  @IsEmail({}, { message: 'Email de contact invalide' })
  @MaxLength(160, { message: 'Email trop long' })
  contactEmail?: string;

  @IsOptional()
  @IsArray({ message: 'Liste de résidences invalide' })
  @IsString({ each: true })
  residenceIds?: string[];
}

/**
 * Création d'un compte agence. Le titulaire définit son mot de passe par le
 * lien reçu par email : aucun mot de passe n'est transmis par ce canal.
 */
export class AddAgencyMemberDto {
  @IsEmail({}, { message: 'Adresse email invalide' })
  @MaxLength(160, { message: 'Email trop long' })
  email!: string;

  @IsString({ message: 'Prénom invalide' })
  @MinLength(1, { message: 'Prénom requis' })
  @MaxLength(80, { message: 'Prénom trop long' })
  firstName!: string;

  @IsString({ message: 'Nom invalide' })
  @MinLength(1, { message: 'Nom requis' })
  @MaxLength(80, { message: 'Nom trop long' })
  lastName!: string;
}
