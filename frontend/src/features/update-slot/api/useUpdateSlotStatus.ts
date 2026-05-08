import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { updateSlotStatus } from "@/shared/api/generated/endpoints/update-slot-status-controller/update-slot-status-controller";
import type {
  SlotDefinitionResponse,
  SlotDefinitionSummary,
  UpdateSlotStatusRequest,
} from "@/shared/api/generated/zod";
import { SLOT_ERROR_MESSAGES } from "./messages";

interface UpdateSlotStatusParams {
  workspaceId: number;
  packId: number;
  versionId: number;
  slotId: number;
  status: UpdateSlotStatusRequest["status"];
}

export const UPDATE_SLOT_STATUS_MUTATION_KEY = ["updateSlotStatus"] as const;

export function useUpdateSlotStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: UPDATE_SLOT_STATUS_MUTATION_KEY,
    mutationFn: async ({ workspaceId, packId, versionId, slotId, status }: UpdateSlotStatusParams) => {
      const res = await updateSlotStatus(workspaceId, packId, versionId, slotId, { status });
      return res.data;
    },
    onMutate: async ({ workspaceId, packId, versionId, slotId, status }) => {
      const detailKey = ["slots", "detail", workspaceId, packId, versionId, slotId] as const;
      const listKey = ["slots", "list", workspaceId, packId, versionId] as const;

      const previousDetail = queryClient.getQueryData<SlotDefinitionResponse>(detailKey);
      const previousList = queryClient.getQueryData<SlotDefinitionSummary[]>(listKey);

      queryClient.setQueryData<SlotDefinitionResponse>(detailKey, (old) =>
        old ? { ...old, status } : old,
      );
      queryClient.setQueryData<SlotDefinitionSummary[]>(listKey, (old) =>
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
        queryKey: ["slots", "detail", workspaceId, packId, versionId, slotId] as const,
      });
      queryClient.invalidateQueries({
        queryKey: ["slots", "list", workspaceId, packId, versionId] as const,
      });
    },
  });
}
