import { beforeEach, describe, expect, it, vi } from "vitest";

import { simulationApi } from "./simulationApi";
import { customFetch } from "@/shared/api/mutator";

vi.mock("@/shared/api/mutator", () => ({
  customFetch: vi.fn(),
}));

const mockedCustomFetch = vi.mocked(customFetch);

const candidate = {
  id: 1000,
  workspaceId: 7,
  domainPackVersionId: 101,
  feedbackId: 1,
  sessionId: 20,
  chatMessageId: 2,
  candidateType: "SLOT_QUESTION",
  targetElementType: "SLOT",
  targetElementId: null,
  targetElementKey: null,
  beforeSummary: "주문번호를 묻지 않았습니다.",
  afterSummary: "주문번호를 먼저 요청합니다.",
  evidenceSummary: "simulation feedback #1",
  status: "DRAFT",
  createdBy: 3,
  createdAt: "2026-06-04T10:05:00Z",
  updatedAt: "2026-06-04T10:05:00Z",
} as const;

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

  it("getSession이 세션 상세 endpoint 응답을 반환한다", async () => {
    const detail = {
      session: { id: 20, channel: "SIMULATION", status: "OPEN", metaJson: "{}" },
      messages: [],
      matchedWorkflow: null,
      slotValues: {},
      slots: [],
    };
    mockedCustomFetch.mockResolvedValue({ data: detail });

    const result = await simulationApi.getSession(7, 20);

    expect(mockedCustomFetch).toHaveBeenCalledWith("/api/v1/workspaces/7/simulation/sessions/20", {
      method: "GET",
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

  it("createFeedback이 session feedback endpoint로 구조화된 피드백을 보낸다", async () => {
    const detail = {
      session: { id: 20, channel: "SIMULATION", status: "ACTIVE", metaJson: "{}" },
      messages: [],
      matchedWorkflow: null,
      slotValues: {},
      slots: [],
      feedback: { items: [], messageFeedbackCounts: {} },
    };
    const payload = {
      chatMessageId: 2,
      feedbackType: "MISSING_SLOT_QUESTION" as const,
      description: "주문번호를 묻지 않았습니다.",
      expectedBehavior: "주문번호를 먼저 요청합니다.",
      severity: "HIGH" as const,
    };
    mockedCustomFetch.mockResolvedValue({ data: detail });

    const result = await simulationApi.createFeedback(7, 20, payload);

    expect(mockedCustomFetch).toHaveBeenCalledWith(
      "/api/v1/workspaces/7/simulation/sessions/20/feedback",
      {
        method: "POST",
        body: JSON.stringify(payload),
      },
    );
    expect(result).toEqual(detail);
  });

  it("listFeedback이 status query와 기본 page shape을 반환한다", async () => {
    const feedback = [
      {
        id: 1,
        workspaceId: 7,
        sessionId: 20,
        chatMessageId: 2,
        feedbackType: "MISSING_SLOT_QUESTION",
        description: "주문번호를 묻지 않았습니다.",
        expectedBehavior: "주문번호를 먼저 요청합니다.",
        severity: "HIGH",
        status: "OPEN",
        createdBy: 3,
        createdAt: "2026-06-04T10:00:00Z",
        updatedAt: "2026-06-04T10:00:00Z",
      },
    ];
    mockedCustomFetch.mockResolvedValue({ data: { content: feedback, page: 0, size: 20 } });

    const result = await simulationApi.listFeedback(7, { status: "OPEN", page: 0, size: 20 });

    expect(mockedCustomFetch).toHaveBeenCalledWith(
      "/api/v1/workspaces/7/simulation/feedback?status=OPEN&page=0&size=20",
      { method: "GET" },
    );
    expect(result).toEqual({
      content: feedback,
      page: 0,
      size: 20,
      totalElements: 1,
      totalPages: 0,
    });
  });

  it("createImprovementCandidate가 feedback 기반 후보 생성 endpoint를 호출한다", async () => {
    const payload = {
      targetElementType: "SLOT" as const,
      targetElementId: 30,
      targetElementKey: "orderNo",
      beforeSummary: "질문 없음",
      afterSummary: "주문번호 질문",
    };
    mockedCustomFetch.mockResolvedValue({ data: candidate });

    const result = await simulationApi.createImprovementCandidate(7, 1, payload);

    expect(mockedCustomFetch).toHaveBeenCalledWith(
      "/api/v1/workspaces/7/simulation/improvement-candidates/from-feedback/1",
      {
        method: "POST",
        body: JSON.stringify(payload),
      },
    );
    expect(result).toEqual(candidate);
  });

  it("listImprovementCandidates가 status query와 기본 page shape을 반환한다", async () => {
    mockedCustomFetch.mockResolvedValue({ data: { content: [candidate], page: 1, size: 5 } });

    const result = await simulationApi.listImprovementCandidates(7, {
      status: "READY_FOR_REVIEW",
      page: 1,
      size: 5,
    });

    expect(mockedCustomFetch).toHaveBeenCalledWith(
      "/api/v1/workspaces/7/simulation/improvement-candidates?status=READY_FOR_REVIEW&page=1&size=5",
      { method: "GET" },
    );
    expect(result).toEqual({
      content: [candidate],
      page: 1,
      size: 5,
      totalElements: 1,
      totalPages: 0,
    });
  });

  it("getImprovementCandidate가 후보 상세 endpoint 응답을 반환한다", async () => {
    mockedCustomFetch.mockResolvedValue({ data: candidate });

    const result = await simulationApi.getImprovementCandidate(7, 1000);

    expect(mockedCustomFetch).toHaveBeenCalledWith(
      "/api/v1/workspaces/7/simulation/improvement-candidates/1000",
      { method: "GET" },
    );
    expect(result).toEqual(candidate);
  });

  it("updateImprovementCandidateStatus가 후보 상태 변경 endpoint를 호출한다", async () => {
    mockedCustomFetch.mockResolvedValue({ data: { ...candidate, status: "READY_FOR_REVIEW" } });

    const result = await simulationApi.updateImprovementCandidateStatus(7, 1000, {
      status: "READY_FOR_REVIEW",
    });

    expect(mockedCustomFetch).toHaveBeenCalledWith(
      "/api/v1/workspaces/7/simulation/improvement-candidates/1000/status",
      {
        method: "PATCH",
        body: JSON.stringify({ status: "READY_FOR_REVIEW" }),
      },
    );
    expect(result.status).toBe("READY_FOR_REVIEW");
  });
});
