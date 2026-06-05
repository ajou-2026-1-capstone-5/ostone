import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { toast } from "sonner";

import { WorkspaceSimulationPage } from "./WorkspaceSimulationPage";
import { simulationApi, type SimulationImprovementCandidate } from "@/features/simulation";
import { useListAllWorkspaceWorkflows } from "@/entities/workflow";

const setCrumbs = vi.fn();

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return {
    ...actual,
    useOutletContext: () => ({ setCrumbs, workspace: { id: 1, name: "CS Team" } }),
  };
});

vi.mock("@/entities/workflow", () => ({
  useListAllWorkspaceWorkflows: vi.fn(),
}));

vi.mock("@/features/simulation", () => ({
  simulationApi: {
    listSessions: vi.fn(),
    createSession: vi.fn(),
    getSession: vi.fn(),
    sendMessage: vi.fn(),
    createFeedback: vi.fn(),
    listFeedback: vi.fn(),
    createImprovementCandidate: vi.fn(),
    listImprovementCandidates: vi.fn(),
    updateImprovementCandidateStatus: vi.fn(),
    approveImprovementCandidate: vi.fn(),
    rejectImprovementCandidate: vi.fn(),
    listGoldenCases: vi.fn(),
    createGoldenCase: vi.fn(),
    replayGoldenCase: vi.fn(),
    listGoldenCaseReplays: vi.fn(),
  },
}));

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

const mockedWorkflows = vi.mocked(useListAllWorkspaceWorkflows);
const mockedSimulationApi = vi.mocked(simulationApi);

const session = {
  id: 10,
  channel: "SIMULATION",
  status: "OPEN",
  metaJson: JSON.stringify({ customerName: "테스트 고객" }),
  startedAt: "2026-06-04T10:30:00Z",
};

const otherSession = {
  id: 20,
  channel: "SIMULATION",
  status: "OPEN",
  metaJson: JSON.stringify({ customerName: "다른 고객" }),
  startedAt: "2026-06-04T11:30:00Z",
};

const detail = {
  session,
  messages: [
    {
      id: 1,
      seqNo: 1,
      senderRole: "USER",
      messageType: "TEXT",
      content: "환불하고 싶어요",
      createdAt: "2026-06-04T10:31:00Z",
    },
  ],
  matchedWorkflow: {
    sessionId: 10,
    workspaceId: 1,
    domainPackId: 11,
    domainPackVersionId: 101,
    executionId: 77,
    intentName: "환불 문의",
    intentCode: "refund_request",
    workflowDefinitionId: 100,
    workflowCode: "refund_workflow",
    workflowName: "환불 처리",
    currentState: "collect_order_no",
    executionStatus: "ACTIVE",
  },
  slotValues: { orderNo: "A-100" },
  slots: [],
  feedback: {
    items: [
      {
        id: 900,
        workspaceId: 1,
        sessionId: 10,
        chatMessageId: 1,
        feedbackType: "MISSING_SLOT_QUESTION",
        description: "주문번호를 묻지 않았습니다.",
        expectedBehavior: "주문번호를 먼저 요청합니다.",
        severity: "HIGH",
        status: "OPEN",
        createdBy: 7,
        createdAt: "2026-06-04T10:40:00Z",
        updatedAt: "2026-06-04T10:40:00Z",
      },
    ],
    messageFeedbackCounts: { "1": 1 },
  },
};

const candidate = {
  id: 1000,
  workspaceId: 1,
  domainPackVersionId: 101,
  feedbackId: 900,
  sessionId: 10,
  chatMessageId: 1,
  candidateType: "SLOT_QUESTION",
  targetElementType: "SLOT",
  targetElementId: null,
  targetElementKey: null,
  beforeSummary: "주문번호를 묻지 않았습니다.",
  afterSummary: "주문번호를 먼저 요청합니다.",
  evidenceSummary: "simulation feedback #900",
  reviewSessionId: null,
  reviewTaskId: null,
  appliedDomainPackVersionId: null,
  draftPatchJson: "{}",
  decisionReason: null,
  decidedBy: null,
  decidedAt: null,
  status: "DRAFT",
  createdBy: 7,
  createdAt: "2026-06-04T10:45:00Z",
  updatedAt: "2026-06-04T10:45:00Z",
} as const;

