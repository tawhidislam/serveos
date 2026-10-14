import { useEffect, useRef, useState } from 'react';
import { Monitor, Tablet, Smartphone, RefreshCw, Eye, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/button';

const deviceSizes = {
  desktop: { width: 1440, height: 900, scale: 0.42, label: 'Desktop' },
  tablet: { width: 768, height: 1024, scale: 0.42, label: 'Tablet' },
  mobile: { width: 375, height: 812, scale: 0.55, label: 'Mobile' },
} as const;

type DeviceKey = keyof typeof deviceSizes;

interface LivePreviewPanelProps {
  slug?: string | null;
  template: string;
  /** Unsaved draft content keyed by homepage_content.section_key */
  draft: Record<string, any>;
}

/**
 * Renders the tenant homepage in an iframe and pushes unsaved editor state
 * into it over postMessage so changes appear instantly, before saving.
 */
export default function LivePreviewPanel({ slug, template, draft }: LivePreviewPanelProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [device, setDevice] = useState<DeviceKey>('desktop');
  const [open, setOpen] = useState(true);
  const [ready, setReady] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  const src = `${slug ? `/r/${slug}` : '/'}?_preview_template=${template}&_live=1`;

  // Handshake: the preview page announces itself once mounted.
  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      if (e.origin !== window.location.origin) return;
      if (e.data?.type === 'serveos:preview-ready') setReady(true);
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, []);

  useEffect(() => { setReady(false); }, [reloadKey, template, slug]);

  // Push draft content (debounced) whenever it changes.
  useEffect(() => {
    if (!ready) return;
    const t = setTimeout(() => {
      iframeRef.current?.contentWindow?.postMessage(
        { type: 'serveos:preview-content', template, sections: draft },
        window.location.origin
      );
    }, 120);
    return () => clearTimeout(t);
  }, [draft, template, ready]);

  const d = deviceSizes[device];

  return (
    <div className="border border-border rounded-xl overflow-hidden bg-card">
      <div className="flex items-center justify-between gap-2 bg-muted px-3 py-2 border-b border-border flex-wrap">
        <div className="flex items-center gap-2">
          <Eye className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium text-card-foreground">Live preview</span>
          <span className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground bg-muted-foreground/10 px-2 py-0.5 rounded-full">
            {template}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="flex items-center bg-background border border-border rounded-lg p-0.5">
            {([
              { key: 'desktop' as const, icon: Monitor },
              { key: 'tablet' as const, icon: Tablet },
              { key: 'mobile' as const, icon: Smartphone },
            ]).map(({ key, icon: Icon }) => (
              <button
                key={key}
                onClick={() => setDevice(key)}
                title={deviceSizes[key].label}
                className={`p-1.5 rounded-md transition-colors ${
                  device === key ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
              </button>
            ))}
          </div>
          <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setReloadKey(k => k + 1)}>
            <RefreshCw className="h-3 w-3 mr-1" /> Reload
          </Button>
          <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setOpen(o => !o)}>
            {open ? <EyeOff className="h-3 w-3 mr-1" /> : <Eye className="h-3 w-3 mr-1" />}
            {open ? 'Hide' : 'Show'}
          </Button>
        </div>
      </div>

      {open && (
        <div className="bg-muted/30 overflow-auto p-3">
          <div
            className="mx-auto relative"
            style={{ width: d.width * d.scale, height: d.height * d.scale }}
          >
            <iframe
              key={`${reloadKey}-${template}-${device}`}
              ref={iframeRef}
              src={src}
              title="Homepage live preview"
              className="border border-border rounded-lg bg-background origin-top-left"
              style={{
                width: d.width,
                height: d.height,
                transform: `scale(${d.scale})`,
                position: 'absolute',
                top: 0,
                left: 0,
              }}
            />
          </div>
          <p className="text-[11px] text-muted-foreground text-center mt-2">
            Unsaved changes appear here instantly. Click Save to publish them.
          </p>
        </div>
      )}
    </div>
  );
}
