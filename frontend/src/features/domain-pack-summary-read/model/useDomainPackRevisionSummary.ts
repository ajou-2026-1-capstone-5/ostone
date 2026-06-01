import { useEffect, useMemo, useState } from "react";
import { listIntents } from "@/shared/api/generated/endpoints/intent-definition-controller/intent-definition-controller";
import {
  getWorkflow,
  listWorkflows,
} from "@/shared/api/generated/endpoints/workflow-definition-controller/workflow-definition-controller";
import type {
  IntentDefinitionSummary,
  WorkflowDefinitionDetail,
  WorkflowDefinitionSummary,
} from "@/shared/api/generated/zod";
import { selectApiData } from "@/shared/api";
import {
  buildDomainPackRevisionSummary,
  type IntentRevisionSummary,
} from "@/shared/lib/domainPackRevisionSummary";

export type DomainPackRevisionSummaryState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ready"; data: IntentRevisionSummary }
  | { status: "error"; message: string };

function readRevisionBaseVersionId(summaryJson?: string | null): number | null {
  if (!summaryJson) return null;

  try {
    const parsed: unknown = JSON.parse(summaryJson);
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return null;
    const draftSource = (parsed as { draftSource?: unknown }).draftSource;
    if (typeof draftSource !== "object" || draftSource === null || Array.isArray(draftSource)) {
      return null;
    }
    const source = draftSource as Record<string, unknown>;
    return source.type === "INTENT_REVISION" && typeof source.baseVersionId === "number"
      ? source.baseVersionId
      : null;
  } catch {
    return null;
  }
}

async function fetchIntents(
  workspaceId: number,
  packId: number,
  versionId: number,
  options: { signal: AbortSignal },
): Promise<IntentDefinitionSummary[]> {
  const response = await listIntents(workspaceId, packId, versionId, options);
  if (Array.isArray(response)) return response as IntentDefinitionSummary[];
  return selectApiData<IntentDefinitionSummary[]>(response) ?? [];
}

async function fetchWorkflowDetails(
  workspaceId: number,
  packId: number,
  versionId: number,
  options: { signal: AbortSignal },
): Promise<WorkflowDefinitionDetail[]> {
  const response = await listWorkflows(workspaceId, packId, versionId, undefined, options);
  const workflows = Array.isArray(response)
    ? (response as WorkflowDefinitionSummary[])
    : selectApiData<WorkflowDefinitionSummary[]>(response) ?? [];

  return Promise.all(
    workflows.flatMap((workflow) => {
      if (typeof workflow.id !== "number") return [];
      return getWorkflow(workspaceId, packId, versionId, workflow.id, options).then(
        (detailResponse) =>
          selectApiData<WorkflowDefinitionDetail>(detailResponse) ?? {
            ...workflow,
            id: workflow.id,
          },
      );
    }),
  );
}

export function useDomainPackRevisionSummary({
  workspaceId,
  packId,
  versionId,
  summaryJson,
}: {
  workspaceId: number;
  packId: number;
  versionId: number | null | undefined;
  summaryJson?: string | null;
}): DomainPackRevisionSummaryState {
  const baseVersionId = readRevisionBaseVersionId(summaryJson);
  const requestKey =
    versionId != null && baseVersionId != null
      ? `${workspaceId}:${packId}:${baseVersionId}:${versionId}:${summaryJson ?? ""}`
      : null;
  const [state, setState] = useState<{
    requestKey: string | null;
    value: DomainPackRevisionSummaryState;
  }>({ requestKey: null, value: { status: "idle" } });

  useEffect(() => {
    if (requestKey === null || versionId == null || baseVersionId == null) return;

    const controller = new AbortController();
    const options = { signal: controller.signal };

    Promise.all([
      fetchIntents(workspaceId, packId, baseVersionId, options),
      fetchIntents(workspaceId, packId, versionId, options),
      fetchWorkflowDetails(workspaceId, packId, baseVersionId, options),
      fetchWorkflowDetails(workspaceId, packId, versionId, options),
    ])
      .then(([baseIntents, draftIntents, baseWorkflows, draftWorkflows]) => {
        if (controller.signal.aborted) return;
        setState({
          requestKey,
          value: {
            status: "ready",
            data: buildDomainPackRevisionSummary({
              baseIntents,
              draftIntents,
              baseWorkflows,
              draftWorkflows,
            }),
          },
        });
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        setState({
          requestKey,
          value: {
            status: "error",
            message:
              error instanceof Error
                ? error.message
                : "도메인팩 변경 요약을 불러오지 못했습니다.",
          },
        });
      });

    return () => controller.abort();
  }, [baseVersionId, packId, requestKey, versionId, workspaceId]);

  return useMemo(() => {
    if (requestKey === null) return { status: "idle" };
    return state.requestKey === requestKey ? state.value : { status: "loading" };
  }, [requestKey, state]);
}
