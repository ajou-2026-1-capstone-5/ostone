import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { slotApi, slotKeys } from "@/entities/slot";
import { SLOT_ERROR_MESSAGES } from "./messages";

interface UpdateSlotStatusParams {
  workspaceId: number;
  packId: number;
  versionId: number;
  slotId: number;
  status: "ACTIVE" | "INACTIVE";
}

export function useUpdateSlotStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ workspaceId, packId, versionId, slotId, status }: UpdateSlotStatusParams) =>
      slotApi.updateStatus(workspaceId, packId, versionId, slotId, { status }),
    onSuccess: (_, { workspaceId, packId, versionId, slotId }) => {
      queryClient.invalidateQueries({
        queryKey: slotKeys.detail(workspaceId, packId, versionId, slotId),
      });
      queryClient.invalidateQueries({
        queryKey: slotKeys.list(workspaceId, packId, versionId),
      });
    },
    onError: () => {
      toast.error(SLOT_ERROR_MESSAGES.STATUS_FAILED);
    },
  });
}
