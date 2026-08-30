'use client';
import React from 'react';
import { cn } from '@/lib/utils';
import { BorderTrail } from './border-trail';
import { Transition } from 'framer-motion';

export interface BorderTrailWrapperProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  className?: string;
  showTrail?: boolean;
  trailSize?: number;
  trailClassName?: string;
  trailStyle?: React.CSSProperties;
  trailTransition?: Transition;
  withCorners?: boolean;
  cornerSize?: string;
}

export function BorderTrailWrapper({
  children,
  className,
  showTrail = true,
  trailSize = 100,
  trailClassName,
  trailStyle,
  trailTransition,
  withCorners = false,
  cornerSize,
  ...props
}: BorderTrailWrapperProps) {
  return (
    <div
      className={cn(
        'relative rounded-[var(--r-lg)] border border-[var(--border)] bg-[var(--surface)] text-[var(--fg)] shadow-[var(--shadow-sm)]',
        className
      )}
      {...props}
    >
      {showTrail && (
        <BorderTrail
          size={trailSize}
          className={trailClassName}
          transition={trailTransition}
          style={{
            boxShadow:
              '0px 0px 50px 25px oklch(0.70 0.155 55 / 0.35), 0 0 80px 40px oklch(0.89 0.12 92 / 0.25)',
            ...trailStyle,
          }}
        />
      )}
      {children}
    </div>
  );
}

export const BorderTrailCard = BorderTrailWrapper;

