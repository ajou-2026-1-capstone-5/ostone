import { Navigate, useNavigate } from "react-router-dom";

import type { WorkspaceResponse } from "@/shared/api/generated/zod";
import { useListWorkspaces } from "@/shared/api/generated/endpoints/workspace-controller/workspace-controller";
import { CreateWorkspaceDialog } from "@/features/workspace";
import { Spinner } from "@/shared/ui/spinner";
import { ApiRequestError } from "@/shared/api";
import { ErrorState } from "@/shared/ui/ostone/atoms/ErrorState";

export function WorkspaceRootRedirect() {
  const navigate = useNavigate();
  const { data: workspacesData, error, isLoading, isError, refetch } = useListWorkspaces();

  if (isLoading) {
    return (
      <div
        style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh" }}
      >
        <Spinner />
      </div>
    );
  }

  if (error instanceof ApiRequestError && error.status === 401) {
    return <Navigate to="/login" replace />;
  }

  if (isError) {
    return (
      <div role="alert" style={{ padding: "24px" }}>
        <ErrorState
          message="워크스페이스 정보를 불러오지 못했습니다."
          onRetry={() => {
            void refetch();
          }}
        />
      </div>
    );
  }

  const workspaces = (workspacesData ?? []) as unknown as WorkspaceResponse[];
  if (workspaces.length > 0) {
    const active = workspaces.find((w) => w.status === "ACTIVE") ?? workspaces[0];
    return <Navigate to={`/workspaces/${active.id}/workflows`} replace />;
  }

  return (
    <div
      style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh" }}
    >
      <CreateWorkspaceDialog
        open={true}
        onOpenChange={() => {
          navigate("/workspaces", { replace: true });
        }}
        onSuccess={async (created) => {
          navigate(`/workspaces/${created.id}/workflows`, { replace: true });
        }}
      />
    </div>
  );
}
