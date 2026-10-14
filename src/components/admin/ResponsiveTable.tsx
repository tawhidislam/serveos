import { ReactNode } from 'react';
import { cn } from '@/lib/utils';

/**
 * Wraps wide tables so they scroll horizontally on small screens
 * instead of forcing the whole page to overflow.
 */
export default function ResponsiveTable({
  children,
  className,
  minWidth = 640,
}: {
  children: ReactNode;
  className?: string;
  /** Minimum width of the inner table in px */
  minWidth?: number;
}) {
  return (
    <div className={cn('relative -mx-1 px-1', className)}>
      <div className="touch-scroll-x scrollbar-hide rounded-lg">
        <div style={{ minWidth }}>{children}</div>
      </div>
    </div>
  );
}

/**
 * Horizontal chip / filter / tab bar that scrolls on mobile.
 */
export function ScrollRow({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'touch-scroll-x scrollbar-hide flex items-center gap-2 -mx-4 px-4 pb-1 md:mx-0 md:px-0 md:flex-wrap',
        className
      )}
    >
      {children}
    </div>
  );
}

/**
 * Toolbar for search + filter controls: stacks full-width on phones,
 * inline on larger screens. Children get 44px tall targets on mobile.
 */
export function FilterBar({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center',
        '[&>*]:w-full sm:[&>*]:w-auto',
        '[&_button[role=combobox]]:h-11 sm:[&_button[role=combobox]]:h-9',
        '[&_input]:h-11 sm:[&_input]:h-9',
        className
      )}
    >
      {children}
    </div>
  );
}

