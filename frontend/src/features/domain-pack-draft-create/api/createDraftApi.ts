import { createDraft } from "@/shared/api/generated/endpoints/create-domain-pack-draft-controller/create-domain-pack-draft-controller";
import { requireApiData } from "@/shared/api";
import type {
  CreateDomainPackDraftRequest,
  CreateDomainPackDraftResponse,
} from "@/shared/api/generated/zod";

export type { CreateDomainPackDraftRequest, CreateDomainPackDraftResponse };

export const createDraftApi = {
  create: async (
    wsId: number,
    packId: number,
    payload: CreateDomainPackDraftRequest,
  ): Promise<CreateDomainPackDraftResponse> => {
    const response = await createDraft(wsId, packId, payload);
    return requireApiData<CreateDomainPackDraftResponse>(
      response,
      "DRAFT 생성 응답을 확인할 수 없습니다.",
    );
  },
};
