import { apiClient } from "@/shared/api";

import type { DomainPackDraftEntryResponse, DomainPackDetail, DomainPackVersionDetail } from "../model/types";

export const DOMAIN_PACK_DRAFT_ENTRY_NOT_FOUND = "DOMAIN_PACK_DRAFT_ENTRY_NOT_FOUND";

export const domainPackKeys = {
  all: ['domain-packs'] as const,
  detail: (wsId: number, packId: number) =>
    [...domainPackKeys.all, 'detail', wsId, packId] as const,
  versionDetail: (wsId: number, packId: number, versionId: number) =>
    [...domainPackKeys.all, 'version-detail', wsId, packId, versionId] as const,
};

export const domainPackApi = {
  getDraftEntry: (workspaceId: number) =>
    apiClient.get<DomainPackDraftEntryResponse>(
      `/workspaces/${workspaceId}/domain-packs/draft-entry`,
    ),

  detail: (wsId: number, packId: number) =>
    apiClient.get<DomainPackDetail>(
      `/workspaces/${wsId}/domain-packs/${packId}`,
    ),

  versionDetail: (wsId: number, packId: number, versionId: number) =>
    apiClient.get<DomainPackVersionDetail>(
      `/workspaces/${wsId}/domain-packs/${packId}/versions/${versionId}`,
    ),
};
