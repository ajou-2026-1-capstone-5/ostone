import { useEffect, useMemo, useState } from "react";
import type { IntentSummary } from "@/entities/intent";
import type { WorkflowDefinitionDetail, WorkflowDefinitionSummary } from "@/shared/api/generated/zod";
import {
  buildDomainPackRevisionSummary,
  type IntentRevisionSummary,
} from "@/shared/lib/domainPackRevisionSummary";
import { intentRevisionDraftApi } from "../api/intentRevisionDraftApi";

export type {
  IntentRevisionChange,
  IntentRevisionSummary,
  RevisionChangedField,
  WorkflowRevisionChange,
  WorkflowRevisionChangedField,
} from "@/shared/lib/domainPackRevisionSummary";

export type IntentRevisionSummaryState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ready"; data: IntentRevisionSummary }
  | { status: "error"; message: string };

export function buildIntentRevisionSummary(
  baseIntents: IntentSummary[],
  draftIntents: IntentSummary[],
  baseWorkflows: WorkflowDefinitionDetail[] = [],
  draftWorkflows: WorkflowDefinitionDetail[] = [],
): IntentRevisionSummary {
  return buildDomainPackRevisionSummary({
    baseIntents,
    draftIntents,
    baseWorkflows,
    draftWorkflows,
  });
}

async function fetchWorkflowDetails(
  workspaceId: number,
  packId: number,
  versionId: number,
  options: { signal: AbortSignal },
): Promise<WorkflowDefinitionDetail[]> {
  const summaries = await intentRevisionDraftApi.listWorkflows(
    workspaceId,
    packId,
    versionId,
    options,
  );
  return Promise.all(
    summaries.flatMap((workflow: WorkflowDefinitionSummary) => {
      if (typeof workflow.id !== "number") return [];
      return intentRevisionDraftApi.getWorkflow(workspaceId, packId, versionId, workflow.id, options);
    }),
  );
}

export function useIntentRevisionSummary({
  workspaceId,
  packId,
  draftVersionId,
  baseVersionId,
  refreshKey,
  enabled,
}: {
  workspaceId: number;
  packId: number;
  draftVersionId: number;
  baseVersionId: number | null;
  refreshKey?: number;
  enabled: boolean;
}): IntentRevisionSummaryState {
  const requestKey =
    enabled && baseVersionId !== null
      ? `${workspaceId}:${packId}:${baseVersionId}:${draftVersionId}:${refreshKey ?? 0}`
      : null;
  const [state, setState] = useState<{
    requestKey: string | null;
    value: IntentRevisionSummaryState;
  }>({ requestKey: null, value: { status: "idle" } });

  useEffect(() => {
    if (!enabled || baseVersionId === null) {
      return;
    }

    const controller = new AbortController();

    Promise.all([
      intentRevisionDraftApi.listIntents(workspaceId, packId, baseVersionId, {
        signal: controller.signal,
      }),
      intentRevisionDraftApi.listIntents(workspaceId, packId, draftVersionId, {
        signal: controller.signal,
      }),
      fetchWorkflowDetails(workspaceId, packId, baseVersionId, {
        signal: controller.signal,
      }),
      fetchWorkflowDetails(workspaceId, packId, draftVersionId, {
        signal: controller.signal,
      }),
    ])
      .then(([baseIntents, draftIntents, baseWorkflows, draftWorkflows]) => {
        if (controller.signal.aborted) return;
        setState({
          requestKey,
          value: {
            status: "ready",
            data: buildIntentRevisionSummary(
              baseIntents,
              draftIntents,
              baseWorkflows,
              draftWorkflows,
            ),
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
                : "상담 유형 수정 요약을 불러오지 못했습니다.",
          },
        });
      });

    return () => controller.abort();
  }, [baseVersionId, draftVersionId, enabled, packId, requestKey, workspaceId]);

  return useMemo(() => {
    if (requestKey === null) return { status: "idle" };
    return state.requestKey === requestKey ? state.value : { status: "loading" };
  }, [requestKey, state]);
}
