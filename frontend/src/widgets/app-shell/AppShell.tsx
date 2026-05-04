import { cn } from '@/shared/lib/utils';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';
import type { IconName } from '@/shared/ui/atoms/Icon';

export interface AppShellProps {
  activeNav?: IconName;
  crumbs?: string[];
  topbarRight?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

export function AppShell({ activeNav, crumbs = [], topbarRight, children, className }: AppShellProps) {
  return (
    <div
      className={cn('flex h-screen', className)}
      style={{ fontFamily: 'var(--sans)', background: 'var(--paper)', color: 'var(--ink)' }}
    >
      <Sidebar active={activeNav} />
      <div className="flex flex-col flex-1 min-w-0">
        <Topbar crumbs={crumbs} right={topbarRight} />
        <main className="flex-1 min-h-0 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
