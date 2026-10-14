import { MessageSquareText } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { useSupportSavedReplies } from '@/hooks/useSupportSavedReplies';

/**
 * Saved-reply picker for the agent composer. Opens from its button or when
 * the agent types "/" in an empty composer; search matches title, shortcut
 * and text.
 */
export default function SavedReplyPicker({
  open, onOpenChange, onPick,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPick: (body: string) => void;
}) {
  const { data: replies = [] } = useSupportSavedReplies();
  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="rounded-md px-2.5 py-1 text-xs font-medium text-muted-foreground hover:bg-muted flex items-center gap-1"
          title="Saved replies (type / in an empty reply)"
        >
          <MessageSquareText className="h-3 w-3" /> Saved replies
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" side="top" className="w-[min(360px,calc(100vw-2rem))] p-0">
        <Command>
          <CommandInput placeholder="Search saved replies…" autoFocus />
          <CommandList className="max-h-72">
            <CommandEmpty>No saved replies. Add some in the Saved replies tab.</CommandEmpty>
            <CommandGroup>
              {replies.map((r) => (
                <CommandItem
                  key={r.id}
                  value={`${r.shortcut ?? ''} ${r.title} ${r.body}`}
                  onSelect={() => { onPick(r.body); onOpenChange(false); }}
                  className="flex flex-col items-start gap-0.5"
                >
                  <div className="flex w-full items-center gap-2">
                    <span className="text-sm font-medium">{r.title}</span>
                    {r.shortcut && <span className="ml-auto font-mono text-[11px] text-muted-foreground">{r.shortcut}</span>}
                  </div>
                  <span className="text-xs text-muted-foreground line-clamp-2">{r.body}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
