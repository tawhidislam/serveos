import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCustomizationTags, type CustomizationTag } from '@/hooks/useCustomizationTags';
import { Label } from '@/components/ui/label';
import { Tags } from 'lucide-react';

interface MenuItemTagAssignerProps {
  menuItemId: string;
}

export default function MenuItemTagAssigner({ menuItemId }: MenuItemTagAssignerProps) {
  const { data: allTags = [] } = useCustomizationTags();
  const queryClient = useQueryClient();

  // RLS on menu_item_tags requires restaurant_id = current_restaurant_id().
  const { data: parentItem } = useQuery({
    queryKey: ['menu_item_restaurant', menuItemId],
    enabled: !!menuItemId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('menu_items')
        .select('restaurant_id')
        .eq('id', menuItemId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
  const restaurantId = (parentItem as any)?.restaurant_id ?? null;

  const { data: assignedTagIds = [], isLoading } = useQuery({
    queryKey: ['menu_item_tags', menuItemId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('menu_item_tags' as any)
        .select('tag_id')
        .eq('menu_item_id', menuItemId);
      if (error) throw error;
      return (data || []).map((r: any) => r.tag_id as string);
    },
  });

  const toggleTag = async (tagId: string) => {
    const isAssigned = assignedTagIds.includes(tagId);
    if (isAssigned) {
      await supabase
        .from('menu_item_tags' as any)
        .delete()
        .eq('menu_item_id', menuItemId)
        .eq('tag_id', tagId);
    } else {
      if (!restaurantId) return;
      await supabase
        .from('menu_item_tags' as any)
        .insert({ menu_item_id: menuItemId, tag_id: tagId, restaurant_id: restaurantId });
    }
    queryClient.invalidateQueries({ queryKey: ['menu_item_tags', menuItemId] });
  };

  const activeTags = allTags.filter(t => t.is_active);

  if (activeTags.length === 0) return null;

  // Group by category
  const grouped: Record<string, CustomizationTag[]> = {};
  activeTags.forEach(t => {
    if (!grouped[t.category]) grouped[t.category] = [];
    grouped[t.category].push(t);
  });

  return (
    <div>
      <Label className="label-ui flex items-center gap-1.5 mb-2">
        <Tags className="h-3.5 w-3.5" /> Customization Tags
      </Label>
      <p className="text-xs text-muted-foreground mb-3">
        Select which tags are available for this item. Leave empty to show all tags.
      </p>
      {isLoading ? (
        <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin mx-auto" />
      ) : (
        <div className="space-y-3">
          {Object.entries(grouped).map(([category, catTags]) => (
            <div key={category}>
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">{category}</p>
              <div className="flex flex-wrap gap-1.5">
                {catTags.map(tag => {
                  const assigned = assignedTagIds.includes(tag.id);
                  return (
                    <button
                      key={tag.id}
                      type="button"
                      onClick={() => toggleTag(tag.id)}
                      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium transition-all ${
                        assigned
                          ? 'ring-2 ring-offset-1 ring-offset-background shadow-sm'
                          : 'opacity-40 hover:opacity-70'
                      }`}
                      style={{
                        backgroundColor: assigned ? tag.color + '25' : tag.color + '08',
                        color: tag.color,
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
      )}
    </div>
  );
}
