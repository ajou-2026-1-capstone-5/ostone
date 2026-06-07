import { DEMO_SELECTION_PATH } from "./demoRoutes";

export function buildUserChatPath(workspaceId: string | number): string {
  return `/chat/${encodeURIComponent(String(workspaceId))}`;
}

function decodeRouteSegment(segment: string): string {
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
}

export function extractWorkspaceIdFromBasePath(basePath: string): string | null {
  const [pathWithoutQuery] = basePath.split(/[?#]/);
  const segments = pathWithoutQuery.split("/").filter(Boolean);

  if (segments[0] !== "workspaces" || !segments[1]) {
    return null;
  }

  return decodeRouteSegment(segments[1]);
}

export function buildWorkspacePreviewChatPath(basePath: string): string {
  const workspaceId = extractWorkspaceIdFromBasePath(basePath);

  return workspaceId ? buildUserChatPath(workspaceId) : DEMO_SELECTION_PATH;
}
