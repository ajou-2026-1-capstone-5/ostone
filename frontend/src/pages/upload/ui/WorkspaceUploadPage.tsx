import { useParams } from "react-router-dom";
import { LogUploadForm } from "../../../features/log-upload/ui/LogUploadForm";
import { parseRouteId } from "@/shared/lib/parseRouteId";

export function WorkspaceUploadPage() {
  const { workspaceId } = useParams();
  const parsedWorkspaceId = parseRouteId(workspaceId);

  return (
    <div style={{ padding: "var(--s-6) var(--s-8) var(--s-10)" }}>
      <LogUploadForm workspaceId={parsedWorkspaceId ?? undefined} />
    </div>
  );
}
