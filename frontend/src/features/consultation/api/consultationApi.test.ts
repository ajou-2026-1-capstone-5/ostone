import { describe, it, expect, vi, beforeEach } from "vite-plus/test";
import { consultationApi } from "./consultationApi";
import {
  generateDraftResponse,
  getMessages,
  sendMessage,
  updateStatus,
} from "@/shared/api/generated/endpoints/consultation-controller/consultation-controller";
import { getQueue } from "@/shared/api/generated/endpoints/workspace-consultation-queue-controller/workspace-consultation-queue-controller";
import {
  assignSession,
  getSessions,
  releaseSession,
  updateResponseMode,
} from "@/shared/api/generated/endpoints/counselor-session-controller/counselor-session-controller";
import { customFetch } from "@/shared/api/mutator";
import type { ChatMessageResponse, ChatSessionResponse } from "@/shared/api/generated/zod";

vi.mock("@/shared/api/generated/endpoints/consultation-controller/consultation-controller", () => ({
  getMessages: vi.fn(),
  sendMessage: vi.fn(),
  updateStatus: vi.fn(),
  generateDraftResponse: vi.fn(),
}));

vi.mock(
  "@/shared/api/generated/endpoints/workspace-consultation-queue-controller/workspace-consultation-queue-controller",
  () => ({
    getQueue: vi.fn(),
  }),
);

vi.mock(
  "@/shared/api/generated/endpoints/counselor-session-controller/counselor-session-controller",
  () => ({
    getSessions: vi.fn(),
    assignSession: vi.fn(),
    releaseSession: vi.fn(),
    updateResponseMode: vi.fn(),
  }),
);

vi.mock("@/shared/api/mutator", () => ({
  customFetch: vi.fn(),
}));

const mockedGetMessages = vi.mocked(getMessages);
const mockedSendMessage = vi.mocked(sendMessage);
const mockedUpdateStatus = vi.mocked(updateStatus);
const mockedGenerateDraftResponse = vi.mocked(generateDraftResponse);
const mockedGetQueue = vi.mocked(getQueue);
const mockedGetSessions = vi.mocked(getSessions);
const mockedAssignSession = vi.mocked(assignSession);
const mockedReleaseSession = vi.mocked(releaseSession);
const mockedUpdateResponseMode = vi.mocked(updateResponseMode);
const mockedCustomFetch = vi.mocked(customFetch);

