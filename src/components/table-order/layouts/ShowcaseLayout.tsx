import { ChefHat } from 'lucide-react';
import QtyControl from './QtyControl';
import type { OrderLayoutProps } from './types';

/** Editorial layout: each category is a horizontally scrolling row of tall cards. */
export default function ShowcaseLayout({
  groups, registerSection, getQty, format, onAdd, onUpdateQty, hasAddons,
}: OrderLayoutProps) {
  return (
    <>
      {groups.map(cat => (
        <div
          key={cat.id}
          id={`cat-${cat.id}`}
          ref={(el) => registerSection(cat.id, el)}
          className="mb-9 scroll-mt-[150px]"
        >
          <div className="flex items-baseline justify-between mb-3">
            <div>
              <p className="text-primary text-[10.5px] font-semibold uppercase tracking-[0.2em]">Featured</p>
              <h2 className="font-display text-xl font-bold text-foreground">{cat.name}</h2>
            </div>
            <span className="text-muted-foreground/40 text-xs tabular-nums">
              {cat.items.length} {cat.items.length === 1 ? 'item' : 'items'}
            </span>
          </div>

          <div className="flex gap-3 overflow-x-auto scrollbar-hide -mx-4 px-4 pb-1 snap-x snap-mandatory">
            {cat.items.map(item => (
              <div
                key={item.id}
                className="snap-start shrink-0 w-[228px] rounded-2xl overflow-hidden bg-card border border-border/60"
              >
                <div className="relative h-[150px] bg-secondary">
                  {item.image_url ? (
                    <img
                      src={item.image_url}
                      alt={item.name}
                      loading="lazy"
                      decoding="async"
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="h-full w-full flex items-center justify-center">
                      <ChefHat className="h-8 w-8 text-muted-foreground/20" strokeWidth={1} />
                    </div>
                  )}
                  <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-background/85 to-transparent" />
                  <span className="absolute bottom-2 left-3 text-[13px] font-bold text-primary tabular-nums">
                    {format(Number(item.price))}
                  </span>
                </div>

                <div className="p-3">
                  <h3 className="text-card-foreground font-semibold text-[14.5px] leading-snug line-clamp-1">
                    {item.name}
                  </h3>
                  {item.description && (
                    <p className="text-muted-foreground text-[11.5px] leading-relaxed line-clamp-2 mt-1 min-h-[2.4em]">
                      {item.description}
                    </p>
                  )}
                  <div className="mt-3 flex justify-end">
                    <QtyControl
                      qty={getQty(item.id)}
                      hasAddons={hasAddons(item.id)}
                      onAdd={() => onAdd(item)}
                      onUpdateQty={(n) => onUpdateQty(item.id, n)}
                      size="sm"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </>
  );
}
