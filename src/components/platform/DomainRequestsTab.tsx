import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { CheckCircle2, XCircle, Clock, Inbox } from 'lucide-react';
import { toast } from 'sonner';
import { customDomainAction } from '@/lib/custom-domains';

interface Props {
  restaurantId: string;
}

export default function DomainRequestsTab({ restaurantId }: Props) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [notesById, setNotesById] = useState<Record<string, string>>({});
  const [savingId, setSavingId] = useState<string | null>(null);

  const { data: requests, isLoading } = useQuery({
    queryKey: ['platform-domain-requests', restaurantId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('custom_domain_requests')
        .select('id, requested_domain, status, message, admin_notes, created_at, reviewed_at')
        .eq('restaurant_id', restaurantId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const setStatus = async (
    id: string,
    status: 'approved' | 'rejected' | 'completed',
    requestedDomain?: string,
  ) => {
    setSavingId(id);
    try {
      const { error } = await supabase
        .from('custom_domain_requests')
        .update({
          status,
          admin_notes: notesById[id] ?? undefined,
          reviewed_by: user?.id ?? null,
          reviewed_at: new Date().toISOString(),
        })
        .eq('id', id);
      if (error) throw error;

      // When marking the request live, add the domain to the multi-domain
      // table as already-verified. Tenants can have unlimited domains here.
      // Use upsert on the unique `domain` column so re-marking live is safe.
      if (status === 'completed' && requestedDomain) {
        const { data: domainRow, error: domainErr } = await supabase
          .from('restaurant_custom_domains')
          .upsert(
            {
              restaurant_id: restaurantId,
              domain: requestedDomain,
            },
            { onConflict: 'domain' },
          )
          .select('id')
          .single();
        if (domainErr) throw domainErr;
        // Registers the hostname with Cloudflare and marks it verified.
        await customDomainAction({ action: 'set_verified', domainId: domainRow.id, verified: true });
      }

      toast.success(`Request ${status}`);
      qc.invalidateQueries({ queryKey: ['platform-domain-requests', restaurantId] });
      qc.invalidateQueries({ queryKey: ['custom-domain-requests', restaurantId] });
      qc.invalidateQueries({ queryKey: ['platform-tenants'] });
      qc.invalidateQueries({ queryKey: ['current-restaurant'] });
      qc.invalidateQueries({ queryKey: ['active-restaurant-id'] });
      qc.invalidateQueries({ queryKey: ['custom-domain-restaurant'] });
    } catch (e: any) {
      toast.error(e?.message ?? 'Failed to update');
    } finally {
      setSavingId(null);
    }
  };

  if (isLoading) {
    return (
      <div className="py-8 flex justify-center">
        <div className="h-5 w-5 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }

  if (!requests || requests.length === 0) {
    return (
      <div className="py-10 text-center text-sm text-muted-foreground flex flex-col items-center gap-2">
        <Inbox className="h-8 w-8 opacity-40" />
        No domain requests from this tenant yet.
      </div>
    );
  }

  const statusBadge = (status: string) => {
    if (status === 'pending') return <Badge variant="outline" className="gap-1 text-[10px] bg-amber-500/15 text-amber-600 border-transparent"><Clock className="h-3 w-3" />Pending</Badge>;
    if (status === 'approved') return <Badge variant="outline" className="gap-1 text-[10px] bg-primary/15 text-primary border-transparent"><CheckCircle2 className="h-3 w-3" />Approved</Badge>;
    if (status === 'rejected') return <Badge variant="outline" className="gap-1 text-[10px] bg-destructive/15 text-destructive border-transparent"><XCircle className="h-3 w-3" />Rejected</Badge>;
    if (status === 'completed') return <Badge variant="outline" className="gap-1 text-[10px] bg-emerald-500/15 text-emerald-600 border-transparent"><CheckCircle2 className="h-3 w-3" />Live</Badge>;
    return <Badge variant="outline" className="text-[10px]">{status}</Badge>;
  };

  return (
    <div className="space-y-3">
      {requests.map((r) => (
        <div key={r.id} className="rounded-md border border-border bg-card p-3 space-y-2">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2 min-w-0">
              {statusBadge(r.status)}
              <code className="text-xs font-mono truncate">{r.requested_domain}</code>
            </div>
            <span className="text-[11px] text-muted-foreground">
              {new Date(r.created_at).toLocaleDateString()}
            </span>
          </div>

          {r.message && (
            <p className="text-xs rounded bg-muted/40 px-2 py-1.5">
              <span className="font-medium">Owner note:</span> {r.message}
            </p>
          )}

          {(r.status === 'pending' || r.status === 'approved') && (
            <>
              <Textarea
                rows={2}
                placeholder="Optional reply to owner (saved with the decision)"
                value={notesById[r.id] ?? r.admin_notes ?? ''}
                onChange={(e) => setNotesById((prev) => ({ ...prev, [r.id]: e.target.value }))}
                className="text-xs"
              />
              <div className="flex flex-wrap items-center gap-2 justify-end">
                {r.status === 'pending' && (
                  <>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setStatus(r.id, 'rejected')}
                      disabled={savingId === r.id}
                      className="text-destructive hover:text-destructive"
                    >
                      <XCircle className="h-3.5 w-3.5 mr-1" /> Reject
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => setStatus(r.id, 'approved')}
                      disabled={savingId === r.id}
                    >
                      <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Approve
                    </Button>
                  </>
                )}
                {r.status === 'approved' && (
                  <Button
                    size="sm"
                    onClick={() => setStatus(r.id, 'completed', r.requested_domain)}
                    disabled={savingId === r.id}
                  >
                    <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Mark live
                  </Button>
                )}
              </div>
              {r.status === 'pending' && (
                <p className="text-[11px] text-muted-foreground">
                  Tip: After approving, also bump the tenant's plan to <b>Pro</b> in the Plan tab so they can save the domain.
                </p>
              )}
            </>
          )}

          {r.admin_notes && (r.status === 'rejected' || r.status === 'completed') && (
            <p className="text-xs rounded bg-muted/30 px-2 py-1.5 text-muted-foreground">
              <span className="font-medium text-foreground">Reply:</span> {r.admin_notes}
            </p>
          )}
        </div>
      ))}
    </div>
  );
}
