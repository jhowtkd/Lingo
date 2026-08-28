import React from 'react';
import { PlusIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CornerPlusProps {
  className?: string;
  size?: string;
}

export function CornerPlus({ className, size = 'size-4' }: CornerPlusProps) {
  return (
    <>
      <PlusIcon className={cn('pointer-events-none absolute -top-2 -left-2 text-muted-foreground/40', size, className)} />
      <PlusIcon className={cn('pointer-events-none absolute -top-2 -right-2 text-muted-foreground/40', size, className)} />
      <PlusIcon className={cn('pointer-events-none absolute -bottom-2 -left-2 text-muted-foreground/40', size, className)} />
      <PlusIcon className={cn('pointer-events-none absolute -right-2 -bottom-2 text-muted-foreground/40', size, className)} />
    </>
  );
}
