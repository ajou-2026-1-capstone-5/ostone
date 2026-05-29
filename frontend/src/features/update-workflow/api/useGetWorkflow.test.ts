import { renderHook } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { useGetWorkflow } from "./useGetWorkflow";
import { useGetWorkflow as useGeneratedGetWorkflow } from "@/shared/api/generated/endpoints/workflow-definition-controller/workflow-definition-controller";

vi.mock(
  "@/shared/api/generated/endpoints/workflow-definition-controller/workflow-definition-controller",
  () => ({
    useGetWorkflow: vi.fn(),
  }),
);

const mockedUseGeneratedGetWorkflow = vi.mocked(useGeneratedGetWorkflow);

const stubDetail = {
  id: 1,
  workflowCode: "W001",
  name: "테스트",
  description: undefined,
  graphJson: "{}",
  initialState: undefined,
  terminalStatesJson: "[]",
  evidenceJson: "{}",
  metaJson: "{}",
  createdAt: "",
  updatedAt: "",
};

describe("useGetWorkflow", () => {
  beforeEach(() => mockedUseGeneratedGetWorkflow.mockReset());

  it("enabled=false이면 fetch 호출 없이 idle 상태다", () => {
    mockedUseGeneratedGetWorkflow.mockReturnValue({
      fetchStatus: "idle",
      data: undefined,
    } as unknown as ReturnType<typeof useGeneratedGetWorkflow>);
    const { result } = renderHook(() => useGetWorkflow(1, 2, 3, 10, false));

    expect(result.current.fetchStatus).toBe("idle");
    expect(mockedUseGeneratedGetWorkflow).toHaveBeenCalledWith(
      1,
      2,
      3,
      10,
      expect.objectContaining({
        query: expect.objectContaining({
          enabled: false,
          queryKey: ["workflows", "detail", 1, 2, 3, 10],
        }),
      }),
    );
  });

  it("enabled=true이면 generated hook에 올바른 인수와 query 옵션을 넘긴다", async () => {
    mockedUseGeneratedGetWorkflow.mockReturnValue({
      data: stubDetail,
      isSuccess: true,
    } as unknown as ReturnType<typeof useGeneratedGetWorkflow>);
    renderHook(() => useGetWorkflow(1, 2, 3, 10, true));

    expect(mockedUseGeneratedGetWorkflow).toHaveBeenCalledWith(
      1,
      2,
      3,
      10,
      expect.objectContaining({
        query: expect.objectContaining({
          enabled: true,
          queryKey: ["workflows", "detail", 1, 2, 3, 10],
        }),
      }),
    );
  });

  it("성공 시 data를 반환한다", async () => {
    mockedUseGeneratedGetWorkflow.mockReturnValue({
      data: stubDetail,
      isSuccess: true,
    } as unknown as ReturnType<typeof useGeneratedGetWorkflow>);
    const { result } = renderHook(() => useGetWorkflow(1, 2, 3, 10, true));

    expect(result.current.isSuccess).toBe(true);
    expect(result.current.data).toEqual(stubDetail);
  });

  it("enabled=false이면 enabled=true보다 fetch 호출 횟수가 적다", async () => {
    mockedUseGeneratedGetWorkflow.mockReturnValue({
      data: stubDetail,
      isSuccess: true,
    } as unknown as ReturnType<typeof useGeneratedGetWorkflow>);
    renderHook(() => useGetWorkflow(1, 2, 3, 10, false));
    renderHook(() => useGetWorkflow(1, 2, 3, 10, true));

    expect(mockedUseGeneratedGetWorkflow).toHaveBeenCalledTimes(2);
    expect(mockedUseGeneratedGetWorkflow.mock.calls[0]?.[4]?.query?.enabled).toBe(false);
    expect(mockedUseGeneratedGetWorkflow.mock.calls[1]?.[4]?.query?.enabled).toBe(true);
  });
});
