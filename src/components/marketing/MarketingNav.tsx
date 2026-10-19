import { Link, useLocation } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { Menu, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { LayoutGroup, motion } from 'framer-motion';
import * as Dialog from '@radix-ui/react-dialog';
import PlatformLogo from './PlatformLogo';
import CurrencySwitcher from './CurrencySwitcher';
import { prefetchHandlers } from '@/lib/marketing-prefetch';

const links = [
  { to: '/features', label: 'Features' },
  { to: '/pricing', label: 'Pricing' },
  { to: '/demo', label: 'Demo' },
  { to: '/download', label: 'Download' },
  { to: '/about', label: 'About' },
  { to: '/contact', label: 'Contact' },
];

export default function MarketingNav() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const location = useLocation();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => setOpen(false), [location.pathname]);

  useEffect(() => {
    const desktop = window.matchMedia('(min-width: 1024px)');
    const closeOnDesktop = () => { if (desktop.matches) setOpen(false); };
    closeOnDesktop();
    desktop.addEventListener('change', closeOnDesktop);
    return () => desktop.removeEventListener('change', closeOnDesktop);
  }, []);

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
    <header
      className={`fixed inset-x-0 top-0 z-50 transition-all duration-300 ${
        scrolled
          ? 'bg-background/80 backdrop-blur-xl border-b border-border/60'
          : 'bg-background/95 border-b border-transparent'
      }`}
    >
      <nav className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between gap-4">
          {/* Logo */}
          <Link
            to="/"
            className="flex items-center min-w-0 flex-shrink-0 -ml-1 rounded-lg px-1 py-1 hover:opacity-80 transition-opacity"
            aria-label="Home"
          >
            <span className="block [&_img]:!h-6 sm:[&_img]:!h-7">
              <PlatformLogo />
            </span>
          </Link>

          {/* Desktop links — clean, no pill background */}
          <LayoutGroup id="marketing-nav">
            <div className="hidden lg:flex items-center gap-1 min-w-0">
              {links.map(l => {
                const isActive = location.pathname === l.to;
                return (
                  <Link
                    key={l.to}
                    to={l.to}
                    aria-current={isActive ? 'page' : undefined}
                    {...prefetchHandlers(l.to)}
                    className={`relative px-3 py-2 text-[13.5px] font-medium transition-colors duration-200 ${
                      isActive
                        ? 'text-foreground'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    <span className="relative">{l.label}</span>
                    {isActive && (
                      <motion.span
                        layoutId="nav-active-underline"
                        className="absolute left-3 right-3 bottom-1 h-[1.5px] bg-foreground rounded-full"
                        transition={{ type: 'spring', stiffness: 350, damping: 30, mass: 0.6 }}
                        style={{ originY: '0px' }}
                      />
                    )}
                  </Link>
                );
              })}
            </div>
          </LayoutGroup>

          {/* Desktop CTAs */}
          <div className="hidden lg:flex items-center gap-2 shrink-0">
            <CurrencySwitcher />
            <Link
              to="/login"
              {...prefetchHandlers('/login')}
              className="text-[13.5px] font-medium text-muted-foreground hover:text-foreground transition-colors px-3 py-2"
            >
              Sign in
            </Link>
            <Button asChild
                size="sm"
                className="rounded-full text-[13px] font-medium h-9 pl-4 pr-3.5 gap-1 group"
              >
                <Link to="/signup" onClick={() => setOpen(false)} {...prefetchHandlers('/signup')}>Get started
                <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                </Link>
              </Button>
          </div>

          {/* Mobile toggle */}
          <Dialog.Trigger asChild>
            <button
              type="button"
              className="lg:hidden -mr-1 h-10 w-10 inline-flex items-center justify-center rounded-lg text-foreground hover:bg-muted/60 transition-colors shrink-0"
              aria-label="Open menu"
            >
              <Menu className="h-5 w-5" />
            </button>
          </Dialog.Trigger>
        </div>
      </nav>

      {/* Portal avoids fixed positioning inside the header's backdrop filter. */}
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[60] bg-background/80" />
        <Dialog.Content aria-describedby={undefined} className="fixed inset-0 z-[61] bg-background lg:hidden">
          <div className="flex h-16 items-center justify-between border-b px-6">
            <Dialog.Title className="font-semibold">Navigation</Dialog.Title>
            <Dialog.Close asChild>
              <button type="button" className="h-10 px-3 rounded-lg hover:bg-muted" aria-label="Close menu">Close</button>
            </Dialog.Close>
          </div>
            <motion.div
              initial={{ y: -8, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: -8, opacity: 0 }}
              transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
              className="h-[calc(100dvh-4rem)] overflow-y-auto px-6 pt-6 pb-10"
            >
              <nav className="flex flex-col">
                {links.map((l, i) => {
                  const isActive = location.pathname === l.to;
                  return (
                    <motion.div
                      key={l.to}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.25, delay: 0.04 + i * 0.04, ease: [0.16, 1, 0.3, 1] }}
                    >
                      <Link
                        to={l.to}
                        onClick={() => setOpen(false)}
                        aria-current={isActive ? 'page' : undefined}
                        {...prefetchHandlers(l.to)}
                        className={`flex items-center justify-between py-4 border-b border-border/60 text-2xl font-medium tracking-tight transition-colors ${
                          isActive
                            ? 'text-foreground'
                            : 'text-muted-foreground hover:text-foreground'
                        }`}
                      >
                        <span>{l.label}</span>
                        <ArrowRight
                          className={`h-5 w-5 transition-opacity ${
                            isActive ? 'opacity-100' : 'opacity-30'
                          }`}
                        />
                      </Link>
                    </motion.div>
                  );
                })}
              </nav>

              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25, delay: 0.04 + links.length * 0.04, ease: [0.16, 1, 0.3, 1] }}
                className="mt-8 flex flex-col gap-3"
              >
                <CurrencySwitcher variant="block" />
                <Button asChild size="lg" className="w-full rounded-full h-12 text-[15px] gap-2 group">
                    <Link to="/signup" onClick={() => setOpen(false)} {...prefetchHandlers('/signup')}>Get started
                    <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                    </Link>
                  </Button>
                  <Button asChild
                    variant="ghost"
                    size="lg"
                    className="w-full rounded-full h-12 text-[15px] text-muted-foreground hover:text-foreground"
                  >
                    <Link to="/login" onClick={() => setOpen(false)} {...prefetchHandlers('/login')}>Sign in</Link>
                  </Button>
              </motion.div>
            </motion.div>
        </Dialog.Content>
      </Dialog.Portal>
    </header>
    </Dialog.Root>
  );
}
