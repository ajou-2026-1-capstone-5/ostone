import React from 'react';
import { cn } from '@/shared/lib/utils';
import { Eyebrow } from '@/shared/ui/atoms/Eyebrow';

export interface TopbarProps {
  crumbs: string[];
  right?: React.ReactNode;
  className?: string;
}

export function Topbar({ crumbs, right, className }: TopbarProps) {
  return (
    <header
      className={cn(
        'flex items-center shrink-0',
        'h-[44px] px-6',
        'bg-[var(--paper)] border-b border-[var(--line)]',
        className
      )}
    >
      <Eyebrow tone="mute">
        {crumbs.map((crumb, i) => (
          <React.Fragment key={i}>
            {i > 0 && <span className="mx-1">·</span>}
            {crumb}
          </React.Fragment>
        ))}
      </Eyebrow>
      <div className="flex-1" />
      {right}
    </header>
  );
}
