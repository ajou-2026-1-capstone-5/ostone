import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import "@testing-library/jest-dom/vitest";
import { ConsultationPage } from "./ConsultationPage";
import { consultationApi } from "../../../features/consultation/api/consultationApi";
import { toast } from "sonner";

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

interface RealtimeChatMessage {
  id: string | number;
  senderRole: string;
  content?: string | null;
  createdAt?: string | null;
  timestamp?: string | null;
}

const { mockSubscribe, mockSendTo, stompState } = vi.hoisted(() => {
  const mockUnsubscribe = vi.fn();
  const stompState = {
    connectionStatus: "CONNECTED" as "CONNECTED" | "DISCONNECTED",
    latestCallback: null as ((msg: RealtimeChatMessage) => void) | null,
  };
  return {
    mockUnsubscribe,
    mockSubscribe: vi.fn((_topic: string, callback: (msg: RealtimeChatMessage) => void) => {
      stompState.latestCallback = callback;
      return mockUnsubscribe;
    }),
    mockSendTo: vi.fn(),
    stompState,
  };
});

const shellContext = {
  setTopbarRight: vi.fn(),
  setCrumbs: vi.fn(),
  workspace: null,
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
  },
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

describe("ConsultationPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    stompState.connectionStatus = "CONNECTED";
    stompState.latestCallback = null;
    window.alert = vi.fn();
  });

  it("renders 3-pane structure with QueuePanel, ChatPanel, and CustomerPanel", async () => {
    render(<ConsultationPage />, { wrapper: Wrapper });

    await waitFor(() => {
      expect(screen.getByText("김민지")).toBeInTheDocument();
    });

    expect(screen.getByText("대기 고객")).toBeInTheDocument();
    expect(screen.getByText("좌측 대기 목록에서 고객을 선택해주세요")).toBeInTheDocument();
    expect(screen.getByText("고객을 선택하면 정보가 표시됩니다")).toBeInTheDocument();
  });

  it("shows customer banner with AI classification after selecting a customer", async () => {
    render(<ConsultationPage />, { wrapper: Wrapper });

    await waitFor(() => {
      expect(screen.getByText("김민지")).toBeInTheDocument();
    });

    const customerItem = screen.getByText("김민지").closest("div");
    if (customerItem) {
      customerItem.click();
    }

    await waitFor(() => {
      expect(screen.getByText("AI가 분류한 주제")).toBeInTheDocument();
    });

    expect(screen.getByText("카드 환불 — 부분환불")).toBeInTheDocument();
    expect(screen.getByText("상담 종료")).toBeInTheDocument();
  });

  it("renders AI suggest strip with 3 pills when customer is active", async () => {
    render(<ConsultationPage />, { wrapper: Wrapper });

    await waitFor(() => {
      expect(screen.getByText("김민지")).toBeInTheDocument();
    });

    const customerItem = screen.getByText("김민지").closest("div");
    if (customerItem) {
      customerItem.click();
    }

    await waitFor(() => {
      expect(screen.getByText("추천 답변")).toBeInTheDocument();
    });

    expect(screen.getByText("부분환불 가능합니다")).toBeInTheDocument();
    expect(screen.getByText("환불 처리 중입니다")).toBeInTheDocument();
    expect(screen.getByText("카드사 확인이 필요합니다")).toBeInTheDocument();
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

    expect(screen.queryByText("AI가 분류한 주제")).not.toBeInTheDocument();
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

  it("sends messages through STOMP and adds an optimistic message", async () => {
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
      expect(screen.getByText("가격 문의")).toBeInTheDocument();
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
      expect(screen.getByText("가격 문의")).toBeInTheDocument();
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
      expect(screen.getByText("가격 문의")).toBeInTheDocument();
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
      expect(screen.getByText("가격 문의")).toBeInTheDocument();
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

  it("shows error toast when loading queue fails", async () => {
    vi.mocked(consultationApi.getQueue).mockRejectedValueOnce(new Error("Network Error"));

    render(<ConsultationPage />, { wrapper: Wrapper });

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("대기열을 불러오지 못했습니다.");
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
    vi.mocked(consultationApi.getQueue).mockResolvedValueOnce([
      {
        id: 1,
        status: "OPEN",
        channel: "카카오톡",
        metaJson: JSON.stringify({ customerName: "김민지", handoffReason: "환불 문의" }),
        startedAt: new Date().toISOString(),
      },
      {
        id: 2,
        status: "OPEN",
        channel: "카카오톡",
        metaJson: JSON.stringify({ customerName: "홍길동", handoffReason: "기타 문의" }),
        startedAt: new Date().toISOString(),
      }
    ]);

    render(<ConsultationPage />, { wrapper: Wrapper });

    await waitFor(() => {
      expect(screen.getByText("김민지")).toBeInTheDocument();
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
      expect(screen.getByText("가격 문의")).toBeInTheDocument();
    });

    vi.mocked(consultationApi.getMessages).mockResolvedValueOnce([]);

    const hongEl = screen.getByText("홍길동").closest("div");
    if (hongEl) hongEl.click();

    await waitFor(() => {
      expect(screen.getByText("고객 정보")).toBeInTheDocument();
      expect(screen.queryByText("가격 문의")).not.toBeInTheDocument();
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

    const input = await screen.findByPlaceholderText("메시지를 입력하세요...");
    await user.type(input, "보낼 수 없는 메시지");
    await user.keyboard("{Enter}");

    expect(toast.error).toHaveBeenCalledWith("연결이 불안정합니다. 잠시 후 다시 시도해주세요.");
    expect(mockSendTo).not.toHaveBeenCalled();
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

    const textarea = await screen.findByPlaceholderText("상담 메모를 입력하세요...");
    await user.type(textarea, "고객이 매우 다급함");

    expect(textarea).toHaveValue("고객이 매우 다급함");
  });
});
