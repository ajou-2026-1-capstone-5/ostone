import { describe, expect, it, vi, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { useGetPolicy } from "@/shared/api/generated/endpoints/policy-definition-controller/policy-definition-controller";
import { usePolicyDetail } from "./usePolicyDetail";

vi.mock(
  "@/shared/api/generated/endpoints/policy-definition-controller/policy-definition-controller",
  () => ({
    useGetPolicy: vi.fn(),
  }),
);

vi.mock("@/entities/policy", () => ({
  policyKeys: {
    all: ["policies"],
    detail: (...args: number[]) => ["policies", "detail", ...args],
  },
}));

const mockedUseGetPolicy = vi.mocked(useGetPolicy);

describe("usePolicyDetail", () => {
  beforeEach(() => mockedUseGetPolicy.mockClear());

  it("policyId가 null이면 enabled:false로 호출한다", () => {
    mockedUseGetPolicy.mockReturnValue({
      isLoading: false,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof useGetPolicy>);
    renderHook(() => usePolicyDetail(1, 2, 3, null));
    expect(mockedUseGetPolicy).toHaveBeenCalledWith(1, 2, 3, -1, { query: { enabled: false } });
  });

  it("policyId가 있으면 enabled:true로 호출한다", () => {
    mockedUseGetPolicy.mockReturnValue({
      isLoading: false,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof useGetPolicy>);
    renderHook(() => usePolicyDetail(1, 2, 3, 4));
    expect(mockedUseGetPolicy).toHaveBeenCalledWith(1, 2, 3, 4, { query: { enabled: true } });
  });

  it("loading 상태를 반환한다", () => {
    mockedUseGetPolicy.mockReturnValue({
      isLoading: true,
      isFetching: true,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof useGetPolicy>);
    const { result } = renderHook(() => usePolicyDetail(1, 2, 3, 4));
    expect(result.current).toEqual({ status: "loading" });
  });

  it("error 상태를 반환한다", () => {
    const err = new Error("fail");
    mockedUseGetPolicy.mockReturnValue({
      isError: true,
      error: err,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof useGetPolicy>);
    const { result } = renderHook(() => usePolicyDetail(1, 2, 3, 4));
    expect(result.current).toEqual({
      status: "error",
      code: "UNKNOWN_ERROR",
      message: "알 수 없는 오류가 발생했습니다.",
    });
  });

  it("성공 상태를 반환한다", () => {
    const data = { data: { id: 4, name: "Test Policy" } };
    mockedUseGetPolicy.mockReturnValue({
      isSuccess: true,
      data,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof useGetPolicy>);
    const { result } = renderHook(() => usePolicyDetail(1, 2, 3, 4));
    expect(result.current).toEqual({ status: "ready", data: data.data });
  });
});
