import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { updateSlot } from "@/shared/api/generated/endpoints/update-slot-controller/update-slot-controller";
import type { UpdateSlotRequest } from "@/shared/api/generated/zod";
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
    mutationFn: async ({ workspaceId, packId, versionId, slotId, body }: UpdateSlotParams) => {
      const res = await updateSlot(workspaceId, packId, versionId, slotId, body);
      return res.data;
    },
    onSuccess: (_, { workspaceId, packId, versionId, slotId }) => {
      queryClient.invalidateQueries({
        queryKey: ["slots", "detail", workspaceId, packId, versionId, slotId] as const,
      });
      queryClient.invalidateQueries({
        queryKey: ["slots", "list", workspaceId, packId, versionId] as const,
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
