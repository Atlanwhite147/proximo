import { IsEmail, MaxLength } from 'class-validator';

/** Demande de réinitialisation : seul l'email est nécessaire. */
export class ForgotPasswordDto {
  @IsEmail({}, { message: 'Adresse email invalide' })
  @MaxLength(254, { message: 'Adresse email trop longue' })
  email!: string;
}
