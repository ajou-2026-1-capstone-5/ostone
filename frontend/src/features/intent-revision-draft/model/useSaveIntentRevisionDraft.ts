import { useCallback, useState } from "react";
import { intentRevisionDraftApi, type UpdateDraftIntentBody } from "../api/intentRevisionDraftApi";

export interface SaveIntentRevisionDraftResult {
  draftVersionId: number;
  clonedIntentId: number | null;
  patchSucceeded: boolean;
}

export function useSaveIntentRevisionDraft() {
  const [isPending, setPending] = useState(false);

  const saveIntentRevisionDraft = useCallback(
    async ({
      workspaceId,
      packId,
      baseVersionId,
      intentCode,
      values,
    }: {
      workspaceId: number;
      packId: number;
      baseVersionId: number;
      intentCode: string;
      values: UpdateDraftIntentBody;
    }): Promise<SaveIntentRevisionDraftResult> => {
      setPending(true);
      try {
        const { draftVersionId } = await intentRevisionDraftApi.createRevisionDraft(
          workspaceId,
          packId,
          baseVersionId,
        );

        const draftIntents = await intentRevisionDraftApi.listIntents(
          workspaceId,
          packId,
          draftVersionId,
        );
        const clonedIntent = draftIntents.find((intent) => intent.intentCode === intentCode);

        if (clonedIntent?.id == null) {
          return { draftVersionId, clonedIntentId: null, patchSucceeded: false };
        }

        try {
          await intentRevisionDraftApi.updateDraftIntent(
            workspaceId,
            packId,
            draftVersionId,
            clonedIntent.id,
            values,
          );
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
      } finally {
        setPending(false);
      }
    },
    [],
  );

  return { saveIntentRevisionDraft, isPending };
}
