import { describe, expect, it, vi, beforeEach } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import React from "react";
import { useVersionDetail } from "./usePackDetail";
import { useGetDomainPackVersion } from "@/shared/api/generated/endpoints/domain-pack-controller/domain-pack-controller";

vi.mock("@/shared/api/generated/endpoints/domain-pack-controller/domain-pack-controller", () => ({
  useGetDomainPackVersion: vi.fn(),
}));

const mockedUseGetDomainPackVersion = vi.mocked(useGetDomainPackVersion);

function makeWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children);
}

describe("useVersionDetail", () => {
  beforeEach(() => mockedUseGetDomainPackVersion.mockReset());

  it("versionId가 null이면 쿼리가 비활성화된다", () => {
    mockedUseGetDomainPackVersion.mockReturnValue({
      data: undefined,
      fetchStatus: "idle",
      isPending: true,
    } as unknown as ReturnType<typeof useGetDomainPackVersion>);
    const { result } = renderHook(() => useVersionDetail(1, 2, null), { wrapper: makeWrapper() });
    expect(result.current.fetchStatus).toBe("idle");
    expect(mockedUseGetDomainPackVersion).toHaveBeenCalledWith(
      1,
      2,
      -1,
      expect.objectContaining({
        query: expect.objectContaining({
          enabled: false,
          queryKey: ["domain-packs", "version", 1, 2, -1],
          select: expect.any(Function),
        }),
      }),
    );
  });

  it("versionId가 있으면 상세 API를 호출한다", async () => {
    const data = { versionId: 3, versionNo: 1 };
    mockedUseGetDomainPackVersion.mockReturnValue({
      data,
      isLoading: false,
      isPending: false,
      isSuccess: true,
      isError: false,
      isFetching: false,
      status: "success",
      error: null,
      failureCount: 0,
      failureReason: null,
      dataUpdatedAt: 0,
      fetchStatus: "idle",
    } as unknown as ReturnType<typeof useGetDomainPackVersion>);
    const { result } = renderHook(() => useVersionDetail(1, 2, 3), { wrapper: makeWrapper() });
    await waitFor(() => expect(result.current.data).toEqual(data));
    expect(mockedUseGetDomainPackVersion).toHaveBeenCalledWith(
      1,
      2,
      3,
      expect.objectContaining({
        query: expect.objectContaining({
          enabled: true,
          queryKey: ["domain-packs", "version", 1, 2, 3],
          select: expect.any(Function),
        }),
      }),
    );
  });
});
