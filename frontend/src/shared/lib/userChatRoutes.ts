import { DEMO_SELECTION_PATH } from "./demoRoutes";

export const WORKSPACE_PREVIEW_LABEL = "운영자 미리보기";
export const WORKSPACE_PREVIEW_NEW_TAB_LABEL =
  "현재 워크스페이스 운영자 미리보기를 새 탭에서 엽니다";

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
