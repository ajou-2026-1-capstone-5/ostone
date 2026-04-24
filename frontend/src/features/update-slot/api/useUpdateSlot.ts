import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { slotApi, slotKeys } from "@/entities/slot";
import type { UpdateSlotRequest } from "@/entities/slot";
import { ApiRequestError } from "@/shared/api";
import { SLOT_ERROR_MESSAGES } from "./messages";

interface UpdateSlotParams {
  workspaceId: number;
  packId: number;
  versionId: number;
  slotId: number;
  body: UpdateSlotRequest;
}

export function useUpdateSlot() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ workspaceId, packId, versionId, slotId, body }: UpdateSlotParams) =>
      slotApi.update(workspaceId, packId, versionId, slotId, body),
    onSuccess: (_, { workspaceId, packId, versionId, slotId }) => {
      queryClient.invalidateQueries({
        queryKey: slotKeys.detail(workspaceId, packId, versionId, slotId),
      });
      queryClient.invalidateQueries({
        queryKey: slotKeys.list(workspaceId, packId, versionId),
      });
      toast.success("슬롯이 수정되었습니다.");
    },
    onError: (error: unknown) => {
      if (error instanceof ApiRequestError && error.code === "SLOT_NOT_EDITABLE") {
        toast.error(SLOT_ERROR_MESSAGES.SLOT_NOT_EDITABLE);
      } else {
        toast.error(SLOT_ERROR_MESSAGES.UPDATE_FAILED);
      }
    },
  });
}
