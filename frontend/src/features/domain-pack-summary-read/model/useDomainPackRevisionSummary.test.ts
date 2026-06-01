import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { listIntents } from "@/shared/api/generated/endpoints/intent-definition-controller/intent-definition-controller";
import {
  getWorkflow,
  listWorkflows,
} from "@/shared/api/generated/endpoints/workflow-definition-controller/workflow-definition-controller";
import { useDomainPackRevisionSummary } from "./useDomainPackRevisionSummary";

vi.mock("@/shared/api/generated/endpoints/intent-definition-controller/intent-definition-controller", () => ({
  listIntents: vi.fn(),
}));

vi.mock(
  "@/shared/api/generated/endpoints/workflow-definition-controller/workflow-definition-controller",
  () => ({
    getWorkflow: vi.fn(),
    listWorkflows: vi.fn(),
  }),
);

const mockedListIntents = vi.mocked(listIntents);
const mockedListWorkflows = vi.mocked(listWorkflows);
const mockedGetWorkflow = vi.mocked(getWorkflow);

const revisionSummaryJson = JSON.stringify({
  draftSource: {
    type: "INTENT_REVISION",
    baseVersionId: 3,
    baseVersionNo: 1,
  },
});

describe("useDomainPackRevisionSummary", () => {
  beforeEach(() => {
    mockedListIntents.mockReset();
    mockedListWorkflows.mockReset();
    mockedGetWorkflow.mockReset();
  });

  it("intent revision 출처가 아니면 idle 상태로 API를 호출하지 않는다", () => {
    const { result } = renderHook(() =>
      useDomainPackRevisionSummary({
        workspaceId: 1,
        packId: 2,
        versionId: 4,
        summaryJson: '{"draftSource":{"type":"PIPELINE"}}',
      }),
    );

    expect(result.current).toEqual({ status: "idle" });
    expect(mockedListIntents).not.toHaveBeenCalled();
    expect(mockedListWorkflows).not.toHaveBeenCalled();
    expect(mockedGetWorkflow).not.toHaveBeenCalled();
  });

  it("baseVersionId가 있는 revision draft는 intent와 workflow 변경 요약을 계산한다", async () => {
    mockedListIntents
      .mockResolvedValueOnce({
        data: [{ id: 10, intentCode: "refund", name: "환불", description: "" }],
      })
      .mockResolvedValueOnce([
        { id: 20, intentCode: "refund", name: "환불 문의", description: "새 설명" },
      ]);
    mockedListWorkflows
      .mockResolvedValueOnce({ data: [{ id: 30, workflowCode: "refund-flow" }] })
      .mockResolvedValueOnce([{ id: 40, workflowCode: "refund-flow" }]);
    mockedGetWorkflow
      .mockResolvedValueOnce({
        data: {
          id: 30,
          workflowCode: "refund-flow",
          name: "환불 흐름",
          graphJson: JSON.stringify({
            nodes: [{ id: "start", type: "START", label: "접수" }],
            edges: [],
          }),
        },
      })
      .mockResolvedValueOnce({
        id: 40,
        workflowCode: "refund-flow",
        name: "환불 흐름",
        graphJson: JSON.stringify({
          nodes: [{ id: "start", type: "START", label: "상담 접수" }],
          edges: [],
        }),
      });

    const { result } = renderHook(() =>
      useDomainPackRevisionSummary({
        workspaceId: 1,
        packId: 2,
        versionId: 4,
        summaryJson: revisionSummaryJson,
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
    expect(result.current.data.changedWorkflows[0]).toMatchObject({
      workflowId: 40,
      workflowCode: "refund-flow",
      fields: ["graphText"],
    });
    expect(mockedListWorkflows).toHaveBeenCalledWith(1, 2, 3, undefined, {
      signal: expect.any(AbortSignal),
    });
  });

  it("요약 조회 실패는 error 상태로 반환한다", async () => {
    mockedListIntents.mockRejectedValueOnce(new Error("revision summary failed"));
    mockedListWorkflows.mockResolvedValue([]);

    const { result } = renderHook(() =>
      useDomainPackRevisionSummary({
        workspaceId: 1,
        packId: 2,
        versionId: 4,
        summaryJson: revisionSummaryJson,
      }),
    );

    await waitFor(() => expect(result.current.status).toBe("error"));
    expect(result.current).toEqual({
      status: "error",
      message: "revision summary failed",
    });
  });
});
