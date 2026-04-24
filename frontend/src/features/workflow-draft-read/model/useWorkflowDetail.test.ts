import { renderHook, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { useWorkflowDetail } from "./useWorkflowDetail";
import { ApiRequestError } from "../../../shared/api";

vi.mock("../api/workflowApi", () => ({
  workflowApi: {
    list: vi.fn(),
    detail: vi.fn(),
  },
}));

import { workflowApi } from "../api/workflowApi";

const mockedDetail = vi.mocked(workflowApi.detail);

const stubDetail = {
  id: 10,
  workflowCode: "W001",
  name: "테스트",
  description: null,
  graphJson: { direction: "LR" as const, nodes: [], edges: [] },
  initialState: null,
  terminalStatesJson: "[]",
  evidenceJson: "{}",
  metaJson: "{}",
  createdAt: "",
  updatedAt: "",
};

describe("useWorkflowDetail", () => {
  beforeEach(() => {
    mockedDetail.mockReset();
  });

  it("workflowId가 null이면 idle 상태다", () => {
    const { result } = renderHook(() => useWorkflowDetail(1, 2, 3, null));
    expect(result.current.status).toBe("idle");
    expect(mockedDetail).not.toHaveBeenCalled();
  });

  it("workflowId가 주어지면 loading 상태로 시작한다", () => {
    mockedDetail.mockReturnValue(new Promise(() => {}));
    const { result } = renderHook(() => useWorkflowDetail(1, 2, 3, 10));
    expect(result.current.status).toBe("loading");
  });

  it("성공 시 ready 상태로 전이된다", async () => {
    mockedDetail.mockResolvedValue(stubDetail);
    const { result } = renderHook(() => useWorkflowDetail(1, 2, 3, 10));
    await waitFor(() => expect(result.current.status).toBe("ready"));
    if (result.current.status === "ready") {
      expect(result.current.data).toEqual(stubDetail);
    }
  });

  it("404 에러 시 httpStatus 404를 포함한 error 상태가 된다", async () => {
    mockedDetail.mockRejectedValue(new ApiRequestError(404, "NOT_FOUND", "없음"));
    const { result } = renderHook(() => useWorkflowDetail(1, 2, 3, 99));
    await waitFor(() => expect(result.current.status).toBe("error"));
    if (result.current.status === "error") {
      expect(result.current.httpStatus).toBe(404);
      expect(result.current.code).toBe("NOT_FOUND");
    }
  });

  it("알 수 없는 오류 시 UNKNOWN_ERROR 코드가 된다", async () => {
    mockedDetail.mockRejectedValue(new Error("unexpected"));
    const { result } = renderHook(() => useWorkflowDetail(1, 2, 3, 5));
    await waitFor(() => expect(result.current.status).toBe("error"));
    if (result.current.status === "error") {
      expect(result.current.code).toBe("UNKNOWN_ERROR");
    }
  });
});
