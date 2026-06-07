export const DEMO_SELECTION_PATH = "/demo";
export const PUBLIC_DEMO_CHAT_LABEL = "공개 데모 체험";
export const PUBLIC_DEMO_SELECTION_LABEL = "공개 데모 선택";
export const PUBLIC_DEMO_SELECTION_NEW_TAB_LABEL = "공개 데모 선택 화면을 새 탭에서 엽니다";

export interface WorkspaceSimulationPathParams {
  packId?: number | string | null;
  versionId?: number | string | null;
  workflowId?: number | string | null;
  feedbackStatus?: string | null;
  candidateStatus?: string | null;
}

function appendDefinedParam(
  searchParams: URLSearchParams,
  key: keyof WorkspaceSimulationPathParams,
  value: WorkspaceSimulationPathParams[keyof WorkspaceSimulationPathParams],
) {
  if (value === null || value === undefined || value === "") return;
  searchParams.set(key, String(value));
}

export function buildWorkspaceSimulationPath(
  workspaceId: number | string,
  params?: WorkspaceSimulationPathParams | URLSearchParams,
): string {
  const searchParams = params instanceof URLSearchParams ? params : new URLSearchParams();

  if (params && !(params instanceof URLSearchParams)) {
    appendDefinedParam(searchParams, "packId", params.packId);
    appendDefinedParam(searchParams, "versionId", params.versionId);
    appendDefinedParam(searchParams, "workflowId", params.workflowId);
    appendDefinedParam(searchParams, "feedbackStatus", params.feedbackStatus);
    appendDefinedParam(searchParams, "candidateStatus", params.candidateStatus);
  }

  const search = searchParams.toString();
  return `/workspaces/${encodeURIComponent(String(workspaceId))}/simulation${search ? `?${search}` : ""}`;
}

export function buildDemoChatPath(
  workspaceId: number | string,
  searchParams?: URLSearchParams,
): string {
  const search = searchParams?.toString();
  return `${DEMO_SELECTION_PATH}/chat/${encodeURIComponent(String(workspaceId))}${search ? `?${search}` : ""}`;
}
