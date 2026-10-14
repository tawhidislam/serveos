import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Copy, ExternalLink, Globe, ShieldCheck, Info } from 'lucide-react';
import { toast } from 'sonner';
import {
  useCustomDomainCnameTarget,
} from '@/hooks/usePlatformSettings';

interface Props {
  /** Optional domain to highlight in examples (e.g. bellacucina.com or shop.bellacucina.com) */
  domain?: string | null;
  /** Show the verified badge if the domain is live */
  verified?: boolean;
  /** Compact mode: smaller padding, no big intro */
  compact?: boolean;
}

/**
 * Heuristic: a hostname is "apex/root" when it has exactly two labels
 * (example.com), or three labels with a known multi-part TLD (.co.uk etc.).
 * Anything else (shop.example.com, menu.example.co.uk) is treated as a
 * subdomain. This drives whether the guide highlights the A/ALIAS or the
 * CNAME tab by default.
 */
const TWO_PART_TLDS = new Set([
  'co.uk', 'org.uk', 'ac.uk', 'gov.uk', 'me.uk',
  'com.au', 'net.au', 'org.au', 'edu.au',
  'co.nz', 'co.in', 'co.jp', 'co.kr', 'co.za',
  'com.br', 'com.mx', 'com.sg', 'com.hk', 'com.tw',
]);

function isApexDomain(host: string | null | undefined): boolean {
  if (!host) return true; // default to root guide
  const h = host.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '');
  const parts = h.split('.');
  if (parts.length < 2) return false;
  if (parts.length === 2) return true;
  const lastTwo = parts.slice(-2).join('.');
  return parts.length === 3 && TWO_PART_TLDS.has(lastTwo);
}

