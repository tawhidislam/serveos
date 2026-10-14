import { Link } from 'react-router-dom';
import { History, LogIn, Search, X } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import { useSettings } from '@/hooks/useSettings';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';

interface MenuHeaderProps {
  tableName?: string | null;
  tableId?: string | null;
  user: any;
  isStaff: boolean;
  waiterMode: boolean;
  onToggleWaiterMode: () => void;
  selectedTable: string;
  onSelectTable: (v: string) => void;
  allTables: { id: string; label: string }[];
  searchQuery: string;
  onSearchChange: (q: string) => void;
}

export default function MenuHeader({
  tableName, tableId, user, isStaff, waiterMode,
  onToggleWaiterMode, selectedTable, onSelectTable, allTables,
  searchQuery, onSearchChange,
}: MenuHeaderProps) {
  const [searchOpen, setSearchOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const { data: settings } = useSettings();

  useEffect(() => {
    if (searchOpen && inputRef.current) inputRef.current.focus();
  }, [searchOpen]);

  const clearSearch = () => {
    onSearchChange('');
    setSearchOpen(false);
  };

  // In waiter mode, use a simpler header
  if (waiterMode) {
    return (
      <div className="sticky top-0 z-30 bg-card/80 backdrop-blur-xl border-b border-border/50">
        <div className="px-4 py-4 flex items-center gap-3">
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-display font-bold tracking-tight text-foreground">New Order</h1>
          </div>
          <button
            onClick={() => setSearchOpen(p => !p)}
            className={`p-2 rounded-full transition-colors ${searchOpen || searchQuery ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:text-foreground hover:bg-secondary'}`}
          >
            <Search className="h-4 w-4" strokeWidth={1.5} />
          </button>
        </div>
        {searchOpen && (
          <div className="px-4 pb-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" strokeWidth={1.5} />
              <input ref={inputRef} type="text" value={searchQuery} onChange={(e) => onSearchChange(e.target.value)} placeholder="Search dishes…"
                className="w-full h-10 rounded-xl border border-input bg-background pl-10 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-ring placeholder:text-muted-foreground/60" />
              {searchQuery && <button onClick={clearSearch} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"><X className="h-4 w-4" strokeWidth={1.5} /></button>}
            </div>
          </div>
        )}
        <div className="px-4 pb-3">
          <Select value={selectedTable} onValueChange={onSelectTable}>
            <SelectTrigger className="h-9"><SelectValue placeholder="Select table…" /></SelectTrigger>
            <SelectContent>
              {allTables.map(t => <SelectItem key={t.id} value={t.id}>{t.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Hero banner for menu */}
      <div className="relative pt-[72px]">
        <div className="bg-[#070707] py-16 sm:py-24 px-6 sm:px-10 lg:px-16 relative overflow-hidden">
          {/* Decorative elements */}
          <div className="absolute inset-0 bg-gradient-to-b from-amber-500/[0.03] to-transparent" />
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-amber-500/[0.04] rounded-full blur-3xl" />

          <div className="relative z-10 max-w-6xl mx-auto">
            {tableName ? (
              <>
                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 mb-5">
                  <span className="h-2 w-2 rounded-full bg-primary animate-pulse" />
                  <span className="text-primary text-sm font-bold uppercase tracking-wider">{tableName}</span>
                </div>
                <h1 className="text-4xl sm:text-5xl lg:text-6xl font-display font-extrabold text-white tracking-tight leading-[0.95] mb-4">
                  Order from<br />Your Table
                </h1>
                <p className="text-white/40 text-lg max-w-xl leading-relaxed">
                  Browse our menu and place your order — it'll be sent straight to the kitchen.
                </p>
              </>
            ) : (
              <>
                <p className="text-primary text-sm font-semibold uppercase tracking-wider mb-3">Browse & Order</p>
                <h1 className="text-4xl sm:text-5xl lg:text-6xl font-display font-extrabold text-white tracking-tight leading-[0.95] mb-4">
                  Our Menu
                </h1>
                <p className="text-white/40 text-lg max-w-xl leading-relaxed">
                  Explore our carefully curated selection of dishes, crafted with passion and the finest ingredients.
                </p>
              </>
            )}

            {/* Search bar */}
            <div className="mt-8 max-w-md">
              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-white/30" strokeWidth={1.5} />
                <input
                  ref={inputRef}
                  type="text"
                  value={searchQuery}
                  onChange={(e) => onSearchChange(e.target.value)}
                  placeholder="Search dishes…"
                  className="w-full h-12 rounded-full bg-white/[0.06] border border-white/[0.08] pl-11 pr-11 text-sm text-white placeholder:text-white/25 focus:outline-none focus:ring-2 focus:ring-amber-500/40 focus:border-amber-500/30 transition-all"
                />
                {searchQuery && (
                  <button onClick={clearSearch} className="absolute right-4 top-1/2 -translate-y-1/2 text-white/30 hover:text-white">
                    <X className="h-4 w-4" strokeWidth={1.5} />
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="relative z-10 max-w-6xl mx-auto mt-6 flex items-center gap-4">
            {user && (
              <Link to="/orders" className="inline-flex items-center gap-2 text-white/40 hover:text-amber-500 text-sm font-medium transition-colors">
                <History className="h-4 w-4" strokeWidth={1.5} />
                My Orders
              </Link>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
