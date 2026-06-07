import { useMemo, useState, type ReactNode } from "react";
import { Navigate, Outlet, useLocation, useParams } from "react-router-dom";
import type {
  Crumb,
  ShellContext,
  SidebarActive,
} from "@/shared/ui/ostone/chrome";

import {
  mapWorkspaceActionError,
  type WorkspaceResponse,
} from "@/entities/workspace";
import { useGetWorkspace } from "@/shared/api/generated/endpoints/workspace-controller/workspace-controller";
import { ErrorState } from "@/shared/ui/ostone/atoms/ErrorState";
import { LoadingSpinner } from "@/shared/ui/ostone/atoms/LoadingSpinner";
import { OstoneShell } from "@/widgets/ostone-shell";
import { parseRouteId } from "@/shared/lib/parseRouteId";

const getActiveFromPath = (pathname: string): SidebarActive => {
  if (pathname.includes("/dashboard")) return "dashboard";
  if (pathname.includes("/simulation")) return "simulation";
  if (pathname.includes("/domain-packs")) return "domain";
  if (pathname.includes("/consultation")) return "consult";
  if (pathname.includes("/upload")) return "upload";
  if (pathname.includes("/pipeline-jobs/")) return "upload";
  if (pathname.includes("/settings")) return "settings";
  if (pathname.includes("/billing")) return "settings";
  if (pathname.includes("/workflows")) return "workflows";

  return "dashboard";
};

export function WorkspaceLayout() {
  const { workspaceId } = useParams();
  const location = useLocation();
  const parsedWorkspaceId = parseRouteId(workspaceId);
  const basePath = parsedWorkspaceId
    ? `/workspaces/${parsedWorkspaceId}`
    : "/workspaces";
  const [topbarRight, setTopbarRight] = useState<ReactNode>(null);
  const [crumbs, setCrumbs] = useState<Crumb[]>([]);
  const active = getActiveFromPath(location.pathname);

  const {
    data: fetchedWorkspace,
    isLoading: isFetchingWorkspace,
    error: fetchError,
    refetch: refetchWorkspace,
  } = useGetWorkspace(parsedWorkspaceId ?? 0, {
    query: { enabled: parsedWorkspaceId !== null },
  });
  const workspace = fetchedWorkspace
    ? (fetchedWorkspace as unknown as WorkspaceResponse)
    : null;
  const error =
    parsedWorkspaceId !== null && fetchError
      ? mapWorkspaceActionError(fetchError)
      : "";
  const isLoading = parsedWorkspaceId !== null && isFetchingWorkspace;

  const defaultCrumbs = useMemo(
    () => (workspace?.name ? [workspace.name] : []),
    [workspace],
  );

  if (parsedWorkspaceId === null) {
    return <Navigate to="/workspaces" replace />;
  }

  const outletContext: ShellContext = { setTopbarRight, setCrumbs, workspace };

  if (isLoading) {
    return (
      <OstoneShell active={active} crumbs={[]} basePath={basePath}>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: "var(--s-3)",
            height: "100%",
          }}
          aria-live="polite"
        >
          <LoadingSpinner />
          <p style={{ color: "var(--ink)", fontSize: "14px" }}>
            워크스페이스 정보를 불러오는 중입니다.
          </p>
        </div>
      </OstoneShell>
    );
  }

  if (error || !workspace) {
    return (
      <OstoneShell active={active} crumbs={[]} basePath={basePath}>
        <ErrorState
          message={error || "워크스페이스를 찾을 수 없습니다."}
          onRetry={refetchWorkspace}
        />
      </OstoneShell>
    );
  }

  return (
    <OstoneShell
      active={active}
      crumbs={crumbs.length > 0 ? crumbs : defaultCrumbs}
      topbarRight={topbarRight}
      basePath={basePath}
    >
      <Outlet context={outletContext} />
    </OstoneShell>
  );
}
