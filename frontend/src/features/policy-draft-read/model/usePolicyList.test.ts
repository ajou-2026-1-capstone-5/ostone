import { describe, expect, it, vi, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { useListPolicies } from "@/shared/api/generated/endpoints/policy-definition-controller/policy-definition-controller";
import { usePolicyList } from "./usePolicyList";

vi.mock(
  "@/shared/api/generated/endpoints/policy-definition-controller/policy-definition-controller",
  () => ({
    useListPolicies: vi.fn(),
  }),
);

const mockedUseListPolicies = vi.mocked(useListPolicies);

describe("usePolicyList", () => {
  beforeEach(() => mockedUseListPolicies.mockClear());

  it("useListPolicies를 호출한다", () => {
    mockedUseListPolicies.mockReturnValue({
      isLoading: false,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof useListPolicies>);
    renderHook(() => usePolicyList(1, 2, 3));
    expect(mockedUseListPolicies).toHaveBeenCalledWith(1, 2, 3, {});
  });

  it("loading 상태를 반환한다", () => {
    mockedUseListPolicies.mockReturnValue({
      isLoading: true,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof useListPolicies>);
    const { result } = renderHook(() => usePolicyList(1, 2, 3));
    expect(result.current).toEqual({ status: "loading" });
  });

  it("error 상태를 반환한다", () => {
    const err = new Error("fail");
    mockedUseListPolicies.mockReturnValue({
      isError: true,
      error: err,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof useListPolicies>);
    const { result } = renderHook(() => usePolicyList(1, 2, 3));
    expect(result.current).toEqual({
      status: "error",
      code: "UNKNOWN_ERROR",
      message: "알 수 없는 오류가 발생했습니다.",
    });
  });

  it("성공 상태를 반환한다", () => {
    const data = { data: [{ id: 1, name: "Policy 1" }] };
    mockedUseListPolicies.mockReturnValue({
      isSuccess: true,
      data,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof useListPolicies>);
    const { result } = renderHook(() => usePolicyList(1, 2, 3));
    expect(result.current).toEqual({ status: "ready", data: data.data });
  });
});
