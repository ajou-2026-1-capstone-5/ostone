import { useGetSlot as useGeneratedGetSlot } from "@/shared/api/generated/endpoints/slot-definition-controller/slot-definition-controller";
import { requireApiData, slotQueryKeys } from "@/shared/api";
import type { SlotDefinitionResponse } from "@/shared/api/generated/zod";

export interface UseGetSlotParams {
  workspaceId: number;
  packId: number;
  versionId: number;
  slotId: number;
  enabled: boolean;
}

export function useGetSlot({ workspaceId, packId, versionId, slotId, enabled }: UseGetSlotParams) {
  return useGeneratedGetSlot<SlotDefinitionResponse>(workspaceId, packId, versionId, slotId, {
    query: {
      queryKey: slotQueryKeys.detail(workspaceId, packId, versionId, slotId),
      select: (response) =>
        requireApiData<SlotDefinitionResponse>(response, "Slot 상세 응답을 확인할 수 없습니다."),
      enabled,
    },
  });
}
