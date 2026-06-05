import { useQuery } from "@tanstack/react-query";

import {
  detail,
  list1,
} from "@/shared/api/generated/endpoints/admin-customer-controller/admin-customer-controller";
import type { List1Params } from "@/shared/api/generated/zod";
import { requireApiData } from "@/shared/api";

// 호출은 generated admin-customer-controller(list1/detail)에 위임한다.
// 이 wrapper는 (1) 응답 data envelope unwrap, (2) UI가 의존하는 도메인 타입 정규화
// (generated 응답 타입은 전 필드 optional이라 화면 계약에 부족), (3) 검색어 trim과
// list/detail scope를 가지는 queryKey 표준화 목적으로만 유지한다.

export interface AdminCustomerWorkspace {
  id: number;
  workspaceKey: string;
  name: string;
  description: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface AdminCustomerBillingSummary {
  subscriptionStatus: string | null;
  planName: string | null;
  currentPeriodEnd: string | null;
  updatedAt: string | null;
}

export interface AdminCustomerUploadSummary {
  datasetId: number;
  datasetKey: string;
  name: string;
  status: string;
  uploadedAt: string;
}

export interface AdminCustomerPipelineJob {
  id: number;
  jobType: string;
  status: string;
  requestedAt: string;
  startedAt: string | null;
  finishedAt: string | null;
}

export interface AdminCustomerSummary {
  workspace: AdminCustomerWorkspace;
  memberCount: number;
  billing: AdminCustomerBillingSummary;
  latestUpload: AdminCustomerUploadSummary | null;
  latestPipelineJob: AdminCustomerPipelineJob | null;
}

export interface AdminCustomerSlice {
  content: AdminCustomerSummary[];
  page: number;
  size: number;
  hasNext: boolean;
}

export interface AdminCustomerMemberEntry {
  memberId: number;
  userId: number;
  name: string;
  email: string;
  workspaceRole: string;
  accountStatus: string;
  joinedAt: string;
}

export interface AdminCustomerMemberSummary {
  totalCount: number;
  ownerCount: number;
  adminCount: number;
  reviewerCount: number;
  operatorCount: number;
  recentMembers: AdminCustomerMemberEntry[];
}

export interface AdminCustomerPipelineSummary {
  totalCount: number;
  runningCount: number;
  succeededCount: number;
  failedCount: number;
  latestJob: AdminCustomerPipelineJob | null;
  recentJobs: AdminCustomerPipelineJob[];
}

export interface AdminCustomerDetail {
  workspace: AdminCustomerWorkspace;
  members: AdminCustomerMemberSummary;
  billing: AdminCustomerBillingSummary;
  latestUpload: AdminCustomerUploadSummary | null;
  pipeline: AdminCustomerPipelineSummary;
}

export interface AdminCustomerListParams {
  search: string;
  status: string;
  page: number;
  size: number;
}

export const adminCustomerQueryKeys = {
  all: ["admin-customers"] as const,
  list: (params: AdminCustomerListParams) =>
    [
      ...adminCustomerQueryKeys.all,
      "list",
      params.search.trim(),
      params.status,
      params.page,
      params.size,
    ] as const,
  detail: (workspaceId: number | null) =>
    [...adminCustomerQueryKeys.all, "detail", workspaceId] as const,
};

function toList1Params(params: AdminCustomerListParams): List1Params {
  const search = params.search.trim();
  return {
    page: params.page,
    size: params.size,
    ...(search ? { q: search } : {}),
    ...(params.status ? { status: params.status } : {}),
  };
}

export async function listAdminCustomers(
  params: AdminCustomerListParams,
): Promise<AdminCustomerSlice> {
  const response = await list1(toList1Params(params));
  return requireApiData<AdminCustomerSlice>(
    response as unknown as { data?: AdminCustomerSlice },
    "고객사 목록 응답을 확인할 수 없습니다.",
  );
}

export async function getAdminCustomerDetail(workspaceId: number): Promise<AdminCustomerDetail> {
  const response = await detail(workspaceId);
  return requireApiData<AdminCustomerDetail>(
    response as unknown as { data?: AdminCustomerDetail },
    "고객사 상세 응답을 확인할 수 없습니다.",
  );
}

export function useAdminCustomers(params: AdminCustomerListParams) {
  return useQuery({
    queryKey: adminCustomerQueryKeys.list(params),
    queryFn: () => listAdminCustomers(params),
  });
}

export function useAdminCustomerDetail(workspaceId: number | null) {
  return useQuery({
    queryKey: adminCustomerQueryKeys.detail(workspaceId),
    enabled: workspaceId !== null,
    queryFn: () => getAdminCustomerDetail(workspaceId ?? 0),
  });
}
