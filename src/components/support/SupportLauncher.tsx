import { lazy, Suspense, useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { MessageCircle } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { usePlatformAdmin } from '@/hooks/usePlatformAdmin';

const SupportWidget = lazy(() => import('./SupportWidget'));

function hasSupportSession(): boolean {
  try {
    return !!localStorage.getItem('serveos-support');
  } catch {
    return false;
  }
}

export function LauncherButton({ onClick, unread = 0, open = false, raised = false }: { onClick: () => void; unread?: number; open?: boolean; raised?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={open ? 'Close support chat' : 'Open support chat'}
      className={`fixed right-5 z-[60] h-14 w-14 ${raised ? 'bottom-24 md:bottom-5' : 'bottom-5'} rounded-full bg-primary text-primary-foreground shadow-xl shadow-primary/30 flex items-center justify-center hover:scale-105 active:scale-95 transition-transform focus:outline-none focus-visible:ring-4 focus-visible:ring-primary/30`}
    >
      <MessageCircle className="h-6 w-6" />
      {unread > 0 && !open && (
        <span className="absolute -top-1 -right-1 min-w-[20px] h-5 px-1 rounded-full bg-destructive text-destructive-foreground text-[11px] font-bold flex items-center justify-center ring-2 ring-background">
          {unread > 9 ? '9+' : unread}
        </span>
      )}
    </button>
  );
}

/**
 * Floating "chat with us" button. The full widget is code-split and only
 * loaded on click — or right away for returning chatters and signed-in staff,
 * so their unread badge can show.
 */
export default function SupportLauncher({ raised = false }: { /** Sit above a mobile bottom nav bar. */ raised?: boolean }) {
  const { user } = useAuth();
  const { isPlatformAdmin } = usePlatformAdmin();
  const { pathname } = useLocation();
  const [load, setLoad] = useState(false);
  const [openOnLoad, setOpenOnLoad] = useState(false);

  useEffect(() => {
    if (user || hasSupportSession()) setLoad(true);
  }, [user]);

  // Keep the inbox workspace clear while allowing admins to preview public support.
  if (isPlatformAdmin && pathname.startsWith('/platform')) return null;
  // The full Help & support page is already open; one chat UI per page.
  if (pathname.startsWith('/admin/support')) return null;

  if (!load) {
    return <LauncherButton raised={raised} onClick={() => { setOpenOnLoad(true); setLoad(true); }} />;
  }
  return (
    <Suspense fallback={<LauncherButton raised={raised} onClick={() => setOpenOnLoad(true)} />}>
      <SupportWidget defaultOpen={openOnLoad} raised={raised} />
    </Suspense>
  );
}
