import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { intentRevisionDraftApi } from "../api/intentRevisionDraftApi";
import { useIntentRevisionSummary } from "./useIntentRevisionSummary";

vi.mock("../api/intentRevisionDraftApi", () => ({
  intentRevisionDraftApi: {
    listIntents: vi.fn(),
  },
}));

const mockedListIntents = vi.mocked(intentRevisionDraftApi.listIntents);

describe("useIntentRevisionSummary hook", () => {
  beforeEach(() => {
    mockedListIntents.mockReset();
  });

  it("비활성 상태에서는 idle을 반환하고 API를 호출하지 않는다", () => {
    const { result } = renderHook(() =>
      useIntentRevisionSummary({
        workspaceId: 1,
        packId: 2,
        draftVersionId: 4,
        baseVersionId: null,
        enabled: false,
      }),
    );

    expect(result.current).toEqual({ status: "idle" });
    expect(mockedListIntents).not.toHaveBeenCalled();
  });

  it("base와 draft intent를 조회해 변경 요약을 만든다", async () => {
    mockedListIntents
      .mockResolvedValueOnce([
        { id: 10, intentCode: "refund", name: "환불", description: "" },
      ] as never)
      .mockResolvedValueOnce([
        { id: 20, intentCode: "refund", name: "환불 문의", description: "새 설명" },
      ] as never);

    const { result } = renderHook(() =>
      useIntentRevisionSummary({
        workspaceId: 1,
        packId: 2,
        draftVersionId: 4,
        baseVersionId: 3,
        enabled: true,
      }),
    );

    expect(result.current.status).toBe("loading");
    await waitFor(() => expect(result.current.status).toBe("ready"));
    if (result.current.status !== "ready") throw new Error("summary not ready");
    expect(result.current.data.changedIntents[0]).toMatchObject({
      intentId: 20,
      intentCode: "refund",
      fields: ["name", "description"],
    });
    expect(mockedListIntents).toHaveBeenCalledWith(1, 2, 3, {
      signal: expect.any(AbortSignal),
    });
    expect(mockedListIntents).toHaveBeenCalledWith(1, 2, 4, {
      signal: expect.any(AbortSignal),
    });
  });

  it("조회 실패 시 error 상태를 반환한다", async () => {
    mockedListIntents.mockRejectedValue(new Error("summary failed"));

    const { result } = renderHook(() =>
      useIntentRevisionSummary({
        workspaceId: 1,
        packId: 2,
        draftVersionId: 4,
        baseVersionId: 3,
        enabled: true,
      }),
    );

    await waitFor(() => expect(result.current.status).toBe("error"));
    expect(result.current).toEqual({
      status: "error",
      message: "summary failed",
    });
  });
});
