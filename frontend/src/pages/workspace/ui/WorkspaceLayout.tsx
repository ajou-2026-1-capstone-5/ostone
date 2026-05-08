import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Navigate, Outlet, useLocation, useNavigate, useParams } from "react-router-dom";
import type { ShellContext, SidebarActive } from "@/shared/ui/ostone/chrome";

import {
  mapWorkspaceActionError,
  type WorkspaceResponse,
} from "@/entities/workspace";
import { useListWorkspaces, useGetWorkspace } from "@/shared/api/generated/endpoints/workspace-controller/workspace-controller";
import {
  ArchiveConfirmDialog,
  CreateWorkspaceDialog,
  EditWorkspaceDialog,
  WorkspaceSwitcher,
} from "@/features/workspace";
import { ErrorState } from "@/shared/ui/ostone/atoms/ErrorState";
import { LoadingSpinner } from "@/shared/ui/ostone/atoms/LoadingSpinner";
import { OstoneShell } from "@/widgets/ostone-shell";
import { parseRouteId } from "@/shared/lib/parseRouteId";

const getActiveFromPath = (pathname: string): SidebarActive => {
  if (pathname.includes("/domain-packs")) return "domain";
  if (pathname.includes("/pipeline")) return "pipeline";
  if (pathname.includes("/consultation")) return "consult";
  if (pathname.includes("/upload")) return "upload";
  if (pathname.includes("/workflows")) return "workflows";

  return "workflows";
};

export function WorkspaceLayout() {
  const { workspaceId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const parsedWorkspaceId = parseRouteId(workspaceId);
  const basePath = parsedWorkspaceId ? `/workspaces/${parsedWorkspaceId}` : "/workspaces";
  const [workspace, setWorkspace] = useState<WorkspaceResponse | null>(null);
  const [isLoading, setIsLoading] = useState(parsedWorkspaceId !== null);
  const [error, setError] = useState("");
  const [workspaces, setWorkspaces] = useState<WorkspaceResponse[]>([]);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<WorkspaceResponse | null>(null);
  const [archiveTarget, setArchiveTarget] = useState<WorkspaceResponse | null>(null);
  const [topbarRight, setTopbarRight] = useState<ReactNode>(null);
  const [crumbs, setCrumbs] = useState<string[]>([]);
  const active = getActiveFromPath(location.pathname);

  const { data: fetchedWorkspaces, refetch: refetchWorkspaces } = useListWorkspaces();
  const { data: fetchedWorkspace, isLoading: isFetchingWorkspace, error: fetchError, refetch: refetchWorkspace } =
    useGetWorkspace(parsedWorkspaceId ?? 0, { query: { enabled: parsedWorkspaceId !== null } });

  useEffect(() => {
    if (fetchedWorkspaces) {
      setWorkspaces(fetchedWorkspaces as unknown as WorkspaceResponse[]);
    }
  }, [fetchedWorkspaces]);

  useEffect(() => {
    if (fetchedWorkspace) {
      setWorkspace(fetchedWorkspace as unknown as WorkspaceResponse);
      setError("");
    } else if (parsedWorkspaceId !== null && fetchError) {
      setError(mapWorkspaceActionError(fetchError));
      setWorkspace(null);
    }
  }, [fetchedWorkspace, fetchError, parsedWorkspaceId]);

  useEffect(() => {
    if (!isFetchingWorkspace && parsedWorkspaceId !== null) {
      setIsLoading(false);
    }
  }, [isFetchingWorkspace, parsedWorkspaceId]);

  const defaultCrumbs = useMemo(() => (workspace?.name ? [workspace.name] : []), [workspace]);

  if (parsedWorkspaceId === null) {
    return <Navigate to="/workspaces" replace />;
  }

  const subPath = location.pathname.replace(/\/workspaces\/[^/]+/, "");

  const handleSwitch = (newWorkspaceId: number) => {
    const targetSubPath = subPath || "/workflows";
    navigate(`/workspaces/${newWorkspaceId}${targetSubPath}`, { replace: true });
  };

  const refreshWorkspaceList = () => {
    refetchWorkspaces();
  };

  const sidebarSwitcher = (
    <WorkspaceSwitcher
      workspaces={workspaces}
      currentWorkspaceId={parsedWorkspaceId}
      onSwitch={handleSwitch}
      onCreate={() => setIsCreateOpen(true)}
      onEdit={(w) => setEditTarget(w)}
      onArchive={(w) => setArchiveTarget(w)}
    />
  );
  const outletContext: ShellContext = { setTopbarRight, setCrumbs, workspace };

  if (isLoading) {
    return (
      <OstoneShell active={active} crumbs={[]} basePath={basePath} sidebarSwitcher={sidebarSwitcher}>
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
          <p style={{ color: "var(--ink)", fontSize: "14px" }}>워크스페이스 정보를 불러오는 중입니다.</p>
        </div>
      </OstoneShell>
    );
  }

  if (error || !workspace) {
    return (
      <OstoneShell active={active} crumbs={[]} basePath={basePath} sidebarSwitcher={sidebarSwitcher}>
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
      sidebarSwitcher={sidebarSwitcher}
    >
      <Outlet context={outletContext} />
      <CreateWorkspaceDialog
        open={isCreateOpen}
        onOpenChange={setIsCreateOpen}
        onSuccess={refreshWorkspaceList}
      />
      <EditWorkspaceDialog
        workspace={editTarget}
        open={editTarget !== null}
        onOpenChange={() => setEditTarget(null)}
        onSuccess={refreshWorkspaceList}
      />
      <ArchiveConfirmDialog
        workspace={archiveTarget}
        open={archiveTarget !== null}
        onOpenChange={() => setArchiveTarget(null)}
        onSuccess={refreshWorkspaceList}
      />
    </OstoneShell>
  );
}
