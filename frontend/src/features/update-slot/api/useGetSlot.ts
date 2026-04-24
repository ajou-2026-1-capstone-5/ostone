import { useQuery } from "@tanstack/react-query";
import { slotApi, slotKeys } from "@/entities/slot";

export function useGetSlot(
  workspaceId: number,
  packId: number,
  versionId: number,
  slotId: number,
  enabled: boolean,
) {
  return useQuery({
    queryKey: slotKeys.detail(workspaceId, packId, versionId, slotId),
    queryFn: () => slotApi.detail(workspaceId, packId, versionId, slotId),
    enabled,
  });
}
