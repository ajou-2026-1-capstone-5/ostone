import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useListPolicies } from "@/shared/api/generated/endpoints/policy-definition-controller/policy-definition-controller";
import { usePolicyNameMap } from "./usePolicyNameMap";

vi.mock(
  "@/shared/api/generated/endpoints/policy-definition-controller/policy-definition-controller",
  () => ({
    useListPolicies: vi.fn(),
  }),
);

const mockedUseListPolicies = vi.mocked(useListPolicies);

beforeEach(() => {
  mockedUseListPolicies.mockReset();
});

describe("usePolicyNameMap", () => {
  it("정책 목록을 policyCode → name 맵으로 반환한다", () => {
    mockedUseListPolicies.mockReturnValue({
      data: [
        { policyCode: "PR-1", name: "환불 승인 기준" },
        { policyCode: "PR-2", name: "교환 기준" },
      ],
    } as unknown as ReturnType<typeof useListPolicies>);

    const { result } = renderHook(() => usePolicyNameMap(1, 2, 3));

    expect(result.current.get("PR-1")).toBe("환불 승인 기준");
    expect(result.current.get("PR-2")).toBe("교환 기준");
  });

  it("데이터가 없으면 빈 맵을 반환한다", () => {
    mockedUseListPolicies.mockReturnValue({
      data: undefined,
    } as unknown as ReturnType<typeof useListPolicies>);

    const { result } = renderHook(() => usePolicyNameMap(1, 2, 3));

    expect(result.current.size).toBe(0);
  });
});
