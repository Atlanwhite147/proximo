import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Listing, Prisma } from '@prisma/client';
import { GeocodingService } from '../geocoding/geocoding.service';
import { EmailService } from '../email/email.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateListingDto } from './dto/create-listing.dto';
import { QueryListingsDto } from './dto/query-listings.dto';
import { UpdateListingDto } from './dto/update-listing.dto';
import {
  buildListingWhere,
  distanceSql,
  ListingResponse,
  RawListingRow,
  toListingResponse,
} from './listing.types';

/** Colonnes sélectionnées sans distance (liste simple). */
const baseColumns = Prisma.sql`
  l."id", l."title", l."description", l."category", l."status",
  l."neighborhood", l."createdAt", l."ownerId",
  u."firstName" AS "ownerFirstName", u."neighborhood" AS "ownerNeighborhood",
  u."building" AS "ownerBuilding", u."floor" AS "ownerFloor", u."showDetails" AS "ownerShowDetails",
  (SELECT COUNT(*)::int FROM "Comment" c WHERE c."listingId" = l."id") AS "commentCount"
`;

/** Colonnes sélectionnées avec distance PostGIS (mètres). */
function withDistanceColumns(lat: number, lng: number): Prisma.Sql {
  return Prisma.sql`
    l."id", l."title", l."description", l."category", l."status",
    l."neighborhood", l."createdAt", l."ownerId",
    u."firstName" AS "ownerFirstName", u."neighborhood" AS "ownerNeighborhood",
    u."building" AS "ownerBuilding", u."floor" AS "ownerFloor", u."showDetails" AS "ownerShowDetails",
    (SELECT COUNT(*)::int FROM "Comment" c WHERE c."listingId" = l."id") AS "commentCount",
    ${distanceSql(lat, lng)} AS "distanceMeters"
  `;
}

const orderByDistance = Prisma.sql`ORDER BY "distanceMeters" ASC`;
const orderByDateDesc = Prisma.sql`ORDER BY l."createdAt" DESC`;

/**
 * Gestion des annonces d'entraide.
 * Localisation : géocodage (adresse libre) ou coordonnées manuelles ;
 * recherche par périmètre via PostGIS (ST_DWithin), tri par distance.
 */
