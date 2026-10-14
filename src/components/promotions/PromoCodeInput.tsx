import { useState } from 'react';
import { Tag, X, Check, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { calculateDiscount, isHappyHourActive, type Promotion } from '@/hooks/usePromotions';
import { toast } from 'sonner';

interface PromoCodeInputProps {
  orderTotal: number;
  appliedPromo: Promotion | null;
  onApply: (promo: Promotion, discount: number) => void;
  onRemove: () => void;
  format: (n: number) => string;
}

export default function PromoCodeInput({ orderTotal, appliedPromo, onApply, onRemove, format }: PromoCodeInputProps) {
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);

  const handleApply = async () => {
    if (!code.trim()) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('promotions' as any)
        .select('*')
        .eq('promo_code', code.trim().toUpperCase())
        .eq('is_active', true)
        .single();
      if (error || !data) {
        toast.error('Invalid promo code');
        return;
      }
      const promo = data as unknown as Promotion;
      const now = new Date();
      if (new Date(promo.starts_at) > now) { toast.error('This promotion hasn\'t started yet'); return; }
      if (promo.ends_at && new Date(promo.ends_at) < now) { toast.error('This promo code has expired'); return; }
      if (promo.max_uses && promo.used_count >= promo.max_uses) { toast.error('This promo code has reached its usage limit'); return; }
      if (promo.type === 'happy_hour' && !isHappyHourActive(promo)) { toast.error('This offer is only valid during happy hours'); return; }

      const discount = calculateDiscount(promo, orderTotal);
      if (discount <= 0) {
        toast.error(`Minimum order of $${promo.min_order_amount} required`);
        return;
      }
      onApply(promo, discount);
      setCode('');
      toast.success(`Promo applied! You save ${format(discount)}`);
    } catch {
      toast.error('Failed to apply code');
    } finally {
      setLoading(false);
    }
  };

  if (appliedPromo) {
    const discount = calculateDiscount(appliedPromo, orderTotal);
    return (
      <div className="flex items-center justify-between bg-success/5 border border-success/20 rounded-xl px-3 py-2">
        <div className="flex items-center gap-2 min-w-0">
          <Check className="h-4 w-4 text-success shrink-0" strokeWidth={2.5} />
          <div className="min-w-0">
            <span className="text-xs font-semibold text-success block truncate">{appliedPromo.name}</span>
            <span className="text-[11px] text-muted-foreground">-{format(discount)}</span>
          </div>
        </div>
        <button onClick={onRemove} className="p-1 text-muted-foreground hover:text-destructive transition-colors">
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    );
  }

  return (
    <div className="flex gap-2">
      <div className="relative flex-1">
        <Tag className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/40" strokeWidth={1.5} />
        <input
          value={code}
          onChange={e => setCode(e.target.value.toUpperCase())}
          onKeyDown={e => e.key === 'Enter' && handleApply()}
          placeholder="Promo code"
          className="w-full h-9 rounded-lg bg-secondary border border-border pl-9 pr-3 text-xs font-mono text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-ring/40"
        />
      </div>
      <button
        onClick={handleApply}
        disabled={!code.trim() || loading}
        className="h-9 px-3 rounded-lg bg-primary text-primary-foreground text-xs font-semibold disabled:opacity-50 hover:bg-primary/90 transition-colors flex items-center gap-1"
      >
        {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Apply'}
      </button>
    </div>
  );
}
