import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ChatRoom } from "./ChatRoom";

const stompState = vi.hoisted(() => ({
  connectionStatus: "CONNECTED" as "CONNECTING" | "CONNECTED" | "DISCONNECTED" | "ERROR",
  lastMessage: null as unknown,
  sendMessage: vi.fn(),
  connect: vi.fn(),
  disconnect: vi.fn(),
}));

vi.mock("@/shared/lib/websocket", () => ({
  useStomp: () => stompState,
}));

describe("ChatRoom", () => {
  beforeEach(() => {
    stompState.connectionStatus = "CONNECTED";
    stompState.lastMessage = null;
    stompState.sendMessage.mockReset();
  });

  it("연결 상태와 빈 메시지 상태를 렌더링한다", () => {
    render(<ChatRoom sessionId={7} />);

    expect(screen.getByText("연결됨")).toBeInTheDocument();
    expect(screen.getByText("아직 메시지가 없습니다. 첫 메시지를 보내보세요!")).toBeInTheDocument();
  });

  it("lastMessage가 바뀌면 메시지 목록에 추가한다", () => {
    const { rerender } = render(<ChatRoom sessionId={7} />);

    act(() => {
      stompState.lastMessage = {
        id: "m1",
        sessionId: 7,
        content: "안녕하세요",
        senderType: "BOT",
        createdAt: "2026-05-22T08:00:00Z",
      };
    });
    rerender(<ChatRoom sessionId={7} />);

    expect(screen.getByText("안녕하세요")).toBeInTheDocument();
  });

  it("입력 메시지를 sessionId와 함께 전송한다", () => {
    render(<ChatRoom sessionId={7} />);

    fireEvent.change(screen.getByLabelText("메시지 입력"), { target: { value: "문의합니다" } });
    fireEvent.click(screen.getByRole("button", { name: "메시지 보내기" }));

    expect(stompState.sendMessage).toHaveBeenCalledWith({ sessionId: 7, content: "문의합니다" });
  });

  it("연결되지 않으면 입력을 비활성화한다", () => {
    stompState.connectionStatus = "DISCONNECTED";

    render(<ChatRoom sessionId={7} />);

    expect(screen.getByLabelText("메시지 입력")).toBeDisabled();
  });
});
