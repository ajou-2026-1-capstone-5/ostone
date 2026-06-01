import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { intentRevisionDraftApi } from "../api/intentRevisionDraftApi";
import { useIntentRevisionSummary } from "./useIntentRevisionSummary";

vi.mock("../api/intentRevisionDraftApi", () => ({
  intentRevisionDraftApi: {
    listIntents: vi.fn(),
    listWorkflows: vi.fn(),
    getWorkflow: vi.fn(),
  },
}));

const mockedListIntents = vi.mocked(intentRevisionDraftApi.listIntents);
const mockedListWorkflows = vi.mocked(intentRevisionDraftApi.listWorkflows);
const mockedGetWorkflow = vi.mocked(intentRevisionDraftApi.getWorkflow);

describe("useIntentRevisionSummary hook", () => {
  beforeEach(() => {
    mockedListIntents.mockReset();
    mockedListWorkflows.mockReset();
    mockedGetWorkflow.mockReset();
    mockedListWorkflows.mockResolvedValue([]);
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
    expect(mockedListWorkflows).not.toHaveBeenCalled();
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
    expect(mockedListWorkflows).toHaveBeenCalledWith(1, 2, 3, {
      signal: expect.any(AbortSignal),
    });
    expect(mockedListWorkflows).toHaveBeenCalledWith(1, 2, 4, {
      signal: expect.any(AbortSignal),
    });
  });

  it("base와 draft workflow를 조회해 workflow 변경 요약을 만든다", async () => {
    mockedListIntents.mockResolvedValue([]);
    mockedListWorkflows
      .mockResolvedValueOnce([{ id: 10, workflowCode: "refund-flow" }] as never)
      .mockResolvedValueOnce([{ id: 20, workflowCode: "refund-flow" }] as never);
    mockedGetWorkflow
      .mockResolvedValueOnce({
        id: 10,
        workflowCode: "refund-flow",
        name: "환불 흐름",
        description: "기존",
        graphJson: JSON.stringify({
          nodes: [{ id: "start", type: "START", label: "접수" }],
          edges: [],
        }),
      } as never)
      .mockResolvedValueOnce({
        id: 20,
        workflowCode: "refund-flow",
        name: "환불 상담 흐름",
        description: "새 설명",
        graphJson: JSON.stringify({
          nodes: [{ id: "start", type: "START", label: "상담 접수" }],
          edges: [],
        }),
      } as never);

    const { result } = renderHook(() =>
      useIntentRevisionSummary({
        workspaceId: 1,
        packId: 2,
        draftVersionId: 4,
        baseVersionId: 3,
        enabled: true,
      }),
    );

    await waitFor(() => expect(result.current.status).toBe("ready"));
    if (result.current.status !== "ready") throw new Error("summary not ready");
    expect(result.current.data.changedWorkflows[0]).toMatchObject({
      workflowId: 20,
      workflowCode: "refund-flow",
      fields: ["name", "description", "graphText"],
    });
    expect(result.current.data.totalChangedComponents).toBe(1);
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
