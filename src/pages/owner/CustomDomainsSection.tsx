import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  Globe2, Loader2, Plus, RefreshCw, CheckCircle2, AlertCircle, Trash2, Copy, Check,
} from 'lucide-react';
import { toast } from 'sonner';
import { customDomainAction, DOMAIN_VERIFY_TXT_PREFIX } from '@/lib/custom-domains';
import { useCustomDomainCnameTarget } from '@/hooks/usePlatformSettings';

interface CustomDomainRow {
  id: string;
  domain: string;
  verified: boolean;
  verified_at: string | null;
  verification_token: string;
  last_check_at: string | null;
  last_check_error: string | null;
  label: string | null;
}

const DOMAIN_RE =
  /^([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/;

export default function CustomDomainsSection({ restaurantId }: { restaurantId: string }) {
  const queryClient = useQueryClient();
  const [newDomain, setNewDomain] = useState('');
  const [adding, setAdding] = useState(false);
  const [verifyingId, setVerifyingId] = useState<string | null>(null);

  const { data: domains, isLoading } = useQuery<CustomDomainRow[]>({
    queryKey: ['custom-domains', restaurantId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('restaurant_custom_domains')
        .select('id, domain, verified, verified_at, verification_token, last_check_at, last_check_error, label')
        .eq('restaurant_id', restaurantId)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return (data ?? []) as CustomDomainRow[];
    },
    enabled: !!restaurantId,
  });

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['custom-domains', restaurantId] });

  const onAdd = async () => {
    const d = newDomain.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '');
    if (!DOMAIN_RE.test(d)) {
      toast.error('Enter a valid domain like restaurant.com');
      return;
    }
    setAdding(true);
    try {
      const { error } = await supabase.from('restaurant_custom_domains').insert({
        restaurant_id: restaurantId,
        domain: d,
      });
      if (error) throw error;
      setNewDomain('');
      toast.success('Domain added — follow the DNS instructions below');
      refresh();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to add domain';
      toast.error(msg.includes('duplicate') || msg.includes('unique') ? 'That domain is already added' : msg);
    } finally {
      setAdding(false);
    }
  };

  const onVerify = async (id: string) => {
    setVerifyingId(id);
    try {
      const data = await customDomainAction({ action: 'verify', domainId: id });
      if (data?.verified) toast.success('Domain verified — you can now use it!');
      else toast.warning(data?.reason ?? 'Not verified yet — DNS may still be propagating');
      refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Verification failed');
    } finally {
      setVerifyingId(null);
    }
  };

  const onRemove = async (id: string, domain: string) => {
    if (!confirm(`Remove ${domain}?`)) return;
    try {
      await customDomainAction({ action: 'remove', domainId: id });
      toast.success('Domain removed');
      refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to remove domain');
    }
  };


  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Globe2 className="h-4 w-4" /> Custom domains
        </CardTitle>
        <CardDescription>
          Use your own domain (e.g. <code>restaurant.com</code>) instead of the default subdomain.
          Add the domain, point it at our servers, then click <strong>Verify</strong>.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Add form */}
        <div className="flex gap-2">
          <Input
            value={newDomain}
            onChange={(e) => setNewDomain(e.target.value)}
            placeholder="restaurant.com"
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                onAdd();
              }
            }}
          />
          <Button onClick={onAdd} disabled={adding || !newDomain}>
            {adding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            <span className="ml-1">Add</span>
          </Button>
        </div>

        {/* List */}
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : (domains?.length ?? 0) === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">No custom domains yet.</p>
        ) : (
          <div className="space-y-3">
            {domains!.map((d) => (
              <DomainRow
                key={d.id}
                row={d}
                verifying={verifyingId === d.id}
                onVerify={() => onVerify(d.id)}
                onRemove={() => onRemove(d.id, d.domain)}
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function DomainRow({
  row, verifying, onVerify, onRemove,
}: {
  row: CustomDomainRow;
  verifying: boolean;
  onVerify: () => void;
  onRemove: () => void;
}) {
  const [showInstructions, setShowInstructions] = useState(!row.verified);
  const cnameTarget = useCustomDomainCnameTarget();

  return (
    <div className="rounded-md border bg-card">
      <div className="p-3 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium text-sm break-all">{row.domain}</span>
            {row.verified ? (
              <Badge className="bg-green-600 hover:bg-green-600 text-white">
                <CheckCircle2 className="h-3 w-3 mr-1" /> Verified
              </Badge>
            ) : (
              <Badge variant="outline" className="text-amber-600 border-amber-300">
                <AlertCircle className="h-3 w-3 mr-1" /> Pending
              </Badge>
            )}
          </div>
          {row.verified_at && (
            <p className="text-xs text-muted-foreground mt-0.5">
              Verified {new Date(row.verified_at).toLocaleString()}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {!row.verified && (
            <Button variant="ghost" size="sm" onClick={() => setShowInstructions((v) => !v)}>
              {showInstructions ? 'Hide' : 'DNS setup'}
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={onVerify} disabled={verifying}>
            {verifying ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <RefreshCw className="h-3.5 w-3.5" />
            )}
            <span className="ml-1.5">{row.verified ? 'Re-check' : 'Verify'}</span>
          </Button>
          <Button variant="ghost" size="sm" onClick={onRemove}>
            <Trash2 className="h-3.5 w-3.5 text-destructive" />
          </Button>
        </div>
      </div>

      {!row.verified && row.last_check_error && (
        <Alert variant="destructive" className="mx-3 mb-3">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle className="text-xs">Last check failed</AlertTitle>
          <AlertDescription className="text-xs">{row.last_check_error}</AlertDescription>
        </Alert>
      )}

      {showInstructions && !row.verified && (
        <div className="border-t bg-muted/30 p-3 space-y-3">
          <p className="text-xs text-muted-foreground">
            Add the following records at your domain registrar (Cloudflare, Namecheap, GoDaddy, etc.).
            Some providers want only the part before your domain in the name field. Then click <strong>Verify</strong>. DNS changes and the SSL certificate can take a few minutes to a few hours.
          </p>
          <DnsRecord
            type="CNAME"
            name={row.domain}
            value={cnameTarget}
            note={row.domain.split('.').length === 2
              ? `Root domains need a DNS provider that supports CNAME flattening or ALIAS records (e.g. Cloudflare). Otherwise add www.${row.domain} instead and forward ${row.domain} to it.`
              : undefined}
          />
          <DnsRecord
            type="TXT"
            name={`${DOMAIN_VERIFY_TXT_PREFIX}.${row.domain}`}
            value={row.verification_token}
            note="This proves you own the domain — required even if you already added the CNAME record."
          />
        </div>
      )}
    </div>
  );
}

function DnsRecord({
  type, name, value, note,
}: { type: string; name: string; value: string; note?: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {
      /* noop */
    }
  };
  return (
    <div className="rounded-md border bg-background p-3 space-y-1.5">
      <div className="grid grid-cols-[60px_minmax(0,1fr)_minmax(0,1fr)_auto] items-center gap-2 text-xs font-mono">
        <Badge variant="outline" className="justify-center">{type}</Badge>
        <span className="text-muted-foreground break-all">{name}</span>
        <span className="break-all">{value}</span>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => copy(value)}>
          {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
        </Button>
      </div>
      {note && <p className="text-[11px] text-muted-foreground">{note}</p>}
    </div>
  );
}
