import { Prisma } from '@prisma/client';

/**
 * Ligne brute retournée par les requêtes géographiques ($queryRaw).
 */
export interface RawListingRow {
  id: string;
  title: string;
  description: string;
  category: string;
  status: string;
  neighborhood: string;
  createdAt: Date;
  ownerId: string;
  ownerFirstName: string;
  ownerNeighborhood: string | null;
  ownerBuilding: string | null;
  ownerFloor: string | null;
  ownerShowDetails: boolean;
  commentCount?: number | null;
  distanceMeters?: number | null;
}

/**
 * Annonce telle qu'exposée par l'API.
 * NB : `lat`, `lng` et `address` ne sont JAMAIS exposés — seule la
 * distance calculée et le quartier sont publics (respect de la vie privée).
 */
export interface ListingResponse {
  id: string;
  title: string;
  description: string;
  category: string;
  status: string;
  neighborhood: string;
  residenceName?: string | null;
  distanceKm?: number;
  commentCount: number;
  isOwner: boolean;
  createdAt: Date;
  owner: {
    id: string;
    firstName: string;
    neighborhood: string | null;
    building: string | null;
    floor: string | null;
    showDetails: boolean;
  };
}

/** Fragment SQL réutilisé pour la distance PostGIS (mètres). */
export function distanceSql(lat: number, lng: number): Prisma.Sql {
  return Prisma.sql`ST_Distance(
    ST_SetSRID(ST_MakePoint(l."lng", l."lat"), 4326)::geography,
    ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)::geography
  )`;
}

/** Fragment SQL réutilisé pour le filtre de périmètre PostGIS. */
export function withinSql(lat: number, lng: number, radiusMeters: number): Prisma.Sql {
  return Prisma.sql`ST_DWithin(
    ST_SetSRID(ST_MakePoint(l."lng", l."lat"), 4326)::geography,
    ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)::geography,
    ${radiusMeters}
  )`;
}

/** Construit la clause WHERE commune aux requêtes d'annonces. */
export function buildListingWhere(query: {
  category?: string;
  search?: string;
  lat?: number;
  lng?: number;
  radiusKm?: number;
  residenceId?: string | null;
}): Prisma.Sql {
  const conditions: Prisma.Sql[] = [Prisma.sql`l."status" = 'OPEN'`];

  // Isolation multi-résidences : chaque habitant ne voit que SA résidence.
  if (query.residenceId) {
    conditions.push(Prisma.sql`l."residenceId" = ${query.residenceId}`);
  }

  if (query.category) {
    conditions.push(Prisma.sql`l."category" = ${query.category}`);
  }

  const search = query.search?.trim();
  if (search) {
    const pattern = `%${search}%`;
    conditions.push(Prisma.sql`(l."title" ILIKE ${pattern} OR l."description" ILIKE ${pattern})`);
  }

  if (
    typeof query.lat === 'number' &&
    typeof query.lng === 'number' &&
    typeof query.radiusKm === 'number'
  ) {
    conditions.push(Prisma.sql`${withinSql(query.lat, query.lng, query.radiusKm * 1000)}`);
  }

  return Prisma.sql`WHERE ${Prisma.join(conditions, ' AND ')}`;
}

/**
 * Transforme une ligne brute en réponse publique (masque les données privées).
 */
export function toListingResponse(
  row: RawListingRow,
  viewerId?: string,
  residenceName?: string | null,
): ListingResponse {
  const distanceMeters = row.distanceMeters;
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    category: row.category,
    status: row.status,
    neighborhood: row.neighborhood,
    residenceName: residenceName ?? row.neighborhood ?? null,
    distanceKm: distanceMeters != null ? Math.round((distanceMeters / 1000) * 10) / 10 : undefined,
    commentCount: Number(row.commentCount ?? 0),
    isOwner: viewerId != null && viewerId === row.ownerId,
    createdAt: row.createdAt,
    owner: {
      id: row.ownerId,
      firstName: row.ownerFirstName,
      neighborhood: row.ownerNeighborhood,
      building: row.ownerBuilding ?? null,
      floor: row.ownerFloor ?? null,
      showDetails: row.ownerShowDetails ?? true,
    },
  };
}
