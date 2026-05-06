import type { ReactNode } from 'react';
import { useParams } from 'react-router-dom';
import { Sidebar, Topbar, type SidebarActive } from '@/shared/ui/ostone/chrome';

interface OstoneShellProps {
  active: SidebarActive;
  crumbs: string[];
  topbarRight?: ReactNode;
  sidebarSwitcher?: ReactNode;
  dark?: boolean;
  basePath?: string;
  children: ReactNode;
}

export function OstoneShell({ active, crumbs, topbarRight, sidebarSwitcher, dark = false, basePath, children }: OstoneShellProps) {
  const { workspaceId } = useParams();
  const resolvedBasePath = basePath ?? (workspaceId ? `/workspaces/${workspaceId}` : '/workspaces');

  return (
    <div
      style={{
        display: 'flex',
        height: '100vh',
        background: dark ? 'var(--dark-bg)' : 'var(--paper)',
      }}
    >
      <div style={{ flexShrink: 0 }}>
        <Sidebar active={active} dark={dark} basePath={resolvedBasePath} switcher={sidebarSwitcher} />
      </div>
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          minWidth: 0,
        }}
      >
        <div style={{ flexShrink: 0 }}>
          <Topbar crumbs={crumbs} right={topbarRight} dark={dark} />
        </div>
        <main style={{ flex: 1, overflow: 'auto' }}>{children}</main>
      </div>
    </div>
  );
}
