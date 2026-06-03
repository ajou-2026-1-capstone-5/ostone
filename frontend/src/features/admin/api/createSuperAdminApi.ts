import { create2 } from "@/shared/api/generated/endpoints/admin-account-controller/admin-account-controller";
import type { CreateSuperAdminRequest, CreateSuperAdminResponse } from "@/shared/api/generated/zod";
import { requireApiData } from "@/shared/api";

export type { CreateSuperAdminRequest, CreateSuperAdminResponse };

export async function createSuperAdminApi(
  data: CreateSuperAdminRequest,
): Promise<CreateSuperAdminResponse> {
  const response = await create2(data);
  return requireApiData<CreateSuperAdminResponse>(
    response,
    "관리자 계정 생성 응답을 확인할 수 없습니다.",
  );
}
