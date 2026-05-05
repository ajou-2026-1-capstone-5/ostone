import type { ReactNode } from 'react';

import { OstoneShell } from '@/widgets/ostone-shell';

interface WorkspaceShellProps {
  workspaceId: number;
  workspaceName?: string;
  children: ReactNode;
}

export function WorkspaceShell({
  workspaceId: _workspaceId,
  workspaceName,
  children,
}: WorkspaceShellProps) {
  return (
    <OstoneShell active="domain" crumbs={workspaceName ? [workspaceName] : []}>
      {children}
    </OstoneShell>
  );
}