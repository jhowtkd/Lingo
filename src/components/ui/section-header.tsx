import React from 'react';
import { cn } from '../../lib/utils';

interface SectionHeaderProps {
  tag?: string;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
  centered?: boolean;
}

export function SectionHeader({
  tag,
  title,
  description,
  action,
  className,
  centered = false,
}: SectionHeaderProps) {
  return (
    <div
      className={cn(
        'space-y-2',
        centered ? 'mx-auto max-w-xl text-center' : 'flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4',
        className
      )}
    >
      <div className={cn('space-y-1.5', centered ? 'text-center' : '')}>
        {tag && (
          <div className={cn('flex', centered ? 'justify-center' : '')}>
            <div className="inline-flex items-center rounded-lg border border-border bg-muted/60 px-3 py-1 font-mono text-[11px] font-medium tracking-wider text-muted-foreground uppercase">
              {tag}
            </div>
          </div>
        )}
        <h2 className="text-xl sm:text-2xl lg:text-3xl font-bold tracking-tighter text-foreground">
          {title}
        </h2>
        {description && (
          <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
            {description}
          </p>
        )}
      </div>

      {action && !centered && (
        <div className="flex items-center gap-2 shrink-0">{action}</div>
      )}
    </div>
  );
}
