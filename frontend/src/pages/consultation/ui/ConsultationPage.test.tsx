import { describe, it, expect, vi, beforeEach } from "vitest";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import "@testing-library/jest-dom/vitest";
import { ConsultationPage } from "./ConsultationPage";
import { consultationApi } from "../../../features/consultation/api/consultationApi";
import { getCurrentWorkflow } from "../../../features/consultation/api/llmToolWorkflowApi";
import { toast } from "sonner";
import { ApiRequestError } from "@/shared/api";

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
    connectionStatus: "CONNECTED" as "CONNECTING" | "CONNECTED" | "DISCONNECTED" | "ERROR",
    latestCallback: null as ((msg: RealtimePayload) => void) | null,
    onServerError: null as ((error: unknown) => void) | null,
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
          status: "ACTIVE",
          channel: "카카오톡",
          metaJson: JSON.stringify({ customerName: "김민지", handoffReason: "환불 문의" }),
          startedAt: new Date(Date.now() - 4 * 60000).toISOString(),
          assignedCounselorId: 7,
          responseMode: "HUMAN_ACTIVE",
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
    getMessagePage: vi.fn(() =>
      Promise.resolve({
        content: [
          {
            id: 100,
            seqNo: 1,
            senderRole: "CUSTOMER",
            messageType: "TEXT",
            content: "환불 문의 드립니다.",
            createdAt: new Date().toISOString(),
          },
        ],
        page: 0,
        size: 50,
        totalElements: 1,
        totalPages: 1,
      }),
    ),
    updateStatus: vi.fn(() => Promise.resolve({})),
    assignSession: vi.fn((sessionId: number) =>
      Promise.resolve({
        id: sessionId,
        status: "ACTIVE",
        channel: "카카오톡",
        metaJson: JSON.stringify({ customerName: "김민지", handoffReason: "환불 문의" }),
        startedAt: new Date(Date.now() - 4 * 60000).toISOString(),
        assignedCounselorId: 7,
        responseMode: "HUMAN_ACTIVE",
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
        responseMode: "AI_ACTIVE",
      }),
    ),
    updateResponseMode: vi.fn((sessionId: number, counselorId: number, responseMode: string) =>
      Promise.resolve({
        id: sessionId,
        status: "ACTIVE",
        channel: "카카오톡",
        metaJson: JSON.stringify({ customerName: "김민지", handoffReason: "환불 문의" }),
        startedAt: new Date(Date.now() - 4 * 60000).toISOString(),
        assignedCounselorId: counselorId,
        responseMode,
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
    generateDraftResponse: vi.fn(() =>
      Promise.resolve({
        content: "주문번호를 확인해주시면 환불 상태를 안내드리겠습니다.",
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
  useStomp: (options?: { onServerError?: (error: unknown) => void }) => {
    stompState.onServerError = options?.onServerError ?? null;
    return {
      connectionStatus: stompState.connectionStatus,
      subscribe: mockSubscribe,
      sendTo: mockSendTo,
      sendMessage: vi.fn(),
      lastMessage: null,
      connect: vi.fn(),
      disconnect: vi.fn(),
    };
  },
}));

function Wrapper({ children }: { children: React.ReactNode }) {
  return <MemoryRouter>{children}</MemoryRouter>;
}

function LocationProbe() {
  const location = useLocation();
  return <div data-testid="location">{location.pathname}</div>;
}

function createRoutedWrapper(initialPath: string) {
  return function RoutedWrapper({ children }: { children: React.ReactNode }) {
    return (
      <MemoryRouter initialEntries={[initialPath]}>
        <LocationProbe />
        <Routes>
          <Route path="/workspaces/:workspaceId/consultation" element={children} />
          <Route path="/workspaces/:workspaceId/consultation/:sessionId" element={children} />
        </Routes>
      </MemoryRouter>
    );
  };
}

function saveTestUser(id: number) {
  window.localStorage.setItem(
    "user",
    JSON.stringify({ id, email: "agent@example.com", name: "상담사", role: "OPERATOR" }),
  );
}

function createUnassignedQueueSession() {
  return {
    id: 1,
    status: "OPEN" as const,
    channel: "카카오톡",
    metaJson: JSON.stringify({ customerName: "김민지", handoffReason: "환불 문의" }),
    startedAt: new Date(Date.now() - 4 * 60000).toISOString(),
    assignedCounselorId: null,
  };
}

describe("ConsultationPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    stompState.connectionStatus = "CONNECTED";
    stompState.latestCallback = null;
    stompState.onServerError = null;
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
    expect(screen.getByText("상담 큐")).toBeInTheDocument();
    expect(screen.getByText("좌측 대기 목록에서 고객을 선택해주세요")).toBeInTheDocument();
    expect(screen.getByText("고객을 선택하면 정보가 표시됩니다")).toBeInTheDocument();
  });

  it("renders customer panel data from session metadata without fallback mock business values", async () => {
    vi.mocked(consultationApi.getQueue).mockResolvedValueOnce([
      {
        id: 1,
        status: "OPEN",
        channel: "WEB",
        metaJson: JSON.stringify({
          customerName: "정세션",
          customerInfo: {
            membershipTier: "VIP",
            contact: "010-2222-3333",
            email: "real@example.com",
          },
          orderInfo: {
            orderNumber: "ORD-SESSION-1",
            orderDate: "2026-06-01",
            paymentAmount: "22,000원",
            deliveryStatus: "결제 확인",
          },
          extractedInfo: {
            cardNumber: "2222 **** **** 3333",
            refundAmount: "5,000원",
            refundReason: "부분 취소",
            dueDate: "2026-06-05",
          },
        }),
        startedAt: new Date(Date.now() - 4 * 60000).toISOString(),
        assignedCounselorId: null,
      },
    ]);

    render(<ConsultationPage />, { wrapper: Wrapper });

    await waitFor(() => {
      expect(screen.getByText("정세션")).toBeInTheDocument();
    });

    const customerItem = screen.getByText("정세션").closest('[role="button"]');
    if (customerItem) {
      fireEvent.click(customerItem);
    }

    expect(screen.getByText("010-2222-3333")).toBeInTheDocument();
    expect(screen.getByText("real@example.com")).toBeInTheDocument();
    expect(screen.getAllByText("ORD-SESSION-1").length).toBeGreaterThan(0);
    expect(screen.getByText("22,000원")).toBeInTheDocument();
    expect(screen.getByText("2222 **** **** 3333")).toBeInTheDocument();
    expect(screen.getByText("5,000원")).toBeInTheDocument();
    expect(screen.queryByText("010-****-1234")).not.toBeInTheDocument();
    expect(screen.queryByText("#ORD-2024-08921")).not.toBeInTheDocument();
    expect(screen.queryByText("89,000원")).not.toBeInTheDocument();
    expect(screen.queryByText("5432 **** **** 8912")).not.toBeInTheDocument();
  });

  it("orders AI handoff queue items before normal sessions and by oldest handoff time", async () => {
    vi.mocked(consultationApi.getQueue).mockResolvedValueOnce([
      {
        id: 1,
        status: "OPEN",
        channel: "WEB",
        metaJson: JSON.stringify({
          customerName: "일반 고객",
          handoffRequired: false,
          handoffReason: "일반 문의",
        }),
        startedAt: "2026-06-01T11:30:00+09:00",
      },
      {
        id: 2,
        status: "OPEN",
        channel: "WEB",
        metaJson: JSON.stringify({
          customerName: "새 이관 고객",
          handoffRequired: true,
          handoffReason: "최근 승인 필요",
          handoffAt: "2026-06-01T11:00:00+09:00",
        }),
        startedAt: "2026-06-01T09:00:00+09:00",
      },
      {
        id: 3,
        status: "OPEN",
        channel: "WEB",
        metaJson: JSON.stringify({
          customerName: "오래된 이관 고객",
          handoffRequired: true,
          handoffReason: "오래된 승인 필요",
          handoffAt: "2026-06-01T10:00:00+09:00",
        }),
        startedAt: "2026-06-01T08:00:00+09:00",
      },
    ]);

    render(<ConsultationPage />, { wrapper: Wrapper });

    await waitFor(() => {
      expect(screen.getByText("오래된 이관 고객")).toBeInTheDocument();
    });

    const queueItems = screen
      .getAllByRole("button")
      .filter((button) => button.textContent?.includes("고객"));
    expect(queueItems.map((button) => button.textContent)).toEqual([
      expect.stringContaining("오래된 이관 고객"),
      expect.stringContaining("새 이관 고객"),
      expect.stringContaining("일반 고객"),
    ]);
    expect(screen.getByText("AI 이관 2건 · 미배정 3건 · 진행 0건")).toBeInTheDocument();
  });

  it("selects the route session and restores messages when opening a session URL directly", async () => {
    vi.mocked(consultationApi.getQueue).mockResolvedValueOnce([
      {
        id: 1,
        status: "OPEN",
        channel: "카카오톡",
        metaJson: JSON.stringify({ customerName: "김민지", handoffReason: "환불 문의" }),
        startedAt: new Date(Date.now() - 4 * 60000).toISOString(),
        assignedCounselorId: null,
      },
    ]);

    render(<ConsultationPage />, {
      wrapper: createRoutedWrapper("/workspaces/2/consultation/1"),
    });

    await waitFor(() => {
      expect(consultationApi.getMessagePage).toHaveBeenCalledWith(1, { page: 0, size: 50 });
    });
    expect(screen.getByText("김민지 고객")).toBeInTheDocument();
    expect(screen.getByText("환불 문의 드립니다.")).toBeInTheDocument();
    expect(consultationApi.assignSession).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "배정받기" })).toBeInTheDocument();
  });

  it("loads previous message pages from the top of the live chat", async () => {
    vi.mocked(consultationApi.getMessagePage)
      .mockResolvedValueOnce({
        content: [
          {
            id: 101,
            seqNo: 51,
            senderRole: "CUSTOMER",
            messageType: "TEXT",
            content: "최근 문의입니다.",
            createdAt: new Date().toISOString(),
          },
        ],
        page: 0,
        size: 50,
        totalElements: 51,
        totalPages: 2,
      })
      .mockResolvedValueOnce({
        content: [
          {
            id: 10,
            seqNo: 1,
            senderRole: "CUSTOMER",
            messageType: "TEXT",
            content: "이전 문의입니다.",
            createdAt: new Date().toISOString(),
          },
        ],
        page: 1,
        size: 50,
        totalElements: 51,
        totalPages: 2,
      });

    render(<ConsultationPage />, {
      wrapper: createRoutedWrapper("/workspaces/2/consultation/1"),
    });

    await waitFor(() => {
      expect(screen.getByText("최근 문의입니다.")).toBeInTheDocument();
    });

    await userEvent.click(screen.getByRole("button", { name: "이전 메시지 불러오기" }));

    await waitFor(() => {
      expect(consultationApi.getMessagePage).toHaveBeenLastCalledWith(1, { page: 1, size: 50 });
    });
    expect(screen.getByText("이전 문의입니다.")).toBeInTheDocument();
    expect(screen.getByText("최근 문의입니다.")).toBeInTheDocument();
  });

  it("updates the browser URL when a queue session is selected", async () => {
    render(<ConsultationPage />, {
      wrapper: createRoutedWrapper("/workspaces/2/consultation"),
    });

    await waitFor(() => {
      expect(screen.getByText("김민지")).toBeInTheDocument();
    });

    const customerItem = screen.getByText("김민지").closest('[role="button"]');
    if (customerItem) {
      fireEvent.click(customerItem);
    }

    await waitFor(() => {
      expect(screen.getByTestId("location")).toHaveTextContent("/workspaces/2/consultation/1");
    });
  });

  it("shows an unavailable state for an inaccessible route session without loading messages", async () => {
    render(<ConsultationPage />, {
      wrapper: createRoutedWrapper("/workspaces/2/consultation/999"),
    });

    await waitFor(() => {
      expect(screen.getByText("요청한 상담 세션을 찾을 수 없습니다")).toBeInTheDocument();
    });
    expect(
      vi.mocked(consultationApi.getMessagePage).mock.calls.some(([sessionId]) => sessionId === 999),
    ).toBe(false);
  });

  it("treats non-numeric route session IDs as unavailable without loading messages", async () => {
    render(<ConsultationPage />, {
      wrapper: createRoutedWrapper("/workspaces/2/consultation/abc"),
    });

    await waitFor(() => {
      expect(screen.getByText("요청한 상담 세션을 찾을 수 없습니다")).toBeInTheDocument();
    });
    expect(consultationApi.getMessagePage).not.toHaveBeenCalled();
  });

  it("selects a route session when it arrives later through the queue websocket", async () => {
    vi.mocked(consultationApi.getQueue).mockResolvedValueOnce([]);

    render(<ConsultationPage />, {
      wrapper: createRoutedWrapper("/workspaces/2/consultation/9"),
    });

    await waitFor(() => {
      expect(screen.getByText("요청한 상담 세션을 찾을 수 없습니다")).toBeInTheDocument();
      expect(stompState.callbacks.has("/topic/workspaces.2.consultation.queue")).toBe(true);
    });

    act(() => {
      stompState.callbacks.get("/topic/workspaces.2.consultation.queue")?.({
        type: "SESSION_UPSERTED",
        session: {
          id: 9,
          status: "OPEN",
          channel: "카카오톡",
          metaJson: JSON.stringify({ customerName: "박지훈", handoffReason: "배송 문의" }),
          startedAt: new Date().toISOString(),
          assignedCounselorId: 7,
        },
      });
    });

    await waitFor(() => {
      expect(screen.queryByText("요청한 상담 세션을 찾을 수 없습니다")).not.toBeInTheDocument();
      expect(screen.getByText("박지훈 고객")).toBeInTheDocument();
      expect(consultationApi.getMessagePage).toHaveBeenCalledWith(9, { page: 0, size: 50 });
    });
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

    it("inserts a matched workflow draft into the message input without sending it", async () => {
      vi.mocked(getCurrentWorkflow).mockResolvedValueOnce(matchedPayload);
      vi.mocked(consultationApi.generateDraftResponse).mockResolvedValueOnce({
        content: "주문번호를 확인해주시면 환불 상태를 안내드리겠습니다.",
      });

      render(<ConsultationPage />, { wrapper: Wrapper });

      await waitFor(() => {
        expect(screen.getByText("김민지")).toBeInTheDocument();
      });
      fireEvent.click(screen.getByText("김민지"));

      await waitFor(() => {
        expect(screen.getByLabelText("답변 초안 삽입")).toBeInTheDocument();
      });

      fireEvent.click(screen.getByLabelText("답변 초안 삽입"));

      await waitFor(() => {
        expect(consultationApi.generateDraftResponse).toHaveBeenCalledWith(1);
      });
      expect(screen.getByPlaceholderText("메시지를 입력하세요...")).toHaveValue(
        "주문번호를 확인해주시면 환불 상태를 안내드리겠습니다.",
      );
      expect(mockSendTo).not.toHaveBeenCalledWith(
        "/app/chat.counselor.send",
        expect.objectContaining({
          content: "주문번호를 확인해주시면 환불 상태를 안내드리겠습니다.",
        }),
      );
    });

    it("keeps the existing input and shows a toast when draft generation fails", async () => {
      vi.mocked(getCurrentWorkflow).mockResolvedValueOnce(matchedPayload);
      vi.mocked(consultationApi.generateDraftResponse).mockRejectedValueOnce(
        new Error("draft failed"),
      );

      render(<ConsultationPage />, { wrapper: Wrapper });

      await waitFor(() => {
        expect(screen.getByText("김민지")).toBeInTheDocument();
      });
      fireEvent.click(screen.getByText("김민지"));

      await waitFor(() => {
        expect(screen.getByLabelText("답변 초안 삽입")).toBeInTheDocument();
      });

      const input = screen.getByPlaceholderText("메시지를 입력하세요...");
      await userEvent.type(input, "기존 작성 내용");
      fireEvent.click(screen.getByLabelText("답변 초안 삽입"));

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith(
          "답변 초안을 생성하지 못했습니다. 기존 입력 내용은 유지됩니다.",
        );
      });
      expect(input).toHaveValue("기존 작성 내용");
    });
  });

  it("does not load or subscribe to queue without a workspace id", async () => {
    shellContext.workspace = null;

    render(<ConsultationPage />, { wrapper: Wrapper });

    await waitFor(() => {
      expect(screen.getByText("현재 상담 큐가 비어 있습니다")).toBeInTheDocument();
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

  it("marks inactive queue item as unread when a customer message queue event arrives", async () => {
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
          metaJson: JSON.stringify({
            customerName: "박서연",
            handoffReason: "배송 문의",
            lastMessagePreview: "배송이 아직 도착하지 않았어요",
            lastMessageRole: "CUSTOMER",
            lastMessageAt: new Date().toISOString(),
          }),
          startedAt: new Date(Date.now() - 10 * 60000).toISOString(),
        },
      });
    });

    await waitFor(() => {
      expect(screen.getByText("배송이 아직 도착하지 않았어요")).toBeInTheDocument();
    });
    expect(screen.getByLabelText("읽지 않은 고객 메시지")).toBeInTheDocument();
  });

  it("clears unread state when selecting an unread queue item", async () => {
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
          metaJson: JSON.stringify({
            customerName: "박서연",
            handoffReason: "배송 문의",
            lastMessagePreview: "확인 부탁드립니다",
            lastMessageRole: "USER",
            lastMessageAt: new Date().toISOString(),
          }),
          startedAt: new Date(Date.now() - 10 * 60000).toISOString(),
        },
      });
    });

    await waitFor(() => {
      expect(screen.getByLabelText("읽지 않은 고객 메시지")).toBeInTheDocument();
    });

    const customerItem = screen.getByText("박서연").closest('[role="button"]');
    if (customerItem) fireEvent.click(customerItem);

    await waitFor(() => {
      expect(screen.queryByLabelText("읽지 않은 고객 메시지")).not.toBeInTheDocument();
    });
  });

  it("does not mark active or non-customer queue events as unread", async () => {
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
        type: "SESSION_UPSERTED",
        session: {
          id: 1,
          status: "ACTIVE",
          channel: "카카오톡",
          metaJson: JSON.stringify({
            customerName: "김민지",
            handoffReason: "환불 문의",
            lastMessagePreview: "활성 세션의 새 고객 메시지",
            lastMessageRole: "CUSTOMER",
            lastMessageAt: new Date().toISOString(),
          }),
          startedAt: new Date(Date.now() - 4 * 60000).toISOString(),
          assignedCounselorId: 7,
        },
      });
      stompState.callbacks.get("/topic/workspaces.2.consultation.queue")?.({
        type: "SESSION_UPSERTED",
        session: {
          id: 2,
          status: "OPEN",
          channel: "WEB",
          metaJson: JSON.stringify({
            customerName: "박서연",
            handoffReason: "배송 문의",
            lastMessagePreview: "내부 확인 메모",
            lastMessageRole: "NOTE",
            lastMessageAt: new Date().toISOString(),
          }),
          startedAt: new Date(Date.now() - 10 * 60000).toISOString(),
        },
      });
    });

    await waitFor(() => {
      expect(screen.getByText("활성 세션의 새 고객 메시지")).toBeInTheDocument();
      expect(screen.getByText("내부 확인 메모")).toBeInTheDocument();
    });
    expect(screen.queryByLabelText("읽지 않은 고객 메시지")).not.toBeInTheDocument();
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

  it("opens an unassigned session as read-only when selected", async () => {
    saveTestUser(7);
    vi.mocked(consultationApi.getQueue).mockResolvedValueOnce([
      {
        id: 1,
        status: "OPEN",
        channel: "카카오톡",
        metaJson: JSON.stringify({ customerName: "김민지", handoffReason: "환불 문의" }),
        startedAt: new Date(Date.now() - 4 * 60000).toISOString(),
        assignedCounselorId: null,
      },
    ]);

    render(<ConsultationPage />, { wrapper: Wrapper });

    await waitFor(() => {
      expect(screen.getByText("김민지")).toBeInTheDocument();
    });

    const customerItem = screen.getByText("김민지").closest('[role="button"]');
    if (customerItem) {
      fireEvent.click(customerItem);
    }

    await waitFor(() => {
      expect(consultationApi.getMessagePage).toHaveBeenCalledWith(1, { page: 0, size: 50 });
    });
    expect(consultationApi.assignSession).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "배정받기" })).toBeInTheDocument();
    expect(
      screen.getAllByText("배정받기 전에는 메시지와 내부 메모를 보낼 수 없습니다.").length,
    ).toBeGreaterThan(0);
    expect(screen.getByLabelText("메시지 전송")).toBeDisabled();
  });

  it("assigns an unassigned session only when the counselor clicks claim", async () => {
    saveTestUser(7);
    vi.mocked(consultationApi.getQueue).mockResolvedValueOnce([
      {
        id: 1,
        status: "OPEN",
        channel: "카카오톡",
        metaJson: JSON.stringify({ customerName: "김민지", handoffReason: "환불 문의" }),
        startedAt: new Date(Date.now() - 4 * 60000).toISOString(),
        assignedCounselorId: null,
      },
    ]);

    render(<ConsultationPage />, { wrapper: Wrapper });

    await waitFor(() => {
      expect(screen.getByText("김민지")).toBeInTheDocument();
    });

    const customerItem = screen.getByText("김민지").closest('[role="button"]');
    if (customerItem) {
      fireEvent.click(customerItem);
    }

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "배정받기" })).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole("button", { name: "배정받기" }));

    await waitFor(() => {
      expect(consultationApi.assignSession).toHaveBeenCalledWith(1);
    });
    await waitFor(() => {
      expect(screen.getAllByText("내게 배정됨").length).toBeGreaterThan(0);
    });
    expect(screen.getByPlaceholderText("메시지를 입력하세요...")).not.toBeDisabled();
  });

  it("keeps the session read-only when claim fails", async () => {
    saveTestUser(7);
    const unassignedSession = createUnassignedQueueSession();
    vi.mocked(consultationApi.getQueue)
      .mockResolvedValueOnce([unassignedSession])
      .mockResolvedValueOnce([unassignedSession]);
    vi.mocked(consultationApi.assignSession).mockRejectedValueOnce(new Error("already assigned"));

    render(<ConsultationPage />, { wrapper: Wrapper });

    await waitFor(() => {
      expect(screen.getByText("김민지")).toBeInTheDocument();
    });

    const customerItem = screen.getByText("김민지").closest('[role="button"]');
    if (customerItem) {
      fireEvent.click(customerItem);
    }

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "배정받기" })).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole("button", { name: "배정받기" }));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("상담 세션 배정에 실패했습니다.");
    });
    expect(consultationApi.getQueue).toHaveBeenCalledTimes(2);
    expect(screen.getByRole("button", { name: "배정받기" })).toBeInTheDocument();
    expect(screen.getByLabelText("메시지 전송")).toBeDisabled();
  });

  it.each([
    ["SESSION_NOT_ASSIGNABLE", "현재 배정할 수 없는 상담 상태입니다."],
    ["SESSION_NOT_FOUND", "상담 세션을 찾을 수 없습니다."],
    ["WORKSPACE_ACCESS_DENIED", "상담 배정 권한이 없습니다."],
    ["FORBIDDEN", "상담 배정 권한이 없습니다."],
    ["UNKNOWN_ERROR", "상담 세션 배정에 실패했습니다."],
  ])("shows a claim failure message for %s", async (code, message) => {
    saveTestUser(7);
    const unassignedSession = createUnassignedQueueSession();
    vi.mocked(consultationApi.getQueue)
      .mockResolvedValueOnce([unassignedSession])
      .mockResolvedValueOnce([unassignedSession]);
    vi.mocked(consultationApi.assignSession).mockRejectedValueOnce(
      new ApiRequestError(400, code, "배정 실패"),
    );

    render(<ConsultationPage />, { wrapper: Wrapper });

    await waitFor(() => {
      expect(screen.getByText("김민지")).toBeInTheDocument();
    });

    const customerItem = screen.getByText("김민지").closest('[role="button"]');
    if (customerItem) {
      fireEvent.click(customerItem);
    }

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "배정받기" })).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole("button", { name: "배정받기" }));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(message);
    });
    expect(consultationApi.getQueue).toHaveBeenCalledTimes(2);
    expect(screen.getByRole("button", { name: "배정받기" })).toBeInTheDocument();
  });

  it("shows a queue sync error when refetching after claim failure fails", async () => {
    saveTestUser(7);
    const unassignedSession = createUnassignedQueueSession();
    vi.mocked(consultationApi.getQueue)
      .mockResolvedValueOnce([unassignedSession])
      .mockRejectedValueOnce(new Error("queue sync failed"));
    vi.mocked(consultationApi.assignSession).mockRejectedValueOnce(new Error("claim failed"));

    render(<ConsultationPage />, { wrapper: Wrapper });

    await waitFor(() => {
      expect(screen.getByText("김민지")).toBeInTheDocument();
    });

    const customerItem = screen.getByText("김민지").closest('[role="button"]');
    if (customerItem) {
      fireEvent.click(customerItem);
    }

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "배정받기" })).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole("button", { name: "배정받기" }));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(
        "배정 실패 후 최신 대기열을 불러오지 못했습니다.",
      );
    });
    expect(screen.getByText("대기열을 불러오지 못했습니다.")).toBeInTheDocument();
  });

  it("syncs queue and clears the selected chat when claim fails because another counselor assigned it", async () => {
    saveTestUser(7);
    vi.mocked(consultationApi.getQueue)
      .mockResolvedValueOnce([
        {
          id: 1,
          status: "OPEN",
          channel: "카카오톡",
          metaJson: JSON.stringify({ customerName: "김민지", handoffReason: "환불 문의" }),
          startedAt: new Date(Date.now() - 4 * 60000).toISOString(),
          assignedCounselorId: null,
        },
      ])
      .mockResolvedValueOnce([
        {
          id: 1,
          status: "ACTIVE",
          channel: "카카오톡",
          metaJson: JSON.stringify({ customerName: "김민지", handoffReason: "환불 문의" }),
          startedAt: new Date(Date.now() - 4 * 60000).toISOString(),
          assignedCounselorId: 99,
          responseMode: "HUMAN_ACTIVE",
        },
      ]);
    vi.mocked(consultationApi.assignSession).mockRejectedValueOnce(
      new ApiRequestError(
        400,
        "SESSION_ALREADY_ASSIGNED",
        "이미 다른 상담사에게 배정된 상담입니다.",
      ),
    );

    render(<ConsultationPage />, { wrapper: Wrapper });

    await waitFor(() => {
      expect(screen.getByText("김민지")).toBeInTheDocument();
    });

    const customerItem = screen.getByText("김민지").closest('[role="button"]');
    if (customerItem) {
      fireEvent.click(customerItem);
    }

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "배정받기" })).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole("button", { name: "배정받기" }));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("이미 다른 상담사에게 배정된 상담입니다.");
    });
    await waitFor(() => {
      expect(consultationApi.getQueue).toHaveBeenCalledTimes(2);
      expect(screen.getAllByText("다른 상담사 배정").length).toBeGreaterThan(0);
    });
    expect(screen.getByText("좌측 대기 목록에서 고객을 선택해주세요")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "배정받기" })).not.toBeInTheDocument();
  });

  it("keeps sessions assigned to another counselor read-only with a reason", async () => {
    vi.mocked(consultationApi.getQueue).mockResolvedValueOnce([
      {
        id: 1,
        status: "ACTIVE",
        channel: "카카오톡",
        metaJson: JSON.stringify({ customerName: "김민지", handoffReason: "환불 문의" }),
        startedAt: new Date(Date.now() - 4 * 60000).toISOString(),
        assignedCounselorId: 99,
      },
    ]);

    render(<ConsultationPage />, { wrapper: Wrapper });

    await waitFor(() => {
      expect(screen.getByText("김민지")).toBeInTheDocument();
    });

    const customerItem = screen.getByText("김민지").closest('[role="button"]');
    if (customerItem) {
      fireEvent.click(customerItem);
    }

    await waitFor(() => {
      expect(screen.getAllByText("다른 상담사 배정").length).toBeGreaterThan(0);
    });
    expect(
      screen.getAllByText("다른 상담사가 응대 중인 세션이므로 메시지를 보낼 수 없습니다.").length,
    ).toBeGreaterThan(0);
    expect(screen.queryByRole("button", { name: "배정받기" })).not.toBeInTheDocument();
    expect(screen.getByLabelText("메시지 전송")).toBeDisabled();
  });

  it("updates AI response mode for the assigned session", async () => {
    const user = userEvent.setup();
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
      expect(screen.getByRole("button", { name: "AI 보조만 사용" })).toBeEnabled();
    });

    await user.click(screen.getByRole("button", { name: "AI 보조만 사용" }));

    await waitFor(() => {
      expect(consultationApi.updateResponseMode).toHaveBeenCalledWith(1, 7, "AI_ASSIST_ONLY");
    });
    expect(toast.success).toHaveBeenCalledWith("AI 응대 모드가 변경되었습니다.");
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "AI 보조만 사용" })).toHaveAttribute(
        "aria-pressed",
        "true",
      );
    });
  });

  it("shows an error toast when AI response mode update fails", async () => {
    const user = userEvent.setup();
    vi.mocked(consultationApi.updateResponseMode).mockRejectedValueOnce(new Error("forbidden"));

    render(<ConsultationPage />, { wrapper: Wrapper });

    await waitFor(() => {
      expect(screen.getByText("김민지")).toBeInTheDocument();
    });

    const customerItem = screen.getByText("김민지").closest('[role="button"]');
    if (customerItem) {
      fireEvent.click(customerItem);
    }

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "AI 보조만 사용" })).toBeEnabled();
    });

    await user.click(screen.getByRole("button", { name: "AI 보조만 사용" }));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("AI 응대 모드 변경에 실패했습니다.");
    });
    expect(screen.getByRole("button", { name: "상담사 응대중" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("disables AI response mode controls for unassigned sessions", async () => {
    vi.mocked(consultationApi.getQueue).mockResolvedValueOnce([
      {
        id: 1,
        status: "OPEN",
        channel: "카카오톡",
        metaJson: JSON.stringify({ customerName: "김민지", handoffReason: "환불 문의" }),
        startedAt: new Date(Date.now() - 4 * 60000).toISOString(),
        assignedCounselorId: null,
        responseMode: "AI_ACTIVE",
      },
    ]);

    render(<ConsultationPage />, { wrapper: Wrapper });

    await waitFor(() => {
      expect(screen.getByText("김민지")).toBeInTheDocument();
    });

    const customerItem = screen.getByText("김민지").closest('[role="button"]');
    if (customerItem) {
      fireEvent.click(customerItem);
    }

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "AI 응대중" })).toBeDisabled();
    });
    expect(screen.getByRole("button", { name: "상담사 응대중" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "AI 보조만 사용" })).toBeDisabled();
  });

  it("opens confirmation before releasing the current counselor assignment", async () => {
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
      expect(screen.getByText("배정 해제")).toBeEnabled();
    });

    fireEvent.click(screen.getByText("배정 해제"));

    expect(consultationApi.releaseSession).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog")).toHaveTextContent("김민지 고객 배정 해제");
    expect(screen.getByText(/다시 미배정 대기열로 돌아가며/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "해제 확인" }));

    await waitFor(() => {
      expect(consultationApi.releaseSession).toHaveBeenCalledWith(1);
    });
  });

  it("warns about in-progress content and preserves it when release is cancelled", async () => {
    const user = userEvent.setup();
    render(<ConsultationPage />, { wrapper: Wrapper });

    await waitFor(() => {
      expect(screen.getByText("김민지")).toBeInTheDocument();
    });

    const customerItem = screen.getByText("김민지").closest('[role="button"]');
    if (customerItem) {
      fireEvent.click(customerItem);
    }

    const input = await screen.findByPlaceholderText("메시지를 입력하세요...");
    await user.type(input, "임시 답변");

    const memo = await screen.findByPlaceholderText(
      "타임라인에 내부 메모로 남길 내용을 입력하세요...",
    );
    await user.type(memo, "카드사 확인 필요");

    const messageGroup = screen.getByText("환불 문의 드립니다.").closest('[role="button"]');
    if (!messageGroup) throw new Error("message group not found");
    fireEvent.click(messageGroup);

    await waitFor(() => {
      expect(screen.getByTestId("message-domain-empty")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("배정 해제"));

    expect(screen.getByText("메시지 입력창에 작성 중인 답변이 있습니다.")).toBeInTheDocument();
    expect(screen.getByText("우측 패널에 저장하지 않은 내부 메모가 있습니다.")).toBeInTheDocument();
    expect(screen.getByText("선택한 메시지 상세 맥락이 닫힙니다.")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "취소" }));

    expect(consultationApi.releaseSession).not.toHaveBeenCalled();
    expect(input).toHaveValue("임시 답변");
    expect(screen.getByTestId("message-domain-empty")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "닫기" }));
    expect(
      screen.getByPlaceholderText("타임라인에 내부 메모로 남길 내용을 입력하세요..."),
    ).toHaveValue("카드사 확인 필요");
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

    fireEvent.click(screen.getByRole("button", { name: "상담 종료" }));

    expect(consultationApi.updateStatus).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: /고객 이탈/ }));
    fireEvent.click(screen.getByRole("button", { name: "종료 확인" }));

    await waitFor(() => {
      expect(consultationApi.updateStatus).toHaveBeenCalledWith(1, {
        status: "COMPLETED",
        resolutionOutcome: "CUSTOMER_LEFT",
        resolutionReason: undefined,
        followUpRequired: false,
      });
    });

    await waitFor(() => {
      expect(screen.queryByText("상담 종료")).not.toBeInTheDocument();
    });
  });

  it("keeps the session unchanged when end session modal is cancelled", async () => {
    render(<ConsultationPage />, { wrapper: Wrapper });

    await waitFor(() => {
      expect(screen.getByText("김민지")).toBeInTheDocument();
    });

    const customerItem = screen.getByText("김민지").closest("div");
    if (customerItem) customerItem.click();

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "상담 종료" })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "상담 종료" }));
    fireEvent.click(screen.getByRole("button", { name: "취소" }));

    expect(consultationApi.updateStatus).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "상담 종료" })).toBeInTheDocument();
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
    expect(screen.getByText("전송 중")).toBeInTheDocument();
  });

  it("marks an optimistic counselor message as sent when the server echo arrives", async () => {
    const user = userEvent.setup();
    render(<ConsultationPage />, { wrapper: Wrapper });

    await waitFor(() => {
      expect(screen.getByText("김민지")).toBeInTheDocument();
    });

    const customerItem = screen.getByText("김민지").closest("div");
    if (customerItem) customerItem.click();

    await waitFor(() => {
      expect(screen.getByText("상담 종료")).toBeEnabled();
      expect(stompState.callbacks.has("/topic/chat.1")).toBe(true);
    });

    const input = await screen.findByPlaceholderText("메시지를 입력하세요...");
    await user.type(input, "처리 도와드리겠습니다.");
    await user.keyboard("{Enter}");

    expect(screen.getByText("전송 중")).toBeInTheDocument();

    act(() => {
      stompState.callbacks.get("/topic/chat.1")?.({
        id: 201,
        senderRole: "COUNSELOR",
        content: "처리 도와드리겠습니다.",
        createdAt: new Date().toISOString(),
      });
    });

    await waitFor(() => {
      expect(screen.queryByText("전송 중")).not.toBeInTheDocument();
    });
    expect(screen.queryByText("전송 실패")).not.toBeInTheDocument();
    expect(screen.getAllByText("처리 도와드리겠습니다.")).toHaveLength(1);
  });

  it("marks the oldest pending message as failed when the server error queue reports a send error", async () => {
    const user = userEvent.setup();
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
    await user.type(input, "권한 오류가 날 메시지");
    await user.keyboard("{Enter}");

    act(() => {
      stompState.onServerError?.({
        senderRole: "SYSTEM",
        messageType: "ERROR",
        content: "[SESSION_NOT_ASSIGNED] Session is not assigned",
      });
    });

    await waitFor(() => {
      expect(screen.getByText("전송 실패")).toBeInTheDocument();
    });
    expect(screen.getByRole("button", { name: "다시 보내기" })).toBeInTheDocument();
  });

  it("marks a pending message as failed when the server echo times out", async () => {
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
    vi.useFakeTimers();
    try {
      fireEvent.change(input, { target: { value: "응답이 늦는 메시지" } });
      fireEvent.keyDown(input, { key: "Enter" });

      expect(screen.getByText("전송 중")).toBeInTheDocument();

      act(() => {
        vi.advanceTimersByTime(8000);
      });

      expect(screen.getByText("전송 실패")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "다시 보내기" })).toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it("retries a failed message without leaving a duplicate after the echo succeeds", async () => {
    const user = userEvent.setup();
    render(<ConsultationPage />, { wrapper: Wrapper });

    await waitFor(() => {
      expect(screen.getByText("김민지")).toBeInTheDocument();
    });

    const customerItem = screen.getByText("김민지").closest("div");
    if (customerItem) customerItem.click();

    await waitFor(() => {
      expect(screen.getByText("상담 종료")).toBeEnabled();
      expect(stompState.callbacks.has("/topic/chat.1")).toBe(true);
    });

    const input = await screen.findByPlaceholderText("메시지를 입력하세요...");
    await user.type(input, "다시 보낼 메시지");
    await user.keyboard("{Enter}");

    act(() => {
      stompState.onServerError?.({
        senderRole: "SYSTEM",
        messageType: "ERROR",
        content: "[INTERNAL_ERROR] failed",
      });
    });

    const retryButton = await screen.findByRole("button", { name: "다시 보내기" });
    await user.click(retryButton);

    await waitFor(() => {
      expect(mockSendTo).toHaveBeenCalledTimes(2);
    });
    expect(screen.getByText("전송 중")).toBeInTheDocument();
    expect(screen.queryByText("전송 실패")).not.toBeInTheDocument();

    act(() => {
      stompState.callbacks.get("/topic/chat.1")?.({
        id: 202,
        senderRole: "COUNSELOR",
        content: "다시 보낼 메시지",
        createdAt: new Date().toISOString(),
      });
    });

    await waitFor(() => {
      expect(screen.queryByText("전송 중")).not.toBeInTheDocument();
    });
    expect(screen.getAllByText("다시 보낼 메시지")).toHaveLength(1);
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

  it("shows a queue sync notice while the websocket connection is unstable", async () => {
    stompState.connectionStatus = "ERROR";

    render(<ConsultationPage />, { wrapper: Wrapper });

    await waitFor(() => {
      expect(screen.getByText("김민지")).toBeInTheDocument();
    });
    expect(
      screen.getByText("실시간 연결이 불안정합니다. 복구되면 대기열을 다시 동기화합니다."),
    ).toBeInTheDocument();
  });

  it("refetches the queue snapshot after websocket reconnect", async () => {
    stompState.connectionStatus = "DISCONNECTED";
    const { rerender } = render(<ConsultationPage />, { wrapper: Wrapper });

    await waitFor(() => {
      expect(consultationApi.getQueue).toHaveBeenCalledTimes(1);
      expect(screen.getByText("김민지")).toBeInTheDocument();
    });

    stompState.connectionStatus = "CONNECTED";
    rerender(<ConsultationPage />);

    await waitFor(() => {
      expect(consultationApi.getQueue).toHaveBeenCalledTimes(2);
    });
    expect(mockSubscribe).toHaveBeenCalledWith(
      "/topic/workspaces.2.consultation.queue",
      expect.any(Function),
    );
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

    vi.mocked(consultationApi.getMessagePage).mockRejectedValueOnce(new Error("DB Error"));

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

    vi.mocked(consultationApi.getMessagePage).mockResolvedValueOnce({
      content: [],
      page: 0,
      size: 50,
      totalElements: 0,
      totalPages: 0,
    });

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

    fireEvent.click(screen.getByRole("button", { name: "상담 종료" }));
    fireEvent.click(screen.getByRole("button", { name: /해결됨/ }));
    fireEvent.click(screen.getByRole("button", { name: "종료 확인" }));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("세션 종료 실패");
    });
    expect(screen.getByRole("dialog")).toBeInTheDocument();
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
