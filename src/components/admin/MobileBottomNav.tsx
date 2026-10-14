import { useLocation, Link } from 'react-router-dom';
import { LayoutDashboard, ShoppingCart, Monitor, LayoutGrid } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';

const navItems = [
  { label: 'Dashboard', path: '/admin', icon: LayoutDashboard, exact: true },
  { label: 'Orders', path: '/admin/orders', icon: ShoppingCart },
  { label: 'POS', path: '/admin/pos', icon: Monitor },
  { label: 'Tables', path: '/admin/tables', icon: LayoutGrid },
];

export default function MobileBottomNav() {
  const isMobile = useIsMobile();
  const { pathname } = useLocation();

  if (!isMobile) return null;

  return (
    <nav className="fixed bottom-0 inset-x-0 z-50 bg-card/95 backdrop-blur-md border-t border-border safe-area-bottom">
      <div className="grid grid-cols-4 h-16">

        {navItems.map(item => {
          const active = item.exact ? pathname === item.path : pathname.startsWith(item.path);
          return (
            <Link
              key={item.path}
              to={item.path}
              className={`flex flex-col items-center justify-center gap-0.5 text-[10px] font-medium transition-colors ${
                active
                  ? 'text-primary'
                  : 'text-muted-foreground'
              }`}
            >
              <item.icon className="h-5 w-5" strokeWidth={active ? 2 : 1.5} />
              {item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