const goldenCase = {
  id: 950,
  workspaceId: 1,
  sourceSessionId: 10,
  sourceDomainPackVersionId: 101,
  name: "환불 검증",
  inputMessagesJson: '[{"content":"환불하고 싶어요"}]',
  expectedJson:
    '{"intentCode":"refund_request","workflowCode":"refund_workflow","currentState":"collect_order_no","actionType":"ASK_SLOT"}',
  createdBy: 7,
  createdAt: "2026-06-05T10:45:00Z",
  updatedAt: "2026-06-05T10:45:00Z",
  latestReplayResult: null,
} as const;

const replayResult = {
  id: 990,
  workspaceId: 1,
  goldenCaseId: 950,
  domainPackVersionId: 101,
  replaySessionId: 960,
  status: "PASS",
  expectedJson: "{}",
  actualJson: "{}",
  failureSummary: null,
  createdBy: 7,
  createdAt: "2026-06-05T10:46:00Z",
} as const;

const failedReplayResult = {
  ...replayResult,
  id: 991,
  status: "FAIL",
  failureSummary: "currentState expected collect_order_no but was handoff",
} as const;

function candidateWithType(
  id: number,
  candidateType: SimulationImprovementCandidate["candidateType"],
): SimulationImprovementCandidate {
  return {
    ...candidate,
    id,
    candidateType,
  };
}

const otherDetail = {
  ...detail,
  session: otherSession,
  messages: [
    {
      id: 3,
      seqNo: 1,
      senderRole: "USER",
      messageType: "TEXT",
      content: "배송지를 바꾸고 싶어요",
      createdAt: "2026-06-04T11:31:00Z",
    },
  ],
  feedback: {
    items: [],
    messageFeedbackCounts: {},
  },
};

function renderPage(path = "/workspaces/1/simulation") {
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/workspaces/:workspaceId/simulation" element={<WorkspaceSimulationPage />} />
        <Route path="/workspaces" element={<div data-testid="workspace-root" />} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mockedWorkflows.mockReturnValue({
    loading: false,
    error: null,
    entries: [
      {
        packId: 11,
        packName: "CS Support",
        versionId: 22,
        workflowId: 100,
        workflowCode: "refund.standard",
        name: "환불 처리",
        description: null,
        intentDefinitionId: 30,
      },
    ],
  });
  mockedSimulationApi.listSessions.mockResolvedValue({
    content: [session],
    page: 0,
    size: 20,
    totalElements: 1,
    totalPages: 1,
  });
  mockedSimulationApi.getSession.mockImplementation(async (_workspaceId, sessionId) =>
    sessionId === otherSession.id ? otherDetail : detail,
  );
  mockedSimulationApi.createSession.mockResolvedValue(detail);
  mockedSimulationApi.createFeedback.mockResolvedValue(detail);
  mockedSimulationApi.listFeedback.mockResolvedValue({
    content: detail.feedback.items,
    page: 0,
    size: 20,
    totalElements: 1,
    totalPages: 1,
  });
  mockedSimulationApi.listImprovementCandidates.mockResolvedValue({
    content: [],
    page: 0,
    size: 20,
    totalElements: 0,
    totalPages: 0,
  });
  mockedSimulationApi.createImprovementCandidate.mockResolvedValue(candidate);
  mockedSimulationApi.updateImprovementCandidateStatus.mockResolvedValue({
    ...candidate,
    status: "READY_FOR_REVIEW",
  });
  mockedSimulationApi.approveImprovementCandidate.mockResolvedValue({
    ...candidate,
    status: "APPLIED",
    appliedDomainPackVersionId: 102,
    decisionReason: "시뮬레이션 리뷰 승인",
  });
  mockedSimulationApi.rejectImprovementCandidate.mockResolvedValue({
    ...candidate,
    status: "REJECTED",
    decisionReason: "근거가 부족합니다.",
  });
  mockedSimulationApi.listGoldenCases.mockResolvedValue({
    content: [],
    page: 0,
    size: 20,
    totalElements: 0,
    totalPages: 0,
  });
  mockedSimulationApi.createGoldenCase.mockResolvedValue(goldenCase);
  mockedSimulationApi.replayGoldenCase.mockResolvedValue(replayResult);
  mockedSimulationApi.sendMessage.mockResolvedValue({
    ...detail,
    messages: [
      ...detail.messages,
      {
        id: 2,
        seqNo: 2,
        senderRole: "ASSISTANT",
        messageType: "TEXT",
        content: "주문번호를 알려주세요.",
        createdAt: "2026-06-04T10:32:00Z",
      },
    ],
  });
});

