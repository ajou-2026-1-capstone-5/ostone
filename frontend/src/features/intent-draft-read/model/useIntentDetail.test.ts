import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useIntentDetail } from "./useIntentDetail";
import { ApiRequestError } from "../../../shared/api";

vi.mock("../api/intentApi", () => ({
  intentApi: {
    list: vi.fn(),
    detail: vi.fn(),
  },
}));

import { intentApi } from "../api/intentApi";

const mockedDetail = vi.mocked(intentApi.detail);

const stubDetail = {
  id: 10,
  intentCode: "INTENT_001",
  name: "배송 조회 문의",
  description: null,
  taxonomyLevel: 1,
  parentIntentId: null,
  status: "ACTIVE",
  sourceClusterRef: "{}",
  entryConditionJson: "{}",
  evidenceJson: "[]",
  metaJson: "{}",
  createdAt: "",
  updatedAt: "",
};

describe("useIntentDetail", () => {
  beforeEach(() => {
    mockedDetail.mockReset();
  });

  it("intentId가 null이면 idle 상태다", () => {
    const { result } = renderHook(() => useIntentDetail(1, 2, 3, null));
    expect(result.current.status).toBe("idle");
    expect(mockedDetail).not.toHaveBeenCalled();
  });

  it("intentId가 주어지면 loading 상태로 시작한다", () => {
    mockedDetail.mockReturnValue(new Promise(() => {}));
    const { result } = renderHook(() => useIntentDetail(1, 2, 3, 10));
    expect(result.current.status).toBe("loading");
  });

  it("성공 시 ready 상태로 전이된다", async () => {
    mockedDetail.mockResolvedValue(stubDetail);
    const { result } = renderHook(() => useIntentDetail(1, 2, 3, 10));
    await waitFor(() => expect(result.current.status).toBe("ready"));
    if (result.current.status === "ready") {
      expect(result.current.data).toEqual(stubDetail);
    }
  });

  it("404 에러 시 httpStatus를 포함한 error 상태가 된다", async () => {
    mockedDetail.mockRejectedValue(new ApiRequestError(404, "NOT_FOUND", "없음"));
    const { result } = renderHook(() => useIntentDetail(1, 2, 3, 99));
    await waitFor(() => expect(result.current.status).toBe("error"));
    if (result.current.status === "error") {
      expect(result.current.httpStatus).toBe(404);
      expect(result.current.code).toBe("NOT_FOUND");
    }
  });

  it("알 수 없는 오류 시 UNKNOWN_ERROR가 된다", async () => {
    mockedDetail.mockRejectedValue(new Error("unexpected"));
    const { result } = renderHook(() => useIntentDetail(1, 2, 3, 5));
    await waitFor(() => expect(result.current.status).toBe("error"));
    if (result.current.status === "error") {
      expect(result.current.code).toBe("UNKNOWN_ERROR");
    }
  });
});
