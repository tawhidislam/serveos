import { useEffect, useState } from 'react';
import { isPrintAgentAvailable } from '@/lib/print-html';

/**
 * Tracks whether the local print agent is running (true silent printing).
 *
 * Re-probes when the tab regains focus so the indicator recovers if the
 * agent is started while the app is open.
 */
export function usePrintAgentStatus() {
  const [available, setAvailable] = useState<boolean | null>(null); // null = probing

  useEffect(() => {
    let cancelled = false;

    const check = () => {
      void isPrintAgentAvailable().then((ok) => {
        if (!cancelled) setAvailable(ok);
      });
    };

    check();
    window.addEventListener('focus', check);
    return () => {
      cancelled = true;
      window.removeEventListener('focus', check);
    };
  }, []);

  return { agentAvailable: available };
}
