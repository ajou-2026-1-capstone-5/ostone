import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useListRisks } from "@/shared/api/generated/endpoints/risk-definition-controller/risk-definition-controller";
import { ApiRequestError } from "@/shared/api";
import { useRiskList } from "./useRiskList";

vi.mock(
  "@/shared/api/generated/endpoints/risk-definition-controller/risk-definition-controller",
  () => ({
    useListRisks: vi.fn(),
  }),
);

const mockedUseListRisks = vi.mocked(useListRisks);

const stubRisk = {
  id: 1,
  domainPackVersionId: 3,
  riskCode: "RISK_FRAUD",
  name: "사기 위험",
  description: null,
  riskLevel: "HIGH" as const,
  status: "ACTIVE" as const,
  createdAt: "",
  updatedAt: "",
};

function mockListQuery(overrides: Partial<ReturnType<typeof useListRisks>> = {}) {
  const result = {
    isLoading: false,
    isError: false,
    error: null,
    data: [stubRisk],
    refetch: vi.fn().mockResolvedValue({}),
    ...overrides,
  };
  mockedUseListRisks.mockReturnValue(result as unknown as ReturnType<typeof useListRisks>);
  return result;
}

describe("useRiskList", () => {
  beforeEach(() => {
    mockedUseListRisks.mockReset();
  });

  it("초기 상태는 loading이다", () => {
    mockListQuery({ isLoading: true, data: undefined });
    const { result } = renderHook(() => useRiskList(1, 2, 3));
    expect(result.current.status).toBe("loading");
  });

  it("성공 시 ready 상태와 위험요소 목록을 반환한다", async () => {
    mockListQuery({ data: [stubRisk] });
    const { result } = renderHook(() => useRiskList(1, 2, 3));

    expect(result.current.status).toBe("ready");
    if (result.current.status === "ready") {
      expect(result.current.data).toEqual([stubRisk]);
    }
    expect(mockedUseListRisks).toHaveBeenCalledWith(
      1,
      2,
      3,
      expect.objectContaining({
        query: expect.objectContaining({ queryKey: ["risk", "list", 1, 2, 3] }),
      }),
    );
  });

  it("목록이 비어 있으면 empty 상태를 반환한다", async () => {
    mockListQuery({ data: [] });
    const { result } = renderHook(() => useRiskList(1, 2, 3));

    expect(result.current.status).toBe("empty");
  });

  it("retryKey가 증가하면 refetch를 호출하고 versionId 변경 시 새 queryKey를 넘긴다", async () => {
    const refetch = vi.fn().mockResolvedValue({});
    mockListQuery({ data: [stubRisk], refetch });

    const { result, rerender } = renderHook(
      ({ retryKey, versionId }) => useRiskList(1, 2, versionId, retryKey),
      {
        initialProps: { retryKey: 0, versionId: 3 },
      },
    );

    expect(result.current.status).toBe("ready");

    rerender({ retryKey: 1, versionId: 3 });

    await waitFor(() => expect(refetch).toHaveBeenCalledTimes(1));

    rerender({ retryKey: 1, versionId: 4 });

    expect(mockedUseListRisks).toHaveBeenLastCalledWith(
      1,
      2,
      4,
      expect.objectContaining({
        query: expect.objectContaining({ queryKey: ["risk", "list", 1, 2, 4] }),
      }),
    );
  });

  it("ApiRequestError를 error 상태로 변환한다", async () => {
    mockListQuery({
      isError: true,
      error: new ApiRequestError(403, "FORBIDDEN", "접근 금지"),
      data: undefined,
    });
    const { result } = renderHook(() => useRiskList(1, 2, 3));

    expect(result.current.status).toBe("error");
    if (result.current.status === "error") {
      expect(result.current.httpStatus).toBe(403);
      expect(result.current.code).toBe("FORBIDDEN");
    }
  });
});
