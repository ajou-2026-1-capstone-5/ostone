import React from 'react';
import { cn } from '@/shared/lib/utils';

export interface MonoProps {
  children: React.ReactNode;
  as?: 'span' | 'code';
  className?: string;
  size?: number;
}

export function Mono({ children, as: Component = 'span', className, size }: MonoProps) {
  return (
    <Component
      className={cn('font-mono tabular-nums', className)}
      style={size !== undefined ? { fontSize: `${size}px` } : undefined}
    >
      {children}
    </Component>
  );
}
