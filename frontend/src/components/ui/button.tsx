import Link from 'next/link';
import { cva, type VariantProps } from 'class-variance-authority';
import type { ComponentPropsWithoutRef, ElementType } from 'react';
import { cn } from '@/lib/utils';

/**
 * Button — primitives du design system Proximo.
 * Variants : primary (gradient Electric Blue) / secondary (bordure) /
 * ghost / danger ; tailles sm / md / lg.
 * Rendu polymorphique : <Button as={Link} href="…"> ou <button>.
 */
const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition-all duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        primary:
          'bg-brand-gradient text-white shadow-sm hover:shadow-glow hover:opacity-95 active:scale-[0.98]',
        secondary:
          'border border-slate-300 bg-white text-slate-700 hover:border-slate-400 hover:bg-slate-50',
        ghost: 'text-slate-600 hover:bg-slate-100 hover:text-slate-900',
        danger: 'bg-red-600 text-white hover:bg-red-700',
        outlineLight: 'border border-white/40 text-white hover:bg-white/10',
      },
      size: {
        sm: 'h-9 px-3 text-sm',
        md: 'h-11 px-5 text-sm',
        lg: 'h-12 px-6 text-base',
        icon: 'h-10 w-10',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'md',
    },
  },
);

export interface ButtonProps
  extends ComponentPropsWithoutRef<'button'>,
    VariantProps<typeof buttonVariants> {
  as?: ElementType;
  href?: string;
}

export function Button({ as, href, className, variant, size, ...props }: ButtonProps) {
  const Component: ElementType = as ?? (href ? Link : 'button');
  return (
    <Component
      href={href}
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    />
  );
}

export { buttonVariants };
