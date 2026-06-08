import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import {
  Wrapper,
  getQueueCustomerButton,
  mockSendTo,
  mockSubscribe,
  stompState,
} from "./ConsultationPage.test-helper";
import { consultationApi } from "../../../features/consultation/api/consultationApi";
import { toast } from "sonner";
import { ConsultationPage } from "./ConsultationPage";

describe("ConsultationPage realtime messaging", () => {
  it("subscribes to STOMP topic when a customer is selected and connection is established", async () => {
    render(<ConsultationPage />, { wrapper: Wrapper });

    await waitFor(() => {
      expect(screen.getByText("김민지")).toBeInTheDocument();
    });

    const customerItem = getQueueCustomerButton("김민지");
    if (customerItem) customerItem.click();

    await waitFor(() => {
      expect(mockSubscribe).toHaveBeenCalledWith(
        "/topic/chat.1",
        expect.any(Function),
      );
    });
  });

  it("sends messages through counselor STOMP endpoint and adds an optimistic message", async () => {
    const user = userEvent.setup();
    render(<ConsultationPage />, { wrapper: Wrapper });

    await waitFor(() => {
      expect(screen.getByText("김민지")).toBeInTheDocument();
    });

    const customerItem = getQueueCustomerButton("김민지");
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

    const customerItem = getQueueCustomerButton("김민지");
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

    const customerItem = getQueueCustomerButton("김민지");
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
    expect(
      screen.getByRole("button", { name: "다시 보내기" }),
    ).toBeInTheDocument();
  });

  it("marks a pending message as failed when the server echo times out", async () => {
    render(<ConsultationPage />, { wrapper: Wrapper });

    await waitFor(() => {
      expect(screen.getByText("김민지")).toBeInTheDocument();
    });

    const customerItem = getQueueCustomerButton("김민지");
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
      expect(
        screen.getByRole("button", { name: "다시 보내기" }),
      ).toBeInTheDocument();
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

    const customerItem = getQueueCustomerButton("김민지");
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

    const retryButton = await screen.findByRole("button", {
      name: "다시 보내기",
    });
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

  it("does not send message and shows error toast when STOMP is disconnected", async () => {
    const user = userEvent.setup();
    stompState.connectionStatus = "DISCONNECTED";

    render(<ConsultationPage />, { wrapper: Wrapper });

    await waitFor(() => {
      expect(screen.getByText("김민지")).toBeInTheDocument();
    });

    const customerItem = getQueueCustomerButton("김민지");
    if (customerItem) customerItem.click();

    await waitFor(() => {
      expect(screen.getByText("상담 종료")).toBeEnabled();
    });

    const input = await screen.findByPlaceholderText("메시지를 입력하세요...");
    await user.type(input, "보낼 수 없는 메시지");
    await user.keyboard("{Enter}");

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(
        "연결이 불안정합니다. 잠시 후 다시 시도해주세요.",
      );
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

    const customerItem = getQueueCustomerButton("김민지");
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

  it("renders realtime customer and assistant messages in server sequence order", async () => {
    render(<ConsultationPage />, { wrapper: Wrapper });

    await waitFor(() => {
      expect(screen.getByText("김민지")).toBeInTheDocument();
    });

    const customerItem = getQueueCustomerButton("김민지");
    if (customerItem) customerItem.click();

    await waitFor(() => {
      expect(screen.getByText("환불 문의 드립니다.")).toBeInTheDocument();
      expect(stompState.callbacks.has("/topic/chat.1")).toBe(true);
    });

    act(() => {
      stompState.callbacks.get("/topic/chat.1")?.({
        id: 302,
        seqNo: 3,
        senderRole: "ASSISTANT",
        content: "챗봇 응답입니다.",
        createdAt: "2026-05-27T00:00:03+09:00",
      });
      stompState.callbacks.get("/topic/chat.1")?.({
        id: 301,
        seqNo: 2,
        senderRole: "CUSTOMER",
        content: "사용자 응답입니다.",
        createdAt: "2026-05-27T00:00:02+09:00",
      });
    });

    const messageList = screen.getByTestId("chat-message-list");
    await waitFor(() => {
      expect(messageList).toHaveTextContent(
        /환불 문의 드립니다\.[\s\S]*사용자 응답입니다\.[\s\S]*챗봇 응답입니다\./,
      );
    });
  });

  it("keeps createdAt order when seqNo-less realtime messages arrive out of order", async () => {
    render(<ConsultationPage />, { wrapper: Wrapper });

    await waitFor(() => {
      expect(screen.getByText("김민지")).toBeInTheDocument();
    });

    const customerItem = getQueueCustomerButton("김민지");
    if (customerItem) customerItem.click();

    await waitFor(() => {
      expect(screen.getByText("환불 문의 드립니다.")).toBeInTheDocument();
      expect(stompState.callbacks.has("/topic/chat.1")).toBe(true);
    });

    // 서버가 seqNo를 싣지 않은 채 챗봇 응답이 사용자 응답보다 먼저 도착(역순)해도
    // createdAt 기준으로 사용자 응답이 먼저 렌더링되어야 한다.
    act(() => {
      stompState.callbacks.get("/topic/chat.1")?.({
        id: 402,
        senderRole: "ASSISTANT",
        content: "역순 챗봇 메시지.",
        createdAt: "2026-05-27T00:00:09+09:00",
      });
      stompState.callbacks.get("/topic/chat.1")?.({
        id: 401,
        senderRole: "CUSTOMER",
        content: "역순 사용자 메시지.",
        createdAt: "2026-05-27T00:00:08+09:00",
      });
    });

    const messageList = screen.getByTestId("chat-message-list");
    await waitFor(() => {
      expect(messageList).toHaveTextContent(
        /역순 사용자 메시지\.[\s\S]*역순 챗봇 메시지\./,
      );
    });
  });

  it("handles counselor echo and replaces the pending optimistic message", async () => {
    const user = userEvent.setup();
    render(<ConsultationPage />, { wrapper: Wrapper });

    await waitFor(() => {
      expect(screen.getByText("김민지")).toBeInTheDocument();
    });

    const customerItem = getQueueCustomerButton("김민지");
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

    const customerItem = getQueueCustomerButton("김민지");
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

    const customerItem = getQueueCustomerButton("김민지");
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
      expect(
        screen.queryByText("임시 메시지 없는 에코"),
      ).not.toBeInTheDocument();
    });
  });
});
