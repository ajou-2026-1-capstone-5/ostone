import { Navigate, useNavigate } from "react-router-dom";

import type { WorkspaceResponse } from "@/shared/api/generated/zod";
import { useListWorkspaces } from "@/shared/api/generated/endpoints/workspace-controller/workspace-controller";
import { selectDefaultWorkspace } from "@/entities/workspace";
import { CreateWorkspaceDialog } from "@/features/workspace";
import { Spinner } from "@/shared/ui/spinner";
import { ApiRequestError, selectApiData } from "@/shared/api";
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

  const workspaces = selectApiData<WorkspaceResponse[]>(workspacesData) ?? [];
  const workspace = selectDefaultWorkspace(workspaces);
  if (typeof workspace?.id === "number") {
    return <Navigate to={`/workspaces/${workspace.id}/dashboard`} replace />;
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
          navigate(`/workspaces/${created.id}/upload`, { replace: true });
        }}
      />
    </div>
  );
}
