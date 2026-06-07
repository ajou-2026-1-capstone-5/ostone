export const DEMO_SELECTION_PATH = "/demo";

export function buildWorkspaceSimulationPath(
  workspaceId: number | string,
): string {
  return `/workspaces/${encodeURIComponent(String(workspaceId))}/simulation`;
}

export function buildDemoChatPath(
  workspaceId: number | string,
  searchParams?: URLSearchParams,
): string {
  const search = searchParams?.toString();
  return `${DEMO_SELECTION_PATH}/chat/${encodeURIComponent(String(workspaceId))}${search ? `?${search}` : ""}`;
}
