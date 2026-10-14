import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Globe, Lock, Sparkles, Clock, CheckCircle2, XCircle, Send, X } from 'lucide-react';
import { toast } from 'sonner';

interface Props {
  restaurantId: string;
}

const DOMAIN_RE = /^([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/i;

function normalize(input: string): string {
  return input.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '');
}

const statusMeta: Record<string, { label: string; color: string; icon: any }> = {
  pending: { label: 'Pending review', color: 'bg-amber-500/15 text-amber-600 border-transparent', icon: Clock },
  approved: { label: 'Approved — set up DNS', color: 'bg-primary/15 text-primary border-transparent', icon: CheckCircle2 },
  rejected: { label: 'Rejected', color: 'bg-destructive/15 text-destructive border-transparent', icon: XCircle },
  completed: { label: 'Live', color: 'bg-emerald-500/15 text-emerald-600 border-transparent', icon: CheckCircle2 },
};

export default function RequestCustomDomainCard({ restaurantId }: Props) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [domain, setDomain] = useState('');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const { data: requests, isLoading } = useQuery({
    queryKey: ['custom-domain-requests', restaurantId],
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

  const activeRequest = (requests ?? []).find((r) => r.status === 'pending' || r.status === 'approved');

  const handleSubmit = async () => {
    const normalized = normalize(domain);
    if (!DOMAIN_RE.test(normalized)) {
      toast.error('Enter a valid domain like bellacucina.com');
      return;
    }
    setSubmitting(true);
    try {
      const { error } = await supabase.from('custom_domain_requests').insert({
        restaurant_id: restaurantId,
        requested_domain: normalized,
        requested_by: user?.id ?? null,
        message: message.trim() || null,
      });
      if (error) throw error;
      toast.success('Request submitted', {
        description: 'We\'ll review and unlock custom domain on your plan shortly.',
      });
      setDomain('');
      setMessage('');
      qc.invalidateQueries({ queryKey: ['custom-domain-requests', restaurantId] });
    } catch (e: any) {
      toast.error(e?.message ?? 'Failed to submit request');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancel = async (id: string) => {
    const { error } = await supabase.from('custom_domain_requests').delete().eq('id', id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success('Request cancelled');
    qc.invalidateQueries({ queryKey: ['custom-domain-requests', restaurantId] });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Globe className="h-4 w-4" /> Custom domain
          <Badge variant="outline" className="ml-1 gap-1 text-[10px]">
            <Lock className="h-3 w-3" /> Pro / Enterprise
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-start gap-3 rounded-md border border-border bg-gradient-to-br from-primary/5 to-transparent p-4">
          <Sparkles className="h-4 w-4 mt-0.5 text-primary shrink-0" />
          <div className="space-y-1">
            <p className="text-sm font-medium">Serve your menu on your own domain</p>
            <p className="text-xs text-muted-foreground">
              Replace <span className="font-mono">/r/{'{slug}'}/menu</span> with your branded URL like
              {' '}<span className="font-mono">bellacucina.com</span>. Available on Pro and Enterprise plans —
              request setup below and our team will unlock it for you.
            </p>
          </div>
        </div>

        {!isLoading && activeRequest && (() => {
          const meta = statusMeta[activeRequest.status] ?? statusMeta.pending;
          const Icon = meta.icon;
          return (
            <div className="rounded-md border border-border bg-card p-3 space-y-2">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2 min-w-0">
                  <Badge variant="outline" className={`gap-1 text-[10px] ${meta.color}`}>
                    <Icon className="h-3 w-3" /> {meta.label}
                  </Badge>
                  <code className="text-xs font-mono truncate">{activeRequest.requested_domain}</code>
                </div>
                {activeRequest.status === 'pending' && (
                  <Button size="sm" variant="ghost" onClick={() => handleCancel(activeRequest.id)}>
                    <X className="h-3.5 w-3.5 mr-1" /> Cancel
                  </Button>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                Requested {new Date(activeRequest.created_at).toLocaleDateString()}
                {activeRequest.reviewed_at && ` · reviewed ${new Date(activeRequest.reviewed_at).toLocaleDateString()}`}
              </p>
              {activeRequest.admin_notes && (
                <p className="text-xs rounded bg-muted/50 px-2 py-1.5">
                  <span className="font-medium">Note from team:</span> {activeRequest.admin_notes}
                </p>
              )}
              {activeRequest.status === 'approved' && (
                <p className="text-xs text-primary">
                  Your plan has been upgraded — head back to this page to enter the domain and follow the DNS guide below.
                </p>
              )}
            </div>
          );
        })()}

        {!isLoading && !activeRequest && (
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="req-domain">Domain you want to use</Label>
              <Input
                id="req-domain"
                value={domain}
                onChange={(e) => setDomain(e.target.value)}
                placeholder="bellacucina.com"
                autoCapitalize="off"
                autoCorrect="off"
                spellCheck={false}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="req-message">Message (optional)</Label>
              <Textarea
                id="req-message"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={2}
                placeholder="Anything we should know — preferred go-live date, current DNS provider, etc."
              />
            </div>
            <div className="flex justify-end">
              <Button onClick={handleSubmit} disabled={submitting || !domain.trim()}>
                <Send className="h-3.5 w-3.5 mr-1.5" />
                {submitting ? 'Submitting…' : 'Request setup'}
              </Button>
            </div>
          </div>
        )}

        {!isLoading && (requests ?? []).some((r) => r.status === 'rejected') && (
          <details className="text-xs">
            <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
              Show past requests
            </summary>
            <div className="mt-2 space-y-1.5">
              {(requests ?? []).filter((r) => r.status === 'rejected').map((r) => (
                <div key={r.id} className="rounded border border-border bg-muted/20 p-2 flex items-center gap-2">
                  <XCircle className="h-3 w-3 text-destructive shrink-0" />
                  <code className="font-mono">{r.requested_domain}</code>
                  <span className="text-muted-foreground ml-auto">
                    {new Date(r.created_at).toLocaleDateString()}
                  </span>
                </div>
              ))}
            </div>
          </details>
        )}
      </CardContent>
    </Card>
  );
}
