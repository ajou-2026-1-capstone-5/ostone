import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { policyApi } from "@/entities/policy";
import { ApiRequestError } from "@/shared/api";
import { usePolicyList } from "./usePolicyList";

vi.mock("@/entities/policy", () => ({
  policyApi: {
    list: vi.fn(),
    detail: vi.fn(),
  },
  policyKeys: {
    all: ["policies"],
    lists: () => ["policies", "list"],
    list: (...args: number[]) => ["policies", "list", ...args],
    detail: (...args: number[]) => ["policies", "detail", ...args],
  },
}));

const mockedList = vi.mocked(policyApi.list);

const stubPolicy = {
  id: 1,
  domainPackVersionId: 3,
  policyCode: "POL_REFUND",
  name: "환불 정책",
  description: null,
  severity: "HIGH",
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

describe("usePolicyList", () => {
  beforeEach(() => {
    mockedList.mockReset();
  });

  it("초기 상태는 loading이다", () => {
    mockedList.mockReturnValue(new Promise(() => {}));
    const { result } = renderHook(() => usePolicyList(1, 2, 3), { wrapper: makeWrapper() });
    expect(result.current.status).toBe("loading");
  });

  it("성공 시 ready 상태와 정책 목록을 반환한다", async () => {
    mockedList.mockResolvedValue([stubPolicy]);
    const { result } = renderHook(() => usePolicyList(1, 2, 3), { wrapper: makeWrapper() });

    await waitFor(() => expect(result.current.status).toBe("ready"));

    if (result.current.status === "ready") {
      expect(result.current.data).toEqual([stubPolicy]);
    }
  });

  it("ApiRequestError를 error 상태로 변환한다", async () => {
    mockedList.mockRejectedValue(new ApiRequestError(403, "FORBIDDEN", "접근 금지"));
    const { result } = renderHook(() => usePolicyList(1, 2, 3), { wrapper: makeWrapper() });

    await waitFor(() => expect(result.current.status).toBe("error"));

    if (result.current.status === "error") {
      expect(result.current.httpStatus).toBe(403);
      expect(result.current.code).toBe("FORBIDDEN");
    }
  });
});
