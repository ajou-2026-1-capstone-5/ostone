import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MessageList } from "./MessageList";
import type { ChatMessage } from "../../../entities/chat";

const messages: ChatMessage[] = [
  {
    id: "m1",
    sessionId: 1,
    content: "배송이 지연됐어요",
    senderType: "USER",
    senderName: "고객",
    createdAt: "2026-05-22T08:00:00Z",
  },
  {
    id: "m2",
    sessionId: 1,
    content: "확인해 드리겠습니다",
    senderType: "BOT",
    senderName: "봇",
    createdAt: "2026-05-22T08:01:00Z",
  },
];

describe("MessageList", () => {
  it("loading 상태를 표시한다", () => {
    render(<MessageList messages={[]} loading />);

    expect(screen.getByText("메시지를 불러오는 중입니다...")).not.toBeNull();
  });

  it("빈 메시지 상태를 표시한다", () => {
    render(<MessageList messages={[]} />);

    expect(screen.getByText("아직 메시지가 없습니다. 첫 메시지를 보내보세요!")).not.toBeNull();
  });

  it("봇 입력 표시 상태를 렌더링한다", () => {
    render(<MessageList messages={[]} botTyping />);

    expect(screen.getByTestId("bot-typing-indicator")).toBeInTheDocument();
    expect(screen.getByLabelText("봇이 응답을 입력하는 중입니다")).toBeInTheDocument();
    expect(screen.queryByText("입력 중...")).not.toBeInTheDocument();
  });

  it("에러 상태를 표시한다", () => {
    render(<MessageList messages={[]} error="세션을 만들 수 없습니다." />);

    expect(screen.getByText("세션을 만들 수 없습니다.")).not.toBeNull();
  });

  it("사용자와 응답 메시지를 서로 다른 정렬로 렌더링한다", () => {
    render(<MessageList messages={messages} />);

    expect(screen.getByText("배송이 지연됐어요")).not.toBeNull();
    expect(screen.getByText("확인해 드리겠습니다")).not.toBeNull();
    expect(screen.getByTestId("message-m1")).toHaveAttribute("data-sender", "user");
    expect(screen.getByTestId("message-m2")).toHaveAttribute("data-sender", "bot");
  });

  it("시스템 메시지를 중앙 안내로 렌더링한다", () => {
    const systemMessages: ChatMessage[] = [
      {
        id: "sys-1",
        sessionId: 1,
        content: "상담사가 배정되었습니다.",
        senderType: "SYSTEM",
        createdAt: "2026-05-22T08:02:00Z",
      },
    ];
    render(<MessageList messages={systemMessages} />);

    const systemMessage = screen.getByTestId("message-sys-1");
    expect(systemMessage).toHaveAttribute("data-sender", "system");
    expect(systemMessage).toHaveAttribute("role", "status");
    expect(systemMessage).toHaveTextContent("상담사가 배정되었습니다.");
  });

  it("새 메시지가 렌더링되면 하단으로 스크롤한다", () => {
    const originalScrollIntoView = window.HTMLElement.prototype.scrollIntoView;
    const scrollIntoView = vi.fn();
    window.HTMLElement.prototype.scrollIntoView = scrollIntoView;

    const { rerender } = render(<MessageList messages={[messages[0]!]} />);
    rerender(<MessageList messages={messages} />);

    expect(scrollIntoView).toHaveBeenCalled();
    window.HTMLElement.prototype.scrollIntoView = originalScrollIntoView;
  });
});
