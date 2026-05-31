import { Navigate, useParams, useSearchParams } from "react-router-dom";
import { LogUploadForm } from "../../../features/log-upload/ui/LogUploadForm";
import { parseRouteId } from "@/shared/lib/parseRouteId";

export function WorkspaceUploadPage() {
  const { workspaceId } = useParams();
  const [searchParams] = useSearchParams();
  const parsedWorkspaceId = parseRouteId(workspaceId);
  const pipelineJobId = parseRouteId(searchParams.get("jobId") ?? undefined);

  if (parsedWorkspaceId !== null && pipelineJobId !== null) {
    return <Navigate to={`/workspaces/${parsedWorkspaceId}/pipeline-jobs/${pipelineJobId}/review`} replace />;
  }

  return (
    <div style={{ padding: "var(--s-6) var(--s-8) var(--s-10)" }}>
      <LogUploadForm workspaceId={parsedWorkspaceId ?? undefined} />
    </div>
  );
}