@Injectable()
export class ListingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly geocoding: GeocodingService,
    private readonly emailService: EmailService,
  ) {}

  /** Nom de résidence configuré (settings singleton) — repli silencieux. */
  private async getResidenceName(): Promise<string | null> {
    try {
      const settings = await this.prisma.syndicSettings.findUnique({ where: { id: 1 } });
      return settings?.residenceName ?? null;
    } catch {
      return null;
    }
  }

  /** Annonces de l'utilisateur (profil). */
  async findMine(userId: string): Promise<ListingResponse[]> {
    const residenceName = await this.getResidenceName();
    const rows = await this.prisma.$queryRaw<RawListingRow[]>`
      SELECT l.id, l.title, l.description, l.category, l.status, l.neighborhood,
             l."createdAt", l."ownerId",
             u."firstName" AS "ownerFirstName", u.neighborhood AS "ownerNeighborhood",
             u."building" AS "ownerBuilding", u."floor" AS "ownerFloor",
             u."showDetails" AS "ownerShowDetails"
      FROM "Listing" l
      JOIN "User" u ON u.id = l."ownerId"
      WHERE l."ownerId" = ${userId}
      ORDER BY l."createdAt" DESC
    `;
    return rows.map((row) => toListingResponse(row, undefined, residenceName));
  }

  /** Crée une annonce pour l'utilisateur connecté. */
  async create(ownerId: string, dto: CreateListingDto): Promise<ListingResponse> {
    // Repli : sans localisation fournie, on utilise la résidence de l'utilisateur
    // (la géolocalisation n'est plus requise à l'échelle d'un immeuble), puis
    // le nom de résidence configuré (settings) en dernier recours.
    const user = await this.prisma.user.findUnique({
      where: { id: ownerId },
      select: { neighborhood: true, residenceId: true },
    });
    const residenceName = await this.getResidenceName();
    const effectiveDto: CreateListingDto = {
      ...dto,
      neighborhood:
        dto.neighborhood?.trim() ||
        user?.neighborhood?.trim() ||
        residenceName?.trim() ||
        undefined,
    };
    const location = await this.resolveLocation(effectiveDto);

    const listing = await this.prisma.listing.create({
      data: {
        title: dto.title.trim(),
        description: dto.description.trim(),
        category: dto.category,
        lat: location.lat,
        lng: location.lng,
        address: location.address,
        neighborhood: location.neighborhood,
        ownerId,
        residenceId: user?.residenceId ?? null,
      },
    });

    // Préférence « afficher mes détails » choisie au dépôt → profil.
    if (dto.showDetails !== undefined) {
      await this.prisma.user.update({
        where: { id: ownerId },
        data: { showDetails: dto.showDetails },
      });
    }

    // Option « notifier la résidence par email » (défaut : désactivé).
    if (dto.notifyResidence === true) {
      const author = await this.prisma.user.findUnique({
        where: { id: ownerId },
        select: { firstName: true },
      });
      await this.emailService.sendListingToResidents(
        { id: listing.id, title: listing.title, description: listing.description },
        author?.firstName ?? '',
        user?.residenceId ?? null,
      );
    }

    return this.findOne(listing.id, ownerId);
  }

  /** Recherche paginée, avec périmètre géographique optionnel. */
  async findAll(
    query: QueryListingsDto,
    viewerId?: string,
    residenceId?: string | null,
  ): Promise<{ items: ListingResponse[]; total: number; page: number; limit: number }> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const hasGeo =
      typeof query.lat === 'number' &&
      typeof query.lng === 'number' &&
      typeof query.radiusKm === 'number';

    const where = buildListingWhere({
      category: query.category,
      search: query.search,
      lat: query.lat,
      lng: query.lng,
      radiusKm: query.radiusKm,
      residenceId,
    });

    const selectColumns = hasGeo
      ? withDistanceColumns(query.lat as number, query.lng as number)
      : baseColumns;
    const orderBy = hasGeo ? orderByDistance : orderByDateDesc;

    const rows = await this.prisma.$queryRaw<RawListingRow[]>(
      Prisma.sql`
        SELECT ${selectColumns}
        FROM "Listing" l
        JOIN "User" u ON u."id" = l."ownerId"
        ${where}
        ${orderBy}
        LIMIT ${limit} OFFSET ${(page - 1) * limit}
      `,
    );

    const totalRows = await this.prisma.$queryRaw<Array<{ count: bigint }>>(
      Prisma.sql`
        SELECT COUNT(*)::bigint AS count
        FROM "Listing" l
        JOIN "User" u ON u."id" = l."ownerId"
        ${where}
      `,
    );
    const total = Number(totalRows[0]?.count ?? 0);

    const residenceName = await this.getResidenceName();
    return {
      items: rows.map((row) => toListingResponse(row, viewerId, residenceName)),
      total,
      page,
      limit,
    };
  }

  /** Détail d'une annonce (les annonces fermées restent visibles sur leur lien direct). */
  async findOne(
    id: string,
    viewerId?: string,
    residenceId?: string | null,
  ): Promise<ListingResponse> {
    const rows = await this.prisma.$queryRaw<RawListingRow[]>(
      Prisma.sql`
        SELECT ${baseColumns}
        FROM "Listing" l
        JOIN "User" u ON u."id" = l."ownerId"
        WHERE l."id" = ${id}
          ${residenceId ? Prisma.sql`AND l."residenceId" = ${residenceId}` : Prisma.sql``}
        LIMIT 1
      `,
    );
    const row = rows[0];
    if (!row) {
      throw new NotFoundException('Annonce introuvable');
    }
    const residenceName = await this.getResidenceName();
    return toListingResponse(row, viewerId, residenceName);
  }

  /** Modifie une annonce — propriétaire uniquement. */
  async update(id: string, ownerId: string, dto: UpdateListingDto): Promise<ListingResponse> {
    const listing = await this.getOwned(id, ownerId);

    let lat = listing.lat;
    let lng = listing.lng;
    let address = listing.address;
    let neighborhood = listing.neighborhood;

    // Si une nouvelle adresse est fournie, on re-géocode.
    if (dto.address?.trim()) {
      const location = await this.resolveLocation(dto);
      lat = location.lat;
      lng = location.lng;
      address = location.address;
      neighborhood = location.neighborhood;
    } else if (dto.lat !== undefined && dto.lng !== undefined && dto.neighborhood?.trim()) {
      lat = dto.lat;
      lng = dto.lng;
      neighborhood = dto.neighborhood.trim();
    }

    await this.prisma.listing.update({
      where: { id },
      data: {
        title: dto.title?.trim(),
        description: dto.description?.trim(),
        category: dto.category,
        status: dto.status,
        lat,
        lng,
        address,
        neighborhood,
      },
    });

    return this.findOne(id, ownerId);
  }

  /** Supprime une annonce — propriétaire uniquement. */
  async remove(id: string, ownerId: string): Promise<void> {
    await this.getOwned(id, ownerId);
    await this.prisma.listing.delete({ where: { id } });
  }

  /** Récupère une annonce et vérifie qu'elle appartient à l'utilisateur. */
  private async getOwned(id: string, ownerId: string): Promise<Listing> {
    const listing = await this.prisma.listing.findUnique({ where: { id } });
    if (!listing) {
      throw new NotFoundException('Annonce introuvable');
    }
    if (listing.ownerId !== ownerId) {
      throw new ForbiddenException('Vous ne pouvez pas modifier cette annonce');
    }
    return listing;
  }

  /**
   * Détermine la localisation d'une annonce.
   * Voie 1 : géocodage de l'adresse (quartier déduit par géocodage inverse).
   * Voie 2 (repli) : coordonnées + quartier fournis manuellement.
   */
  private async resolveLocation(dto: {
    address?: string;
    lat?: number;
    lng?: number;
    neighborhood?: string;
  }): Promise<{ lat: number; lng: number; address: string; neighborhood: string }> {
    if (dto.address?.trim()) {
      const address = dto.address.trim();
      const geocoded = await this.geocoding.geocode(address);
      let neighborhood = dto.neighborhood?.trim();
      if (!neighborhood) {
        try {
          neighborhood = await this.geocoding.reverse(geocoded.lat, geocoded.lng);
        } catch {
          neighborhood = geocoded.displayName;
        }
      }
      return {
        lat: geocoded.lat,
        lng: geocoded.lng,
        address,
        neighborhood: neighborhood || geocoded.displayName,
      };
    }

    if (typeof dto.lat === 'number' && typeof dto.lng === 'number' && dto.neighborhood?.trim()) {
      return {
        lat: dto.lat,
        lng: dto.lng,
        address: '',
        neighborhood: dto.neighborhood.trim(),
      };
    }

    // Résidence sans géolocalisation : pas de coordonnées précises
    // (jamais exposées publiquement de toute façon).
    if (dto.neighborhood?.trim()) {
      return {
        lat: 0,
        lng: 0,
        address: '',
        neighborhood: dto.neighborhood.trim(),
      };
    }

    throw new BadRequestException(
      'Indiquez le nom de la résidence (ou une adresse pour la géolocalisation automatique)',
    );
  }
}
