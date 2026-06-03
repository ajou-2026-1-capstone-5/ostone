import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import {
  adminPipelineJobKeys,
  listAdminPipelineJobs,
  retryAdminPipelineJob,
} from "./pipelineJobAdminApi";
import {
  list,
  retry,
} from "@/shared/api/generated/endpoints/admin-pipeline-job-controller/admin-pipeline-job-controller";

vi.mock("@/shared/api/generated/endpoints/admin-pipeline-job-controller/admin-pipeline-job-controller", () => ({
  list: vi.fn(),
  retry: vi.fn(),
}));

const mockedList = vi.mocked(list);
const mockedRetry = vi.mocked(retry);

describe("pipelineJobAdminApi", () => {
  beforeEach(() => {
    mockedList.mockReset();
    mockedRetry.mockReset();
  });

  it("목록 필터를 generated endpoint 파라미터로 변환한다", async () => {
    const response = {
      items: [],
      page: 0,
      size: 20,
      totalElements: 0,
      totalPages: 0,
    };
    mockedList.mockResolvedValueOnce({ data: response } as never);

    const result = await listAdminPipelineJobs({
      status: "FAILED",
      workspaceId: "42",
      dagId: "domain_pack_generation",
      runId: "pipeline_job_42",
      page: 1,
      size: 50,
      lagThresholdSeconds: 600,
    });

    expect(mockedList).toHaveBeenCalledWith({
      status: "FAILED",
      workspaceId: 42,
      dagId: "domain_pack_generation",
      runId: "pipeline_job_42",
      page: 1,
      size: 50,
      lagThresholdSeconds: 600,
    });
    expect(result).toBe(response);
  });

  it("workspaceId가 비어 있거나 숫자가 아니면 전달하지 않는다", async () => {
    const response = {
      items: [],
      page: 0,
      size: 20,
      totalElements: 0,
      totalPages: 0,
    };
    mockedList.mockResolvedValue({ data: response } as never);

    await listAdminPipelineJobs({ workspaceId: "   " });
    await listAdminPipelineJobs({ workspaceId: "abc" });

    expect(mockedList).toHaveBeenNthCalledWith(1, {
      status: undefined,
      workspaceId: undefined,
      dagId: undefined,
      runId: undefined,
      page: undefined,
      size: undefined,
      lagThresholdSeconds: undefined,
    });
    expect(mockedList).toHaveBeenNthCalledWith(2, {
      status: undefined,
      workspaceId: undefined,
      dagId: undefined,
      runId: undefined,
      page: undefined,
      size: undefined,
      lagThresholdSeconds: undefined,
    });
  });

  it("재시도 응답을 반환한다", async () => {
    const response = {
      sourcePipelineJobId: 11,
      retryPipelineJobId: 12,
      workspaceId: 1,
      datasetId: 7,
      jobType: "DOMAIN_PACK_GENERATION",
      status: "QUEUED",
      airflowDagId: null,
      airflowRunId: null,
      requestedAt: "2026-06-03T01:00:00Z",
      startedAt: null,
    };
    mockedRetry.mockResolvedValueOnce({ data: response } as never);

    const result = await retryAdminPipelineJob(11);

    expect(mockedRetry).toHaveBeenCalledWith(11);
    expect(result).toBe(response);
  });

  it("data 없는 응답은 명확한 오류로 거부한다", async () => {
    mockedList.mockResolvedValueOnce({ data: undefined } as never);
    mockedRetry.mockResolvedValueOnce({ data: undefined } as never);

    await expect(listAdminPipelineJobs({})).rejects.toThrow(
      "Pipeline job 목록 응답을 확인할 수 없습니다.",
    );
    await expect(retryAdminPipelineJob(11)).rejects.toThrow(
      "Pipeline job 재시도 응답을 확인할 수 없습니다.",
    );
  });

  it("query key에 필터 객체를 포함한다", () => {
    const filters = { status: "FAILED", workspaceId: "1" };

    expect(adminPipelineJobKeys.list(filters)).toEqual([
      "admin",
      "pipeline-jobs",
      "list",
      filters,
    ]);
  });
});
