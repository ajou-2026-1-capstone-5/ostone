import {
  useGetDomainPack,
  useGetDomainPackVersion,
} from "@/shared/api/generated/endpoints/domain-pack-controller/domain-pack-controller";
import {
  type DomainPackDetailResult,
  type DomainPackVersionDetailResult,
} from "@/shared/api/generated/zod";
import { domainPackQueryKeys, selectApiData } from "@/shared/api";

export function usePackDetail(wsId: number, packId: number, options?: { enabled?: boolean }) {
  return useGetDomainPack(wsId, packId, {
    query: {
      enabled: options?.enabled,
      queryKey: domainPackQueryKeys.detail(wsId, packId),
      select: selectApiData<DomainPackDetailResult>,
    },
  });
}

export function useVersionDetail(wsId: number, packId: number, versionId: number | null) {
  return useGetDomainPackVersion(wsId, packId, versionId ?? -1, {
    query: {
      enabled: versionId !== null,
      queryKey: domainPackQueryKeys.version(wsId, packId, versionId ?? -1),
      select: selectApiData<DomainPackVersionDetailResult>,
    },
  });
}
