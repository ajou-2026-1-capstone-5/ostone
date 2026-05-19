import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { useParams } from 'react-router-dom';
import { Sidebar, Topbar, type SidebarActive, type SidebarTreeData } from '@/shared/ui/ostone/chrome';
import { useSidebarTreeData } from '@/shared/ui/ostone/chrome/useSidebarTreeData';

const COLLAPSED_STORAGE_KEY = 'ostone:sidebar:collapsed';

function readPersistedCollapsed(): boolean {
  if (typeof window === 'undefined') return true;
  try {
    const raw = window.localStorage.getItem(COLLAPSED_STORAGE_KEY);
    if (raw === null) return true;
    return raw !== 'false';
  } catch {
    return true;
  }
}

function persistCollapsed(value: boolean): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(COLLAPSED_STORAGE_KEY, value ? 'true' : 'false');
  } catch {
    /* noop */
  }
}

interface OstoneShellProps {
  active: SidebarActive;
  crumbs: string[];
  topbarRight?: ReactNode;
  sidebarSwitcher?: ReactNode;
  dark?: boolean;
  basePath?: string;
  children: ReactNode;
  activePackId?: number | null;
  activeWorkflowId?: number | null;
  /** Override tree data — primarily for tests. */
  treeOverride?: SidebarTreeData;
}

interface SidebarBaseProps {
  active: SidebarActive;
  dark: boolean;
  basePath: string;
  switcher: ReactNode;
  collapsed: boolean;
  onToggleCollapsed: () => void;
  activePackId: number | null;
  activeWorkflowId: number | null;
}

interface SidebarWithFetchedTreeProps extends SidebarBaseProps {
  workspaceId: number | null;
}

function SidebarWithFetchedTree({ workspaceId, ...sidebarProps }: SidebarWithFetchedTreeProps) {
  const tree = useSidebarTreeData({ workspaceId, enabled: true });
  return <Sidebar {...sidebarProps} tree={tree} />;
}

export function OstoneShell({
  active,
  crumbs,
  topbarRight,
  sidebarSwitcher,
  dark = false,
  basePath,
  children,
  activePackId = null,
  activeWorkflowId = null,
  treeOverride,
}: OstoneShellProps) {
  const { workspaceId } = useParams();
  const resolvedBasePath = basePath ?? (workspaceId ? `/workspaces/${workspaceId}` : '/workspaces');
  const numericWorkspaceId = workspaceId ? Number(workspaceId) : null;
  const safeWorkspaceId =
    numericWorkspaceId !== null && Number.isFinite(numericWorkspaceId) ? numericWorkspaceId : null;

  const [collapsed, setCollapsed] = useState<boolean>(() => readPersistedCollapsed());

  useEffect(() => {
    persistCollapsed(collapsed);
  }, [collapsed]);

  const handleToggle = useCallback(() => {
    setCollapsed((v) => !v);
  }, []);

  const sidebarBaseProps: SidebarBaseProps = {
    active,
    dark,
    basePath: resolvedBasePath,
    switcher: sidebarSwitcher,
    collapsed,
    onToggleCollapsed: handleToggle,
    activePackId,
    activeWorkflowId,
  };

  const shouldFetchTree = !collapsed && treeOverride === undefined;

  return (
    <div
      style={{
        display: 'flex',
        height: '100vh',
        background: dark ? 'var(--dark-bg)' : 'var(--paper)',
      }}
    >
      <div style={{ flexShrink: 0 }}>
        {shouldFetchTree ? (
          <SidebarWithFetchedTree {...sidebarBaseProps} workspaceId={safeWorkspaceId} />
        ) : (
          <Sidebar {...sidebarBaseProps} tree={treeOverride} />
        )}
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
