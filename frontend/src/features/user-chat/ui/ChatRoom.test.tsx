import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import "@testing-library/jest-dom/vitest";
import { ChatRoom } from "./ChatRoom";

const { stompState, listChatMessagesMock } = vi.hoisted(() => {
  const callbacks = new Map<string, (msg: unknown) => void>();
  const subscribe = vi.fn((topic: string, cb: (msg: unknown) => void) => {
    callbacks.set(topic, cb);
    return () => {};
  });
  return {
    listChatMessagesMock: vi.fn(),
    stompState: {
      connectionStatus: "CONNECTED" as "CONNECTING" | "CONNECTED" | "DISCONNECTED" | "ERROR",
      sendMessage: vi.fn(),
      connect: vi.fn(),
      disconnect: vi.fn(),
      subscribe,
      dispatch: (topic: string, msg: unknown) => callbacks.get(topic)?.(msg),
    },
  };
});

vi.mock("@/entities/chat", () => ({
  listChatMessages: listChatMessagesMock,
}));

vi.mock("@/shared/lib/websocket", () => ({
  useStomp: () => stompState,
}));

describe("ChatRoom", () => {
  beforeEach(() => {
    stompState.connectionStatus = "CONNECTED";
    stompState.sendMessage.mockReset();
    stompState.subscribe.mockClear();
    listChatMessagesMock.mockReset();
    listChatMessagesMock.mockResolvedValue([]);
  });

  it("연결 상태와 빈 메시지 상태를 렌더링한다", async () => {
    render(<ChatRoom sessionId={7} />);

    expect(screen.getByText("연결됨")).toBeInTheDocument();
    expect(
      await screen.findByText("아직 메시지가 없습니다. 첫 메시지를 보내보세요!"),
    ).toBeInTheDocument();
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

  it("초기 메시지를 불러와 렌더링한다", async () => {
    listChatMessagesMock.mockResolvedValue([
      {
        id: "m1",
        sessionId: 7,
        senderType: "BOT",
        content: "이전 메시지",
        createdAt: "2026-05-22T08:00:00Z",
      },
    ]);

    render(<ChatRoom sessionId={7} />);

    expect(await screen.findByText("이전 메시지")).toBeInTheDocument();
    expect(listChatMessagesMock).toHaveBeenCalledWith(7);
  });

  it("초기 메시지 로딩 중 도착한 STOMP 메시지를 유지한다", async () => {
    let resolveInitialMessages: (messages: unknown[]) => void = () => {};
    listChatMessagesMock.mockReturnValue(
      new Promise((resolve) => {
        resolveInitialMessages = resolve;
      }),
    );

    render(<ChatRoom sessionId={7} />);

    await waitFor(() => {
      expect(stompState.subscribe).toHaveBeenCalledWith("/topic/chat.7", expect.any(Function));
    });

    act(() => {
      stompState.dispatch("/topic/chat.7", {
        id: 2,
        seqNo: 2,
        senderRole: "ASSISTANT",
        messageType: "TEXT",
        content: "실시간 메시지",
        createdAt: "2026-05-22T08:00:02Z",
      });
    });
    expect(screen.getByText("실시간 메시지")).toBeInTheDocument();

    await act(async () => {
      resolveInitialMessages([
        {
          id: "m1",
          sessionId: 7,
          senderType: "USER",
          content: "이전 메시지",
          createdAt: "2026-05-22T08:00:01Z",
        },
      ]);
    });

    expect(await screen.findByText("이전 메시지")).toBeInTheDocument();
    expect(screen.getByText("실시간 메시지")).toBeInTheDocument();
  });
});
