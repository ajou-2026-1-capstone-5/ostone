export function buildUserChatPath(workspaceId: string | number): string {
  return `/chat/${encodeURIComponent(String(workspaceId))}`;
}
