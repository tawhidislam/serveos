import { useEffect, useRef } from 'react';

interface CategoryScrollerProps {
  categories: { id: string; name: string }[];
  menuItems: { category_id: string }[];
  activeCategoryId: string | null;
  onSelect: (id: string) => void;
  waiterMode?: boolean;
}

export default function CategoryScroller({
  categories, menuItems, activeCategoryId, onSelect, waiterMode,
}: CategoryScrollerProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!activeCategoryId || !scrollRef.current) return;
    const chip = scrollRef.current.querySelector(`[data-cat="${activeCategoryId}"]`);
    if (chip) chip.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
  }, [activeCategoryId]);

  if (waiterMode) {
    return (
      <div
        ref={scrollRef}
        className="sticky top-[57px] z-20 flex gap-2 px-4 py-3 overflow-x-auto scrollbar-hide bg-background/80 backdrop-blur-xl border-b border-border/30"
        style={{ scrollPaddingInline: '16px' }}
      >
        {categories.map(cat => {
          const count = menuItems.filter(i => i.category_id === cat.id).length;
          if (count === 0) return null;
          const isActive = activeCategoryId === cat.id;
          return (
            <button key={cat.id} data-cat={cat.id} onClick={() => onSelect(cat.id)}
              className={`shrink-0 px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 ${
                isActive ? 'bg-primary text-primary-foreground shadow-md shadow-primary/20' : 'bg-secondary/80 text-secondary-foreground hover:bg-secondary'
              }`}>
              {cat.name}
              {!isActive && <span className="ml-1.5 text-xs text-muted-foreground">{count}</span>}
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <div className="sticky top-[72px] z-20 bg-[#070707]/95 backdrop-blur-xl border-b border-white/[0.05]">
      <div
        ref={scrollRef}
        className="max-w-6xl mx-auto flex gap-1.5 px-6 sm:px-10 lg:px-16 py-3 overflow-x-auto scrollbar-hide"
        style={{ scrollPaddingInline: '24px' }}
      >
        {categories.map(cat => {
          const count = menuItems.filter(i => i.category_id === cat.id).length;
          if (count === 0) return null;
          const isActive = activeCategoryId === cat.id;
          return (
            <button
              key={cat.id}
              data-cat={cat.id}
              onClick={() => onSelect(cat.id)}
              className={`shrink-0 px-5 py-2 rounded-full text-sm font-medium transition-all duration-300 ${
                isActive
                  ? 'bg-amber-500 text-black shadow-lg shadow-amber-500/20'
                  : 'bg-white/[0.06] text-white/50 hover:text-white hover:bg-white/[0.1] border border-white/[0.06]'
              }`}
            >
              {cat.name}
              {!isActive && (
                <span className="ml-1.5 text-xs text-white/25">{count}</span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
