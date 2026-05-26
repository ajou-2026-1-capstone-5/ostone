import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import "@testing-library/jest-dom/vitest";
import { ChatRoom } from "./ChatRoom";

const stompState = vi.hoisted(() => {
  const callbacks = new Map<string, (msg: unknown) => void>();
  const subscribe = vi.fn((topic: string, cb: (msg: unknown) => void) => {
    callbacks.set(topic, cb);
    return () => {};
  });
  return {
    connectionStatus: "CONNECTED" as "CONNECTING" | "CONNECTED" | "DISCONNECTED" | "ERROR",
    sendMessage: vi.fn(),
    connect: vi.fn(),
    disconnect: vi.fn(),
    subscribe,
    dispatch: (topic: string, msg: unknown) => callbacks.get(topic)?.(msg),
  };
});

vi.mock("@/shared/lib/websocket", () => ({
  useStomp: () => stompState,
}));

describe("ChatRoom", () => {
  beforeEach(() => {
    stompState.connectionStatus = "CONNECTED";
    stompState.sendMessage.mockReset();
    stompState.subscribe.mockClear();
  });

  it("연결 상태와 빈 메시지 상태를 렌더링한다", () => {
    render(<ChatRoom sessionId={7} />);

    expect(screen.getByText("연결됨")).toBeInTheDocument();
    expect(screen.getByText("아직 메시지가 없습니다. 첫 메시지를 보내보세요!")).toBeInTheDocument();
  });

  it("STOMP 메시지 수신 시 메시지 목록에 추가한다", async () => {
    render(<ChatRoom sessionId={7} />);

    await waitFor(() => {
      expect(stompState.subscribe).toHaveBeenCalledWith("/topic/chat.7", expect.any(Function));
    });

    act(() => {
      stompState.dispatch("/topic/chat.7", {
        id: 1,
        seqNo: 1,
        senderRole: "ASSISTANT",
        messageType: "TEXT",
        content: "안녕하세요",
        createdAt: "2026-05-22T08:00:00Z",
      });
    });

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
