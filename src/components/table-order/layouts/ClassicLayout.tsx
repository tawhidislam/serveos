import TableMenuItem from '@/components/table-order/TableMenuItem';
import type { OrderLayoutProps } from './types';

/** Default ordering layout: one stacked row per dish with a square thumbnail. */
export default function ClassicLayout({
  groups, registerSection, getQty, format, onAdd, onUpdateQty, hasAddons,
}: OrderLayoutProps) {
  return (
    <>
      {groups.map(cat => (
        <div
          key={cat.id}
          id={`cat-${cat.id}`}
          ref={(el) => registerSection(cat.id, el)}
          className="mb-8 scroll-mt-[150px]"
        >
          <div className="flex items-baseline justify-between mb-3">
            <h2 className="font-display text-lg font-bold text-foreground">{cat.name}</h2>
            <span className="text-muted-foreground/40 text-xs tabular-nums">
              {cat.items.length} {cat.items.length === 1 ? 'item' : 'items'}
            </span>
          </div>

          <div className="grid grid-cols-1 gap-3">
            {cat.items.map((item, idx) => (
              <TableMenuItem
                key={item.id}
                item={item as any}
                qty={getQty(item.id)}
                formattedPrice={format(Number(item.price))}
                onAdd={() => onAdd(item)}
                onUpdateQty={(newQty) => onUpdateQty(item.id, newQty)}
                index={idx}
                hasAddons={hasAddons(item.id)}
              />
            ))}
          </div>
        </div>
      ))}
    </>
  );
}
