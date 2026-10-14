import { Check, ChevronDown } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { SUPPORTED_CURRENCIES } from '@/lib/currency';
import { usePlatformCurrency } from '@/hooks/usePlatformCurrency';

interface Props {
  /** Visual variant: compact (nav) or full-width (mobile menu / billing). */
  variant?: 'compact' | 'block';
  className?: string;
}

/**
 * Manual currency selector for the marketing + checkout surfaces. Reads/writes
 * the shared platform-currency context (persisted to localStorage), so every
 * pricing surface reflects the same choice.
 */
export default function CurrencySwitcher({ variant = 'compact', className }: Props) {
  const { currency, setCurrency, options } = usePlatformCurrency();
  const active = SUPPORTED_CURRENCIES.find((c) => c.code === currency);
  // Nothing to choose between: prices exist in a single currency.
  if (options.length <= 1) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={
          variant === 'block'
            ? `inline-flex w-full items-center justify-between gap-2 rounded-lg border border-border/60 px-4 py-3 text-[15px] font-medium text-foreground transition-colors hover:bg-muted/60 ${className ?? ''}`
            : `inline-flex items-center gap-1 rounded-full px-3 py-2 text-[13.5px] font-medium text-muted-foreground transition-colors hover:text-foreground ${className ?? ''}`
        }
        aria-label="Select currency"
      >
        <span className="tabular-nums">
          {active ? `${active.symbol} ${active.code}` : currency}
        </span>
        <ChevronDown className="h-3.5 w-3.5 opacity-60" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="max-h-80 overflow-y-auto">
        {options.map((c) => (
          <DropdownMenuItem
            key={c.code}
            onClick={() => setCurrency(c.code)}
            className="flex items-center justify-between gap-6"
          >
            <span className="flex items-center gap-2">
              <span className="inline-block w-10 tabular-nums text-muted-foreground">
                {c.symbol}
              </span>
              <span>{c.name}</span>
            </span>
            <span className="flex items-center gap-2 text-muted-foreground">
              <span className="text-xs">{c.code}</span>
              {c.code === currency && <Check className="h-4 w-4 text-primary" />}
            </span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
