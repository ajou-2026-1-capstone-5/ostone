import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useGetRisk } from "@/shared/api/generated/endpoints/risk-definition-controller/risk-definition-controller";
import { ApiRequestError } from "@/shared/api";
import { useRiskDetail } from "./useRiskDetail";

vi.mock(
  "@/shared/api/generated/endpoints/risk-definition-controller/risk-definition-controller",
  () => ({
    useGetRisk: vi.fn(),
  }),
);

const mockedUseGetRisk = vi.mocked(useGetRisk);

const stubRisk = {
  id: 4,
  domainPackVersionId: 3,
  riskCode: "RISK_FRAUD",
  name: "사기 위험",
  description: "부정 거래 징후",
  riskLevel: "HIGH" as const,
  triggerConditionJson: '{"channel":"web"}',
  handlingActionJson: '{"type":"MANUAL_REVIEW"}',
  evidenceJson: "[]",
  metaJson: "{}",
  status: "ACTIVE" as const,
  createdAt: "2026-04-16T10:00:00Z",
  updatedAt: "2026-04-16T10:00:00Z",
};

function mockDetailQuery(overrides: Partial<ReturnType<typeof useGetRisk>> = {}) {
  const result = {
    isLoading: false,
    isFetching: false,
    isError: false,
    error: null,
    data: stubRisk,
    refetch: vi.fn().mockResolvedValue({}),
    ...overrides,
  };
  mockedUseGetRisk.mockReturnValue(result as unknown as ReturnType<typeof useGetRisk>);
  return result;
}

describe("useRiskDetail", () => {
  beforeEach(() => {
    mockedUseGetRisk.mockReset();
  });

  it("riskId가 없으면 idle 상태를 반환한다", () => {
    mockDetailQuery({ data: undefined });
    const { result } = renderHook(() => useRiskDetail(1, 2, 3, null));

    expect(result.current.status).toBe("idle");
    expect(mockedUseGetRisk).toHaveBeenCalledWith(
      1,
      2,
      3,
      -1,
      expect.objectContaining({
        query: expect.objectContaining({ enabled: false, queryKey: ["risk", "detail", 1, 2, 3, -1] }),
      }),
    );
  });

  it("성공 시 ready 상태와 상세 데이터를 반환한다", async () => {
    mockDetailQuery({ data: stubRisk });
    const { result } = renderHook(() => useRiskDetail(1, 2, 3, 4));

    expect(result.current.status).toBe("ready");
    if (result.current.status === "ready") {
      expect(result.current.data.riskCode).toBe("RISK_FRAUD");
    }
  });

  it("ApiRequestError를 error 상태로 변환한다", async () => {
    mockDetailQuery({
      isError: true,
      error: new ApiRequestError(404, "RISK_DEFINITION_NOT_FOUND", "없음"),
      data: undefined,
    });
    const { result } = renderHook(() => useRiskDetail(1, 2, 3, 404));

    expect(result.current.status).toBe("error");
    if (result.current.status === "error") {
      expect(result.current.httpStatus).toBe(404);
      expect(result.current.code).toBe("RISK_DEFINITION_NOT_FOUND");
    }
  });

  it("retryKey가 증가하면 refetch를 호출하고 riskId 변경 시 새 queryKey를 넘긴다", async () => {
    const refetch = vi.fn().mockResolvedValue({});
    mockDetailQuery({ data: stubRisk, refetch });

    const { result, rerender } = renderHook(
      ({ retryKey, riskId }) => useRiskDetail(1, 2, 3, riskId, retryKey),
      {
        initialProps: { retryKey: 0, riskId: 4 },
      },
    );

    expect(result.current.status).toBe("ready");

    rerender({ retryKey: 1, riskId: 4 });

    await waitFor(() => expect(refetch).toHaveBeenCalledTimes(1));

    rerender({ retryKey: 1, riskId: 5 });

    expect(mockedUseGetRisk).toHaveBeenLastCalledWith(
      1,
      2,
      3,
      5,
      expect.objectContaining({
        query: expect.objectContaining({ enabled: true, queryKey: ["risk", "detail", 1, 2, 3, 5] }),
      }),
    );
  });
});
