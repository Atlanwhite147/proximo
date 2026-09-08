import { IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

/**
 * Création d'une invitation (lien partageable + QR code).
 * `neighborhood` sert de RÉFÉRENCE interne pour identifier l'invitation dans
 * l'admin (ex. « Famille Martin — Bât. B »). Optionnel : si vide, la liste
 * admin affiche une étiquette générique. Le jeton est à usage unique et
 * expire (défaut : 72 h).
 */
export class CreateInvitationDto {
  @IsOptional()
  @IsString({ message: 'Référence invalide' })
  @MaxLength(120, { message: 'Référence trop longue (120 caractères max)' })
  neighborhood?: string;

  @IsOptional()
  @IsInt({ message: 'Durée invalide' })
  @Min(1, { message: 'Durée minimale : 1 heure' })
  @Max(168, { message: 'Durée maximale : 168 heures (7 jours)' })
  expiresInHours?: number;
}
