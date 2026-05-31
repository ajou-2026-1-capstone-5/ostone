import { describe, it, expect, vi, beforeEach } from "vitest";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import "@testing-library/jest-dom/vitest";
import { ConsultationPage } from "./ConsultationPage";
import { consultationApi } from "../../../features/consultation/api/consultationApi";
import { getCurrentWorkflow } from "../../../features/consultation/api/llmToolWorkflowApi";
import { toast } from "sonner";

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

type RealtimePayload = {
  id?: string | number;
  senderRole?: string;
  content?: string | null;
  createdAt?: string | null;
  timestamp?: string | null;
  type?: string;
  session?: Record<string, unknown>;
};

const { mockSubscribe, mockSendTo, stompState } = vi.hoisted(() => {
  const mockUnsubscribe = vi.fn();
  const stompState = {
    connectionStatus: "CONNECTED" as "CONNECTED" | "DISCONNECTED",
    latestCallback: null as ((msg: RealtimePayload) => void) | null,
    callbacks: new Map<string, (msg: RealtimePayload) => void>(),
  };
  return {
    mockUnsubscribe,
    mockSubscribe: vi.fn((topic: string, callback: (msg: RealtimePayload) => void) => {
      stompState.latestCallback = callback;
      stompState.callbacks.set(topic, callback);
      return mockUnsubscribe;
    }),
    mockSendTo: vi.fn(),
    stompState,
  };
});

const shellContext = {
  setTopbarRight: vi.fn(),
  setCrumbs: vi.fn(),
  workspace: { id: 2, name: "QA Alpha" } as { id: number; name: string } | null,
};

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return {
    ...actual,
    useOutletContext: () => shellContext,
  };
});

vi.mock("../../../features/consultation/api/consultationApi", () => ({
  consultationApi: {
    getQueue: vi.fn(() =>
      Promise.resolve([
        {
          id: 1,
          status: "OPEN",
          channel: "카카오톡",
          metaJson: JSON.stringify({ customerName: "김민지", handoffReason: "환불 문의" }),
          startedAt: new Date(Date.now() - 4 * 60000).toISOString(),
        },
      ]),
    ),
    getMessages: vi.fn(() =>
      Promise.resolve([
        {
          id: 100,
          seqNo: 1,
          senderRole: "CUSTOMER",
          messageType: "TEXT",
          content: "환불 문의 드립니다.",
          createdAt: new Date().toISOString(),
        },
      ]),
    ),
    updateStatus: vi.fn(() => Promise.resolve({})),
    assignSession: vi.fn((_sessionId: number, counselorId: number) =>
      Promise.resolve({
        id: 1,
        status: "ACTIVE",
        channel: "카카오톡",
        metaJson: JSON.stringify({ customerName: "김민지", handoffReason: "환불 문의" }),
        startedAt: new Date(Date.now() - 4 * 60000).toISOString(),
        assignedCounselorId: counselorId,
      }),
    ),
    releaseSession: vi.fn(() =>
      Promise.resolve({
        id: 1,
        status: "OPEN",
        channel: "카카오톡",
        metaJson: JSON.stringify({ customerName: "김민지", handoffReason: "환불 문의" }),
        startedAt: new Date(Date.now() - 4 * 60000).toISOString(),
        assignedCounselorId: null,
      }),
    ),
    getMetrics: vi.fn(() =>
      Promise.resolve({
        workspaceId: 2,
        periodStart: "2026-05-27T00:00:00+09:00",
        periodEnd: "2026-05-28T00:00:00+09:00",
        averageFirstResponseSeconds: 134,
        averageLlmFirstResponseSeconds: 3,
        averageHumanFirstResponseSeconds: 420,
        handledTodayCount: 14,
        llmHandledTodayCount: 9,
        humanHandledTodayCount: 5,
      }),
    ),
    sendMessage: vi.fn((_sessionId: number, content: string, isNote = false) =>
      Promise.resolve({
        id: 200,
        seqNo: 2,
        senderRole: isNote ? "NOTE" : "AGENT",
        messageType: "TEXT",
        content,
        createdAt: new Date().toISOString(),
      }),
    ),
  },
}));

vi.mock("../../../features/consultation/api/llmToolWorkflowApi", () => ({
  getCurrentWorkflow: vi.fn(() => Promise.resolve(null)),
  isMatchedWorkflow: (payload: unknown) =>
    !!payload && (payload as { workflowDefinitionId?: number | null }).workflowDefinitionId != null,
}));

vi.mock("@/shared/lib/websocket", () => ({
  useStomp: () => ({
    connectionStatus: stompState.connectionStatus,
    subscribe: mockSubscribe,
    sendTo: mockSendTo,
    sendMessage: vi.fn(),
    lastMessage: null,
    connect: vi.fn(),
    disconnect: vi.fn(),
  }),
}));

