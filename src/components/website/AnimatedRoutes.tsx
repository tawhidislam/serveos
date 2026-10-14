import type { ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

// Render navigation immediately. Route-wide exit animations delay the next
// screen and fading the whole page makes already-loaded content look pending.
export default function AnimatedRoutes({ children }: Props) {
  return <>{children}</>;
}
