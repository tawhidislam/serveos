import { Link, useLocation, useParams } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { Menu, X } from 'lucide-react';
import { useSettings } from '@/hooks/useSettings';
import { useAuth } from '@/hooks/useAuth';
import { AnimatePresence, motion } from 'framer-motion';
import TenantLogo from '@/components/TenantLogo';

const baseLinks = [
  { key: '', label: 'Home' },
  { key: 'about', label: 'About' },
  { key: 'menu', label: 'Menu' },
  { key: 'gallery', label: 'Gallery' },
  { key: 'contact', label: 'Contact' },
];

export default function WebsiteNav({ slugOverride, showAccount }: { slugOverride?: string; showAccount?: boolean } = {}) {
  const { data: settings, isLoading } = useSettings();
  const { user, getDashboardPath } = useAuth();
  const location = useLocation();
  const params = useParams<{ slug?: string }>();
  const slug = slugOverride ?? params.slug;
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => setMobileOpen(false), [location.pathname]);

  useEffect(() => {
    const desktop = window.matchMedia('(min-width: 1280px)');
    const closeOnDesktop = () => { if (desktop.matches) setMobileOpen(false); };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMobileOpen(false);
    };
    desktop.addEventListener('change', closeOnDesktop);
    window.addEventListener('keydown', closeOnEscape);
    return () => {
      desktop.removeEventListener('change', closeOnDesktop);
      window.removeEventListener('keydown', closeOnEscape);
    };
  }, []);

  // When viewing /r/:slug/* keep nav links scoped to the same tenant.
  const prefix = slug ? `/r/${slug}` : '';
  const navLinks = baseLinks.map(l => ({
    to: l.key ? `${prefix}/${l.key}` : (prefix || '/'),
    label: l.label,
  }));
  const orderHref = `${prefix}/menu`;
  const loginHref = slug ? `${prefix}/login` : '/auth';
  const accountHref = slug ? `${prefix}/account` : '/account';
  const dashboardHref = user ? (getDashboardPath() === '/account' ? accountHref : getDashboardPath()) : null;

  return (
    <nav style={{ backgroundColor: 'var(--tmpl-nav-bg, rgba(0,0,0,0.7))' }} className="fixed top-0 left-0 right-0 z-50 backdrop-blur-xl border-b border-white/[0.05]">
      <div className="max-w-6xl mx-auto px-6 sm:px-10 lg:px-16">
        <div className="flex items-center justify-between gap-4 h-[72px]">
          {/* Logo */}
          <Link to={prefix || '/'} className="flex min-w-0 items-center gap-3">
            <TenantLogo
              sizeClassName="h-9 w-9"
              roundedClassName="rounded-lg"
              bgClassName="bg-[color:var(--tmpl-nav-accent,#f59e0b)]"
              fallbackTextClassName="text-[color:var(--tmpl-nav-bg,#000)] text-sm font-bold"
              imgFitClassName="object-cover"
            />
            {/* Hide name while loading so we don't flash 'RestaurantOS' before the real name. */}
            <span
              className={`truncate text-sm font-bold text-[color:var(--tmpl-nav-text,#fff)] tracking-wide transition-opacity duration-150 ${
                isLoading ? 'opacity-0' : 'opacity-100'
              }`}
            >
              {settings?.restaurant_name || 'RestaurantOS'}
            </span>
          </Link>

          {/* Desktop links */}
          <div className="hidden xl:flex shrink-0 items-center gap-1">
            {navLinks.map(link => (
              <Link
                key={link.to}
                to={link.to}
                aria-current={location.pathname === link.to ? 'page' : undefined}
                className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors duration-200 ${
                  location.pathname === link.to
                    ? 'text-[color:var(--tmpl-nav-accent,#f59e0b)]'
                    : 'text-[color:var(--tmpl-nav-text,#fff)] opacity-60 hover:opacity-100'
                }`}
              >
                {link.label}
              </Link>
            ))}
          {showAccount && !user && (
            <Link
              to={accountHref}
              className="ml-4 px-4 py-2 text-sm font-medium text-[color:var(--tmpl-nav-text,#fff)] opacity-70 hover:opacity-100 transition-colors"
            >
              My Account
            </Link>
          )}
          {user ? (
            <Link
              to={dashboardHref!}
              className="ml-4 px-4 py-2 text-sm font-medium text-[color:var(--tmpl-nav-text,#fff)] opacity-70 hover:opacity-100 transition-colors"
            >
              Dashboard
            </Link>
          ) : (
            <Link
              to={loginHref}
              className={`${showAccount ? 'ml-2' : 'ml-4'} px-4 py-2 text-sm font-medium text-[color:var(--tmpl-nav-text,#fff)] opacity-70 hover:opacity-100 transition-colors`}
            >
              Login
            </Link>
          )}
          <Link
            to={orderHref}
            className="ml-2 px-6 py-2.5 text-sm font-bold bg-[color:var(--tmpl-nav-accent,#f59e0b)] hover:opacity-90 text-[color:var(--tmpl-nav-bg,#000)] rounded-full transition-all duration-300"
          >
            Order Now
          </Link>
        </div>

          {/* Mobile toggle */}
          <button
            onClick={() => setMobileOpen(p => !p)}
            type="button"
            aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={mobileOpen}
            aria-controls="restaurant-mobile-navigation"
            className="xl:hidden shrink-0 p-2 text-[color:var(--tmpl-nav-text,#fff)] opacity-70 hover:opacity-100"
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            id="restaurant-mobile-navigation"
            style={{ backgroundColor: 'var(--tmpl-nav-bg, rgba(0,0,0,0.95))' }}
            className="xl:hidden max-h-[calc(100dvh-72px)] overflow-y-auto bg-black/95 backdrop-blur-xl border-b border-white/[0.05]"
          >
            <div className="px-6 py-6 space-y-1">
              {navLinks.map(link => (
                <Link
                  key={link.to}
                  to={link.to}
                aria-current={location.pathname === link.to ? 'page' : undefined}
                  onClick={() => setMobileOpen(false)}
                  className={`block py-3 px-4 text-sm font-medium rounded-lg transition-colors ${
                    location.pathname === link.to
                      ? 'text-[color:var(--tmpl-nav-accent,#f59e0b)] bg-amber-500/10'
                      : 'text-[color:var(--tmpl-nav-text,#fff)] opacity-60 hover:opacity-100'
                  }`}
                >
                  {link.label}
                </Link>
              ))}
              {showAccount && !user && (
                <Link
                  to={accountHref}
                  onClick={() => setMobileOpen(false)}
                  className="block py-3 px-4 text-sm font-medium text-[color:var(--tmpl-nav-text,#fff)] opacity-60 hover:opacity-100 rounded-lg"
                >
                  My Account
                </Link>
              )}
              {user ? (
                <Link
                  to={dashboardHref!}
                  onClick={() => setMobileOpen(false)}
                  className="block py-3 px-4 text-sm font-medium text-[color:var(--tmpl-nav-text,#fff)] opacity-60 hover:opacity-100 rounded-lg"
                >
                  Dashboard
                </Link>
              ) : (
                <Link
                  to={loginHref}
                  onClick={() => setMobileOpen(false)}
                  className="block py-3 px-4 text-sm font-medium text-[color:var(--tmpl-nav-text,#fff)] opacity-60 hover:opacity-100 rounded-lg"
                >
                  Login
                </Link>
              )}
              <Link
                to={orderHref}
                onClick={() => setMobileOpen(false)}
                className="block mt-4 py-3 text-sm font-bold bg-[color:var(--tmpl-nav-accent,#f59e0b)] text-[color:var(--tmpl-nav-bg,#000)] text-center rounded-full"
              >
                Order Now
              </Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
}
