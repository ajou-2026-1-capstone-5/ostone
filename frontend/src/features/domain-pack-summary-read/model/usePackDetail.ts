import { useGetDomainPack, useGetDomainPackVersion } from '@/shared/api/generated/endpoints/domain-pack-controller/domain-pack-controller';
import {
  type DomainPackDetailResult,
  type DomainPackVersionDetailResult,
} from "@/shared/api/generated/zod";
import { unwrapApiResponse } from "@/shared/api";

export function usePackDetail(wsId: number, packId: number) {
  return useGetDomainPack(wsId, packId, {
    query: { select: (res) => unwrapApiResponse<DomainPackDetailResult>(res) },
  });
}

export function useVersionDetail(
  wsId: number,
  packId: number,
  versionId: number | null,
) {
  return useGetDomainPackVersion(wsId, packId, versionId ?? -1, {
    query: {
      enabled: versionId !== null,
      select: (res) => unwrapApiResponse<DomainPackVersionDetailResult>(res),
    },
  });
}
