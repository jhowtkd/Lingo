'use client';
import React from 'react';
import { cn } from '@/lib/utils';
import { BorderTrail } from './border-trail';
import { CornerPlus } from './corner-plus';
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
        'relative rounded-lg border border-border bg-card text-card-foreground',
        className
      )}
      {...props}
    >
      {withCorners && <CornerPlus size={cornerSize} />}
      {showTrail && (
        <BorderTrail
          size={trailSize}
          className={trailClassName}
          transition={trailTransition}
          style={{
            boxShadow:
              '0px 0px 60px 30px rgb(255 255 255 / 40%), 0 0 100px 60px rgb(0 0 0 / 30%)',
            ...trailStyle,
          }}
        />
      )}
      {children}
    </div>
  );
}

export const BorderTrailCard = BorderTrailWrapper;
