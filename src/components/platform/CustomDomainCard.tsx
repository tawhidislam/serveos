import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Globe, Copy, AlertCircle, CheckCircle2, Lock, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { customDomainAction } from '@/lib/custom-domains';
import { useCustomDomainCnameTarget } from '@/hooks/usePlatformSettings';

interface Props {
  restaurantId: string;
  /** When false, shows an upgrade lock instead of the form */
  unlocked?: boolean;
  /** Show per-domain verification controls (platform admins only) */
  canMarkVerified?: boolean;
  /** Show as plain section without Card wrapper */
  embedded?: boolean;
  onChanged?: () => void;
}

interface DomainRow {
  id: string;
  domain: string;
  verified: boolean;
  verified_at: string | null;
  created_at: string;
}

const DOMAIN_RE = /^([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/i;

function normalize(input: string): string {
  return input.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '');
}

export default function CustomDomainCard({
  restaurantId,
  unlocked = true,
  canMarkVerified = false,
  embedded = false,
  onChanged,
}: Props) {
  const qc = useQueryClient();
  const cnameTarget = useCustomDomainCnameTarget();
  const [newDomain, setNewDomain] = useState('');
  const [adding, setAdding] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const { data: domains, isLoading } = useQuery<DomainRow[]>({
    queryKey: ['restaurant-custom-domains', restaurantId],
    enabled: unlocked && !!restaurantId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('restaurant_custom_domains')
        .select('id, domain, verified, verified_at, created_at')
        .eq('restaurant_id', restaurantId)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return (data ?? []) as DomainRow[];
    },
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['restaurant-custom-domains', restaurantId] });
    qc.invalidateQueries({ queryKey: ['platform-tenants'] });
    qc.invalidateQueries({ queryKey: ['current-restaurant'] });
    qc.invalidateQueries({ queryKey: ['custom-domain-restaurant'] });
    onChanged?.();
  };

  const handleAdd = async () => {
    const next = normalize(newDomain);
    if (!next || !DOMAIN_RE.test(next)) {
      toast.error('Enter a valid domain like bellacucina.com');
      return;
    }
    setAdding(true);
    try {
      const { error } = await supabase.from('restaurant_custom_domains').insert({
        restaurant_id: restaurantId,
        domain: next,
      });
      if (error) throw error;
      toast.success('Domain added — set up DNS to go live');
      setNewDomain('');
      invalidate();
    } catch (e: any) {
      toast.error(e?.message ?? 'Failed to add domain');
    } finally {
      setAdding(false);
    }
  };

  const handleDelete = async (id: string) => {
    setBusyId(id);
    try {
      await customDomainAction({ action: 'remove', domainId: id });
      toast.success('Domain removed');
      invalidate();
    } catch (e: any) {
      toast.error(e?.message ?? 'Failed to remove domain');
    } finally {
      setBusyId(null);
    }
  };

  const handleVerifyToggle = async (row: DomainRow) => {
    setBusyId(row.id);
    try {
      const next = !row.verified;
      await customDomainAction({ action: 'set_verified', domainId: row.id, verified: next });
      toast.success(next ? 'Marked as verified' : 'Verification cleared');
      invalidate();
    } catch (e: any) {
      toast.error(e?.message ?? 'Failed to update');
    } finally {
      setBusyId(null);
    }
  };

  const copy = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Copied');
  };

  const Wrapper = embedded
    ? ({ children }: { children: React.ReactNode }) => <div className="space-y-4">{children}</div>
    : ({ children }: { children: React.ReactNode }) => (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Globe className="h-4 w-4" /> Custom domains
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">{children}</CardContent>
        </Card>
      );

  if (!unlocked) {
    return (
      <Wrapper>
        <div className="flex items-start gap-3 rounded-md border border-border bg-muted/30 p-4">
          <Lock className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
          <div className="space-y-1">
            <p className="text-sm font-medium">Available on Pro and Enterprise</p>
            <p className="text-xs text-muted-foreground">
              Upgrade your plan to serve your menu from your own domains (e.g. bellacucina.com).
            </p>
          </div>
        </div>
      </Wrapper>
    );
  }

  return (
    <Wrapper>
      {/* Add new domain */}
      <div className="space-y-2">
        <Label htmlFor="new-domain">Add a domain</Label>
        <div className="flex gap-2">
          <Input
            id="new-domain"
            value={newDomain}
            onChange={(e) => setNewDomain(e.target.value)}
            placeholder="bellacucina.com"
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleAdd();
              }
            }}
          />
          <Button onClick={handleAdd} disabled={adding || !newDomain.trim()}>
            <Plus className="h-4 w-4 mr-1" />
            {adding ? 'Adding…' : 'Add'}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          No <code>https://</code>, no trailing slash. Apex or subdomain both work. Add as many as you like.
        </p>
      </div>

      {/* Domain list */}
      {isLoading ? (
        <div className="py-6 flex justify-center">
          <div className="h-5 w-5 rounded-full border-2 border-primary border-t-transparent animate-spin" />
        </div>
      ) : (domains?.length ?? 0) === 0 ? (
        <div className="rounded-md border border-dashed border-border bg-muted/20 p-4 text-center">
          <p className="text-sm text-muted-foreground">No custom domains yet.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {domains!.map((row) => (
            <div
              key={row.id}
              className="rounded-md border border-border bg-card p-3 space-y-2"
            >
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2 min-w-0">
                  <code className="text-sm font-mono truncate">{row.domain}</code>
                  {row.verified ? (
                    <Badge variant="default" className="gap-1 text-[10px]">
                      <CheckCircle2 className="h-3 w-3" />Verified
                    </Badge>
                  ) : (
                    <Badge variant="secondary" className="gap-1 text-[10px]">
                      <AlertCircle className="h-3 w-3" />Pending DNS
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  {canMarkVerified && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleVerifyToggle(row)}
                      disabled={busyId === row.id}
                    >
                      {row.verified ? 'Mark unverified' : 'Mark verified'}
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDelete(row.id)}
                    disabled={busyId === row.id}
                    className="text-destructive hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {!row.verified && (
                <div className="rounded-md border border-border bg-muted/30 p-3 space-y-2">
                  <p className="text-xs font-medium">DNS setup for {row.domain}</p>
                  <div className="space-y-1.5 text-xs">
                    <div className="flex items-center justify-between gap-2 rounded bg-background border border-border px-2 py-1.5">
                      <span className="font-mono break-all">Type: <b>CNAME</b> · Name: <b>{row.domain}</b> · Value: <b>{cnameTarget}</b></span>
                      <Button size="sm" variant="ghost" onClick={() => copy(cnameTarget)}>
                        <Copy className="h-3 w-3" />
                      </Button>
                    </div>
                    <p className="text-muted-foreground">
                      Once the CNAME is in place, mark the domain verified to register it with Cloudflare and issue its SSL certificate.
                    </p>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </Wrapper>
  );
}
