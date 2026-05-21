import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { listRisks } from "@/shared/api/generated/endpoints/risk-definition-controller/risk-definition-controller";
import { ApiRequestError } from "@/shared/api";
import { useRiskList } from "./useRiskList";

vi.mock(
  "@/shared/api/generated/endpoints/risk-definition-controller/risk-definition-controller",
  () => ({
    listRisks: vi.fn(),
  }),
);

const mockedListRisks = vi.mocked(listRisks);

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

function makeWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children);
}

describe("useRiskList", () => {
  beforeEach(() => {
    mockedListRisks.mockReset();
  });

  it("초기 상태는 loading이다", () => {
    mockedListRisks.mockReturnValue(new Promise(() => {}));
    const { result } = renderHook(() => useRiskList(1, 2, 3), { wrapper: makeWrapper() });
    expect(result.current.status).toBe("loading");
  });

  it("성공 시 ready 상태와 위험요소 목록을 반환한다", async () => {
    mockedListRisks.mockResolvedValue({
      data: [stubRisk as any],
      status: 200,
      headers: new Headers(),
    });
    const { result } = renderHook(() => useRiskList(1, 2, 3), { wrapper: makeWrapper() });

    await waitFor(() => expect(result.current.status).toBe("ready"));

    if (result.current.status === "ready") {
      expect(result.current.data).toEqual([stubRisk]);
    }
  });

  it("목록이 비어 있으면 empty 상태를 반환한다", async () => {
    mockedListRisks.mockResolvedValue({ data: [], status: 200, headers: new Headers() });
    const { result } = renderHook(() => useRiskList(1, 2, 3), { wrapper: makeWrapper() });

    await waitFor(() => expect(result.current.status).toBe("empty"));
  });

  it("retryKey가 증가한 뒤 versionId가 바뀌어도 새 목록 조회를 한 번만 호출한다", async () => {
    mockedListRisks.mockResolvedValue({
      data: [stubRisk as any],
      status: 200,
      headers: new Headers(),
    });

    const { result, rerender } = renderHook(
      ({ retryKey, versionId }) => useRiskList(1, 2, versionId, retryKey),
      {
        wrapper: makeWrapper(),
        initialProps: { retryKey: 0, versionId: 3 },
      },
    );

    await waitFor(() => expect(result.current.status).toBe("ready"));
    expect(mockedListRisks).toHaveBeenCalledTimes(1);
    expect(mockedListRisks).toHaveBeenLastCalledWith(1, 2, 3);

    rerender({ retryKey: 1, versionId: 3 });

    await waitFor(() => expect(mockedListRisks).toHaveBeenCalledTimes(2));
    expect(mockedListRisks).toHaveBeenLastCalledWith(1, 2, 3);

    rerender({ retryKey: 1, versionId: 4 });

    await waitFor(() => expect(mockedListRisks).toHaveBeenCalledTimes(3));
    expect(mockedListRisks).toHaveBeenLastCalledWith(1, 2, 4);
  });

  it("ApiRequestError를 error 상태로 변환한다", async () => {
    mockedListRisks.mockRejectedValue(new ApiRequestError(403, "FORBIDDEN", "접근 금지"));
    const { result } = renderHook(() => useRiskList(1, 2, 3), { wrapper: makeWrapper() });

    await waitFor(() => expect(result.current.status).toBe("error"));

    if (result.current.status === "error") {
      expect(result.current.httpStatus).toBe(403);
      expect(result.current.code).toBe("FORBIDDEN");
    }
  });
});
