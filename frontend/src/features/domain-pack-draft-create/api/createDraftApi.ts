import { createDraft } from "@/shared/api/generated/endpoints/create-domain-pack-draft-controller/create-domain-pack-draft-controller";
import type {
  CreateDomainPackDraftRequest,
  CreateDomainPackDraftResponse,
} from "@/shared/api/generated/zod";

export type { CreateDomainPackDraftRequest, CreateDomainPackDraftResponse };

export const createDraftApi = {
  create: (wsId: number, packId: number, payload: CreateDomainPackDraftRequest) =>
    createDraft(wsId, packId, payload).then(
      (response): CreateDomainPackDraftResponse => response.data,
    ),
};