export default function CustomDomainSetupGuide({ domain, verified, compact }: Props) {
  const SAAS_HOST = useCustomDomainCnameTarget();
  const copy = (value: string) => {
    navigator.clipboard.writeText(value);
    toast.success('Copied to clipboard');
  };

  const exampleDomain = domain || 'yourdomain.com';
  const apex = isApexDomain(domain);
  const defaultTab = apex ? 'root' : 'sub';

  return (
    <div className={compact ? 'space-y-4' : 'space-y-5'}>
      {!compact && (
        <div className="flex items-start gap-3">
          <div className="rounded-md bg-primary/10 p-2 text-primary shrink-0">
            <Globe className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-semibold text-base">Custom domain setup guide</h3>
              {verified && (
                <Badge variant="default" className="gap-1 text-[10px]">
                  <ShieldCheck className="h-3 w-3" /> Live
                </Badge>
              )}
            </div>
            <p className="text-sm text-muted-foreground mt-0.5">
              Point your root domain (<span className="font-mono">{exampleDomain}</span>) at your storefront using a
              CNAME-style record. Setup typically takes 10–60 minutes after DNS propagates.
            </p>
          </div>
        </div>
      )}

      <ol className="space-y-4">
        {/* Step 1 */}
        <li className="rounded-md border border-border bg-card p-4">
          <div className="flex items-start gap-3">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-semibold">1</span>
            <div className="min-w-0 flex-1 space-y-2">
              <p className="font-medium text-sm">Save your domain in this dashboard</p>
              <p className="text-xs text-muted-foreground">
                Enter your domain — <span className="font-mono">{exampleDomain}</span> (no <code>https://</code>,
                no trailing slash). Both root domains (<span className="font-mono">example.com</span>) and
                subdomains (<span className="font-mono">shop.example.com</span>) are supported.
                Click <b>Save domain</b> — we'll show pending DNS until our team verifies it.
              </p>
            </div>
          </div>
        </li>

        {/* Step 2 — DNS records (apex vs subdomain) */}
        <li className="rounded-md border border-border bg-card p-4">
          <div className="flex items-start gap-3">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-semibold">2</span>
            <div className="min-w-0 flex-1 space-y-3">
              <p className="font-medium text-sm">Add the DNS records at your registrar</p>
              <p className="text-xs text-muted-foreground">
                Log in to where your DNS lives (Cloudflare, Namecheap, GoDaddy, Google Domains, etc.) and add the
                records that match your setup. We auto-detected{' '}
                <b>{apex ? 'a root domain' : 'a subdomain'}</b> — but use whichever tab matches what you actually want to host.
              </p>

              <Tabs defaultValue={defaultTab} className="w-full">
                <TabsList className="grid grid-cols-2 w-full">
                  <TabsTrigger value="root">Root domain (apex)</TabsTrigger>
                  <TabsTrigger value="sub">Subdomain</TabsTrigger>
                </TabsList>

                {/* ROOT / APEX */}
                <TabsContent value="root" className="space-y-3 pt-3">
                  <p className="text-xs text-muted-foreground">
                    For an apex domain like <span className="font-mono">{apex ? exampleDomain : 'example.com'}</span>,
                    add a <b>CNAME</b> on <code>@</code> and one for <code>www</code>:
                  </p>
                  <div className="overflow-hidden rounded-md border border-border">
                    <table className="w-full text-xs">
                      <thead className="bg-muted/50">
                        <tr className="text-left">
                          <th className="px-3 py-2 font-medium">Type</th>
                          <th className="px-3 py-2 font-medium">Name / Host</th>
                          <th className="px-3 py-2 font-medium">Value</th>
                          <th className="px-3 py-2 font-medium">TTL</th>
                          <th className="px-3 py-2"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        <tr>
                          <td className="px-3 py-2 font-mono"><b>CNAME</b></td>
                          <td className="px-3 py-2 font-mono">@</td>
                          <td className="px-3 py-2 font-mono break-all">{SAAS_HOST}</td>
                          <td className="px-3 py-2 font-mono text-muted-foreground">Auto</td>
                          <td className="px-3 py-2 text-right">
                            <Button size="sm" variant="ghost" onClick={() => copy(SAAS_HOST)}>
                              <Copy className="h-3 w-3" />
                            </Button>
                          </td>
                        </tr>
                        <tr>
                          <td className="px-3 py-2 font-mono"><b>CNAME</b></td>
                          <td className="px-3 py-2 font-mono">www</td>
                          <td className="px-3 py-2 font-mono break-all">{SAAS_HOST}</td>
                          <td className="px-3 py-2 font-mono text-muted-foreground">Auto</td>
                          <td className="px-3 py-2 text-right">
                            <Button size="sm" variant="ghost" onClick={() => copy(SAAS_HOST)}>
                              <Copy className="h-3 w-3" />
                            </Button>
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  <div className="rounded-md border border-border bg-muted/40 p-3 space-y-2">
                    <div className="flex gap-2">
                      <Info className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" />
                      <p className="text-xs text-foreground">
                        <b>A CNAME on the root (<code>@</code>) needs CNAME flattening or an ALIAS/ANAME record.</b>{' '}
                        Most modern DNS providers support it:
                      </p>
                    </div>
                    <ul className="text-xs text-muted-foreground list-disc list-inside space-y-0.5 pl-5">
                      <li><b>Cloudflare</b> — CNAME @ → <span className="font-mono">{SAAS_HOST}</span>, proxy status <b>DNS only</b> (grey cloud). Flattening is automatic.</li>
                      <li><b>DNSimple, Hover, easyDNS</b> — use an <b>ALIAS</b> record.</li>
                      <li><b>Route 53, DNS Made Easy, Namecheap Premium DNS</b> — use an <b>ALIAS</b> or <b>ANAME</b>.</li>
                      <li><b>GoDaddy, basic Namecheap</b> — no ALIAS support: use <code>www.{apex ? exampleDomain : 'example.com'}</code> as your domain here, and set up a redirect from the root to www at your registrar.</li>
                    </ul>
                  </div>
                </TabsContent>

                {/* SUBDOMAIN */}
                <TabsContent value="sub" className="space-y-3 pt-3">
                  <p className="text-xs text-muted-foreground">
                    For a subdomain like <span className="font-mono">{apex ? `shop.${exampleDomain}` : exampleDomain}</span>,
                    add a single <b>CNAME</b>:
                  </p>
                  <div className="overflow-hidden rounded-md border border-border">
                    <table className="w-full text-xs">
                      <thead className="bg-muted/50">
                        <tr className="text-left">
                          <th className="px-3 py-2 font-medium">Type</th>
                          <th className="px-3 py-2 font-medium">Name / Host</th>
                          <th className="px-3 py-2 font-medium">Value</th>
                          <th className="px-3 py-2 font-medium">TTL</th>
                          <th className="px-3 py-2"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        <tr>
                          <td className="px-3 py-2 font-mono"><b>CNAME</b></td>
                          <td className="px-3 py-2 font-mono">
                            {apex ? 'shop' : (domain?.split('.')[0] ?? 'shop')}
                          </td>
                          <td className="px-3 py-2 font-mono break-all">{SAAS_HOST}</td>
                          <td className="px-3 py-2 font-mono text-muted-foreground">Auto</td>
                          <td className="px-3 py-2 text-right">
                            <Button size="sm" variant="ghost" onClick={() => copy(SAAS_HOST)}>
                              <Copy className="h-3 w-3" />
                            </Button>
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    Replace the host with whatever subdomain you want to use (e.g. <code>menu</code>, <code>order</code>, <code>shop</code>).
                  </p>
                </TabsContent>
              </Tabs>
            </div>
          </div>
        </li>

        {/* Step 3 */}
        <li className="rounded-md border border-border bg-card p-4">
          <div className="flex items-start gap-3">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-semibold">3</span>
            <div className="min-w-0 flex-1 space-y-2">
              <p className="font-medium text-sm">Wait for DNS to propagate</p>
              <p className="text-xs text-muted-foreground">
                Usually 10–30 minutes, occasionally up to 72 hours. You can verify by visiting{' '}
                <a
                  href={`https://dnschecker.org/#CNAME/${encodeURIComponent(domain ?? exampleDomain)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-0.5 underline underline-offset-2 hover:text-foreground"
                >
                  dnschecker.org <ExternalLink className="h-3 w-3" />
                </a>{' '}
                — your domain should point to <span className="font-mono">{SAAS_HOST}</span>.
              </p>
            </div>
          </div>
        </li>

        {/* Step 4 */}
        <li className="rounded-md border border-border bg-card p-4">
          <div className="flex items-start gap-3">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-semibold">4</span>
            <div className="min-w-0 flex-1 space-y-2">
              <p className="font-medium text-sm">We verify and issue SSL automatically</p>
              <p className="text-xs text-muted-foreground">
                Once DNS is in place, click <b>Verify</b>: we check ownership, register your domain and issue an SSL certificate (usually within minutes).
                You'll see a green <b>Live</b> badge here when it's ready, and visitors hitting{' '}
                <span className="font-mono">{exampleDomain}</span> will see your storefront automatically.
              </p>
            </div>
          </div>
        </li>
      </ol>

      <div className="rounded-md border border-border bg-muted/30 p-3 text-xs text-muted-foreground space-y-1">
        <p className="font-medium text-foreground">Troubleshooting</p>
        <ul className="list-disc list-inside space-y-0.5">
          <li>Using <b>Cloudflare</b> for your DNS? Set the record to <b>DNS only</b> (grey cloud), not proxied.</li>
          <li>If you use the <b>ALIAS/ANAME/flattened CNAME</b> option on the root, remove any existing A or AAAA records on <code>@</code> — they conflict.</li>
          <li>Have <b>CAA</b> records? Make sure they allow Let's Encrypt and Google Trust Services (pki.goog).</li>
          <li>Still stuck after 72 hours? Contact support with a screenshot of your DNS records.</li>
        </ul>
      </div>
    </div>
  );
}
