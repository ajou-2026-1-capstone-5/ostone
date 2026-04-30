import { useQuery } from '@tanstack/react-query';
import { domainPackApi, domainPackKeys } from '@/entities/domain-pack';

export function usePackDetail(wsId: number, packId: number) {
  return useQuery({
    queryKey: domainPackKeys.detail(wsId, packId),
    queryFn: () => domainPackApi.detail(wsId, packId),
  });
}
