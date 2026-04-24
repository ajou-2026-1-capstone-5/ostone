import { useQuery } from "@tanstack/react-query";
import { slotApi, slotKeys } from "@/entities/slot";

export interface UseGetSlotParams {
  workspaceId: number;
  packId: number;
  versionId: number;
  slotId: number;
  enabled: boolean;
}

export function useGetSlot({ workspaceId, packId, versionId, slotId, enabled }: UseGetSlotParams) {
  return useQuery({
    queryKey: slotKeys.detail(workspaceId, packId, versionId, slotId),
    queryFn: () => slotApi.detail(workspaceId, packId, versionId, slotId),
    enabled,
  });
}
