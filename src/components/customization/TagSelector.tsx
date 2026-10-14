import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useActiveCustomizationTags, groupTagsByCategory, type CustomizationTag } from '@/hooks/useCustomizationTags';

interface TagSelectorProps {
  selectedTags: string[];
  onToggle: (tagName: string) => void;
  menuItemId?: string; // if provided, only show tags assigned to this item (or all if none assigned)
}

export default function TagSelector({ selectedTags, onToggle, menuItemId }: TagSelectorProps) {
  const { data: allTags = [] } = useActiveCustomizationTags();

  // Fetch assigned tag IDs for this menu item
  const { data: assignedTagIds } = useQuery({
    queryKey: ['menu_item_tags', menuItemId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('menu_item_tags' as any)
        .select('tag_id')
        .eq('menu_item_id', menuItemId!);
      if (error) throw error;
      return (data || []).map((r: any) => r.tag_id as string);
    },
    enabled: !!menuItemId,
  });

  // Filter: if item has assigned tags, show only those; otherwise show all
  const tags = menuItemId && assignedTagIds && assignedTagIds.length > 0
    ? allTags.filter(t => assignedTagIds.includes(t.id))
    : allTags;

  const grouped = groupTagsByCategory(tags);

  if (tags.length === 0) return null;

  return (
    <div className="space-y-3">
      {Object.entries(grouped).map(([category, catTags]) => (
        <div key={category}>
          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">{category}</p>
          <div className="flex flex-wrap gap-1.5">
            {catTags.map(tag => {
              const selected = selectedTags.includes(tag.name);
              return (
                <button
                  key={tag.id}
                  type="button"
                  onClick={() => onToggle(tag.name)}
                  className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium transition-all ${
                    selected
                      ? 'ring-2 ring-offset-1 ring-offset-background shadow-sm'
                      : 'opacity-70 hover:opacity-100'
                  }`}
                  style={{
                    backgroundColor: selected ? tag.color + '20' : tag.color + '10',
                    color: tag.color,
                    borderColor: tag.color,
                    ...(selected ? { ringColor: tag.color } : {}),
                  }}
                >
                  <span className="text-xs leading-none">{tag.emoji}</span>
                  {tag.name}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
