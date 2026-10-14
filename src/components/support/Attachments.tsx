import { useEffect, useRef, useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { FileText, Paperclip, X } from 'lucide-react';
import { toast } from 'sonner';
import type { Database } from '@/integrations/supabase/types';
import { formatBytes } from '@/lib/upload-limits';
import { cn } from '@/lib/utils';
import {
  ATTACHMENT_ACCEPT,
  MAX_ATTACHMENTS,
  getSupportAttachmentUrl,
  isImageAttachment,
  validateAttachment,
  type SupportAttachment,
} from '@/lib/support-attachments';

/** Paperclip button that adds files to a pending list (validated, max 5). */
export function AttachButton({ files, onChange, disabled }: { files: File[]; onChange: (f: File[]) => void; disabled?: boolean }) {
  const input = useRef<HTMLInputElement>(null);
  return (
    <>
      <input
        ref={input}
        type="file"
        multiple
        accept={ATTACHMENT_ACCEPT}
        className="hidden"
        onChange={(e) => {
          const picked = Array.from(e.target.files ?? []);
          e.target.value = '';
          const ok: File[] = [];
          for (const f of picked) {
            const problem = validateAttachment(f);
            if (problem) toast.error(problem);
            else ok.push(f);
          }
          const next = [...files, ...ok];
          if (next.length > MAX_ATTACHMENTS) toast.error(`Up to ${MAX_ATTACHMENTS} files per message`);
          onChange(next.slice(0, MAX_ATTACHMENTS));
        }}
      />
      <button
        type="button"
        onClick={() => input.current?.click()}
        disabled={disabled || files.length >= MAX_ATTACHMENTS}
        className="h-11 w-11 shrink-0 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-40"
        aria-label="Attach files"
        title="Attach images, PDFs or text files (max 10 MB each)"
      >
        <Paperclip className="h-4 w-4" />
      </button>
    </>
  );
}

/** Chips for files chosen but not yet sent. */
export function PendingFiles({ files, onRemove }: { files: File[]; onRemove: (i: number) => void }) {
  if (files.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1.5 mb-2">
      {files.map((f, i) => (
        <span key={`${f.name}-${i}`} className="inline-flex items-center gap-1.5 max-w-[220px] rounded-md border border-border bg-muted/50 pl-2 pr-1 py-1 text-xs">
          <FileText className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          <span className="truncate">{f.name}</span>
          <span className="text-muted-foreground shrink-0">{formatBytes(f.size)}</span>
          <button type="button" onClick={() => onRemove(i)} className="p-0.5 rounded hover:bg-muted" aria-label={`Remove ${f.name}`}>
            <X className="h-3 w-3" />
          </button>
        </span>
      ))}
    </div>
  );
}

/** Attachments of a sent message, loaded through short-lived signed links. */
export function AttachmentList({
  client, attachments, inverted = false,
}: {
  client: SupabaseClient<Database>;
  attachments: SupportAttachment[];
  /** Rendered on a primary-coloured bubble. */
  inverted?: boolean;
}) {
  const [urls, setUrls] = useState<Record<string, string | null>>({});

  useEffect(() => {
    let cancelled = false;
    Promise.all(attachments.map(async (a) => [a.path, await getSupportAttachmentUrl(client, a.path)] as const))
      .then((pairs) => { if (!cancelled) setUrls(Object.fromEntries(pairs)); });
    return () => { cancelled = true; };
  }, [client, attachments]);

  if (attachments.length === 0) return null;
  const images = attachments.filter(isImageAttachment);
  const files = attachments.filter((a) => !isImageAttachment(a));

  return (
    <div className="mt-1.5 space-y-1.5">
      {images.length > 0 && (
        <div className={cn('grid gap-1.5', images.length > 1 ? 'grid-cols-2' : 'grid-cols-1')}>
          {images.map((a) => (
            <a key={a.path} href={urls[a.path] ?? undefined} target="_blank" rel="noopener noreferrer" className="block overflow-hidden rounded-lg bg-muted">
              {urls[a.path] ? (
                <img src={urls[a.path]!} alt={a.name} className="h-32 w-full object-cover" loading="lazy" />
              ) : (
                <div className="h-32 w-full animate-pulse bg-muted" />
              )}
            </a>
          ))}
        </div>
      )}
      {files.map((a) => (
        <a
          key={a.path}
          href={urls[a.path] ?? undefined}
          target="_blank"
          rel="noopener noreferrer"
          className={cn(
            'flex items-center gap-2 rounded-lg border px-2.5 py-2 text-xs hover:underline',
            inverted ? 'border-primary-foreground/30 text-primary-foreground' : 'border-border bg-background text-foreground',
          )}
        >
          <FileText className="h-4 w-4 shrink-0" />
          <span className="truncate flex-1">{a.name}</span>
          <span className="shrink-0 opacity-70">{formatBytes(a.size)}</span>
        </a>
      ))}
    </div>
  );
}
