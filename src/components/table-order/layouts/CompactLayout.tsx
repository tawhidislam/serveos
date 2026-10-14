import QtyControl from './QtyControl';
import type { OrderLayoutProps } from './types';

/** Text-only dense list — no images, fastest to scan and to load. */
export default function CompactLayout({
  groups, registerSection, getQty, format, onAdd, onUpdateQty, hasAddons,
}: OrderLayoutProps) {
  return (
    <>
      {groups.map(cat => (
        <div
          key={cat.id}
          id={`cat-${cat.id}`}
          ref={(el) => registerSection(cat.id, el)}
          className="mb-7 scroll-mt-[150px]"
        >
          <h2 className="font-display text-sm font-bold uppercase tracking-[0.18em] text-muted-foreground mb-2">
            {cat.name}
          </h2>

          <div className="rounded-2xl border border-border/60 bg-card divide-y divide-border/50 overflow-hidden">
            {cat.items.map(item => (
              <div key={item.id} className="flex items-center gap-3 px-3.5 py-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-2">
                    <h3 className="text-card-foreground font-semibold text-[14.5px] truncate">{item.name}</h3>
                    <span className="flex-1 border-b border-dashed border-border/70 translate-y-[-2px]" />
                    <span className="text-primary font-bold text-[14px] tabular-nums shrink-0">
                      {format(Number(item.price))}
                    </span>
                  </div>
                  {item.description && (
                    <p className="text-muted-foreground text-[11.5px] leading-relaxed line-clamp-1 mt-0.5">
                      {item.description}
                    </p>
                  )}
                </div>

                <QtyControl
                  qty={getQty(item.id)}
                  hasAddons={hasAddons(item.id)}
                  onAdd={() => onAdd(item)}
                  onUpdateQty={(n) => onUpdateQty(item.id, n)}
                  size="sm"
                  compactLabel
                />
              </div>
            ))}
          </div>
        </div>
      ))}
    </>
  );
}
