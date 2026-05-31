import { useEffect, useMemo, useState } from "react";
import type { IntentSummary } from "@/entities/intent";
import { intentRevisionDraftApi } from "../api/intentRevisionDraftApi";

export type RevisionChangedField = "name" | "description";

export interface IntentRevisionChange {
  intentId: number;
  intentCode: string;
  name: string;
  fields: RevisionChangedField[];
  before: {
    name: string;
    description: string;
  };
  after: {
    name: string;
    description: string;
  };
}

export interface IntentRevisionSummary {
  changedIntents: IntentRevisionChange[];
  changedFieldCounts: Record<RevisionChangedField, number>;
  changedByDraftIntentId: Record<number, IntentRevisionChange>;
}

export type IntentRevisionSummaryState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ready"; data: IntentRevisionSummary }
  | { status: "error"; message: string };

function normalizeText(value: string | null | undefined): string {
  return value ?? "";
}

export function buildIntentRevisionSummary(
  baseIntents: IntentSummary[],
  draftIntents: IntentSummary[],
): IntentRevisionSummary {
  const baseByCode = new Map(
    baseIntents
      .filter((intent) => intent.intentCode)
      .map((intent) => [intent.intentCode as string, intent]),
  );

  const changedIntents = draftIntents.flatMap<IntentRevisionChange>((draft) => {
    if (draft.id == null || !draft.intentCode) return [];

    const base = baseByCode.get(draft.intentCode);
    if (!base) return [];

    const fields: RevisionChangedField[] = [];
    const before = {
      name: normalizeText(base.name),
      description: normalizeText(base.description),
    };
    const after = {
      name: normalizeText(draft.name),
      description: normalizeText(draft.description),
    };

    if (before.name !== after.name) fields.push("name");
    if (before.description !== after.description) fields.push("description");
    if (fields.length === 0) return [];

    return [
      {
        intentId: draft.id,
        intentCode: draft.intentCode,
        name: after.name,
        fields,
        before,
        after,
      },
    ];
  });

  return {
    changedIntents,
    changedFieldCounts: {
      name: changedIntents.filter((change) => change.fields.includes("name")).length,
      description: changedIntents.filter((change) => change.fields.includes("description")).length,
    },
    changedByDraftIntentId: Object.fromEntries(
      changedIntents.map((change) => [change.intentId, change]),
    ),
  };
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
    ])
      .then(([baseIntents, draftIntents]) => {
        if (controller.signal.aborted) return;
        setState({
          requestKey,
          value: {
            status: "ready",
            data: buildIntentRevisionSummary(baseIntents, draftIntents),
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
