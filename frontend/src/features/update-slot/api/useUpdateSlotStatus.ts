import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { slotApi, slotKeys } from "@/entities/slot";
import type { SlotDefinition, SlotSummary } from "@/entities/slot";
import { SLOT_ERROR_MESSAGES } from "./messages";

interface UpdateSlotStatusParams {
  workspaceId: number;
  packId: number;
  versionId: number;
  slotId: number;
  status: "ACTIVE" | "INACTIVE";
}

export const UPDATE_SLOT_STATUS_MUTATION_KEY = ["updateSlotStatus"] as const;

export function useUpdateSlotStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: UPDATE_SLOT_STATUS_MUTATION_KEY,
    mutationFn: ({ workspaceId, packId, versionId, slotId, status }: UpdateSlotStatusParams) =>
      slotApi.updateStatus(workspaceId, packId, versionId, slotId, { status }),
    onMutate: async ({ workspaceId, packId, versionId, slotId, status }) => {
      const detailKey = slotKeys.detail(workspaceId, packId, versionId, slotId);
      const listKey = slotKeys.list(workspaceId, packId, versionId);

      const previousDetail = queryClient.getQueryData<SlotDefinition>(detailKey);
      const previousList = queryClient.getQueryData<SlotSummary[]>(listKey);

      queryClient.setQueryData<SlotDefinition>(detailKey, (old) =>
        old ? { ...old, status } : old,
      );
      queryClient.setQueryData<SlotSummary[]>(listKey, (old) =>
        old?.map((item) => (item.id === slotId ? { ...item, status } : item)),
      );

      return { previousDetail, previousList, detailKey, listKey };
    },
    onError: (_err, _vars, context) => {
      if (context) {
        queryClient.setQueryData(context.detailKey, context.previousDetail);
        queryClient.setQueryData(context.listKey, context.previousList);
      }
      toast.error(SLOT_ERROR_MESSAGES.STATUS_FAILED);
    },
    onSuccess: (_, { workspaceId, packId, versionId, slotId }) => {
      queryClient.invalidateQueries({
        queryKey: slotKeys.detail(workspaceId, packId, versionId, slotId),
      });
      queryClient.invalidateQueries({
        queryKey: slotKeys.list(workspaceId, packId, versionId),
      });
    },
  });
}
