import { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface LaptopMockupProps {
  children: ReactNode;
  className?: string;
}

/**
 * Realistic laptop frame mockup. Children render inside the screen area
 * with a 16/10 aspect ratio (standard laptop screen).
 */
export function LaptopMockup({ children, className }: LaptopMockupProps) {
  return (
    <div className={cn('relative w-full', className)}>
      {/* Screen bezel - light/white frame */}
      <div className="relative rounded-t-[14px] sm:rounded-t-[18px] bg-gradient-to-b from-neutral-50 to-neutral-200 p-[6px] sm:p-[10px] pb-0 shadow-[0_30px_60px_-20px_rgba(15,23,42,0.18)] ring-1 ring-neutral-200">
        {/* Camera notch */}
        <div className="absolute left-1/2 top-[3px] sm:top-[5px] -translate-x-1/2 h-1 w-1 rounded-full bg-neutral-400" />
        {/* Screen */}
        <div className="relative overflow-hidden rounded-[6px] sm:rounded-[8px] bg-white" style={{ aspectRatio: '16 / 10' }}>
          {children}
        </div>
      </div>
      {/* Base / hinge */}
      <div className="relative mx-auto h-[10px] sm:h-[14px] w-[105%] -translate-x-[2.5%] rounded-b-[10px] sm:rounded-b-[14px] bg-gradient-to-b from-neutral-200 to-neutral-300 shadow-[0_10px_20px_-5px_rgba(15,23,42,0.15)]">
        {/* Hinge notch */}
        <div className="absolute left-1/2 top-0 -translate-x-1/2 h-[3px] sm:h-[5px] w-12 sm:w-20 rounded-b-md bg-neutral-300" />
      </div>
    </div>
  );
}
