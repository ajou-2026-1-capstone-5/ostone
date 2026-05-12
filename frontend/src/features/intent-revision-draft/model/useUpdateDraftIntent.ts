import { useCallback, useState } from "react";
import { intentRevisionDraftApi, type UpdateDraftIntentBody } from "../api/intentRevisionDraftApi";

export function useUpdateDraftIntent() {
  const [isPending, setPending] = useState(false);

  const updateDraftIntent = useCallback(
    async ({
      workspaceId,
      packId,
      draftVersionId,
      intentId,
      values,
    }: {
      workspaceId: number;
      packId: number;
      draftVersionId: number;
      intentId: number;
      values: UpdateDraftIntentBody;
    }) => {
      setPending(true);
      try {
        return await intentRevisionDraftApi.updateDraftIntent(
          workspaceId,
          packId,
          draftVersionId,
          intentId,
          values,
        );
      } finally {
        setPending(false);
      }
    },
    [],
  );

  return { updateDraftIntent, isPending };
}
