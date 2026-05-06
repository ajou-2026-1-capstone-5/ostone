import { useEffect, useState } from "react";
import { Navigate, Outlet, useParams } from "react-router-dom";

import { mapWorkspaceActionError, workspaceApi, type WorkspaceResponse } from "@/entities/workspace";
import { ErrorState } from "@/shared/ui/ostone/atoms/ErrorState";
import { LoadingSpinner } from "@/shared/ui/ostone/atoms/LoadingSpinner";
import { OstoneShell } from "@/widgets/ostone-shell";
import { parseRouteId } from "@/shared/lib/parseRouteId";

export function WorkspaceLayout() {
  const { workspaceId } = useParams();
  const parsedWorkspaceId = parseRouteId(workspaceId);
  const basePath = parsedWorkspaceId ? `/workspaces/${parsedWorkspaceId}` : undefined;
  const [workspace, setWorkspace] = useState<WorkspaceResponse | null>(null);
  const [isLoading, setIsLoading] = useState(parsedWorkspaceId !== null);
  const [error, setError] = useState("");
  const [retryNonce, setRetryNonce] = useState(0);

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

  if (isLoading) {
    return (
      <OstoneShell active="workflows" crumbs={[]} basePath={basePath}>
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
      <OstoneShell active="workflows" crumbs={[]} basePath={basePath}>
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
    <OstoneShell active="workflows" crumbs={[workspace.name]} basePath={basePath}>
      <Outlet context={{ workspace }} />
    </OstoneShell>
  );
}
