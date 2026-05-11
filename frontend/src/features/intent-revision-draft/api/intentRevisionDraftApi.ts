import { apiClient } from "@/shared/api";
import { unwrapApiResponse } from "@/shared/api/unwrapApiResponse";
import type { DomainPackVersionDetail } from "@/entities/domain-pack";
import type { IntentDetail, IntentSummary } from "@/entities/intent";

export interface UpdateDraftIntentBody {
  name: string;
  description: string;
}

interface RevisionDraftResponse {
  versionId?: number;
  id?: number;
  draftVersionId?: number;
  draftVersion?: {
    versionId?: number;
    id?: number;
  };
  data?: RevisionDraftResponse;
}

interface ActivateVersionResponse {
  id?: number;
  versionId?: number;
  data?: ActivateVersionResponse;
}

function normalizeDraftVersionId(response: RevisionDraftResponse): number {
  const unwrapped = unwrapApiResponse(response);
  const id =
    unwrapped.draftVersionId ??
    unwrapped.versionId ??
    unwrapped.id ??
    unwrapped.draftVersion?.versionId ??
    unwrapped.draftVersion?.id;

  if (typeof id !== "number") {
    throw new Error("Intent 수정 초안 version id를 확인할 수 없습니다.");
  }

  return id;
}

function normalizeActivatedVersionId(response: ActivateVersionResponse): number {
  const unwrapped = unwrapApiResponse(response);
  const id = unwrapped.versionId ?? unwrapped.id;

  if (typeof id !== "number") {
    throw new Error("활성화된 version id를 확인할 수 없습니다.");
  }

  return id;
}

export const intentRevisionDraftApi = {
  async createRevisionDraft(
    workspaceId: number,
    packId: number,
    versionId: number,
  ): Promise<{ draftVersionId: number }> {
    const response = await apiClient.post<RevisionDraftResponse>(
      `/workspaces/${workspaceId}/domain-packs/${packId}/versions/${versionId}/revision-drafts`,
      undefined,
    );
    return { draftVersionId: normalizeDraftVersionId(response) };
  },

  async updateDraftIntent(
    workspaceId: number,
    packId: number,
    draftVersionId: number,
    intentId: number,
    body: UpdateDraftIntentBody,
  ): Promise<IntentDetail> {
    const response = await apiClient.patch<IntentDetail | { data: IntentDetail }>(
      `/workspaces/${workspaceId}/domain-packs/${packId}/versions/${draftVersionId}/intents/${intentId}`,
      body,
    );
    return unwrapApiResponse(response);
  },

  async activateVersion(
    workspaceId: number,
    packId: number,
    versionId: number,
  ): Promise<{ activatedVersionId: number }> {
    const response = await apiClient.post<ActivateVersionResponse>(
      `/workspaces/${workspaceId}/domain-packs/${packId}/versions/${versionId}/activate`,
      undefined,
    );
    return { activatedVersionId: normalizeActivatedVersionId(response) };
  },

  async discardDraft(
    workspaceId: number,
    packId: number,
    draftVersionId: number,
  ): Promise<void> {
    await apiClient.delete<void>(
      `/workspaces/${workspaceId}/domain-packs/${packId}/versions/${draftVersionId}/draft`,
    );
  },

  async listIntents(
    workspaceId: number,
    packId: number,
    versionId: number,
    options?: { signal?: AbortSignal },
  ): Promise<IntentSummary[]> {
    const response = await apiClient.get<IntentSummary[] | { data: IntentSummary[] }>(
      `/workspaces/${workspaceId}/domain-packs/${packId}/versions/${versionId}/intents`,
      options,
    );
    return unwrapApiResponse(response);
  },

  async getIntent(
    workspaceId: number,
    packId: number,
    versionId: number,
    intentId: number,
  ): Promise<IntentDetail> {
    const response = await apiClient.get<IntentDetail | { data: IntentDetail }>(
      `/workspaces/${workspaceId}/domain-packs/${packId}/versions/${versionId}/intents/${intentId}`,
    );
    return unwrapApiResponse(response);
  },

  async getVersionDetail(
    workspaceId: number,
    packId: number,
    versionId: number,
  ): Promise<DomainPackVersionDetail> {
    const response = await apiClient.get<DomainPackVersionDetail | { data: DomainPackVersionDetail }>(
      `/workspaces/${workspaceId}/domain-packs/${packId}/versions/${versionId}`,
    );
    return unwrapApiResponse(response);
  },
};
