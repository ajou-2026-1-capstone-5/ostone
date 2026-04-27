import { apiClient } from "@/shared/api";

import type { DomainPackDraftEntryResponse } from "../model/types";

export const DOMAIN_PACK_DRAFT_ENTRY_NOT_FOUND = "DOMAIN_PACK_DRAFT_ENTRY_NOT_FOUND";

export const domainPackApi = {
  getDraftEntry: (workspaceId: number) =>
    apiClient.get<DomainPackDraftEntryResponse>(
      `/workspaces/${workspaceId}/domain-packs/draft-entry`,
    ),
};