describe("consultationApi", () => {
  beforeEach(() => {
    mockedGetMessages.mockClear();
    mockedSendMessage.mockClear();
    mockedUpdateStatus.mockClear();
    mockedGenerateDraftResponse.mockClear();
    mockedGetQueue.mockClear();
    mockedGetSessions.mockClear();
    mockedAssignSession.mockClear();
    mockedReleaseSession.mockClear();
    mockedUpdateResponseMode.mockClear();
    mockedCustomFetch.mockClear();
  });

  it("getQueue가 generated getQueue 응답의 data를 반환한다", async () => {
    const stubSessions = [
      {
        id: 1,
        status: "OPEN",
        channel: "카카오톡",
        metaJson: "{}",
        startedAt: new Date().toISOString(),
      },
    ];
    mockedGetQueue.mockResolvedValue({
      data: stubSessions,
      status: 200,
      headers: new Headers(),
    } as never);

    const result = await consultationApi.getQueue(2);

    expect(mockedGetQueue).toHaveBeenCalledWith(2);
    expect(result).toEqual(stubSessions);
    expect(result).toHaveLength(1);
  });

  it("getQueue가 plain array 응답도 반환한다", async () => {
    const stubSessions = [
      {
        id: 1,
        status: "OPEN",
        channel: "WEB",
        metaJson: "{}",
        startedAt: new Date().toISOString(),
      },
    ];
    mockedGetQueue.mockResolvedValue(stubSessions as never);

    const result = await consultationApi.getQueue(2);

    expect(result).toEqual(stubSessions);
  });

  it("getMessages가 메시지 데이터를 반환한다", async () => {
    const stubMessages = [
      {
        id: 1,
        seqNo: 1,
        senderRole: "AGENT",
        messageType: "TEXT",
        content: "안녕하세요",
        createdAt: new Date().toISOString(),
      },
    ];
    mockedGetMessages.mockResolvedValue({
      data: stubMessages,
      status: 200,
      headers: new Headers(),
    } as never);

    const result = await consultationApi.getMessages(1);

    expect(mockedGetMessages).toHaveBeenCalledWith(1);
    expect(result).toEqual(stubMessages);
  });

  it("sendMessage가 전송된 메시지를 반환한다", async () => {
    const stubMessage = {
      id: 99,
      seqNo: 1,
      senderRole: "AGENT",
      messageType: "TEXT",
      content: "test",
      createdAt: new Date().toISOString(),
    };
    mockedSendMessage.mockResolvedValue({
      data: stubMessage,
      status: 200,
      headers: new Headers(),
    } as never);

    const result = await consultationApi.sendMessage(1, "test");

    expect(mockedSendMessage).toHaveBeenCalledWith(1, { content: "test", isNote: false });
    expect(result).toEqual(stubMessage);
  });

  it("sendMessage가 plain object 응답도 반환한다", async () => {
    const stubMessage = {
      id: 99,
      seqNo: 1,
      senderRole: "AGENT",
      messageType: "TEXT",
      content: "plain",
      createdAt: new Date().toISOString(),
    };
    mockedSendMessage.mockResolvedValue(stubMessage as never);

    const result = await consultationApi.sendMessage(1, "plain");

    expect(result).toEqual(stubMessage);
  });

  it("sendMessage가 isNote=true를 전달한다", async () => {
    const stubNote = {
      id: 100,
      seqNo: 1,
      senderRole: "AGENT",
      messageType: "NOTE",
      content: "메모",
      createdAt: new Date().toISOString(),
    };
    mockedSendMessage.mockResolvedValue({
      data: stubNote,
      status: 200,
      headers: new Headers(),
    } as never);

    const result = await consultationApi.sendMessage(1, "메모", true);

    expect(mockedSendMessage).toHaveBeenCalledWith(1, { content: "메모", isNote: true });
    expect(result).toEqual(stubNote);
  });

  it("updateStatus가 업데이트된 세션을 반환한다", async () => {
    const stubSession = {
      id: 1,
      status: "COMPLETED",
      channel: "카카오톡",
      metaJson: "{}",
      startedAt: new Date().toISOString(),
    };
    mockedUpdateStatus.mockResolvedValue({
      data: stubSession,
      status: 200,
      headers: new Headers(),
    } as never);

    const result = await consultationApi.updateStatus(1, "COMPLETED");

    expect(mockedUpdateStatus).toHaveBeenCalledWith(1, { status: "COMPLETED" });
    expect(result).toEqual(stubSession);
  });

  it("updateStatus가 처리 결과 payload를 전달한다", async () => {
    const stubSession = {
      id: 1,
      status: "RESOLVED",
      channel: "카카오톡",
      metaJson: "{}",
      startedAt: new Date().toISOString(),
    };
    mockedUpdateStatus.mockResolvedValue({
      data: stubSession,
      status: 200,
      headers: new Headers(),
    } as never);

    const result = await consultationApi.updateStatus(1, {
      status: "RESOLVED",
      resolutionOutcome: "FOLLOW_UP_REQUIRED",
      resolutionReason: "배송사 확인 필요",
      followUpRequired: true,
    });

    expect(mockedUpdateStatus).toHaveBeenCalledWith(1, {
      status: "RESOLVED",
      resolutionOutcome: "FOLLOW_UP_REQUIRED",
      resolutionReason: "배송사 확인 필요",
      followUpRequired: true,
    });
    expect(result).toEqual(stubSession);
  });

  it("getSessions가 generated getSessions content를 반환한다", async () => {
    const stubSessions = [
      {
        id: 1,
        status: "OPEN",
        channel: "카카오톡",
        metaJson: "{}",
        startedAt: new Date().toISOString(),
      },
    ];
    mockedGetSessions.mockResolvedValue({
      data: stubSessions,
      status: 200,
      headers: new Headers(),
    } as never);

    const result = await consultationApi.getSessions(2);

    expect(mockedGetSessions).toHaveBeenCalledWith(2, {});
    expect(result).toEqual(stubSessions);
  });

  it("getSessions가 paged content 응답도 반환한다", async () => {
    const stubSessions = [
      {
        id: 1,
        status: "ACTIVE",
        channel: "WEB",
        metaJson: "{}",
        startedAt: new Date().toISOString(),
      },
    ];
    mockedGetSessions.mockResolvedValue({ content: stubSessions, page: 0, size: 20 } as never);

    const result = await consultationApi.getSessions(2);

    expect(result).toEqual(stubSessions);
  });

  it("getSessions가 status 필터를 generated params로 전달한다", async () => {
    const stubSessions: ChatSessionResponse[] = [];
    mockedGetSessions.mockResolvedValue({
      data: stubSessions,
      status: 200,
      headers: new Headers(),
    } as never);

    await consultationApi.getSessions(2, { status: "OPEN" });

    expect(mockedGetSessions).toHaveBeenCalledWith(2, { status: "OPEN" });
  });

  it("getSessions가 page/size를 generated params로 전달한다", async () => {
    const stubSessions: ChatSessionResponse[] = [];
    mockedGetSessions.mockResolvedValue({
      data: stubSessions,
      status: 200,
      headers: new Headers(),
    } as never);

    await consultationApi.getSessions(2, { page: 1, size: 20 });

    expect(mockedGetSessions).toHaveBeenCalledWith(2, { page: 1, size: 20 });
  });

  it("getSessionPage가 검색/필터 파라미터를 generated params로 전달하고 page envelope를 반환한다", async () => {
    const stubSessions: ChatSessionResponse[] = [];
    mockedGetSessions.mockResolvedValue({
      data: {
        content: stubSessions,
        page: 1,
        size: 20,
        totalElements: 24,
        totalPages: 2,
      },
      status: 200,
      headers: new Headers(),
    } as never);

    const result = await consultationApi.getSessionPage(2, {
      status: "COMPLETED",
      keyword: "환불",
      startedFrom: "2026-05-01",
      startedTo: "2026-05-31",
      assignedCounselorId: 42,
      page: 1,
      size: 20,
    });

    expect(mockedGetSessions).toHaveBeenCalledWith(2, {
      status: "COMPLETED",
      keyword: "환불",
      startedFrom: "2026-05-01",
      startedTo: "2026-05-31",
      assignedCounselorId: 42,
      page: 1,
      size: 20,
    });
    expect(result).toEqual({
      content: stubSessions,
      page: 1,
      size: 20,
      totalElements: 24,
      totalPages: 2,
    });
  });

  it("getMessages가 params 없이 호출되면 generated getMessages를 인자 없이 사용한다", async () => {
    const stubMessages: ChatMessageResponse[] = [];
    mockedGetMessages.mockResolvedValue({
      data: stubMessages,
      status: 200,
      headers: new Headers(),
    } as never);

    const result = await consultationApi.getMessages(1);

    expect(mockedGetMessages).toHaveBeenCalledWith(1);
    expect(mockedCustomFetch).not.toHaveBeenCalled();
    expect(result).toEqual(stubMessages);
  });

  it("getMessages가 page/size 파라미터와 함께 호출되면 generated getMessages에 params를 전달한다", async () => {
    const stubMessages: ChatMessageResponse[] = [
      {
        id: 1,
        seqNo: 1,
        senderRole: "AGENT",
        messageType: "TEXT",
        content: "안녕하세요",
        createdAt: new Date().toISOString(),
      },
    ];
    mockedGetMessages.mockResolvedValue({
      data: stubMessages,
      status: 200,
      headers: new Headers(),
    } as never);

    const result = await consultationApi.getMessages(1, { page: 0, size: 10 });

    expect(mockedGetMessages).toHaveBeenCalledWith(1, { page: 0, size: 10 });
    expect(mockedCustomFetch).not.toHaveBeenCalled();
    expect(result).toEqual(stubMessages);
  });

  it("getMessages가 params와 함께 호출되면 plain array 응답도 반환한다", async () => {
    const stubMessages: ChatMessageResponse[] = [
      {
        id: 1,
        seqNo: 1,
        senderRole: "AGENT",
        messageType: "TEXT",
        content: "plain",
        createdAt: new Date().toISOString(),
      },
    ];
    mockedGetMessages.mockResolvedValue(stubMessages as never);

    const result = await consultationApi.getMessages(1, { page: 0, size: 10 });

    expect(mockedGetMessages).toHaveBeenCalledWith(1, { page: 0, size: 10 });
    expect(result).toEqual(stubMessages);
  });

  it("getMessages가 params와 함께 호출되면 paged content 응답도 반환한다", async () => {
    const stubMessages: ChatMessageResponse[] = [
      {
        id: 1,
        seqNo: 1,
        senderRole: "AGENT",
        messageType: "TEXT",
        content: "content",
        createdAt: new Date().toISOString(),
      },
    ];
    mockedGetMessages.mockResolvedValue({ content: stubMessages, page: 0, size: 10 } as never);

    const result = await consultationApi.getMessages(1, { page: 0, size: 10 });

    expect(mockedGetMessages).toHaveBeenCalledWith(1, { page: 0, size: 10 });
    expect(result).toEqual(stubMessages);
  });

  it("getMessagePage가 page metadata와 content를 반환한다", async () => {
    const stubMessages: ChatMessageResponse[] = [
      {
        id: 1,
        seqNo: 51,
        senderRole: "CUSTOMER",
        messageType: "TEXT",
        content: "최근 메시지",
        createdAt: new Date().toISOString(),
      },
    ];
    mockedGetMessages.mockResolvedValue({
      content: stubMessages,
      page: 0,
      size: 50,
      totalElements: 75,
      totalPages: 2,
    } as never);

    const result = await consultationApi.getMessagePage(1);

    expect(mockedGetMessages).toHaveBeenCalledWith(1, { page: 0, size: 50 });
    expect(result).toEqual({
      content: stubMessages,
      page: 0,
      size: 50,
      totalElements: 75,
      totalPages: 2,
    });
  });

  it("getMessagePage가 legacy array 응답을 metadata로 보정한다", async () => {
    const stubMessages: ChatMessageResponse[] = [
      {
        id: 1,
        seqNo: 1,
        senderRole: "AGENT",
        messageType: "TEXT",
        content: "legacy",
        createdAt: new Date().toISOString(),
      },
    ];
    mockedGetMessages.mockResolvedValue(stubMessages as never);

    const result = await consultationApi.getMessagePage(1, { page: 2, size: 10 });

    expect(mockedGetMessages).toHaveBeenCalledWith(1, { page: 2, size: 10 });
    expect(result).toEqual({
      content: stubMessages,
      page: 2,
      size: 10,
      totalElements: 1,
      totalPages: 1,
    });
  });

  it("getMessagePage가 잘못된 page/size를 요청과 응답에서 보정한다", async () => {
    mockedGetMessages.mockResolvedValue({
      content: [],
      page: -3,
      size: 0,
      totalElements: 12,
    } as never);

    const result = await consultationApi.getMessagePage(1, { page: -1, size: 0 });

    expect(mockedGetMessages).toHaveBeenCalledWith(1, { page: 0, size: 1 });
    expect(result).toEqual({
      content: [],
      page: 0,
      size: 1,
      totalElements: 12,
      totalPages: 12,
    });
  });

  it("assignSession이 generated assignSession을 호출한다", async () => {
    const stubSession = {
      id: 1,
      status: "ACTIVE",
      channel: "WEB",
      metaJson: "{}",
      startedAt: new Date().toISOString(),
      assignedCounselorId: 7,
    };
    mockedAssignSession.mockResolvedValue(stubSession as never);

    const result = await consultationApi.assignSession(1);

    expect(mockedAssignSession).toHaveBeenCalledWith(1);
    expect(result).toEqual(stubSession);
  });

  it("releaseSession이 generated releaseSession을 호출한다", async () => {
    const stubSession = {
      id: 1,
      status: "OPEN",
      channel: "WEB",
      metaJson: "{}",
      startedAt: new Date().toISOString(),
      assignedCounselorId: null,
    };
    mockedReleaseSession.mockResolvedValue({ data: stubSession } as never);

    const result = await consultationApi.releaseSession(1);

    expect(mockedReleaseSession).toHaveBeenCalledWith(1);
    expect(result).toEqual(stubSession);
  });

  it("updateResponseMode가 generated updateResponseMode에 상담사 ID와 모드를 전달한다", async () => {
    const stubSession = {
      id: 1,
      status: "ACTIVE",
      channel: "WEB",
      metaJson: "{}",
      startedAt: new Date().toISOString(),
      assignedCounselorId: 7,
      responseMode: "AI_ASSIST_ONLY" as const,
    };
    mockedUpdateResponseMode.mockResolvedValue({ data: stubSession } as never);

    const result = await consultationApi.updateResponseMode(1, 7, "AI_ASSIST_ONLY");

    expect(mockedUpdateResponseMode).toHaveBeenCalledWith(1, {
      counselorId: 7,
      responseMode: "AI_ASSIST_ONLY",
    });
    expect(result).toEqual(stubSession);
  });

  it("generateDraftResponse가 generated generateDraftResponse를 호출하고 data를 반환한다", async () => {
    const stubDraft = { content: "안녕하세요, 무엇을 도와드릴까요?" };
    mockedGenerateDraftResponse.mockResolvedValue({ data: stubDraft } as never);

    const result = await consultationApi.generateDraftResponse(1);

    expect(mockedGenerateDraftResponse).toHaveBeenCalledWith(1);
    expect(result).toEqual(stubDraft);
  });

  it("getMetrics가 워크스페이스 상담 지표를 반환한다", async () => {
    const stubMetrics = {
      workspaceId: 2,
      periodStart: "2026-05-27T00:00:00+09:00",
      periodEnd: "2026-05-28T00:00:00+09:00",
      totalConsultationCount: 20,
      completedConsultationCount: 14,
      averageFirstResponseSeconds: 134,
      averageLlmFirstResponseSeconds: 3,
      averageHumanFirstResponseSeconds: 420,
      llmHandledCount: 9,
      humanInterventionCount: 5,
      unresolvedSessionCount: 2,
      comparison: {
        totalConsultationCountChangeRate: 25,
        completedConsultationCountChangeRate: 16.7,
        averageFirstResponseSecondsChangeRate: -10,
        averageLlmFirstResponseSecondsChangeRate: null,
        averageHumanFirstResponseSecondsChangeRate: 5,
        llmHandledCountChangeRate: 12.5,
        humanInterventionCountChangeRate: 0,
        unresolvedSessionCountChangeRate: null,
      },
      coverage: {
        workflowMatchedCount: 12,
        workflowMatchRate: 60,
        intentClassificationSuccessCount: 11,
        intentClassificationSuccessRate: 55,
        lowConfidenceCount: 2,
        lowConfidenceRate: 10,
        unmatchedSessionCount: 1,
        autoCompletedWorkflowCount: 8,
        humanHandoffRate: 25,
        llmOnlyProcessingRate: 64.3,
        measurementStatus: "READY" as const,
        measurementMessage: "커버리지 산출에 필요한 운영 로그가 확인되었습니다.",
        trend: [
          {
            date: "2026-05-27",
            totalConsultationCount: 20,
            workflowMatchedCount: 12,
            workflowMatchRate: 60,
          },
        ],
      },
      handledTodayCount: 14,
      llmHandledTodayCount: 9,
      humanHandledTodayCount: 5,
    };
    mockedCustomFetch.mockResolvedValue({
      data: stubMetrics,
      status: 200,
      headers: new Headers(),
    });

    const result = await consultationApi.getMetrics(2);

    expect(mockedCustomFetch).toHaveBeenCalledWith("/api/v1/workspaces/2/consultation/metrics", {
      method: "GET",
    });
    expect(result).toEqual(stubMetrics);
  });

  it("getMetrics가 기간 파라미터를 쿼리스트링으로 전달한다", async () => {
    const stubMetrics = {
      workspaceId: 2,
      periodStart: "2026-05-21T00:00:00+09:00",
      periodEnd: "2026-05-28T00:00:00+09:00",
      totalConsultationCount: 8,
      completedConsultationCount: 6,
      averageFirstResponseSeconds: 90,
      averageLlmFirstResponseSeconds: 4,
      averageHumanFirstResponseSeconds: 300,
      llmHandledCount: 5,
      humanInterventionCount: 1,
      unresolvedSessionCount: 2,
      comparison: null,
      coverage: null,
      handledTodayCount: 6,
      llmHandledTodayCount: 5,
      humanHandledTodayCount: 1,
    };
    mockedCustomFetch.mockResolvedValue({
      data: stubMetrics,
      status: 200,
      headers: new Headers(),
    });

    const result = await consultationApi.getMetrics(2, {
      from: "2026-05-21",
      to: "2026-05-27",
    });

    expect(mockedCustomFetch).toHaveBeenCalledWith(
      "/api/v1/workspaces/2/consultation/metrics?from=2026-05-21&to=2026-05-27",
      { method: "GET" },
    );
    expect(result).toEqual(stubMetrics);
  });

  it("getWorkflowRankings가 워크스페이스 대시보드 랭킹 endpoint를 호출한다", async () => {
    const stubRanking = {
      workspaceId: 2,
      periodStart: "2026-05-21T00:00:00+09:00",
      periodEnd: "2026-05-28T00:00:00+09:00",
      totalConsultationCount: 20,
      topRankings: [],
      rankings: [
        {
          rank: 1,
          workflowDefinitionId: 10,
          domainPackId: 3,
          domainPackVersionId: 4,
          workflowCode: "refund_flow",
          workflowName: "환불 처리",
          executionCount: 8,
          shareRate: 40,
          completedCount: 6,
          failedCount: 1,
          runningCount: 1,
          completionRate: 75,
          failureRate: 12.5,
          averageHandlingSeconds: 180,
          humanInterventionRate: 25,
          changeRate: 33.3,
          surging: true,
          detailPath: "/workspaces/2/domain-packs/3/workflows/10?versionId=4",
        },
      ],
    };
    mockedCustomFetch.mockResolvedValue({
      data: stubRanking,
      status: 200,
      headers: new Headers(),
    });

    const result = await consultationApi.getWorkflowRankings(2);

    expect(mockedCustomFetch).toHaveBeenCalledWith(
      "/api/v1/workspaces/2/dashboard/workflow-rankings",
      { method: "GET" },
    );
    expect(result).toEqual(stubRanking);
  });

  it("getWorkflowRankings가 기간 파라미터를 쿼리스트링으로 전달한다", async () => {
    const stubRanking = {
      workspaceId: 2,
      periodStart: "2026-05-21T00:00:00+09:00",
      periodEnd: "2026-05-28T00:00:00+09:00",
      totalConsultationCount: 0,
      topRankings: [],
      rankings: [],
    };
    mockedCustomFetch.mockResolvedValue({
      data: stubRanking,
      status: 200,
      headers: new Headers(),
    });

    const result = await consultationApi.getWorkflowRankings(2, {
      from: "2026-05-21",
      to: "2026-05-27",
    });

    expect(mockedCustomFetch).toHaveBeenCalledWith(
      "/api/v1/workspaces/2/dashboard/workflow-rankings?from=2026-05-21&to=2026-05-27",
      { method: "GET" },
    );
    expect(result).toEqual(stubRanking);
  });

  it("getWorkflowBottleneckAnalysis가 워크플로우 병목 분석 endpoint를 호출한다", async () => {
    const stubAnalysis = {
      workspaceId: 2,
      workflowDefinitionId: 10,
      periodStart: "2026-05-21T00:00:00+09:00",
      periodEnd: "2026-05-28T00:00:00+09:00",
      totalExecutionCount: 3,
      completedCount: 1,
      failedCount: 1,
      runningCount: 1,
      transitions: [{ stateFrom: "collect_slots", stateTo: "verify_policy", passCount: 2 }],
      longestDwellState: {
        stateName: "collect_slots",
        metricValue: 420,
        executionCount: 2,
        description: "평균 420초 동안 머문 state",
      },
      mostStoppedState: null,
      stateMetrics: [],
      missingSlotTop: [],
      policyHitTop: [],
      riskHitTop: [],
      humanInterventionPoints: [],
      improvementHints: [],
    };
    mockedCustomFetch.mockResolvedValue({
      data: stubAnalysis,
      status: 200,
      headers: new Headers(),
    });

    const result = await consultationApi.getWorkflowBottleneckAnalysis(2, 10, {
      from: "2026-05-21",
      to: "2026-05-27",
    });

    expect(mockedCustomFetch).toHaveBeenCalledWith(
      "/api/v1/workspaces/2/dashboard/workflows/10/bottleneck-analysis?from=2026-05-21&to=2026-05-27",
      { method: "GET" },
    );
    expect(result).toEqual(stubAnalysis);
  });

  it("getWorkflowBottleneckAnalysis가 기간 없이 워크플로우 병목 분석 endpoint를 호출한다", async () => {
    const stubAnalysis = {
      workspaceId: 2,
      workflowDefinitionId: 10,
      periodStart: "2026-05-29T00:00:00+09:00",
      periodEnd: "2026-06-05T00:00:00+09:00",
      totalExecutionCount: 0,
      completedCount: 0,
      failedCount: 0,
      runningCount: 0,
      transitions: [],
      longestDwellState: null,
      mostStoppedState: null,
      stateMetrics: [],
      missingSlotTop: [],
      policyHitTop: [],
      riskHitTop: [],
      humanInterventionPoints: [],
      improvementHints: [],
    };
    mockedCustomFetch.mockResolvedValue(stubAnalysis as never);

    const result = await consultationApi.getWorkflowBottleneckAnalysis(2, 10);

    expect(mockedCustomFetch).toHaveBeenCalledWith(
      "/api/v1/workspaces/2/dashboard/workflows/10/bottleneck-analysis",
      { method: "GET" },
    );
    expect(result).toEqual(stubAnalysis);
  });
});
