import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useGetPolicy } from "./useGetPolicy";
import { useGetPolicy as useGeneratedGetPolicy } from "@/shared/api/generated/endpoints/policy-definition-controller/policy-definition-controller";

vi.mock(
  "@/shared/api/generated/endpoints/policy-definition-controller/policy-definition-controller",
  () => ({
    useGetPolicy: vi.fn(),
  }),
);

const mockedUseGeneratedGetPolicy = vi.mocked(useGeneratedGetPolicy);

const stubPolicy = {
  id: 4,
  domainPackVersionId: 3,
  policyCode: "POL_REFUND",
  name: "환불 정책",
  description: null,
  severity: "HIGH",
  conditionJson: "{}",
  actionJson: "{}",
  evidenceJson: "[]",
  metaJson: "{}",
  status: "ACTIVE" as const,
  createdAt: "",
  updatedAt: "",
};

describe("useGetPolicy", () => {
  beforeEach(() => {
    mockedUseGeneratedGetPolicy.mockReset();
  });

  it("enabled 상태면 정책 상세를 조회한다", async () => {
    mockedUseGeneratedGetPolicy.mockReturnValue({
      data: stubPolicy,
      isSuccess: true,
    } as unknown as ReturnType<typeof useGeneratedGetPolicy>);

    const { result } = renderHook(
      () =>
        useGetPolicy({
          workspaceId: 1,
          packId: 2,
          versionId: 3,
          policyId: 4,
          enabled: true,
        }),
    );

    expect(result.current.data).toEqual(stubPolicy);
    expect(mockedUseGeneratedGetPolicy).toHaveBeenCalledWith(
      1,
      2,
      3,
      4,
      expect.objectContaining({
        query: expect.objectContaining({
          enabled: true,
          queryKey: ["policies", "detail", 1, 2, 3, 4],
        }),
      }),
    );
  });
});