describe("WorkspaceSimulationPage", () => {
  it("잘못된 workspaceId면 /workspaces로 리다이렉트한다", () => {
    renderPage("/workspaces/abc/simulation");
    expect(screen.getByTestId("workspace-root")).toBeInTheDocument();
  });

  it("세션 목록과 runtime 상태를 표시한다", async () => {
    renderPage();

    expect(await screen.findByRole("heading", { name: "상담 시뮬레이션" })).toBeInTheDocument();
    expect(await screen.findByText("테스트 고객")).toBeInTheDocument();
    expect(await screen.findByText("환불하고 싶어요")).toBeInTheDocument();
    expect(screen.getByText("환불 문의")).toBeInTheDocument();
    expect(screen.getByText("환불 처리")).toBeInTheDocument();
    expect(screen.getByText("collect_order_no")).toBeInTheDocument();
    expect(screen.getByText("A-100")).toBeInTheDocument();
  });

  it("대시보드 추천 query로 피드백과 개선 후보 상태 필터를 초기화한다", async () => {
    renderPage("/workspaces/1/simulation?feedbackStatus=RESOLVED&candidateStatus=READY_FOR_REVIEW");

    expect(await screen.findByLabelText("피드백 상태 필터")).toHaveValue("RESOLVED");
    expect(screen.getByLabelText("개선 후보 상태 필터")).toHaveValue("READY_FOR_REVIEW");
    await waitFor(() => {
      expect(mockedSimulationApi.listFeedback).toHaveBeenCalledWith(1, {
        status: "RESOLVED",
        page: 0,
        size: 20,
      });
    });
    await waitFor(() => {
      expect(mockedSimulationApi.listImprovementCandidates).toHaveBeenCalledWith(1, {
        status: "READY_FOR_REVIEW",
        page: 0,
        size: 20,
      });
    });
  });

  it("workflow를 선택해 시뮬레이션 세션을 생성한다", async () => {
    renderPage();

    fireEvent.change(await screen.findByLabelText("시작 workflow 선택"), {
      target: { value: "100" },
    });
    fireEvent.click(screen.getByRole("button", { name: "세션 생성" }));

    await waitFor(() => {
      expect(mockedSimulationApi.createSession).toHaveBeenCalledWith(1, {
        customerName: "시뮬레이션 고객",
        workflowDefinitionId: 100,
      });
    });
  });

  it("고객 메시지를 전송하고 응답을 화면에 반영한다", async () => {
    renderPage();

    fireEvent.change(await screen.findByPlaceholderText("고객 역할 메시지 입력"), {
      target: { value: "A-100 주문 환불이요" },
    });
    fireEvent.click(screen.getByRole("button", { name: "전송" }));

    await waitFor(() => {
      expect(mockedSimulationApi.sendMessage).toHaveBeenCalledWith(1, 10, {
        content: "A-100 주문 환불이요",
      });
    });
    expect(await screen.findByText("주문번호를 알려주세요.")).toBeInTheDocument();
  });

  it("turn 단위 피드백을 작성하고 session 상세를 갱신한다", async () => {
    renderPage();

    fireEvent.click(await screen.findByLabelText("Turn 1 피드백 대상 선택"));
    fireEvent.change(screen.getByLabelText("피드백 유형 선택"), {
      target: { value: "MISSING_SLOT_QUESTION" },
    });
    fireEvent.change(screen.getByLabelText("피드백 심각도 선택"), {
      target: { value: "HIGH" },
    });
    fireEvent.change(screen.getByLabelText("설명"), {
      target: { value: "주문번호를 묻지 않았습니다." },
    });
    fireEvent.change(screen.getByLabelText("기대 응답/행동"), {
      target: { value: "주문번호를 먼저 요청합니다." },
    });
    fireEvent.click(screen.getByRole("button", { name: "피드백 저장" }));

    await waitFor(() => {
      expect(mockedSimulationApi.createFeedback).toHaveBeenCalledWith(1, 10, {
        chatMessageId: 1,
        feedbackType: "MISSING_SLOT_QUESTION",
        description: "주문번호를 묻지 않았습니다.",
        expectedBehavior: "주문번호를 먼저 요청합니다.",
        severity: "HIGH",
      });
    });
  });

  it("세션을 바꾸면 피드백 입력 상태를 초기화한다", async () => {
    mockedSimulationApi.listSessions.mockResolvedValue({
      content: [session, otherSession],
      page: 0,
      size: 20,
      totalElements: 2,
      totalPages: 1,
    });
    renderPage();

    fireEvent.click(await screen.findByLabelText("Turn 1 피드백 대상 선택"));
    fireEvent.change(screen.getByLabelText("피드백 유형 선택"), {
      target: { value: "OTHER" },
    });
    fireEvent.change(screen.getByLabelText("피드백 심각도 선택"), {
      target: { value: "CRITICAL" },
    });
    fireEvent.change(screen.getByLabelText("설명"), {
      target: { value: "이전 세션 피드백" },
    });
    fireEvent.change(screen.getByLabelText("기대 응답/행동"), {
      target: { value: "다른 응답" },
    });

    fireEvent.click(await screen.findByRole("button", { name: /다른 고객/ }));

    await waitFor(() => {
      expect(mockedSimulationApi.getSession).toHaveBeenCalledWith(1, 20);
    });
    await waitFor(() => {
      expect(screen.getByLabelText("피드백 대상 선택")).toHaveValue("session");
    });
    expect(screen.getByLabelText("피드백 유형 선택")).toHaveValue("INTENT_MISMATCH");
    expect(screen.getByLabelText("피드백 심각도 선택")).toHaveValue("MEDIUM");
    expect(screen.getByLabelText("설명")).toHaveValue("");
    expect(screen.getByLabelText("기대 응답/행동")).toHaveValue("");
  });

  it("피드백 저장 후 목록 새로고침 실패는 저장 실패로 처리하지 않는다", async () => {
    renderPage();

    expect(await screen.findByText("환불하고 싶어요")).toBeInTheDocument();
    fireEvent.change(await screen.findByLabelText("설명"), {
      target: { value: "주문번호를 묻지 않았습니다." },
    });
    fireEvent.change(screen.getByLabelText("기대 응답/행동"), {
      target: { value: "주문번호를 먼저 요청합니다." },
    });
    mockedSimulationApi.listFeedback.mockRejectedValueOnce(new Error("refresh failed"));
    fireEvent.click(screen.getByRole("button", { name: "피드백 저장" }));

    await waitFor(() => {
      expect(mockedSimulationApi.createFeedback).toHaveBeenCalled();
    });
    expect(toast.success).toHaveBeenCalledWith("시뮬레이션 피드백을 남겼습니다.");
    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("피드백 목록 새로고침에 실패했습니다.");
    });
    expect(toast.error).not.toHaveBeenCalledWith("시뮬레이션 피드백을 저장하지 못했습니다.");
  });

  it("OPEN 피드백에서 개선 후보를 생성하고 목록을 새로고침한다", async () => {
    renderPage();

    fireEvent.click(await screen.findByRole("button", { name: "후보" }));

    await waitFor(() => {
      expect(mockedSimulationApi.createImprovementCandidate).toHaveBeenCalledWith(1, 900);
    });
    expect(toast.success).toHaveBeenCalledWith("개선 후보를 생성했습니다.");
    await waitFor(() => {
      expect(mockedSimulationApi.listFeedback).toHaveBeenCalledTimes(2);
      expect(mockedSimulationApi.listImprovementCandidates).toHaveBeenCalledTimes(2);
    });
  });

  it("개선 후보 생성 후 목록 새로고침 실패는 생성 실패로 처리하지 않는다", async () => {
    renderPage();

    await screen.findByText("환불하고 싶어요");
    mockedSimulationApi.listImprovementCandidates.mockRejectedValueOnce(
      new Error("refresh failed"),
    );
    fireEvent.click(screen.getByRole("button", { name: "후보" }));

    await waitFor(() => {
      expect(mockedSimulationApi.createImprovementCandidate).toHaveBeenCalledWith(1, 900);
    });
    expect(toast.success).toHaveBeenCalledWith("개선 후보를 생성했습니다.");
    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("개선 후보 목록 새로고침에 실패했습니다.");
    });
    expect(toast.error).not.toHaveBeenCalledWith("개선 후보를 생성하지 못했습니다.");
  });

  it("개선 후보 상태를 변경하고 후보 목록을 새로고침한다", async () => {
    mockedSimulationApi.listImprovementCandidates.mockResolvedValue({
      content: [candidate],
      page: 0,
      size: 20,
      totalElements: 1,
      totalPages: 1,
    });
    renderPage();

    fireEvent.click(await screen.findByRole("button", { name: "리뷰 요청" }));

    await waitFor(() => {
      expect(mockedSimulationApi.updateImprovementCandidateStatus).toHaveBeenCalledWith(1, 1000, {
        status: "READY_FOR_REVIEW",
      });
    });
    expect(toast.success).toHaveBeenCalledWith("개선 후보 상태를 변경했습니다.");
    await waitFor(() => {
      expect(mockedSimulationApi.listImprovementCandidates).toHaveBeenCalledTimes(2);
    });
  });

  it("개선 후보 상태 변경 후 목록 새로고침 실패는 변경 실패로 처리하지 않는다", async () => {
    mockedSimulationApi.listImprovementCandidates.mockResolvedValue({
      content: [candidate],
      page: 0,
      size: 20,
      totalElements: 1,
      totalPages: 1,
    });
    renderPage();

    const requestButton = await screen.findByRole("button", { name: "리뷰 요청" });
    mockedSimulationApi.listImprovementCandidates.mockRejectedValueOnce(
      new Error("refresh failed"),
    );
    fireEvent.click(requestButton);

    await waitFor(() => {
      expect(mockedSimulationApi.updateImprovementCandidateStatus).toHaveBeenCalledWith(1, 1000, {
        status: "READY_FOR_REVIEW",
      });
    });
    expect(toast.success).toHaveBeenCalledWith("개선 후보 상태를 변경했습니다.");
    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("개선 후보 목록 새로고침에 실패했습니다.");
    });
    expect(toast.error).not.toHaveBeenCalledWith("개선 후보 상태를 변경하지 못했습니다.");
  });

  it("개선 후보 유형 라벨을 표시한다", async () => {
    mockedSimulationApi.listImprovementCandidates.mockResolvedValue({
      content: [
        candidateWithType(1001, "INTENT_DESCRIPTION_EXAMPLE"),
        candidateWithType(1002, "POLICY_CONDITION"),
        candidateWithType(1003, "RISK_RULE"),
        candidateWithType(1004, "WORKFLOW_STATE_TRANSITION"),
        candidateWithType(1005, "HANDOFF_CONDITION"),
        candidateWithType(1006, "RESPONSE_COPY"),
        candidateWithType(1007, "OTHER"),
        candidateWithType(1008, "CUSTOM" as SimulationImprovementCandidate["candidateType"]),
      ],
      page: 0,
      size: 20,
      totalElements: 8,
      totalPages: 1,
    });
    renderPage();

    expect(await screen.findByText("intent 설명/예시")).toBeInTheDocument();
    expect(screen.getByText("policy 조건")).toBeInTheDocument();
    expect(screen.getByText("risk rule")).toBeInTheDocument();
    expect(screen.getByText("workflow 전이")).toBeInTheDocument();
    expect(screen.getByText("handoff 조건")).toBeInTheDocument();
    expect(screen.getByText("응답 문구")).toBeInTheDocument();
    expect(screen.getAllByText("기타")).toHaveLength(2);
    expect(screen.getByText("CUSTOM")).toBeInTheDocument();
    expect(screen.getAllByText("초안").length).toBeGreaterThan(0);
    expect(screen.getAllByText("변경 전").length).toBeGreaterThan(0);
    expect(screen.getAllByText("근거").length).toBeGreaterThan(0);
  });

  it("개선 후보 목록 로드 실패를 토스트로 알린다", async () => {
    mockedSimulationApi.listImprovementCandidates.mockRejectedValueOnce(new Error("load failed"));
    renderPage();

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("개선 후보 목록을 불러오지 못했습니다.");
    });
  });

  it("개선 후보 생성 실패를 토스트로 알린다", async () => {
    renderPage();

    await screen.findByText("환불하고 싶어요");
    mockedSimulationApi.createImprovementCandidate.mockRejectedValueOnce(
      new Error("create failed"),
    );
    fireEvent.click(screen.getByRole("button", { name: "후보" }));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("개선 후보를 생성하지 못했습니다.");
    });
  });

  it("개선 후보 상태 변경 실패를 토스트로 알린다", async () => {
    mockedSimulationApi.listImprovementCandidates.mockResolvedValue({
      content: [candidate],
      page: 0,
      size: 20,
      totalElements: 1,
      totalPages: 1,
    });
    renderPage();

    const requestButton = await screen.findByRole("button", { name: "리뷰 요청" });
    mockedSimulationApi.updateImprovementCandidateStatus.mockRejectedValueOnce(
      new Error("update failed"),
    );
    fireEvent.click(requestButton);

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("개선 후보 상태를 변경하지 못했습니다.");
    });
  });

  it("READY_FOR_REVIEW 개선 후보를 승인하고 목록을 새로고침한다", async () => {
    mockedSimulationApi.listImprovementCandidates.mockResolvedValue({
      content: [
        {
          ...candidate,
          status: "READY_FOR_REVIEW",
          reviewSessionId: 200,
          reviewTaskId: 300,
        },
      ],
      page: 0,
      size: 20,
      totalElements: 1,
      totalPages: 1,
    });
    renderPage();

    fireEvent.click(await screen.findByRole("button", { name: "승인" }));

    await waitFor(() => {
      expect(mockedSimulationApi.approveImprovementCandidate).toHaveBeenCalledWith(1, 1000, {
        reason: "시뮬레이션 리뷰 승인",
      });
    });
    expect(toast.success).toHaveBeenCalledWith("개선 후보를 초안 버전에 반영했습니다.");
    await waitFor(() => {
      expect(mockedSimulationApi.listImprovementCandidates).toHaveBeenCalledTimes(2);
      expect(mockedSimulationApi.listFeedback).toHaveBeenCalledTimes(2);
    });
  });

  it("READY_FOR_REVIEW 개선 후보를 반려하고 사유를 전달한다", async () => {
    mockedSimulationApi.listImprovementCandidates.mockResolvedValue({
      content: [
        {
          ...candidate,
          status: "READY_FOR_REVIEW",
          reviewSessionId: 200,
          reviewTaskId: 300,
        },
      ],
      page: 0,
      size: 20,
      totalElements: 1,
      totalPages: 1,
    });
    renderPage();

    fireEvent.change(await screen.findByLabelText("개선 후보 반려 사유"), {
      target: { value: "근거가 부족합니다." },
    });
    fireEvent.click(screen.getByRole("button", { name: "반려" }));

    await waitFor(() => {
      expect(mockedSimulationApi.rejectImprovementCandidate).toHaveBeenCalledWith(1, 1000, {
        reason: "근거가 부족합니다.",
      });
    });
    expect(toast.success).toHaveBeenCalledWith("개선 후보를 반려했습니다.");
  });

  it("현재 runtime snapshot을 검증 케이스로 저장한다", async () => {
    renderPage();

    await screen.findByText("환불하고 싶어요");
    fireEvent.change(await screen.findByLabelText("검증 케이스 이름"), {
      target: { value: "환불 주문번호 검증" },
    });
    fireEvent.change(await screen.findByLabelText("기대 action"), {
      target: { value: "ASK_SLOT" },
    });
    fireEvent.click(screen.getByRole("button", { name: "등록" }));

    await waitFor(() => {
      expect(mockedSimulationApi.createGoldenCase).toHaveBeenCalledWith(1, 10, {
        name: "환불 주문번호 검증",
        expectedIntentCode: "refund_request",
        expectedWorkflowCode: "refund_workflow",
        expectedCurrentState: "collect_order_no",
        expectedActionType: "ASK_SLOT",
        expectedSlotValues: { orderNo: "A-100" },
      });
    });
    expect(toast.success).toHaveBeenCalledWith("검증 케이스를 저장했습니다.");
  });

  it("저장된 검증 케이스를 선택 version으로 replay한다", async () => {
    mockedSimulationApi.listGoldenCases.mockResolvedValue({
      content: [goldenCase],
      page: 0,
      size: 20,
      totalElements: 1,
      totalPages: 1,
    });
    renderPage();

    await screen.findByText("환불하고 싶어요");
    fireEvent.click(await screen.findByRole("button", { name: "환불 검증 replay" }));

    await waitFor(() => {
      expect(mockedSimulationApi.replayGoldenCase).toHaveBeenCalledWith(1, 950, {
        domainPackVersionId: 101,
      });
    });
    expect(toast.success).toHaveBeenCalledWith("검증 케이스 replay가 통과했습니다.");
  });

  it("최근 replay 실패 요약을 검증 케이스 목록에 표시한다", async () => {
    mockedSimulationApi.listGoldenCases.mockResolvedValue({
      content: [
        {
          ...goldenCase,
          latestReplayResult: failedReplayResult,
        },
      ],
      page: 0,
      size: 20,
      totalElements: 1,
      totalPages: 1,
    });
    renderPage();

    expect(await screen.findByText("FAIL")).toBeInTheDocument();
    expect(
      screen.getByText("currentState expected collect_order_no but was handoff"),
    ).toBeInTheDocument();
  });

  it("Replay version이 비어 있으면 replay 요청을 보내지 않는다", async () => {
    mockedSimulationApi.listGoldenCases.mockResolvedValue({
      content: [goldenCase],
      page: 0,
      size: 20,
      totalElements: 1,
      totalPages: 1,
    });
    renderPage();

    await screen.findByRole("button", { name: "환불 검증 replay" });
    await waitFor(() => {
      expect(screen.getByLabelText("Replay version")).toHaveValue("101");
    });
    fireEvent.change(screen.getByLabelText("Replay version"), {
      target: { value: "" },
    });
    fireEvent.click(screen.getByRole("button", { name: "환불 검증 replay" }));

    expect(toast.error).toHaveBeenCalledWith("Replay version을 입력하세요.");
    expect(mockedSimulationApi.replayGoldenCase).not.toHaveBeenCalled();
  });

  it("개선 후보 상태 필터를 변경해 목록을 다시 조회한다", async () => {
    renderPage();

    fireEvent.change(await screen.findByLabelText("개선 후보 상태 필터"), {
      target: { value: "READY_FOR_REVIEW" },
    });

    await waitFor(() => {
      expect(mockedSimulationApi.listImprovementCandidates).toHaveBeenCalledWith(1, {
        status: "READY_FOR_REVIEW",
        page: 0,
        size: 20,
      });
    });
  });

  it("Enter 키로 고객 메시지를 전송한다", async () => {
    renderPage();

    const input = await screen.findByPlaceholderText("고객 역할 메시지 입력");
    fireEvent.change(input, {
      target: { value: "A-100 주문 환불이요" },
    });
    fireEvent.keyDown(input, { key: "Enter", shiftKey: false });

    await waitFor(() => {
      expect(mockedSimulationApi.sendMessage).toHaveBeenCalledWith(1, 10, {
        content: "A-100 주문 환불이요",
      });
    });
  });
});
