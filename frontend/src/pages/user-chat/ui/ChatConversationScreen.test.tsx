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
    isSending: false,
    messageError: null,
    onSend: vi.fn(),
    ...overrides,
  };
  render(<ChatConversationScreen {...props} />);
  return props;
}

describe("ChatConversationScreen", () => {
  it("renders ChatHeader 와 meta strip, message list 를 포함한다", () => {
    setup();

    expect(screen.getByTestId("chat-header")).toBeInTheDocument();
    expect(screen.getByTestId("chat-meta-strip")).toHaveTextContent("연결됨");
    expect(screen.getByTestId("chat-meta-strip")).toHaveTextContent("김민지");
  });

  it("session.messages 의 본문이 화면에 렌더된다", () => {
    setup();

    expect(screen.getByText("안녕하세요, 김민지님.")).toBeInTheDocument();
    expect(screen.getByText("결제 오류 환불 진행 상태 알려주세요.")).toBeInTheDocument();
  });

  it("messageError 가 주어지면 role=alert 으로 에러 배너를 렌더", () => {
    setup({ messageError: "응답을 생성하지 못했습니다." });

    const alert = screen.getByTestId("chat-message-error");
    expect(alert).toHaveAttribute("role", "alert");
    expect(alert).toHaveTextContent("응답을 생성하지 못했습니다.");
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

  it("ChatHeader 가 session.id 와 status 를 노출한다", () => {
    setup({ session: buildSession({ id: "9", status: "CLOSED" }) });

    expect(screen.getByTestId("chat-header-eyebrow")).toHaveTextContent("Session #9");
    expect(screen.getByTestId("chat-header-status")).toHaveTextContent("CLOSED");
  });
});
