import { useQuery } from "@tanstack/react-query";
import { getSlot } from "@/shared/api/generated/endpoints/slot-definition-controller/slot-definition-controller";

export interface UseGetSlotParams {
  workspaceId: number;
  packId: number;
  versionId: number;
  slotId: number;
  enabled: boolean;
}

export function useGetSlot({ workspaceId, packId, versionId, slotId, enabled }: UseGetSlotParams) {
  return useQuery({
    queryKey: ["slots", "detail", workspaceId, packId, versionId, slotId] as const,
    queryFn: async () => {
      const res = await getSlot(workspaceId, packId, versionId, slotId);
      return res.data;
    },
    enabled,
  });
}
