import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useGetRisk } from "./useGetRisk";
import { useGetRisk as useGeneratedGetRisk } from "@/shared/api/generated/endpoints/risk-definition-controller/risk-definition-controller";

vi.mock(
  "@/shared/api/generated/endpoints/risk-definition-controller/risk-definition-controller",
  () => ({
    useGetRisk: vi.fn(),
  }),
);

const mockedUseGeneratedGetRisk = vi.mocked(useGeneratedGetRisk);

const stubRisk = {
  id: 4,
  domainPackVersionId: 3,
  riskCode: "RISK_FRAUD",
  name: "사기 위험",
  description: null,
  riskLevel: "HIGH" as const,
  triggerConditionJson: "{}",
  handlingActionJson: "{}",
  evidenceJson: "[]",
  metaJson: "{}",
  status: "ACTIVE" as const,
  createdAt: "",
  updatedAt: "",
};

describe("useGetRisk", () => {
  beforeEach(() => {
    mockedUseGeneratedGetRisk.mockReset();
  });

  it("enabled 상태면 위험요소 상세를 조회한다", async () => {
    mockedUseGeneratedGetRisk.mockReturnValue({
      data: stubRisk,
      isSuccess: true,
    } as unknown as ReturnType<typeof useGeneratedGetRisk>);

    const { result } = renderHook(
      () =>
        useGetRisk({
          workspaceId: 1,
          packId: 2,
          versionId: 3,
          riskId: 4,
          enabled: true,
        }),
    );

    expect(result.current.data).toEqual(stubRisk);
    expect(mockedUseGeneratedGetRisk).toHaveBeenCalledWith(
      1,
      2,
      3,
      4,
      expect.objectContaining({
        query: expect.objectContaining({
          enabled: true,
          queryKey: ["risk", "detail", 1, 2, 3, 4],
        }),
      }),
    );
  });
});
