import { useCallback, useState } from 'react';

const TOGGLE_KEY = 'admin-auto-print';

function readToggle(): boolean {
  try {
    return localStorage.getItem(TOGGLE_KEY) === 'true';
  } catch {
    return false;
  }
}

/**
 * Auto-print toggle state with localStorage persistence (default OFF),
 * mirroring the KDS auto-print convention.
 */
export function useAdminAutoPrintToggle() {
  const [enabled, setEnabled] = useState<boolean>(readToggle);

  const toggle = useCallback(() => {
    setEnabled((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(TOGGLE_KEY, String(next));
      } catch {
        /* noop — private mode etc. */
      }
      return next;
    });
  }, []);

  return { enabled, toggle };
}
