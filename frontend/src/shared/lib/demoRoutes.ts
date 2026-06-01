export function buildDemoChatPath(
  workspaceId: number | string,
  searchParams?: URLSearchParams,
): string {
  const search = searchParams?.toString();
  return `/demo/chat/${encodeURIComponent(String(workspaceId))}${search ? `?${search}` : ""}`;
}
