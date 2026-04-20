import { renderHook, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { useWorkflowList } from "./useWorkflowList";
import { ApiRequestError } from "../../../shared/api";

vi.mock("../api/workflowApi", () => ({
  workflowApi: {
    list: vi.fn(),
    detail: vi.fn(),
  },
}));

import { workflowApi } from "../api/workflowApi";

const mockedList = vi.mocked(workflowApi.list);

const stubWorkflow = {
  id: 1,
  workflowCode: "W001",
  name: "테스트 워크플로우",
  description: null,
  initialState: null,
  terminalStatesJson: "[]",
  createdAt: "",
  updatedAt: "",
};

describe("useWorkflowList", () => {
  beforeEach(() => {
    mockedList.mockReset();
  });

  it("초기 상태는 loading이다", () => {
    mockedList.mockReturnValue(new Promise(() => {}));
    const { result } = renderHook(() => useWorkflowList(1, 2, 3));
    expect(result.current.status).toBe("loading");
  });

  it("성공 시 ready 상태로 전이되고 데이터를 반환한다", async () => {
    mockedList.mockResolvedValue([stubWorkflow]);
    const { result } = renderHook(() => useWorkflowList(1, 2, 3));
    await waitFor(() => expect(result.current.status).toBe("ready"));
    if (result.current.status === "ready") {
      expect(result.current.data).toEqual([stubWorkflow]);
    }
  });

  it("빈 배열 응답 시 ready 상태로 전이된다", async () => {
    mockedList.mockResolvedValue([]);
    const { result } = renderHook(() => useWorkflowList(1, 2, 3));
    await waitFor(() => expect(result.current.status).toBe("ready"));
    if (result.current.status === "ready") {
      expect(result.current.data).toHaveLength(0);
    }
  });

  it("ApiRequestError 발생 시 error 상태로 전이되고 httpStatus를 포함한다", async () => {
    mockedList.mockRejectedValue(new ApiRequestError(403, "FORBIDDEN", "접근 금지"));
    const { result } = renderHook(() => useWorkflowList(1, 2, 3));
    await waitFor(() => expect(result.current.status).toBe("error"));
    if (result.current.status === "error") {
      expect(result.current.httpStatus).toBe(403);
      expect(result.current.code).toBe("FORBIDDEN");
    }
  });

  it("알 수 없는 오류 발생 시 UNKNOWN_ERROR 코드로 error 상태가 된다", async () => {
    mockedList.mockRejectedValue(new Error("network fail"));
    const { result } = renderHook(() => useWorkflowList(1, 2, 3));
    await waitFor(() => expect(result.current.status).toBe("error"));
    if (result.current.status === "error") {
      expect(result.current.code).toBe("UNKNOWN_ERROR");
    }
  });
});
