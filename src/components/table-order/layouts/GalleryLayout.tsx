import { motion } from 'framer-motion';
import { ChefHat } from 'lucide-react';
import QtyControl from './QtyControl';
import type { OrderLayoutProps } from './types';

/** Image-first two-column grid — best for photo-rich menus. */
export default function GalleryLayout({
  groups, registerSection, getQty, format, onAdd, onUpdateQty, hasAddons, reducedMotion,
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

          <div className="grid grid-cols-2 gap-3">
            {cat.items.map((item, idx) => (
              <motion.div
                key={item.id}
                initial={reducedMotion ? false : { opacity: 0, y: 14 }}
                whileInView={reducedMotion ? undefined : { opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-30px' }}
                transition={{ delay: reducedMotion ? 0 : idx * 0.04, duration: 0.35 }}
                className="group flex flex-col rounded-2xl overflow-hidden bg-card border border-border/60 hover:border-border transition-colors"
              >
                <div className="relative aspect-[4/3] bg-secondary overflow-hidden">
                  {item.image_url ? (
                    <img
                      src={item.image_url}
                      alt={item.name}
                      loading="lazy"
                      decoding="async"
                      className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                  ) : (
                    <div className="h-full w-full flex items-center justify-center">
                      <ChefHat className="h-8 w-8 text-muted-foreground/20" strokeWidth={1} />
                    </div>
                  )}
                  <span className="absolute bottom-2 left-2 rounded-full bg-background/90 backdrop-blur px-2.5 py-1 text-[12px] font-bold text-primary tabular-nums">
                    {format(Number(item.price))}
                  </span>
                </div>

                <div className="p-3 flex-1 flex flex-col">
                  <h3 className="text-card-foreground font-semibold text-[14px] leading-snug line-clamp-2">
                    {item.name}
                  </h3>
                  {item.description && (
                    <p className="text-muted-foreground text-[11.5px] leading-relaxed line-clamp-2 mt-1">
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
              </motion.div>
            ))}
          </div>
        </div>
      ))}
    </>
  );
}
