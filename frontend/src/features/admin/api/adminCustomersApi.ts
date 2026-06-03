import { useQuery } from "@tanstack/react-query";

import { apiClient } from "@/shared/api";

// OpenAPI generated endpoints do not include #499 yet; switch this wrapper to generated
// functions after backend OpenAPI generation is available.

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

function buildQuery(params: AdminCustomerListParams): string {
  const query = new URLSearchParams({
    page: String(params.page),
    size: String(params.size),
  });
  const search = params.search.trim();
  if (search) {
    query.set("q", search);
  }
  if (params.status) {
    query.set("status", params.status);
  }
  return query.toString();
}

export function listAdminCustomers(params: AdminCustomerListParams): Promise<AdminCustomerSlice> {
  return apiClient.get<AdminCustomerSlice>(`/admin/customers?${buildQuery(params)}`);
}

export function getAdminCustomerDetail(workspaceId: number): Promise<AdminCustomerDetail> {
  return apiClient.get<AdminCustomerDetail>(`/admin/customers/${workspaceId}`);
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
