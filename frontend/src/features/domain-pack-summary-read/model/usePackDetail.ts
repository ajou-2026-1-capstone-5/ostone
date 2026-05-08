import { useGetDomainPack, useGetDomainPackVersion } from '@/shared/api/generated/endpoints/domain-pack-controller/domain-pack-controller';

export function usePackDetail(wsId: number, packId: number) {
  return useGetDomainPack(wsId, packId, {
    query: { select: (res) => res.data },
  });
}

export function useVersionDetail(
  wsId: number,
  packId: number,
  versionId: number | null,
) {
  return useGetDomainPackVersion(wsId, packId, versionId ?? -1, {
    query: { enabled: versionId !== null, select: (res) => res.data },
  });
}