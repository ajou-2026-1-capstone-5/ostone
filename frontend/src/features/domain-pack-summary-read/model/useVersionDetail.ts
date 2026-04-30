import { useQuery } from '@tanstack/react-query';
import { domainPackApi, domainPackKeys } from '@/entities/domain-pack';

export function useVersionDetail(
  wsId: number,
  packId: number,
  versionId: number | null,
) {
  return useQuery({
    queryKey: domainPackKeys.versionDetail(wsId, packId, versionId ?? -1),
    queryFn: () => domainPackApi.versionDetail(wsId, packId, versionId!),
    enabled: versionId !== null,
  });
}
