import { IsBoolean, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

/**
 * Création d'une invitation (lien partageable + QR code).
 * `neighborhood` sert de RÉFÉRENCE interne pour identifier l'invitation dans
 * l'admin (ex. « Famille Martin — Bât. B »). Optionnel : si vide, la liste
 * admin affiche une étiquette générique. Le jeton est à usage unique et
 * expire (défaut : 72 h). `multiUse` = invitation d'affiche : usage illimité
 * jusqu'à expiration (jusqu'à 3 mois).
 */
export class CreateInvitationDto {
  @IsOptional()
  @IsString({ message: 'Référence invalide' })
  @MaxLength(120, { message: 'Référence trop longue (120 caractères max)' })
  neighborhood?: string;

  @IsOptional()
  @IsInt({ message: 'Durée invalide' })
  @Min(1, { message: 'Durée minimale : 1 heure' })
  @Max(2160, { message: 'Durée maximale : 2160 heures (90 jours)' })
  expiresInHours?: number;

  /** Invitation d'affiche : utilisable par tous les habitants jusqu'à expiration. */
  @IsOptional()
  @IsBoolean({ message: 'Mode invalide' })
  multiUse?: boolean;
}
