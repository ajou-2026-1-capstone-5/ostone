import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import type { ChatMessage, DemoChatSession } from "@/entities/chat";
import { ChatConversationScreen } from "./ChatConversationScreen";

function buildSession(overrides: Partial<DemoChatSession> = {}): DemoChatSession {
  const baseMessages: ChatMessage[] = [
    {
      id: "1",
      sessionId: 77,
      content: "안녕하세요, 김민지님.",
      senderType: "BOT",
      createdAt: "2026-05-22T00:00:00Z",
    },
    {
      id: "2",
      sessionId: 77,
      content: "결제 오류 환불 진행 상태 알려주세요.",
      senderType: "USER",
      senderName: "김민지",
      createdAt: "2026-05-22T00:00:10Z",
    },
  ];
  return {
    id: "77",
    status: "OPEN",
    startedAt: "2026-05-22T00:00:00Z",
    messages: baseMessages,
    ...overrides,
  };
}

function setup(overrides: Partial<Parameters<typeof ChatConversationScreen>[0]> = {}) {
  const props: Parameters<typeof ChatConversationScreen>[0] = {
    session: buildSession(),
    customerName: "김민지",
    workspaceId: 42,
    isSending: false,
    connectionStatus: "CONNECTED",
    messageError: null,
    onSend: vi.fn(),
    onStartNewSession: vi.fn(),
    ...overrides,
  };
  const view = render(<ChatConversationScreen {...props} />);
  return { props, ...view };
}

describe("ChatConversationScreen", () => {
  it("renders ChatHeader 와 meta strip, message list 를 포함한다", () => {
    setup();

    expect(screen.getByTestId("chat-header")).toBeInTheDocument();
    expect(screen.getByTestId("chat-meta-strip")).toHaveTextContent("연결됨");
    expect(screen.getByTestId("chat-meta-strip")).toHaveTextContent("Workspace #42");
    expect(screen.getByTestId("chat-meta-strip")).toHaveTextContent("운영 도메인 팩 기준");
    expect(screen.getByTestId("chat-session-reuse-note")).toHaveTextContent("김민지 테스트 세션");
    expect(screen.queryByTestId("chat-connection-notice")).not.toBeInTheDocument();
    expect(screen.getByLabelText("메시지 입력")).toBeEnabled();
  });

  it("session.messages 의 본문이 화면에 렌더된다", () => {
    setup();

    expect(screen.getByText("안녕하세요, 김민지님.")).toBeInTheDocument();
    expect(screen.getByText("결제 오류 환불 진행 상태 알려주세요.")).toBeInTheDocument();
  });

  it("botTyping 이 true 이면 봇 입력 표시를 렌더한다", () => {
    setup({ botTyping: true });

    expect(screen.getByTestId("bot-typing-indicator")).toBeInTheDocument();
  });

  it("messageError 와 연결 안내가 동시에 필요한 경우 각각 렌더", () => {
    setup({
      connectionStatus: "DISCONNECTED",
      messageError: "응답을 생성하지 못했습니다.",
    });

    const alert = screen.getByTestId("chat-message-error");
    expect(alert).toHaveAttribute("role", "alert");
    expect(alert).toHaveTextContent("응답을 생성하지 못했습니다.");

    const notice = screen.getByTestId("chat-connection-notice");
    expect(notice).toHaveAttribute("role", "status");
    expect(notice).toHaveTextContent("자동 재연결을 시도합니다.");
  });

  it("MessageInput 의 send 클릭이 onSend 호출", () => {
    const onSend = vi.fn();
    setup({ onSend });

    fireEvent.change(screen.getByLabelText("메시지 입력"), { target: { value: "Hello" } });
    fireEvent.click(screen.getByLabelText("메시지 보내기"));
    expect(onSend).toHaveBeenCalledWith("Hello");
  });

  it("isSending=true 면 MessageInput 이 disabled", () => {
    setup({ isSending: true });

    expect(screen.getByLabelText("메시지 입력")).toBeDisabled();
    expect(screen.getByLabelText("메시지 보내기")).toBeDisabled();
  });

  it("입력값이 비어 있으면 연결됨 상태에서도 전송 버튼이 disabled", () => {
    setup();

    expect(screen.getByLabelText("메시지 입력")).toBeEnabled();
    expect(screen.getByLabelText("메시지 보내기")).toBeDisabled();
  });

  it.each([
    {
      status: "CONNECTING" as const,
      label: "연결 중",
      notice: "실시간 연결을 준비하는 중입니다.",
      dotColor: "var(--ink-4)",
    },
    {
      status: "DISCONNECTED" as const,
      label: "재연결 중",
      notice: "실시간 연결이 끊어졌습니다.",
      dotColor: "var(--ink-4)",
    },
    {
      status: "ERROR" as const,
      label: "오프라인",
      notice: "네트워크 상태를 확인한 뒤 다시 시도해 주세요.",
      dotColor: "var(--danger)",
    },
  ])(
    "$label 상태에서는 연결 안내를 표시하고 입력을 비활성화한다",
    ({ status, label, notice, dotColor }) => {
      setup({ connectionStatus: status });

      expect(screen.getByTestId("chat-meta-strip")).toHaveTextContent(label);
      expect(screen.getByTestId("chat-connection-dot").style.background).toBe(dotColor);
      expect(screen.getByTestId("chat-connection-notice")).toHaveTextContent(notice);
      expect(screen.getByLabelText("메시지 입력")).toBeDisabled();
      expect(screen.getByLabelText("메시지 보내기")).toBeDisabled();
    },
  );

  it("연결이 복구되면 안내가 사라지고 입력 가능 상태로 돌아온다", () => {
    const { props, rerender } = setup({ connectionStatus: "DISCONNECTED" });

    expect(screen.getByTestId("chat-connection-notice")).toHaveTextContent("자동 재연결");
    expect(screen.getByLabelText("메시지 입력")).toBeDisabled();

    rerender(<ChatConversationScreen {...props} connectionStatus="CONNECTED" />);

    expect(screen.getByTestId("chat-meta-strip")).toHaveTextContent("연결됨");
    expect(screen.queryByTestId("chat-connection-notice")).not.toBeInTheDocument();
    expect(screen.getByLabelText("메시지 입력")).toBeEnabled();
  });

  it("새 테스트 세션 시작 클릭이 onStartNewSession 호출", () => {
    const onStartNewSession = vi.fn();
    setup({ onStartNewSession });

    fireEvent.click(screen.getByRole("button", { name: "새 테스트 세션 시작" }));
    expect(onStartNewSession).toHaveBeenCalled();
  });

  it("ChatHeader 가 session.id 와 status 를 노출한다", () => {
    setup({ session: buildSession({ id: "9", status: "CLOSED" }) });

    expect(screen.getByTestId("chat-header-eyebrow")).toHaveTextContent("Session #9");
    expect(screen.getByTestId("chat-header-status")).toHaveTextContent("CLOSED");
  });
});
