import { type ReactNode } from "react";
import { useParams } from "react-router-dom";
import { Sidebar, Topbar, type SidebarActive } from "@/shared/ui/ostone/chrome";
import { WorkspaceMarker } from "@/shared/ui/ostone/chrome/WorkspaceMarker";

interface OstoneShellProps {
  active: SidebarActive;
  crumbs: string[];
  topbarRight?: ReactNode;
  sidebarSwitcher?: ReactNode;
  dark?: boolean;
  basePath?: string;
  children: ReactNode;
}

interface SidebarBaseProps {
  active: SidebarActive;
  dark: boolean;
  basePath: string;
  switcher: ReactNode;
}

export function OstoneShell({
  active,
  crumbs,
  topbarRight,
  sidebarSwitcher,
  dark = false,
  basePath,
  children,
}: OstoneShellProps) {
  const { workspaceId } = useParams();
  const resolvedBasePath = basePath ?? (workspaceId ? `/workspaces/${workspaceId}` : "/workspaces");
  const numericWorkspaceId = workspaceId ? Number(workspaceId) : null;
  const safeWorkspaceId =
    numericWorkspaceId !== null && Number.isFinite(numericWorkspaceId) ? numericWorkspaceId : null;

  const fallbackSwitcher = sidebarSwitcher ?? (
    <WorkspaceMarker workspaceId={safeWorkspaceId} collapsed={false} />
  );

  const sidebarBaseProps: SidebarBaseProps = {
    active,
    dark,
    basePath: resolvedBasePath,
    switcher: fallbackSwitcher,
  };

  return (
    <div
      style={{
        display: "flex",
        height: "100vh",
        background: dark ? "var(--dark-bg)" : "var(--paper)",
      }}
    >
      <div style={{ flexShrink: 0 }}>
        <Sidebar {...sidebarBaseProps} />
      </div>
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          minWidth: 0,
        }}
      >
        <div style={{ flexShrink: 0 }}>
          <Topbar crumbs={crumbs} right={topbarRight} dark={dark} />
        </div>
        <main style={{ flex: 1, overflow: "auto" }}>{children}</main>
      </div>
    </div>
  );
}
