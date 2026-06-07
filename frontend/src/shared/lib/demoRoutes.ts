export const DEMO_SELECTION_PATH = "/demo";

export function buildDemoChatPath(
  workspaceId: number | string,
  searchParams?: URLSearchParams,
): string {
  const search = searchParams?.toString();
  return `${DEMO_SELECTION_PATH}/chat/${encodeURIComponent(String(workspaceId))}${search ? `?${search}` : ""}`;
}