function Wrapper({ children }: { children: React.ReactNode }) {
  return <MemoryRouter>{children}</MemoryRouter>;
}

function saveTestUser(id: number) {
  window.localStorage.setItem(
    "user",
    JSON.stringify({ id, email: "agent@example.com", name: "상담사", role: "OPERATOR" }),
  );
}

describe("ConsultationPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    stompState.connectionStatus = "CONNECTED";
    stompState.latestCallback = null;
    stompState.callbacks.clear();
    shellContext.workspace = { id: 2, name: "QA Alpha" };
    window.alert = vi.fn();
    window.localStorage.clear();
    saveTestUser(7);
  });

  const getLatestTopbarNode = () => {
    const node = [...shellContext.setTopbarRight.mock.calls]
      .reverse()
      .find(([value]) => value !== undefined)?.[0];
    if (!node) {
      throw new Error("Topbar node was not set");
    }
    return node as React.ReactElement<{
      metricsViewState?: "loading" | "error" | "empty" | "ready";
      averageFirstResponseSeconds?: number | null;
      handledTodayCount?: number | null;
    }>;
  };

  const renderLatestTopbar = () => {
    const node = getLatestTopbarNode();
    return render(<>{node}</>);
  };

  it("loads consultation metrics and renders the topbar values", async () => {
    render(<ConsultationPage />, { wrapper: Wrapper });

    await waitFor(() => {
      expect(consultationApi.getMetrics).toHaveBeenCalledWith(2);
    });

    await waitFor(() => {
      expect(getLatestTopbarNode().props.averageFirstResponseSeconds).toBe(134);
    });
    const topbar = renderLatestTopbar();
    expect(topbar.getByText("2분 14초")).toBeInTheDocument();
    expect(topbar.getByText("14건")).toBeInTheDocument();
    topbar.unmount();
  });

  it("renders metric loading state while the request is pending", async () => {
    vi.mocked(consultationApi.getMetrics).mockImplementationOnce(() => new Promise(() => {}));

    const { unmount } = render(<ConsultationPage />, { wrapper: Wrapper });

    await waitFor(() => {
      expect(getLatestTopbarNode().props.metricsViewState).toBe("loading");
    });
    const topbar = renderLatestTopbar();
    expect(topbar.getAllByText("로딩중")).toHaveLength(2);
    topbar.unmount();
    unmount();
  });

  it("renders metric fallbacks when average value is null", async () => {
    vi.mocked(consultationApi.getMetrics).mockResolvedValueOnce({
      workspaceId: 2,
      periodStart: "2026-05-27T00:00:00+09:00",
      periodEnd: "2026-05-28T00:00:00+09:00",
      averageFirstResponseSeconds: null,
      averageLlmFirstResponseSeconds: null,
      averageHumanFirstResponseSeconds: null,
      handledTodayCount: 0,
      llmHandledTodayCount: 0,
      humanHandledTodayCount: 0,
    });

    render(<ConsultationPage />, { wrapper: Wrapper });

    await waitFor(() => {
      expect(consultationApi.getMetrics).toHaveBeenCalledWith(2);
    });

    await waitFor(() => {
      expect(getLatestTopbarNode().props.handledTodayCount).toBe(0);
    });
    const topbar = renderLatestTopbar();
    expect(topbar.getByText("--")).toBeInTheDocument();
    expect(topbar.getByText("0건")).toBeInTheDocument();
    topbar.unmount();
  });

  it("renders metric error state and shows a toast once when metrics fail", async () => {
    vi.mocked(consultationApi.getMetrics).mockRejectedValueOnce(new Error("Metrics failed"));

    render(<ConsultationPage />, { wrapper: Wrapper });

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("상담 지표를 불러오지 못했습니다.");
    });
    expect(toast.error).toHaveBeenCalledTimes(1);

    await waitFor(() => {
      expect(getLatestTopbarNode().props.metricsViewState).toBe("error");
    });
    const topbar = renderLatestTopbar();
    expect(topbar.getAllByText("오류")).toHaveLength(2);
    topbar.unmount();
  });

  it("renders 3-pane structure with QueuePanel, ChatPanel, and CustomerPanel", async () => {
    render(<ConsultationPage />, { wrapper: Wrapper });

    await waitFor(() => {
      expect(screen.getByText("김민지")).toBeInTheDocument();
    });

    expect(consultationApi.getQueue).toHaveBeenCalledWith(2);
    expect(mockSubscribe).toHaveBeenCalledWith(
      "/topic/workspaces.2.consultation.queue",
      expect.any(Function),
    );
    expect(screen.getByText("대기 고객")).toBeInTheDocument();
    expect(screen.getByText("좌측 대기 목록에서 고객을 선택해주세요")).toBeInTheDocument();
    expect(screen.getByText("고객을 선택하면 정보가 표시됩니다")).toBeInTheDocument();
  });

  describe("MatchedWorkflowBar integration", () => {
    const matchedPayload = {
      sessionId: 1,
      workspaceId: 2,
      domainPackId: 42,
      domainPackVersionId: 12,
      executionId: 41,
      executionStatus: "RUNNING",
      currentState: "COLLECT_INFO",
      workflowDefinitionId: 88,
      workflowCode: "REFUND_FLOW",
      workflowName: "환불 워크플로우",
      workflowDescription: "환불 흐름",
      graphJson: { nodes: [{ id: "n1", type: "START", label: "start" }], edges: [] },
    };

    it("does not render the bar or skeleton when no session is active", async () => {
      render(<ConsultationPage />, { wrapper: Wrapper });

      await waitFor(() => {
        expect(screen.getByText("김민지")).toBeInTheDocument();
      });

      expect(screen.queryByTestId("matched-workflow-bar")).not.toBeInTheDocument();
      expect(screen.queryByTestId("matched-workflow-bar-skeleton")).not.toBeInTheDocument();
      expect(getCurrentWorkflow).not.toHaveBeenCalled();
    });

    it("shows skeleton immediately after selecting a session and replaces it once workflow is matched", async () => {
      let resolveFetch: ((value: typeof matchedPayload) => void) | null = null;
      vi.mocked(getCurrentWorkflow).mockImplementationOnce(
        () =>
          new Promise<typeof matchedPayload>((resolve) => {
            resolveFetch = resolve;
          }),
      );

      render(<ConsultationPage />, { wrapper: Wrapper });

      await waitFor(() => {
        expect(screen.getByText("김민지")).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText("김민지"));

      await waitFor(() => {
        expect(screen.getByTestId("matched-workflow-bar-skeleton")).toBeInTheDocument();
      });
      expect(screen.queryByTestId("matched-workflow-bar")).not.toBeInTheDocument();

      await act(async () => {
        resolveFetch?.(matchedPayload);
      });

      await waitFor(() => {
        expect(screen.getByTestId("matched-workflow-bar")).toBeInTheDocument();
      });
      expect(screen.queryByTestId("matched-workflow-bar-skeleton")).not.toBeInTheDocument();
      expect(screen.getByTestId("matched-workflow-bar-title")).toHaveTextContent("환불 워크플로우");
      // collapsed by default — meta only appears after toggle
      expect(screen.queryByTestId("matched-workflow-bar-meta")).not.toBeInTheDocument();
    });

    it("hides both skeleton and bar when the workflow lookup returns null", async () => {
      vi.mocked(getCurrentWorkflow).mockResolvedValueOnce(null);

      render(<ConsultationPage />, { wrapper: Wrapper });

      await waitFor(() => {
        expect(screen.getByText("김민지")).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText("김민지"));

      await waitFor(() => {
        expect(getCurrentWorkflow).toHaveBeenCalledWith(1);
      });

      await waitFor(() => {
        expect(screen.queryByTestId("matched-workflow-bar-skeleton")).not.toBeInTheDocument();
      });
      expect(screen.queryByTestId("matched-workflow-bar")).not.toBeInTheDocument();
    });

    it("hides the bar without showing an error toast when the workflow lookup fails", async () => {
      vi.mocked(getCurrentWorkflow).mockRejectedValueOnce(new Error("boom"));

      render(<ConsultationPage />, { wrapper: Wrapper });

      await waitFor(() => {
        expect(screen.getByText("김민지")).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText("김민지"));

      await waitFor(() => {
        expect(getCurrentWorkflow).toHaveBeenCalledWith(1);
      });

      await waitFor(() => {
        expect(screen.queryByTestId("matched-workflow-bar-skeleton")).not.toBeInTheDocument();
      });
      expect(screen.queryByTestId("matched-workflow-bar")).not.toBeInTheDocument();
      // 매칭 바는 보조 패널이므로 조회 실패가 운영자에게 토스트로 노출되지 않아야 한다.
      expect(toast.error).not.toHaveBeenCalledWith("워크플로우 정보를 불러오지 못했습니다.");
    });

    it("refetches the workflow after an assistant message arrives via STOMP", async () => {
      vi.mocked(getCurrentWorkflow)
        .mockResolvedValueOnce(matchedPayload)
        .mockResolvedValueOnce({ ...matchedPayload, currentState: "REVIEW" });

      render(<ConsultationPage />, { wrapper: Wrapper });

      await waitFor(() => {
        expect(screen.getByText("김민지")).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText("김민지"));

      await waitFor(() => {
        expect(getCurrentWorkflow).toHaveBeenCalledTimes(1);
      });

      const chatTopicCallback = stompState.callbacks.get("/topic/chat.1");
      expect(chatTopicCallback).toBeDefined();

      await act(async () => {
        chatTopicCallback?.({
          id: "assistant-1",
          senderRole: "ASSISTANT",
          content: "도움이 필요하신 내용을 알려주세요",
          createdAt: new Date().toISOString(),
        });
      });

      await waitFor(
        () => {
          expect(getCurrentWorkflow).toHaveBeenCalledTimes(2);
        },
        { timeout: 1500 },
      );
    });
  });

  it("does not load or subscribe to queue without a workspace id", async () => {
    shellContext.workspace = null;

    render(<ConsultationPage />, { wrapper: Wrapper });

    await waitFor(() => {
      expect(screen.getByText("대기중인 고객이 없습니다")).toBeInTheDocument();
    });

    expect(consultationApi.getQueue).not.toHaveBeenCalled();
    expect(mockSubscribe).not.toHaveBeenCalledWith(
      expect.stringContaining("consultation.queue"),
      expect.any(Function),
    );
    expect(consultationApi.getMetrics).not.toHaveBeenCalled();

    await waitFor(() => {
      expect(getLatestTopbarNode().props.metricsViewState).toBe("empty");
    });
    const topbar = renderLatestTopbar();
    expect(topbar.getAllByText("--")).toHaveLength(2);
    topbar.unmount();
  });

  it("updates queue items from workspace queue upsert events", async () => {
    render(<ConsultationPage />, { wrapper: Wrapper });

    await waitFor(() => {
      expect(stompState.callbacks.has("/topic/workspaces.2.consultation.queue")).toBe(true);
    });

    act(() => {
      stompState.callbacks.get("/topic/workspaces.2.consultation.queue")?.({
        type: "SESSION_UPSERTED",
        session: {
          id: 2,
          status: "OPEN",
          channel: "WEB",
          metaJson: JSON.stringify({ customerName: "박서연", handoffReason: "배송 문의" }),
          startedAt: new Date().toISOString(),
        },
      });
    });

    await waitFor(() => {
      expect(screen.getByText("박서연")).toBeInTheDocument();
    });
    expect(screen.getByText("배송 문의")).toBeInTheDocument();
  });

  it("removes queue item and clears active selection from workspace queue remove events", async () => {
    render(<ConsultationPage />, { wrapper: Wrapper });

    await waitFor(() => {
      expect(screen.getByText("김민지")).toBeInTheDocument();
    });

    const customerItem = screen.getByText("김민지").closest('[role="button"]');
    if (customerItem) fireEvent.click(customerItem);

    await waitFor(() => {
      expect(screen.getByText("상담 종료")).toBeInTheDocument();
    });

    act(() => {
      stompState.callbacks.get("/topic/workspaces.2.consultation.queue")?.({
        type: "SESSION_REMOVED",
        session: { id: 1 },
      });
    });

    await waitFor(() => {
      expect(screen.queryByText("상담 종료")).not.toBeInTheDocument();
      expect(screen.queryByText("김민지")).not.toBeInTheDocument();
    });
  });

  it("shows customer banner actions after selecting a customer", async () => {
    render(<ConsultationPage />, { wrapper: Wrapper });

    await waitFor(() => {
      expect(screen.getByText("김민지")).toBeInTheDocument();
    });

    const customerItem = screen.getByText("김민지").closest("div");
    if (customerItem) {
      customerItem.click();
    }

    await waitFor(() => {
      expect(screen.getByText("상담 종료")).toBeInTheDocument();
    });

    expect(screen.getByText("김민지 고객")).toBeInTheDocument();
    expect(screen.queryByText("AI가 분류한 주제")).not.toBeInTheDocument();
    expect(screen.queryByText("카드 환불 — 부분환불")).not.toBeInTheDocument();
  });

  it("assigns an unassigned session to the current counselor when selected", async () => {
    saveTestUser(7);

    render(<ConsultationPage />, { wrapper: Wrapper });

    await waitFor(() => {
      expect(screen.getByText("김민지")).toBeInTheDocument();
    });

    const customerItem = screen.getByText("김민지").closest('[role="button"]');
    if (customerItem) {
      fireEvent.click(customerItem);
    }

    await waitFor(() => {
      expect(consultationApi.assignSession).toHaveBeenCalledWith(1, 7);
    });
    await waitFor(() => {
      expect(screen.getAllByText("내게 배정됨").length).toBeGreaterThan(0);
    });
  });

  it("releases the current counselor assignment through the backend API", async () => {
    saveTestUser(7);

    render(<ConsultationPage />, { wrapper: Wrapper });

    await waitFor(() => {
      expect(screen.getByText("김민지")).toBeInTheDocument();
    });

    const customerItem = screen.getByText("김민지").closest('[role="button"]');
    if (customerItem) {
      fireEvent.click(customerItem);
    }

    await waitFor(() => {
      expect(consultationApi.assignSession).toHaveBeenCalledWith(1, 7);
      expect(screen.getByText("배정 해제")).toBeEnabled();
    });

    fireEvent.click(screen.getByText("배정 해제"));

    await waitFor(() => {
      expect(consultationApi.releaseSession).toHaveBeenCalledWith(1, 7);
    });
  });

  it("does not render hard-coded suggestion strip when customer is active", async () => {
    render(<ConsultationPage />, { wrapper: Wrapper });

    await waitFor(() => {
      expect(screen.getByText("김민지")).toBeInTheDocument();
    });

    const customerItem = screen.getByText("김민지").closest("div");
    if (customerItem) {
      customerItem.click();
    }

    await waitFor(() => {
      expect(screen.getByText("상담 종료")).toBeInTheDocument();
    });

    expect(screen.queryByText("추천 답변")).not.toBeInTheDocument();
    expect(screen.queryByText("부분환불 가능합니다")).not.toBeInTheDocument();
    expect(screen.queryByText("환불 처리 중입니다")).not.toBeInTheDocument();
    expect(screen.queryByText("카드사 확인이 필요합니다")).not.toBeInTheDocument();
  });

  it("ends session when 상담 종료 is clicked", async () => {
    render(<ConsultationPage />, { wrapper: Wrapper });

    await waitFor(() => {
      expect(screen.getByText("김민지")).toBeInTheDocument();
    });

    const customerItem = screen.getByText("김민지").closest("div");
    if (customerItem) {
      customerItem.click();
    }

    await waitFor(() => {
      expect(screen.getByText("상담 종료")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("상담 종료"));

    await waitFor(() => {
      expect(consultationApi.updateStatus).toHaveBeenCalledWith(1, "COMPLETED");
    });

    await waitFor(() => {
      expect(screen.queryByText("상담 종료")).not.toBeInTheDocument();
    });
  });

  it("subscribes to STOMP topic when a customer is selected and connection is established", async () => {
    render(<ConsultationPage />, { wrapper: Wrapper });

    await waitFor(() => {
      expect(screen.getByText("김민지")).toBeInTheDocument();
    });

    const customerItem = screen.getByText("김민지").closest("div");
    if (customerItem) customerItem.click();

    await waitFor(() => {
      expect(mockSubscribe).toHaveBeenCalledWith("/topic/chat.1", expect.any(Function));
    });
  });

  it("sends messages through counselor STOMP endpoint and adds an optimistic message", async () => {
    const user = userEvent.setup();
    render(<ConsultationPage />, { wrapper: Wrapper });

    await waitFor(() => {
      expect(screen.getByText("김민지")).toBeInTheDocument();
    });

    const customerItem = screen.getByText("김민지").closest("div");
    if (customerItem) customerItem.click();

    const input = await screen.findByPlaceholderText("메시지를 입력하세요...");
    await user.type(input, "처리 도와드리겠습니다.");
    await user.keyboard("{Enter}");

    await waitFor(() => {
      expect(mockSendTo).toHaveBeenCalledWith("/app/chat.counselor.send", {
        sessionId: 1,
        content: "처리 도와드리겠습니다.",
        isNote: false,
      });
    });
    expect(consultationApi.sendMessage).not.toHaveBeenCalled();
    expect(screen.getByText("처리 도와드리겠습니다.")).toBeInTheDocument();
  });

  it("cleans up topbar and crumbs on unmount", () => {
    const { unmount } = render(<ConsultationPage />, { wrapper: Wrapper });
    unmount();
    expect(shellContext.setTopbarRight).toHaveBeenCalledWith(undefined);
    expect(shellContext.setCrumbs).toHaveBeenCalledWith([]);
  });

  it("shows MessageDetailPanel when a message is clicked and hides it on close", async () => {
    render(<ConsultationPage />, { wrapper: Wrapper });

    await waitFor(() => {
      expect(screen.getByText("김민지")).toBeInTheDocument();
    });

    const customerItem = screen.getByText("김민지").closest("div");
    if (customerItem) customerItem.click();

    await waitFor(() => {
      expect(screen.getByText("환불 문의 드립니다.")).toBeInTheDocument();
    });

    const messageEl = screen.getByText("환불 문의 드립니다.");
    fireEvent.click(messageEl);

    await waitFor(() => {
      expect(screen.getByText("연결된 도메인 팩 요소가 없습니다")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("닫기"));

    await waitFor(() => {
      expect(screen.getByText("고객 정보")).toBeInTheDocument();
    });
  });

  it("deselects message when the same message is clicked again", async () => {
    render(<ConsultationPage />, { wrapper: Wrapper });

    await waitFor(() => {
      expect(screen.getByText("김민지")).toBeInTheDocument();
    });

    const customerItem = screen.getByText("김민지").closest("div");
    if (customerItem) customerItem.click();

    await waitFor(() => {
      expect(screen.getByText("환불 문의 드립니다.")).toBeInTheDocument();
    });

    const messageEl = screen.getByText("환불 문의 드립니다.");
    fireEvent.click(messageEl);

    await waitFor(() => {
      expect(screen.getByText("연결된 도메인 팩 요소가 없습니다")).toBeInTheDocument();
    });

    fireEvent.click(messageEl);

    await waitFor(() => {
      expect(screen.getByText("고객 정보")).toBeInTheDocument();
    });
  });

  it("opens detail panel with Enter key and closes on re-Enter", async () => {
    const user = userEvent.setup();
    render(<ConsultationPage />, { wrapper: Wrapper });

    await waitFor(() => {
      expect(screen.getByText("김민지")).toBeInTheDocument();
    });

    const customerItem = screen.getByText("김민지").closest("div");
    if (customerItem) customerItem.click();

    await waitFor(() => {
      expect(screen.getByText("환불 문의 드립니다.")).toBeInTheDocument();
    });

    const messageButton = screen.getByRole("button", { name: /환불 문의 드립니다/ });
    messageButton.focus();
    await user.keyboard("{Enter}");

    await waitFor(() => {
      expect(screen.getByText("연결된 도메인 팩 요소가 없습니다")).toBeInTheDocument();
    });

    messageButton.focus();
    await user.keyboard("{Enter}");

    await waitFor(() => {
      expect(screen.getByText("고객 정보")).toBeInTheDocument();
    });
  });

  it("opens detail panel with Space key", async () => {
    const user = userEvent.setup();
    render(<ConsultationPage />, { wrapper: Wrapper });

    await waitFor(() => {
      expect(screen.getByText("김민지")).toBeInTheDocument();
    });

    const customerItem = screen.getByText("김민지").closest("div");
    if (customerItem) customerItem.click();

    await waitFor(() => {
      expect(screen.getByText("환불 문의 드립니다.")).toBeInTheDocument();
    });

    const messageButton = screen.getByRole("button", { name: /환불 문의 드립니다/ });
    messageButton.focus();
    await user.keyboard(" ");

    await waitFor(() => {
      expect(screen.getByText("연결된 도메인 팩 요소가 없습니다")).toBeInTheDocument();
    });
  });

  it("handles empty startedAt in queue items to set waitMinutes to 0", async () => {
    vi.mocked(consultationApi.getQueue).mockResolvedValueOnce([
      {
        id: 2,
        status: "OPEN",
        channel: "카카오톡",
        metaJson: JSON.stringify({ customerName: "이영희", handoffReason: "환불 문의" }),
        startedAt: "",
      },
    ]);

    render(<ConsultationPage />, { wrapper: Wrapper });

    await waitFor(() => {
      expect(screen.getByText("이영희")).toBeInTheDocument();
    });
    expect(screen.getByText(/0분 전/)).toBeInTheDocument();
  });

  it("handles metaJson parse error gracefully by using fallback metadata", async () => {
    vi.mocked(consultationApi.getQueue).mockResolvedValueOnce([
      {
        id: 3,
        status: "OPEN",
        channel: "네이버톡톡",
        metaJson: "{invalid-json}",
        startedAt: new Date().toISOString(),
      },
    ]);

    render(<ConsultationPage />, { wrapper: Wrapper });

    await waitFor(() => {
      expect(screen.getByText("Unknown")).toBeInTheDocument();
    });
  });

  it("shows queue load error state and retries the snapshot request", async () => {
    vi.mocked(consultationApi.getQueue).mockRejectedValueOnce(new Error("Network Error"));
    const user = userEvent.setup();

    render(<ConsultationPage />, { wrapper: Wrapper });

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("대기열을 불러오지 못했습니다.");
    });
    expect(screen.getByRole("alert")).toHaveTextContent("대기열을 불러오지 못했습니다.");

    await user.click(screen.getByText("다시 시도"));

    await waitFor(() => {
      expect(consultationApi.getQueue).toHaveBeenCalledTimes(2);
      expect(screen.getByText("김민지")).toBeInTheDocument();
    });
  });

  it("loads queue only once on initial mount and does not spam toast errors", async () => {
    render(<ConsultationPage />, { wrapper: Wrapper });

    await waitFor(() => {
      expect(consultationApi.getQueue).toHaveBeenCalledTimes(1);
      expect(screen.getByText("김민지")).toBeInTheDocument();
    });

    const errorToasts = vi
      .mocked(toast.error)
      .mock.calls.filter(([message]) => message === "대기열을 불러오지 못했습니다.");
    expect(errorToasts).toHaveLength(0);
  });

  it("deduplicates queue error toast across multiple failed loads", async () => {
    vi.mocked(consultationApi.getQueue)
      .mockRejectedValueOnce(new Error("Network Error"))
      .mockRejectedValueOnce(new Error("Network Error"));
    const user = userEvent.setup();

    render(<ConsultationPage />, { wrapper: Wrapper });

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("대기열을 불러오지 못했습니다.");
    });

    let queueErrorToasts = vi
      .mocked(toast.error)
      .mock.calls.filter(([message]) => message === "대기열을 불러오지 못했습니다.");
    expect(queueErrorToasts).toHaveLength(1);

    await user.click(screen.getByText("다시 시도"));

    await waitFor(() => {
      queueErrorToasts = vi
        .mocked(toast.error)
        .mock.calls.filter(([message]) => message === "대기열을 불러오지 못했습니다.");
      expect(queueErrorToasts).toHaveLength(2);
    });
  });

  it("shows error toast when loading messages fails", async () => {
    render(<ConsultationPage />, { wrapper: Wrapper });

    await waitFor(() => {
      expect(screen.getByText("김민지")).toBeInTheDocument();
    });

    vi.mocked(consultationApi.getMessages).mockRejectedValueOnce(new Error("DB Error"));

    const customerItem = screen.getByText("김민지").closest("div");
    if (customerItem) {
      customerItem.click();
    }

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("메시지를 불러오지 못했습니다.");
    });
  });

  it("clears selectedMessageId if the selected message is no longer in messages list", async () => {
    render(<ConsultationPage />, { wrapper: Wrapper });

    await waitFor(() => {
      expect(screen.getByText("김민지")).toBeInTheDocument();
    });

    await waitFor(() => {
      expect(stompState.callbacks.has("/topic/workspaces.2.consultation.queue")).toBe(true);
    });

    act(() => {
      stompState.callbacks.get("/topic/workspaces.2.consultation.queue")?.({
        type: "SESSION_UPSERTED",
        session: {
          id: 2,
          status: "OPEN",
          channel: "카카오톡",
          metaJson: JSON.stringify({ customerName: "홍길동", handoffReason: "기타 문의" }),
          startedAt: new Date().toISOString(),
        },
      });
    });

    await waitFor(() => {
      expect(screen.getByText("홍길동")).toBeInTheDocument();
    });

    const customerItem = screen.getByText("김민지").closest("div");
    if (customerItem) customerItem.click();

    await waitFor(() => {
      expect(screen.getByText("환불 문의 드립니다.")).toBeInTheDocument();
    });

    const messageEl = screen.getByText("환불 문의 드립니다.");
    fireEvent.click(messageEl);

    await waitFor(() => {
      expect(screen.getByText("연결된 도메인 팩 요소가 없습니다")).toBeInTheDocument();
    });

    vi.mocked(consultationApi.getMessages).mockResolvedValueOnce([]);

    const hongEl = screen.getByText("홍길동").closest("div");
    if (hongEl) hongEl.click();

    await waitFor(() => {
      expect(screen.getByText("고객 정보")).toBeInTheDocument();
      expect(screen.queryByText("연결된 도메인 팩 요소가 없습니다")).not.toBeInTheDocument();
    });
  });

  it("does not send message and shows error toast when STOMP is disconnected", async () => {
    const user = userEvent.setup();
    stompState.connectionStatus = "DISCONNECTED";

    render(<ConsultationPage />, { wrapper: Wrapper });

    await waitFor(() => {
      expect(screen.getByText("김민지")).toBeInTheDocument();
    });

    const customerItem = screen.getByText("김민지").closest("div");
    if (customerItem) customerItem.click();

    await waitFor(() => {
      expect(screen.getByText("상담 종료")).toBeEnabled();
    });

    const input = await screen.findByPlaceholderText("메시지를 입력하세요...");
    await user.type(input, "보낼 수 없는 메시지");
    await user.keyboard("{Enter}");

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("연결이 불안정합니다. 잠시 후 다시 시도해주세요.");
    });
    expect(mockSendTo).not.toHaveBeenCalled();
    expect(consultationApi.sendMessage).not.toHaveBeenCalled();
    expect(screen.queryByText("보낼 수 없는 메시지")).not.toBeInTheDocument();
  });

  it("handles incoming non-counselor STOMP message", async () => {
    render(<ConsultationPage />, { wrapper: Wrapper });

    await waitFor(() => {
      expect(screen.getByText("김민지")).toBeInTheDocument();
    });

    const customerItem = screen.getByText("김민지").closest("div");
    if (customerItem) customerItem.click();

    await waitFor(() => {
      expect(mockSubscribe).toHaveBeenCalled();
    });

    expect(stompState.latestCallback).toBeTypeOf("function");

    if (stompState.latestCallback) {
      stompState.latestCallback({
        id: 999,
        senderRole: "CUSTOMER",
        content: "새로운 고객 메시지",
        timestamp: new Date().toISOString(),
      });
    }

    await waitFor(() => {
      expect(screen.getByText("새로운 고객 메시지")).toBeInTheDocument();
    });
  });

  it("handles counselor echo and replaces the pending optimistic message", async () => {
    const user = userEvent.setup();
    render(<ConsultationPage />, { wrapper: Wrapper });

    await waitFor(() => {
      expect(screen.getByText("김민지")).toBeInTheDocument();
    });

    const customerItem = screen.getByText("김민지").closest("div");
    if (customerItem) customerItem.click();

    const input = await screen.findByPlaceholderText("메시지를 입력하세요...");
    await user.type(input, "임시 답변");
    await user.keyboard("{Enter}");

    await waitFor(() => {
      expect(screen.getByText("임시 답변")).toBeInTheDocument();
    });

    if (stompState.latestCallback) {
      stompState.latestCallback({
        id: 888,
        senderRole: "COUNSELOR",
        content: "임시 답변",
        createdAt: new Date().toISOString(),
      });
    }

    await waitFor(() => {
      expect(screen.getByText("임시 답변")).toBeInTheDocument();
      expect(screen.getAllByText("임시 답변")).toHaveLength(1);
    });
  });

  it("handles legacy AGENT echo and replaces the pending optimistic message", async () => {
    const user = userEvent.setup();
    render(<ConsultationPage />, { wrapper: Wrapper });

    await waitFor(() => {
      expect(screen.getByText("김민지")).toBeInTheDocument();
    });

    const customerItem = screen.getByText("김민지").closest("div");
    if (customerItem) customerItem.click();

    const input = await screen.findByPlaceholderText("메시지를 입력하세요...");
    await user.type(input, "레거시 답변");
    await user.keyboard("{Enter}");

    await waitFor(() => {
      expect(screen.getByText("레거시 답변")).toBeInTheDocument();
    });

    if (stompState.latestCallback) {
      stompState.latestCallback({
        id: 889,
        senderRole: "AGENT",
        content: "레거시 답변",
        createdAt: new Date().toISOString(),
      });
    }

    await waitFor(() => {
      expect(screen.getByText("레거시 답변")).toBeInTheDocument();
      expect(screen.getAllByText("레거시 답변")).toHaveLength(1);
    });
  });

  it("ignores counselor echo if there are no pending optimistic messages", async () => {
    render(<ConsultationPage />, { wrapper: Wrapper });

    await waitFor(() => {
      expect(screen.getByText("김민지")).toBeInTheDocument();
    });

    const customerItem = screen.getByText("김민지").closest("div");
    if (customerItem) customerItem.click();

    await waitFor(() => {
      expect(mockSubscribe).toHaveBeenCalled();
    });

    if (stompState.latestCallback) {
      stompState.latestCallback({
        id: 777,
        senderRole: "COUNSELOR",
        content: "임시 메시지 없는 에코",
        createdAt: new Date().toISOString(),
      });
    }

    await waitFor(() => {
      expect(screen.queryByText("임시 메시지 없는 에코")).not.toBeInTheDocument();
    });
  });

  it("shows error toast when ending session fails", async () => {
    vi.mocked(consultationApi.updateStatus).mockRejectedValueOnce(new Error("API Error"));

    render(<ConsultationPage />, { wrapper: Wrapper });

    await waitFor(() => {
      expect(screen.getByText("김민지")).toBeInTheDocument();
    });

    const customerItem = screen.getByText("김민지").closest("div");
    if (customerItem) customerItem.click();

    await waitFor(() => {
      expect(screen.getByText("상담 종료")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("상담 종료"));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("세션 종료 실패");
    });
  });

  it("updates active customer's memo when typing in the textarea", async () => {
    const user = userEvent.setup();
    render(<ConsultationPage />, { wrapper: Wrapper });

    await waitFor(() => {
      expect(screen.getByText("김민지")).toBeInTheDocument();
    });

    const customerItem = screen.getByText("김민지").closest("div");
    if (customerItem) customerItem.click();

    const textarea = await screen.findByPlaceholderText(
      "타임라인에 내부 메모로 남길 내용을 입력하세요...",
    );
    await user.type(textarea, "고객이 매우 다급함");

    expect(textarea).toHaveValue("고객이 매우 다급함");
  });

  it("saves the customer memo as an internal note message", async () => {
    const user = userEvent.setup();
    render(<ConsultationPage />, { wrapper: Wrapper });

    await waitFor(() => {
      expect(screen.getByText("김민지")).toBeInTheDocument();
    });

    const customerItem = screen.getByText("김민지").closest('[role="button"]');
    if (customerItem) fireEvent.click(customerItem);

    const textarea = await screen.findByPlaceholderText(
      "타임라인에 내부 메모로 남길 내용을 입력하세요...",
    );
    await user.type(textarea, "카드사 확인 필요");
    await user.click(screen.getByText("내부 메모로 남기기"));

    await waitFor(() => {
      expect(mockSendTo).toHaveBeenCalledWith("/app/chat.counselor.send", {
        sessionId: 1,
        content: "카드사 확인 필요",
        isNote: true,
      });
    });
    expect(consultationApi.sendMessage).not.toHaveBeenCalled();
    expect(screen.getByText("카드사 확인 필요")).toBeInTheDocument();
  });
});
