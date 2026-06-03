import { beforeEach, describe, expect, it, vi } from "vitest";

import { simulationApi } from "./simulationApi";
import { customFetch } from "@/shared/api/mutator";

vi.mock("@/shared/api/mutator", () => ({
  customFetch: vi.fn(),
}));

const mockedCustomFetch = vi.mocked(customFetch);

describe("simulationApi", () => {
  beforeEach(() => {
    mockedCustomFetch.mockReset();
  });

  it("listSessions가 page query와 기본 page shape을 반환한다", async () => {
    const sessions = [
      {
        id: 10,
        channel: "SIMULATION",
        status: "OPEN",
        metaJson: "{}",
        startedAt: "2026-06-04T10:00:00Z",
      },
    ];
    mockedCustomFetch.mockResolvedValue({ data: { content: sessions, page: 2, size: 5 } });

    const result = await simulationApi.listSessions(7, { page: 2, size: 5 });

    expect(mockedCustomFetch).toHaveBeenCalledWith(
      "/api/v1/workspaces/7/simulation/sessions?page=2&size=5",
      { method: "GET" },
    );
    expect(result).toEqual({
      content: sessions,
      page: 2,
      size: 5,
      totalElements: 1,
      totalPages: 0,
    });
  });

  it("createSession이 선택 workflow payload를 전달한다", async () => {
    const detail = {
      session: { id: 20, channel: "SIMULATION", status: "OPEN", metaJson: "{}" },
      messages: [],
      matchedWorkflow: null,
      slotValues: {},
      slots: [],
    };
    mockedCustomFetch.mockResolvedValue({ data: detail });

    const result = await simulationApi.createSession(7, {
      customerName: "홍길동",
      workflowDefinitionId: 100,
    });

    expect(mockedCustomFetch).toHaveBeenCalledWith("/api/v1/workspaces/7/simulation/sessions", {
      method: "POST",
      body: JSON.stringify({ customerName: "홍길동", workflowDefinitionId: 100 }),
    });
    expect(result).toEqual(detail);
  });

  it("sendMessage가 customer content를 세션별 endpoint로 보낸다", async () => {
    const detail = {
      session: { id: 20, channel: "SIMULATION", status: "ACTIVE", metaJson: "{}" },
      messages: [{ id: 1, senderRole: "USER", content: "환불하고 싶어요" }],
      matchedWorkflow: { workflowName: "환불 처리", currentState: "collect_order_no" },
      slotValues: { orderNo: "A-100" },
      slots: [],
    };
    mockedCustomFetch.mockResolvedValue({ data: detail });

    const result = await simulationApi.sendMessage(7, 20, { content: "환불하고 싶어요" });

    expect(mockedCustomFetch).toHaveBeenCalledWith(
      "/api/v1/workspaces/7/simulation/sessions/20/messages",
      {
        method: "POST",
        body: JSON.stringify({ content: "환불하고 싶어요" }),
      },
    );
    expect(result).toEqual(detail);
  });
});
