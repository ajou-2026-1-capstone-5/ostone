import { apiClient } from "@/shared/api";

import type { DomainPackDraftEntryResponse } from "../model/types";

export const domainPackApi = {
  getDraftEntry: (workspaceId: number) =>
    apiClient.get<DomainPackDraftEntryResponse>(
      `/workspaces/${workspaceId}/domain-packs/draft-entry`,
    ),
};
