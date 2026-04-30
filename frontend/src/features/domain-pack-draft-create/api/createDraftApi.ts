import { apiClient } from '@/shared/api';
import type { CreateDomainPackDraftRequest, CreateDomainPackDraftResponse } from '@/entities/domain-pack';

export const createDraftApi = {
  create: (wsId: number, packId: number, payload: CreateDomainPackDraftRequest) =>
    apiClient.post<CreateDomainPackDraftResponse>(
      `/workspaces/${wsId}/domain-packs/${packId}/versions/drafts`,
      payload,
    ),
};
