import { cn } from '@/lib/utils';

/**
 * SectionLabel — badge de section avec point pulsant (● VIE DE RÉSIDENCE).
 * Typographie JetBrains Mono, uppercase, tracking large.
 */
export function SectionLabel({
  children,
  className,
  color = 'blue',
}: {
  children: React.ReactNode;
  className?: string;
  color?: 'blue' | 'amber' | 'green' | 'slate';
}) {
  const dotColor = {
    blue: 'bg-primary',
    amber: 'bg-amber-500',
    green: 'bg-emerald-500',
    slate: 'bg-slate-400',
  }[color];

  const textColor = {
    blue: 'text-primary',
    amber: 'text-amber-600',
    green: 'text-emerald-600',
    slate: 'text-slate-500',
  }[color];

  return (
    <span
      className={cn(
        'inline-flex items-center gap-2 font-mono text-xs font-semibold uppercase tracking-badge',
        textColor,
        className,
      )}
    >
      <span className="relative flex h-2 w-2">
        <span
          aria-hidden
          className={cn(
            'absolute inline-flex h-full w-full animate-ping rounded-full opacity-60',
            dotColor,
          )}
        />
        <span aria-hidden className={cn('relative inline-flex h-2 w-2 rounded-full', dotColor)} />
      </span>
      {children}
    </span>
  );
}
