import {
  IsBoolean,
  IsEmail,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import { Transform } from 'class-transformer';

/**
 * Réglages d'envoi d'emails (singleton EmailSettings).
 *
 * Règles :
 * - `brevoApiKey`, `smtpPass` : si LAISSÉS VIDES lors d'une mise à jour,
 *   la valeur existante est conservée (on ne peut pas relire un secret).
 * - `mode` : 'brevo' | 'smtp' | 'log' (journal de dev, aucun envoi).
 * - La validation applicative (ex. clé Brevo requise si mode=brevo) est
 *   faite dans le service, pas ici — on ne bloque pas l'enregistrement
 *   d'une config partielle (l'utilisateur peut vouloir tout préparer).
 */
export class UpdateEmailSettingsDto {
  @IsOptional()
  @IsIn(['brevo', 'smtp', 'log'], { message: 'Mode d’envoi invalide' })
  mode?: 'brevo' | 'smtp' | 'log';

  @IsOptional()
  @IsString({ message: 'Nom d’expéditeur invalide' })
  @MaxLength(120, { message: 'Nom d’expéditeur trop long' })
  fromName?: string;

  @IsOptional()
  @IsEmail({}, { message: 'Email d’expéditeur invalide' })
  @MaxLength(160, { message: 'Email trop long' })
  fromEmail?: string;

  @IsOptional()
  @IsString({ message: 'Clé API Brevo invalide' })
  @MaxLength(200, { message: 'Clé API Brevo trop longue' })
  brevoApiKey?: string;

  @IsOptional()
  @IsString({ message: 'Hôte SMTP invalide' })
  @MaxLength(200, { message: 'Hôte SMTP trop long' })
  smtpHost?: string;

  @IsOptional()
  @Transform(({ value }) =>
    value === '' || value === null || value === undefined ? undefined : Number(value),
  )
  @IsInt({ message: 'Port SMTP invalide' })
  @Min(1, { message: 'Port SMTP invalide' })
  smtpPort?: number;

  @IsOptional()
  @Transform(({ value }) => (value === 'true' || value === true ? true : false))
  @IsBoolean({ message: 'Option SMTP Secure invalide' })
  smtpSecure?: boolean;

  @IsOptional()
  @IsString({ message: 'Utilisateur SMTP invalide' })
  @MaxLength(200, { message: 'Utilisateur SMTP trop long' })
  smtpUser?: string;

  @IsOptional()
  @IsString({ message: 'Mot de passe SMTP invalide' })
  @MaxLength(200, { message: 'Mot de passe SMTP trop long' })
  smtpPass?: string;
}
