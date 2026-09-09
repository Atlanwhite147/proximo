import { IsString, Length, Matches } from 'class-validator';

/** Réinitialisation avec le jeton reçu par email + nouveau mot de passe. */
export class ResetPasswordDto {
  @IsString({ message: 'Jeton invalide' })
  @Length(20, 200, { message: 'Jeton invalide' })
  token!: string;

  @IsString({ message: 'Mot de passe requis' })
  @Length(8, 128, { message: 'Le mot de passe doit contenir entre 8 et 128 caractères' })
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).+$/, {
    message: 'Le mot de passe doit contenir une minuscule, une majuscule et un chiffre',
  })
  password!: string;
}
