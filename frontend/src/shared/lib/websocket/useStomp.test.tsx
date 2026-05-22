import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Client, IMessage, StompSubscription } from "@stomp/stompjs";
import { useStomp } from "./useStomp";

const client = {
  activate: vi.fn(),
  deactivate: vi.fn(),
  publish: vi.fn(),
  subscribe: vi.fn(),
  connected: false,
  onConnect: undefined as Client["onConnect"],
  onDisconnect: undefined as Client["onDisconnect"],
  onStompError: undefined as Client["onStompError"],
  onWebSocketError: undefined as Client["onWebSocketError"],
};

vi.mock("./stompClient", () => ({
  createStompClient: () => client,
}));

const subscription: StompSubscription = { id: "messages", unsubscribe: vi.fn() };

function makeMessage(body: string): IMessage {
  return { body } as IMessage;
}

describe("useStomp", () => {
  beforeEach(() => {
    client.activate.mockClear();
    client.deactivate.mockClear();
    client.publish.mockClear();
    client.subscribe.mockReset();
    client.connected = false;
    client.onConnect = undefined;
    client.onDisconnect = undefined;
    client.onStompError = undefined;
    client.onWebSocketError = undefined;
    vi.mocked(subscription.unsubscribe).mockClear();
    client.subscribe.mockReturnValue(subscription);
  });

  it("mount 시 연결을 시작하고 unmount 시 연결을 종료한다", () => {
    const { result, unmount } = renderHook(() => useStomp());

    expect(result.current.connectionStatus).toBe("CONNECTING");
    expect(client.activate).toHaveBeenCalledTimes(1);

    act(() => {
      client.connected = true;
      client.onConnect?.({} as Parameters<NonNullable<Client["onConnect"]>>[0]);
    });

    unmount();

    expect(subscription.unsubscribe).toHaveBeenCalledTimes(1);
    expect(client.deactivate).toHaveBeenCalledTimes(1);
  });

  it("연결되면 사용자 메시지 큐를 구독하고 수신 메시지를 저장한다", () => {
    const { result } = renderHook(() => useStomp());

    act(() => {
      client.connected = true;
      client.onConnect?.({} as Parameters<NonNullable<Client["onConnect"]>>[0]);
    });

    expect(result.current.connectionStatus).toBe("CONNECTED");
    expect(client.subscribe).toHaveBeenCalledWith("/user/queue/messages", expect.any(Function));

    const onMessage = client.subscribe.mock.calls[0]?.[1];
    act(() => {
      onMessage?.(makeMessage('{"id":"m1","content":"안녕하세요"}'));
    });

    expect(result.current.lastMessage).toEqual({ id: "m1", content: "안녕하세요" });
  });

  it("연결된 상태에서 채팅 메시지를 publish 한다", () => {
    const { result } = renderHook(() => useStomp());

    act(() => {
      client.connected = true;
      client.onConnect?.({} as Parameters<NonNullable<Client["onConnect"]>>[0]);
    });

    act(() => {
      result.current.sendMessage({ sessionId: 1, content: "문의합니다" });
    });

    expect(client.publish).toHaveBeenCalledWith({
      destination: "/app/chat.send",
      body: JSON.stringify({ sessionId: 1, content: "문의합니다" }),
    });
  });

  it("에러 콜백이 호출되면 ERROR 상태로 전환한다", () => {
    const { result } = renderHook(() => useStomp());

    act(() => {
      client.onWebSocketError?.(new Event("error"));
    });

    expect(result.current.connectionStatus).toBe("ERROR");
  });
});
