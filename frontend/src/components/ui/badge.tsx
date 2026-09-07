import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

/**
 * Badge — petit libellé de statut / étiquette mono.
 * Variants : neutral / amber / blue / green / red (+ soft par défaut).
 */
const badgeVariants = cva(
  'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 font-mono text-[11px] font-medium uppercase tracking-badge',
  {
    variants: {
      variant: {
        neutral: 'bg-slate-100 text-slate-600',
        amber: 'bg-amber-50 text-amber-700',
        blue: 'bg-primary-50 text-primary-700',
        green: 'bg-emerald-50 text-emerald-700',
        red: 'bg-red-50 text-red-600',
      },
    },
    defaultVariants: { variant: 'neutral' },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {
  dot?: boolean;
}

export function Badge({ className, variant, dot, children, ...props }: BadgeProps) {
  return (
    <span className={cn(badgeVariants({ variant }), className)} {...props}>
      {dot && (
        <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-current opacity-70" />
      )}
      {children}
    </span>
  );
}

export { badgeVariants };
