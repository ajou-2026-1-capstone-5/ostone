import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { toast } from "sonner";

import { WorkspaceSimulationPage } from "./WorkspaceSimulationPage";
import {
  simulationApi,
  type SimulationFeedbackType,
  type SimulationImprovementCandidate,
} from "@/features/simulation";
import { useListAllWorkspaceWorkflows } from "@/entities/workflow";

const setCrumbs = vi.fn();

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return {
    ...actual,
    useOutletContext: () => ({
      setCrumbs,
      workspace: { id: 1, name: "CS Team" },
    }),
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

function feedbackWithType(id: number, feedbackType: SimulationFeedbackType) {
  return {
    ...detail.feedback.items[0],
    id,
    feedbackType,
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

function renderPage(path = "/workspaces/1/simulation", state?: unknown) {
  render(
    <MemoryRouter initialEntries={[state === undefined ? path : { pathname: path, state }]}>
      <Routes>
        <Route path="/workspaces/:workspaceId/simulation" element={<WorkspaceSimulationPage />} />
        <Route path="/workspaces" element={<div data-testid="workspace-root" />} />
      </Routes>
    </MemoryRouter>,
  );
}

async function openFeedbackTab() {
  fireEvent.click(await screen.findByRole("tab", { name: "피드백" }));
}

async function openCandidateTab() {
  fireEvent.click(await screen.findByRole("tab", { name: "개선 후보" }));
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
    expect(screen.getAllByText("collect_order_no").length).toBeGreaterThan(0);
    expect(screen.getByText("A-100")).toBeInTheDocument();
  });

  it("대시보드 추천 query로 피드백과 개선 후보 상태 필터를 초기화한다", async () => {
    renderPage("/workspaces/1/simulation?feedbackStatus=RESOLVED&candidateStatus=READY_FOR_REVIEW");

    await openFeedbackTab();
    expect(await screen.findByLabelText("피드백 상태 필터")).toHaveValue("RESOLVED");
    await openCandidateTab();
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

  it("query 검증 대상을 상단에 표시하고 시작 workflow 기본값으로 사용한다", async () => {
    renderPage("/workspaces/1/simulation?packId=11&versionId=22&workflowId=100");

    expect(await screen.findByText("Verification Target")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "환불 처리" })).toBeInTheDocument();
    expect(screen.getByText("CS Support · Version #22 · refund.standard")).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByLabelText("시작 workflow 선택")).toHaveValue("100");
    });

    fireEvent.click(screen.getByRole("button", { name: "세션 생성" }));

    await waitFor(() => {
      expect(mockedSimulationApi.createSession).toHaveBeenCalledWith(1, {
        customerName: "시뮬레이션 고객",
        workflowDefinitionId: 100,
      });
    });
  });

  it("route state 검증 대상도 상단 대상과 시작 workflow 기본값으로 사용한다", async () => {
    renderPage("/workspaces/1/simulation", {
      simulationTarget: {
        packId: 11,
        versionId: 22,
        workflowId: 100,
      },
    });

    expect(await screen.findByText("Verification Target")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "환불 처리" })).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByLabelText("시작 workflow 선택")).toHaveValue("100");
    });
  });

  it("query 검증 대상이 있어도 사용자가 자동 매칭을 선택하면 workflow를 고정하지 않는다", async () => {
    renderPage("/workspaces/1/simulation?packId=11&versionId=22&workflowId=100");

    const workflowSelect = await screen.findByLabelText("시작 workflow 선택");
    await waitFor(() => {
      expect(workflowSelect).toHaveValue("100");
    });

    fireEvent.change(workflowSelect, { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: "세션 생성" }));

    await waitFor(() => {
      expect(mockedSimulationApi.createSession).toHaveBeenCalledWith(1, {
        customerName: "시뮬레이션 고객",
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
    expect(screen.getByRole("tab", { name: "피드백" })).toHaveAttribute("aria-selected", "true");
    expect(await screen.findByLabelText("피드백 대상 선택")).toHaveValue("1");
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
    await openFeedbackTab();
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
      expect(screen.getByText("시뮬레이션 피드백 목록을 불러오지 못했습니다.")).toBeInTheDocument();
    });
    expect(toast.error).not.toHaveBeenCalledWith("시뮬레이션 피드백 목록을 불러오지 못했습니다.");
    expect(toast.error).not.toHaveBeenCalledWith("시뮬레이션 피드백을 저장하지 못했습니다.");
  });

  it("피드백 목록 로드 실패는 패널 내부 오류와 재시도를 제공한다", async () => {
    mockedSimulationApi.listFeedback.mockRejectedValueOnce(new Error("load failed"));
    renderPage();

    await openFeedbackTab();
    expect(
      await screen.findByText("시뮬레이션 피드백 목록을 불러오지 못했습니다."),
    ).toBeInTheDocument();
    expect(toast.error).not.toHaveBeenCalledWith("시뮬레이션 피드백 목록을 불러오지 못했습니다.");

    fireEvent.click(screen.getByRole("button", { name: "다시 시도" }));

    expect(await screen.findByText("주문번호를 묻지 않았습니다.")).toBeInTheDocument();
  });

  it("검증 케이스 목록 로드 실패는 패널 내부 오류로 표시한다", async () => {
    mockedSimulationApi.listGoldenCases.mockRejectedValueOnce(new Error("load failed"));
    renderPage();

    expect(await screen.findByText("검증 케이스 목록을 불러오지 못했습니다.")).toBeInTheDocument();
    expect(toast.error).not.toHaveBeenCalledWith("검증 케이스 목록을 불러오지 못했습니다.");

    fireEvent.click(screen.getByRole("button", { name: "다시 시도" }));

    expect(await screen.findByText("저장된 검증 케이스가 없습니다.")).toBeInTheDocument();
  });

  it("OPEN 피드백에서 개선 후보를 생성하고 목록을 새로고침한다", async () => {
    renderPage();

    await openFeedbackTab();
    expect(await screen.findByLabelText("피드백 #900 개선 대상 선택")).toHaveValue("SLOT");
    expect(screen.getByText("세부 element 미선택")).toBeInTheDocument();
    expect(screen.getByText("현재 화면은 세부 element 선택을 지원하지 않아 target type까지만 후보에 저장합니다.")).toBeInTheDocument();
    fireEvent.click(await screen.findByRole("button", { name: "후보" }));

    await waitFor(() => {
      expect(mockedSimulationApi.createImprovementCandidate).toHaveBeenCalledWith(
        1,
        900,
        expect.objectContaining({
          targetElementType: "SLOT",
          beforeSummary: "Slot 개선 후보 (환불 처리 workflow 맥락): 주문번호를 묻지 않았습니다.",
          afterSummary: "주문번호를 먼저 요청합니다.",
        }),
      );
    });
    expect(toast.success).toHaveBeenCalledWith("개선 후보를 생성했습니다.");
    await waitFor(() => {
      expect(mockedSimulationApi.listFeedback).toHaveBeenCalledTimes(2);
      expect(mockedSimulationApi.listImprovementCandidates).toHaveBeenCalledTimes(2);
    });
  });

  it("개선 후보 target을 workflow로 바꾸면 기존 workflow context payload를 유지한다", async () => {
    renderPage();

    await openFeedbackTab();
    fireEvent.change(await screen.findByLabelText("피드백 #900 개선 대상 선택"), {
      target: { value: "WORKFLOW" },
    });
    expect(screen.getByText("#100 · refund_workflow")).toBeInTheDocument();
    expect(screen.getByText("환불 처리 workflow id/key를 후보에 함께 저장합니다.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "후보" }));

    await waitFor(() => {
      expect(mockedSimulationApi.createImprovementCandidate).toHaveBeenCalledWith(
        1,
        900,
        expect.objectContaining({
          targetElementType: "WORKFLOW",
          targetElementId: 100,
          targetElementKey: "refund_workflow",
          beforeSummary: "Workflow 개선 후보 (환불 처리 workflow 맥락): 주문번호를 묻지 않았습니다.",
          afterSummary: "주문번호를 먼저 요청합니다.",
        }),
      );
    });
  });

  it("개선 후보 target을 policy로 바꿔 생성할 수 있다", async () => {
    renderPage();

    await openFeedbackTab();
    fireEvent.change(await screen.findByLabelText("피드백 #900 개선 대상 선택"), {
      target: { value: "POLICY" },
    });
    fireEvent.click(screen.getByRole("button", { name: "후보" }));

    await waitFor(() => {
      expect(mockedSimulationApi.createImprovementCandidate).toHaveBeenCalledWith(
        1,
        900,
        expect.objectContaining({
          targetElementType: "POLICY",
          beforeSummary: "Policy 개선 후보 (환불 처리 workflow 맥락): 주문번호를 묻지 않았습니다.",
        }),
      );
    });
  });

  it("feedback type별 기본 개선 대상을 서로 다르게 표시한다", async () => {
    mockedSimulationApi.listFeedback.mockResolvedValue({
      content: [
        feedbackWithType(901, "INTENT_MISMATCH"),
        feedbackWithType(902, "MISSING_SLOT_QUESTION"),
        feedbackWithType(903, "POLICY_CONDITION_MISSING"),
        feedbackWithType(904, "RISK_HANDOFF_REQUIRED"),
        feedbackWithType(905, "WORKFLOW_BRANCH_ERROR"),
        feedbackWithType(906, "INAPPROPRIATE_RESPONSE"),
        feedbackWithType(907, "OTHER"),
      ],
      page: 0,
      size: 20,
      totalElements: 7,
      totalPages: 1,
    });
    renderPage();

    await openFeedbackTab();

    expect(await screen.findByLabelText("피드백 #901 개선 대상 선택")).toHaveValue("INTENT");
    expect(screen.getByLabelText("피드백 #902 개선 대상 선택")).toHaveValue("SLOT");
    expect(screen.getByLabelText("피드백 #903 개선 대상 선택")).toHaveValue("POLICY");
    expect(screen.getByLabelText("피드백 #904 개선 대상 선택")).toHaveValue("RISK_RULE");
    expect(screen.getByLabelText("피드백 #905 개선 대상 선택")).toHaveValue("WORKFLOW");
    expect(screen.getByLabelText("피드백 #906 개선 대상 선택")).toHaveValue("RESPONSE");
    expect(screen.getByLabelText("피드백 #907 개선 대상 선택")).toHaveValue("UNKNOWN");
    expect(screen.getByText("기타 피드백은 구체 대상이 확정되지 않은 제한 상태로 후보화됩니다.")).toBeInTheDocument();
  });

  it("workflow 맥락이 없으면 workflow target type만 후보 payload에 보존한다", async () => {
    mockedWorkflows.mockReturnValue({
      loading: false,
      error: null,
      entries: [],
    });
    mockedSimulationApi.getSession.mockResolvedValue({
      ...detail,
      matchedWorkflow: null,
    });
    mockedSimulationApi.listFeedback.mockResolvedValue({
      content: [feedbackWithType(905, "WORKFLOW_BRANCH_ERROR")],
      page: 0,
      size: 20,
      totalElements: 1,
      totalPages: 1,
    });
    renderPage();

    await openFeedbackTab();
    expect(
      await screen.findByText("workflow 맥락이 확인되지 않아 target type만 후보에 저장됩니다."),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "후보" }));

    await waitFor(() => {
      expect(mockedSimulationApi.createImprovementCandidate).toHaveBeenCalledWith(
        1,
        905,
        expect.objectContaining({
          targetElementType: "WORKFLOW",
          beforeSummary: "Workflow 개선 후보: 주문번호를 묻지 않았습니다.",
        }),
      );
    });
    expect(mockedSimulationApi.createImprovementCandidate).toHaveBeenCalledWith(
      1,
      905,
      expect.not.objectContaining({
        targetElementId: expect.any(Number),
      }),
    );
  });

  it("개선 후보 생성 후 목록 새로고침 실패는 생성 실패로 처리하지 않는다", async () => {
    renderPage();

    await screen.findByText("환불하고 싶어요");
    await openFeedbackTab();
    mockedSimulationApi.listImprovementCandidates.mockRejectedValueOnce(
      new Error("refresh failed"),
    );
    fireEvent.click(screen.getByRole("button", { name: "후보" }));

    await waitFor(() => {
      expect(mockedSimulationApi.createImprovementCandidate).toHaveBeenCalledWith(
        1,
        900,
        expect.objectContaining({
          targetElementType: "SLOT",
        }),
      );
    });
    expect(toast.success).toHaveBeenCalledWith("개선 후보를 생성했습니다.");
    await waitFor(() => {
      expect(screen.getByText("개선 후보 목록을 불러오지 못했습니다.")).toBeInTheDocument();
    });
    expect(toast.error).not.toHaveBeenCalledWith("개선 후보 목록을 불러오지 못했습니다.");
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

    await openCandidateTab();
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
    expect(screen.getByRole("tab", { name: "개선 후보" })).toHaveAttribute("aria-selected", "true");
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

    await openCandidateTab();
    const requestButton = await screen.findByRole("button", {
      name: "리뷰 요청",
    });
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
      expect(screen.getByText("개선 후보 목록을 불러오지 못했습니다.")).toBeInTheDocument();
    });
    expect(toast.error).not.toHaveBeenCalledWith("개선 후보 목록을 불러오지 못했습니다.");
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

    await openCandidateTab();
    expect(screen.getByRole("tab", { name: "개선 후보" })).toHaveAttribute("aria-selected", "true");
    expect(await screen.findByText("intent 설명/예시")).toBeInTheDocument();
    expect(screen.getByText("policy 조건")).toBeInTheDocument();
    expect(screen.getByText("risk rule")).toBeInTheDocument();
    expect(screen.getByText("workflow 전이")).toBeInTheDocument();
    expect(screen.getByText("handoff 조건")).toBeInTheDocument();
    expect(screen.getByText("응답 문구")).toBeInTheDocument();
    expect(screen.getAllByText("기타")).toHaveLength(1);
    expect(screen.getByText("CUSTOM")).toBeInTheDocument();
    expect(screen.getAllByText("초안").length).toBeGreaterThan(0);
    expect(screen.getAllByText("변경 전").length).toBeGreaterThan(0);
    expect(screen.getAllByText("근거").length).toBeGreaterThan(0);
  });

  it("개선 후보 목록 로드 실패는 패널 내부 오류와 재시도를 제공한다", async () => {
    mockedSimulationApi.listImprovementCandidates.mockRejectedValueOnce(new Error("load failed"));
    renderPage();

    await openCandidateTab();
    expect(await screen.findByText("개선 후보 목록을 불러오지 못했습니다.")).toBeInTheDocument();
    expect(toast.error).not.toHaveBeenCalledWith("개선 후보 목록을 불러오지 못했습니다.");

    fireEvent.click(screen.getByRole("button", { name: "다시 시도" }));

    expect(await screen.findByText("조건에 맞는 개선 후보가 없습니다.")).toBeInTheDocument();
  });

  it("개선 후보 생성 실패를 토스트로 알린다", async () => {
    renderPage();

    await screen.findByText("환불하고 싶어요");
    await openFeedbackTab();
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

    await openCandidateTab();
    const requestButton = await screen.findByRole("button", {
      name: "리뷰 요청",
    });
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

    await openCandidateTab();
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

  it("반려 사유가 없으면 READY_FOR_REVIEW 개선 후보를 반려하지 않는다", async () => {
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

    await openCandidateTab();
    fireEvent.click(await screen.findByRole("button", { name: "반려" }));

    expect(toast.error).toHaveBeenCalledWith("반려 사유를 입력하세요.");
    expect(mockedSimulationApi.rejectImprovementCandidate).not.toHaveBeenCalled();
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

    await openCandidateTab();
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

  it("현재 실행 결과와 구분한 기대 결과를 검증 케이스로 저장한다", async () => {
    renderPage();

    await screen.findByText("환불하고 싶어요");
    expect(screen.getByText("현재 실행 결과")).toBeInTheDocument();
    expect(screen.getByText("기대 결과")).toBeInTheDocument();
    fireEvent.change(await screen.findByLabelText("검증 케이스 이름"), {
      target: { value: "환불 주문번호 검증" },
    });
    fireEvent.change(screen.getByLabelText("기대 intent"), {
      target: { value: "refund_order_number_required" },
    });
    fireEvent.change(screen.getByLabelText("기대 workflow"), {
      target: { value: "refund_required_slot_workflow" },
    });
    fireEvent.change(screen.getByLabelText("기대 state"), {
      target: { value: "ask_order_no" },
    });
    fireEvent.change(await screen.findByLabelText("기대 action"), {
      target: { value: "ASK_SLOT" },
    });
    fireEvent.change(screen.getByLabelText("필수 slot JSON"), {
      target: { value: '{"orderNo":"B-200"}' },
    });
    fireEvent.click(screen.getByRole("button", { name: "등록" }));

    await waitFor(() => {
      expect(mockedSimulationApi.createGoldenCase).toHaveBeenCalledWith(1, 10, {
        name: "환불 주문번호 검증",
        expectedIntentCode: "refund_order_number_required",
        expectedWorkflowCode: "refund_required_slot_workflow",
        expectedCurrentState: "ask_order_no",
        expectedActionType: "ASK_SLOT",
        expectedSlotValues: { orderNo: "B-200" },
      });
    });
    expect(toast.success).toHaveBeenCalledWith("검증 케이스를 저장했습니다.");
  });

  it("기대 intent, workflow, action 확인 전에는 검증 케이스를 저장하지 않는다", async () => {
    renderPage();

    await screen.findByText("환불하고 싶어요");
    await waitFor(() => {
      expect(screen.getByLabelText("기대 intent")).toHaveValue("refund_request");
    });
    fireEvent.change(screen.getByLabelText("기대 intent"), {
      target: { value: "" },
    });
    fireEvent.change(screen.getByLabelText("기대 action"), {
      target: { value: "ASK_SLOT" },
    });
    fireEvent.click(screen.getByRole("button", { name: "등록" }));

    expect(toast.error).toHaveBeenCalledWith("기대 intent, workflow, action을 확인하세요.");
    expect(mockedSimulationApi.createGoldenCase).not.toHaveBeenCalled();
  });

  it("필수 slot JSON이 객체가 아니면 검증 케이스를 저장하지 않는다", async () => {
    renderPage();

    await screen.findByText("환불하고 싶어요");
    await waitFor(() => {
      expect(screen.getByLabelText("기대 intent")).toHaveValue("refund_request");
    });
    fireEvent.change(screen.getByLabelText("기대 action"), {
      target: { value: "ASK_SLOT" },
    });
    fireEvent.change(screen.getByLabelText("필수 slot JSON"), {
      target: { value: '["orderNo"]' },
    });
    fireEvent.click(screen.getByRole("button", { name: "등록" }));

    expect(toast.error).toHaveBeenCalledWith("필수 slot은 JSON 객체로 입력하세요.");
    expect(mockedSimulationApi.createGoldenCase).not.toHaveBeenCalled();
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
    await waitFor(() => {
      expect(screen.getByLabelText("Replay version")).toHaveValue("101");
    });
    fireEvent.click(await screen.findByRole("button", { name: "환불 검증 replay" }));

    await waitFor(() => {
      expect(mockedSimulationApi.replayGoldenCase).toHaveBeenCalledWith(1, 950, {
        domainPackVersionId: 101,
      });
    });
    expect(toast.success).toHaveBeenCalledWith("검증 케이스 replay가 통과했습니다.");
  });

  it("query target version을 replay version 기본값으로 사용한다", async () => {
    mockedSimulationApi.listGoldenCases.mockResolvedValue({
      content: [goldenCase],
      page: 0,
      size: 20,
      totalElements: 1,
      totalPages: 1,
    });
    renderPage("/workspaces/1/simulation?packId=11&versionId=22&workflowId=100");

    await screen.findByText("환불하고 싶어요");
    await waitFor(() => {
      expect(screen.getByLabelText("Replay version")).toHaveValue("22");
    });
    fireEvent.click(await screen.findByRole("button", { name: "환불 검증 replay" }));

    await waitFor(() => {
      expect(mockedSimulationApi.replayGoldenCase).toHaveBeenCalledWith(1, 950, {
        domainPackVersionId: 22,
      });
    });
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

    await openCandidateTab();
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
