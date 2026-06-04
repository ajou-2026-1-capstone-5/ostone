import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { toast } from "sonner";

import { WorkspaceSimulationPage } from "./WorkspaceSimulationPage";
import { simulationApi } from "@/features/simulation";
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
    intentName: "환불 문의",
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
