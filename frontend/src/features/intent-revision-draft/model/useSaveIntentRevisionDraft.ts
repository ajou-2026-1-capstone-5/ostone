import { useCallback, useState } from "react";
import { intentRevisionDraftApi, type UpdateDraftIntentBody } from "../api/intentRevisionDraftApi";
import type { IntentSummary } from "@/entities/intent";

export interface SaveIntentRevisionDraftResult {
  draftVersionId: number;
  clonedIntentId: number | null;
  patchSucceeded: boolean;
}

interface SaveIntentRevisionDraftApiPort {
  createRevisionDraft: (
    workspaceId: number,
    packId: number,
    versionId: number,
  ) => Promise<{ draftVersionId: number }>;
  listIntents: (
    workspaceId: number,
    packId: number,
    versionId: number,
  ) => Promise<IntentSummary[]>;
  updateDraftIntent: (
    workspaceId: number,
    packId: number,
    draftVersionId: number,
    intentId: number,
    values: UpdateDraftIntentBody,
  ) => Promise<unknown>;
}

interface SaveIntentRevisionDraftParams {
  workspaceId: number;
  packId: number;
  baseVersionId: number;
  intentCode: string;
  values: UpdateDraftIntentBody;
}

export async function saveIntentRevisionDraftFlow(
  api: SaveIntentRevisionDraftApiPort,
  {
    workspaceId,
    packId,
    baseVersionId,
    intentCode,
    values,
  }: SaveIntentRevisionDraftParams,
): Promise<SaveIntentRevisionDraftResult> {
  const { draftVersionId } = await api.createRevisionDraft(workspaceId, packId, baseVersionId);

  const draftIntents = await api.listIntents(workspaceId, packId, draftVersionId);
  const clonedIntent = draftIntents.find((intent) => intent.intentCode === intentCode);

  if (clonedIntent?.id == null) {
    return { draftVersionId, clonedIntentId: null, patchSucceeded: false };
  }

  try {
    await api.updateDraftIntent(workspaceId, packId, draftVersionId, clonedIntent.id, values);
    return {
      draftVersionId,
      clonedIntentId: clonedIntent.id,
      patchSucceeded: true,
    };
  } catch {
    return {
      draftVersionId,
      clonedIntentId: clonedIntent.id,
      patchSucceeded: false,
    };
  }
}

export function useSaveIntentRevisionDraft() {
  const [isPending, setPending] = useState(false);

  const saveIntentRevisionDraft = useCallback(
    async (params: SaveIntentRevisionDraftParams): Promise<SaveIntentRevisionDraftResult> => {
      setPending(true);
      try {
        return await saveIntentRevisionDraftFlow(intentRevisionDraftApi, params);
      } finally {
        setPending(false);
      }
    },
    [],
  );

  return { saveIntentRevisionDraft, isPending };
}
