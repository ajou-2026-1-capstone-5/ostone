import { Navigate, useLocation, useParams } from "react-router-dom";
import { parseRouteId } from "@/shared/lib/parseRouteId";

export function LegacyDomainPackVersionRedirect() {
  const { workspaceId, packId, versionId, "*": childPath } = useParams();
  const location = useLocation();

  const wsId = parseRouteId(workspaceId);
  const pId = parseRouteId(packId);
  const vId = parseRouteId(versionId);

  if (wsId === null || pId === null || vId === null) {
    return <Navigate to="/workspaces" replace />;
  }

  const search = new URLSearchParams(location.search);
  search.set("versionId", String(vId));

  const normalizedChildPath = childPath ? `/${childPath}` : "";
  const targetPath = `/workspaces/${wsId}/domain-packs/${pId}${normalizedChildPath}`;
  return <Navigate to={`${targetPath}?${search.toString()}`} replace />;
}
