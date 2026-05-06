import { useEffect, useState } from "react";
import { Navigate, Outlet, useLocation, useNavigate, useParams } from "react-router-dom";

import {
  mapWorkspaceActionError,
  workspaceApi,
  type WorkspaceResponse,
} from "@/entities/workspace";
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

export function WorkspaceLayout() {
  const { workspaceId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const parsedWorkspaceId = parseRouteId(workspaceId);
  const basePath = parsedWorkspaceId ? `/workspaces/${parsedWorkspaceId}` : undefined;
  const [workspace, setWorkspace] = useState<WorkspaceResponse | null>(null);
  const [isLoading, setIsLoading] = useState(parsedWorkspaceId !== null);
  const [error, setError] = useState("");
  const [retryNonce, setRetryNonce] = useState(0);
  const [workspaces, setWorkspaces] = useState<WorkspaceResponse[]>([]);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<WorkspaceResponse | null>(null);
  const [archiveTarget, setArchiveTarget] = useState<WorkspaceResponse | null>(null);

  useEffect(() => {
    workspaceApi
      .list()
      .then(setWorkspaces)
      .catch(() => {});
  }, [retryNonce]);

  useEffect(() => {
    if (parsedWorkspaceId === null) {
      return;
    }

    const controller = new AbortController();

    void workspaceApi
      .get(parsedWorkspaceId, controller.signal)
      .then((workspaceResult) => {
        if (!controller.signal.aborted) {
          setWorkspace(workspaceResult);
        }
      })
      .catch((err) => {
        if (err instanceof Error && err.name === "AbortError") {
          return;
        }

        if (!controller.signal.aborted) {
          setError(mapWorkspaceActionError(err));
          setWorkspace(null);
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      });

    return () => {
      controller.abort();
    };
  }, [parsedWorkspaceId, retryNonce]);

  if (parsedWorkspaceId === null) {
    return <Navigate to="/workspaces" replace />;
  }

  const subPath = location.pathname.replace(/\/workspaces\/[^/]+/, "");

  const handleSwitch = (newWorkspaceId: number) => {
    const targetSubPath = subPath || "/workflows";
    navigate(`/workspaces/${newWorkspaceId}${targetSubPath}`, { replace: true });
  };

  const refreshWorkspaceList = async () => {
    try {
      const list = await workspaceApi.list();
      setWorkspaces(list);
    } catch {
      /* silently fail */
    }
  };

  const topbarLeft = (
    <WorkspaceSwitcher
      workspaces={workspaces}
      currentWorkspaceId={parsedWorkspaceId}
      onSwitch={handleSwitch}
      onCreate={() => setIsCreateOpen(true)}
      onEdit={(w) => setEditTarget(w)}
      onArchive={(w) => setArchiveTarget(w)}
    />
  );

  if (isLoading) {
    return (
      <OstoneShell active="workflows" crumbs={[]} basePath={basePath} topbarLeft={topbarLeft}>
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
      <OstoneShell active="workflows" crumbs={[]} basePath={basePath} topbarLeft={topbarLeft}>
        <ErrorState
          message={error || "워크스페이스를 찾을 수 없습니다."}
          onRetry={() => {
            setIsLoading(true);
            setError("");
            setRetryNonce((value) => value + 1);
          }}
        />
      </OstoneShell>
    );
  }

  return (
    <OstoneShell active="workflows" crumbs={[workspace.name]} basePath={basePath} topbarLeft={topbarLeft}>
      <Outlet context={{ workspace }} />
      <CreateWorkspaceDialog
        open={isCreateOpen}
        onOpenChange={setIsCreateOpen}
        onSuccess={refreshWorkspaceList}
      />
      <EditWorkspaceDialog
        workspace={editTarget}
        open={editTarget !== null}
        onOpenChange={() => setEditTarget(null)}
        onSuccess={async () => {
          await refreshWorkspaceList();
          setRetryNonce((v) => v + 1);
        }}
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
