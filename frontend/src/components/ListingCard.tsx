import Link from 'next/link';
import { listingCategoryVisual } from '@/lib/category';
import { cn } from '@/lib/utils';
import { CATEGORY_LABELS, CATEGORY_EMOJI, Listing } from '@/lib/types';
import { formatDistance, formatLocation, formatRelativeDate } from '@/lib/format';

/**
 * Carte d'annonce du design system — Minimalist Modern.
 * - Liseré latéral + badge colorés selon la catégorie (token sémantique)
 * - Badge commentaires 💬 (discussion active)
 * - Interaction hover : élévation douce + titre teinté Electric Blue
 */
export function ListingCard({ listing }: { listing: Listing }) {
  const visual = listingCategoryVisual(listing.category);

  return (
    <Link
      href={`/annonces/${listing.id}`}
      className={cn(
        'group relative flex flex-col overflow-hidden rounded-2xl border border-border bg-card p-5 pl-6 shadow-card transition-all duration-200 hover:-translate-y-0.5 hover:shadow-card-hover',
      )}
    >
      {/* Liseré catégorie (gauche) */}
      <span
        aria-hidden
        className="absolute inset-y-0 left-0 w-1"
        style={{ backgroundColor: visual.color }}
      />
      <div className="mb-2 flex items-center justify-between gap-2">
        <span
          className={cn(
            'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 font-mono text-[11px] font-medium uppercase tracking-badge',
            visual.soft,
            visual.border,
            visual.text,
          )}
        >
          <span aria-hidden>{CATEGORY_EMOJI[listing.category]}</span>
          {CATEGORY_LABELS[listing.category]}
        </span>
        {listing.distanceKm !== undefined && (
          <span className="font-mono text-[11px] text-muted-foreground">
            à {formatDistance(listing.distanceKm)}
          </span>
        )}
      </div>

      <h3 className="font-sans text-base font-semibold leading-snug text-foreground transition-colors group-hover:text-primary">
        {listing.title}
      </h3>
      <p className="mt-1 line-clamp-2 flex-1 text-sm leading-relaxed text-muted-foreground">
        {listing.description}
      </p>

      <div className="mt-4 flex items-center justify-between gap-2 border-t border-border/70 pt-3 text-xs text-muted-foreground">
        <span className="truncate">
          {formatLocation(
            listing.residenceName,
            listing.neighborhood,
            listing.owner.building,
            listing.owner.floor,
            listing.owner.showDetails,
          )}{' '}
          · {listing.owner.firstName}
        </span>
        <span className="flex shrink-0 items-center gap-2">
          {typeof listing.commentCount === 'number' && listing.commentCount > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full bg-primary-50 px-2 py-0.5 font-mono text-[11px] font-semibold text-primary-700">
              💬 {listing.commentCount}
            </span>
          )}
          <span className="font-mono text-[11px]">{formatRelativeDate(listing.createdAt)}</span>
        </span>
      </div>
    </Link>
  );
}
