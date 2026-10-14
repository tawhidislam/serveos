import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';

// The panel mocks are large; load them on demand so they stay out of the
// marketing entry bundle.
const PANELS = {
  owner: lazy(() => import('@/components/marketing/demo/DemoPanelMocks').then((m) => ({ default: m.OwnerPanelMock }))),
  kitchen: lazy(() => import('@/components/marketing/demo/DemoPanelMocks').then((m) => ({ default: m.KitchenPanelMock }))),
} as const;

interface Props {
  panel: keyof typeof PANELS;
  url: string;
  /** Height classes for the viewport area (the mocks fill it absolutely). */
  heightClassName?: string;
  className?: string;
}

/**
 * Browser-framed, non-interactive render of a real product panel mock
 * (the same ones used on /demo), so marketing visuals match the product.
 */
export default function ProductPreviewFrame({
  panel, url, heightClassName = 'h-[340px] sm:h-[560px] lg:h-[640px]', className,
}: Props) {
  const Panel = PANELS[panel];
  const previewRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const element = previewRef.current;
    if (!element) return;
    if (!('IntersectionObserver' in window)) {
      setVisible(true);
      return;
    }
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setVisible(true);
        observer.disconnect();
      }
    }, { rootMargin: '200px' });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  return (
    <div ref={previewRef} className={cn('relative rounded-2xl overflow-hidden border border-border bg-card shadow-2xl shadow-foreground/5', className)}>
      <div className="flex items-center gap-2 px-4 h-10 border-b border-border bg-muted/40">
        <div className="flex items-center gap-1.5" aria-hidden>
          <div className="h-2.5 w-2.5 rounded-full bg-destructive/70" />
          <div className="h-2.5 w-2.5 rounded-full bg-warning/70" />
          <div className="h-2.5 w-2.5 rounded-full bg-success/70" />
        </div>
        <div className="flex-1 flex justify-center min-w-0">
          <div className="truncate text-[11px] text-muted-foreground font-mono px-3 py-0.5 rounded bg-background/80 border border-border">
            {url}
          </div>
        </div>
      </div>
      <div
        className={cn('relative bg-background pointer-events-none select-none', heightClassName)}
        aria-hidden
        data-nosnippet
        // Illustration only: keep the mock out of tab order and assistive tech.
        {...{ inert: '' }}
      >
        <Suspense fallback={<div className="absolute inset-0 animate-pulse bg-muted/40" />}>
          {visible ? <Panel /> : <div className="absolute inset-0 bg-muted/40" />}
        </Suspense>
      </div>
    </div>
  );
}
