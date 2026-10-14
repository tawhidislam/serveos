import { useEffect, useState } from 'react';
import { useParams, Navigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { getDeviceHash } from '@/lib/device-hash';

/**
 * Short QR/NFC link resolver: /t/AB12
 *
 * Printed codes point here instead of at a table UUID, so a code can be
 * re-pointed to another table (or deactivated) without reprinting. Each visit
 * is logged for scan analytics by the `resolve_qr_short_link` RPC.
 */
export default function ShortLinkPage() {
  const { code } = useParams<{ code: string }>();
  const [searchParams] = useSearchParams();
  const [state, setState] = useState<'loading' | 'invalid'>('loading');
  const [tableId, setTableId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!code) {
        setState('invalid');
        return;
      }
      const { data, error } = await supabase.rpc('resolve_qr_short_link', {
        _code: code,
        _device_hash: getDeviceHash(),
        _referrer: document.referrer || null,
        _user_agent: navigator.userAgent,
      });
      if (cancelled) return;
      const row = Array.isArray(data) ? data[0] : null;
      if (error || !row?.table_id) {
        setState('invalid');
        return;
      }
      setTableId(row.table_id as string);
    })();
    return () => {
      cancelled = true;
    };
  }, [code]);

  if (tableId) {
    const qs = searchParams.toString();
    return <Navigate to={`/table/${tableId}${qs ? `?${qs}` : ''}`} replace />;
  }

  if (state === 'invalid') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-6">
        <div className="text-center max-w-sm">
          <h1 className="font-display text-xl font-bold text-foreground mb-2">This code isn’t active</h1>
          <p className="text-sm text-muted-foreground">
            Ask a staff member for help — the QR code may have been retired or reassigned.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center">
        <div className="h-10 w-10 rounded-full border-2 border-primary border-t-transparent animate-spin mx-auto mb-4" />
        <p className="text-muted-foreground text-sm">Opening your table…</p>
      </div>
    </div>
  );
}
