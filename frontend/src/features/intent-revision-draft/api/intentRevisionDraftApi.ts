import { requireApiData, selectApiData } from "@/shared/api";
import { activate } from "@/shared/api/generated/endpoints/activate-domain-pack-version-controller/activate-domain-pack-version-controller";
import { create } from "@/shared/api/generated/endpoints/create-intent-revision-draft-controller/create-intent-revision-draft-controller";
import { discard } from "@/shared/api/generated/endpoints/discard-draft-version-controller/discard-draft-version-controller";
import { getDomainPackVersion } from "@/shared/api/generated/endpoints/domain-pack-controller/domain-pack-controller";
import {
  getIntent,
  listIntents,
} from "@/shared/api/generated/endpoints/intent-definition-controller/intent-definition-controller";
import { update } from "@/shared/api/generated/endpoints/update-draft-intent-controller/update-draft-intent-controller";
import {
  getWorkflow,
  listWorkflows,
} from "@/shared/api/generated/endpoints/workflow-definition-controller/workflow-definition-controller";
import type { DomainPackVersionDetail } from "@/entities/domain-pack";
import type { IntentDetail, IntentSummary } from "@/entities/intent";
import type {
  UpdateDraftIntentRequest,
  WorkflowDefinitionDetail,
  WorkflowDefinitionSummary,
} from "@/shared/api/generated/zod";

export interface UpdateDraftIntentBody {
  name: UpdateDraftIntentRequest["name"];
  description: UpdateDraftIntentRequest["description"];
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
  const unwrapped = selectApiData(response) ?? response;
  const canonicalId = unwrapped.draftVersionId;
  const legacyId =
    unwrapped.versionId ??
    unwrapped.id ??
    unwrapped.draftVersion?.versionId ??
    unwrapped.draftVersion?.id;
  const id = canonicalId ?? legacyId;

  if (canonicalId === undefined && legacyId !== undefined) {
    // TODO: remove fallback handling once RevisionDraftResponse always returns draftVersionId.
    console.warn("[intentRevisionDraftApi] using legacy revision draft id response field");
  }

  if (typeof id !== "number") {
    throw new Error("상담 유형 수정 초안 버전 ID를 확인할 수 없습니다.");
  }

  return id;
}

function normalizeActivatedVersionId(response: ActivateVersionResponse): number {
  const unwrapped = selectApiData(response) ?? response;
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
    const response = await create(workspaceId, packId, versionId);
    return { draftVersionId: normalizeDraftVersionId(response as RevisionDraftResponse) };
  },

  async updateDraftIntent(
    workspaceId: number,
    packId: number,
    draftVersionId: number,
    intentId: number,
    body: UpdateDraftIntentBody,
  ): Promise<IntentDetail> {
    const response = await update(workspaceId, packId, draftVersionId, intentId, body);
    return requireApiData<IntentDetail>(response, "상담 유형 수정 응답을 확인할 수 없습니다.");
  },

  async activateVersion(
    workspaceId: number,
    packId: number,
    versionId: number,
  ): Promise<{ activatedVersionId: number }> {
    const response = await activate(workspaceId, packId, versionId);
    return { activatedVersionId: normalizeActivatedVersionId(response as ActivateVersionResponse) };
  },

  async discardDraft(workspaceId: number, packId: number, draftVersionId: number): Promise<void> {
    await discard(workspaceId, packId, draftVersionId);
  },

  async listIntents(
    workspaceId: number,
    packId: number,
    versionId: number,
    options?: { signal?: AbortSignal },
  ): Promise<IntentSummary[]> {
    const response = await listIntents(workspaceId, packId, versionId, options);
    if (Array.isArray(response)) return response as IntentSummary[];
    return selectApiData<IntentSummary[]>(response) ?? [];
  },

  async getIntent(
    workspaceId: number,
    packId: number,
    versionId: number,
    intentId: number,
  ): Promise<IntentDetail> {
    const response = await getIntent(workspaceId, packId, versionId, intentId);
    return requireApiData<IntentDetail>(response, "상담 유형 상세 응답을 확인할 수 없습니다.");
  },

  async getVersionDetail(
    workspaceId: number,
    packId: number,
    versionId: number,
  ): Promise<DomainPackVersionDetail> {
    const response = await getDomainPackVersion(workspaceId, packId, versionId);
    return requireApiData<DomainPackVersionDetail>(
      response,
      "Domain pack version 상세 응답을 확인할 수 없습니다.",
    );
  },

  async listWorkflows(
    workspaceId: number,
    packId: number,
    versionId: number,
    options?: { signal?: AbortSignal },
  ): Promise<WorkflowDefinitionSummary[]> {
    const response = await listWorkflows(workspaceId, packId, versionId, undefined, options);
    if (Array.isArray(response)) return response as WorkflowDefinitionSummary[];
    return selectApiData<WorkflowDefinitionSummary[]>(response) ?? [];
  },

  async getWorkflow(
    workspaceId: number,
    packId: number,
    versionId: number,
    workflowId: number,
    options?: { signal?: AbortSignal },
  ): Promise<WorkflowDefinitionDetail> {
    const response = await getWorkflow(workspaceId, packId, versionId, workflowId, options);
    return requireApiData<WorkflowDefinitionDetail>(
      response,
      "Workflow 상세 응답을 확인할 수 없습니다.",
    );
  },
};
