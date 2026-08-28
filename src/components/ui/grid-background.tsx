import React from 'react';
import { cn } from '@/lib/utils';

interface GridBackgroundProps {
  className?: string;
  children?: React.ReactNode;
}

export function GridBackground({ className, children }: GridBackgroundProps) {
  return (
    <div className={cn('relative w-full overflow-hidden', className)}>
      <div
        className={cn(
          'pointer-events-none absolute inset-0 size-full -z-10',
          'bg-[linear-gradient(to_right,hsl(var(--foreground)/0.05)_1px,transparent_1px),linear-gradient(to_bottom,hsl(var(--foreground)/0.05)_1px,transparent_1px)]',
          'bg-[size:32px_32px]',
          '[mask-image:radial-gradient(ellipse_at_center,var(--background)_20%,transparent)]'
        )}
      />
      {children}
    </div>
  );
}
