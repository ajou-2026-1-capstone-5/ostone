import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type {
  IMessage,
  StompSubscription,
  IFrame,
  frameCallbackType,
  wsErrorCallbackType,
  Client,
} from "@stomp/stompjs";
import { useStomp } from "./useStomp";

interface MockClient {
  activate: ReturnType<typeof vi.fn>;
  deactivate: ReturnType<typeof vi.fn>;
  publish: ReturnType<typeof vi.fn>;
  subscribe: ReturnType<typeof vi.fn>;
  connected: boolean;
  onConnect?: frameCallbackType;
  onDisconnect?: frameCallbackType;
  onStompError?: frameCallbackType;
  onWebSocketError?: wsErrorCallbackType;
}

const client: MockClient = {
  activate: vi.fn(),
  deactivate: vi.fn(),
  publish: vi.fn(),
  subscribe: vi.fn(),
  connected: false,
  onConnect: undefined,
  onDisconnect: undefined,
  onStompError: undefined,
  onWebSocketError: undefined,
};

vi.mock("./stompClient", () => ({
  createStompClient: () => client as unknown as Client,
}));

const subscription: StompSubscription = { id: "errors", unsubscribe: vi.fn() };
const dummyFrame = { headers: {}, body: "", command: "CONNECTED" } as unknown as IFrame;

function makeMessage(body: string): IMessage {
  return { body } as unknown as IMessage;
}

async function renderUseStompHelper(options?: Parameters<typeof useStomp>[0]) {
  const rendered = renderHook(() => useStomp(options));
  await act(async () => {
    await Promise.resolve();
  });
  return rendered;
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

  it("mount 시 연결을 시작하고 unmount 시 연결을 종료한다", async () => {
    const { result, unmount } = await renderUseStompHelper();

    expect(result.current.connectionStatus).toBe("CONNECTING");
    expect(client.activate).toHaveBeenCalledTimes(1);

    act(() => {
      client.connected = true;
      client.onConnect?.(dummyFrame);
    });

    unmount();

    expect(subscription.unsubscribe).toHaveBeenCalledTimes(1);
    expect(client.deactivate).toHaveBeenCalledTimes(1);
  });

  it("onConnect 시 서버 에러 큐를 구독한다", async () => {
    await renderUseStompHelper();

    act(() => {
      client.connected = true;
      client.onConnect?.(dummyFrame);
    });

    expect(client.subscribe).toHaveBeenCalledWith("/user/queue/errors", expect.any(Function));
  });

  it("연결된 상태에서 채팅 메시지를 publish 한다", async () => {
    const { result } = await renderUseStompHelper();

    act(() => {
      client.connected = true;
      client.onConnect?.(dummyFrame);
    });

    act(() => {
      result.current.sendMessage({ sessionId: 1, content: "문의합니다" });
    });

    expect(client.publish).toHaveBeenCalledWith({
      destination: "/app/chat.sendMessage",
      body: JSON.stringify({ sessionId: 1, content: "문의합니다" }),
    });
  });

  it("에러 콜백이 호출되면 ERROR 상태로 전환한다", async () => {
    const { result } = await renderUseStompHelper();

    act(() => {
      client.onWebSocketError?.(new Event("error") as unknown as CloseEvent);
    });

    expect(result.current.connectionStatus).toBe("ERROR");
  });

  it("연결된 상태에서 특정 토픽을 subscribe 하고, 해제(unsubscribe) 할 수 있다", async () => {
    const { result } = await renderUseStompHelper();

    act(() => {
      client.connected = true;
      client.onConnect?.(dummyFrame);
    });

    const topicCallback = vi.fn();
    let unsubscribeFn: (() => void) | undefined;

    act(() => {
      unsubscribeFn = result.current.subscribe("/topic/test", topicCallback);
    });

    expect(client.subscribe).toHaveBeenLastCalledWith("/topic/test", expect.any(Function));

    const onMessage = client.subscribe.mock.calls[client.subscribe.mock.calls.length - 1]?.[1];

    act(() => {
      onMessage?.(makeMessage('{"content":"hello"}'));
    });
    expect(topicCallback).toHaveBeenCalledWith({ content: "hello" });

    act(() => {
      onMessage?.(makeMessage("invalid-json"));
    });
    expect(topicCallback).toHaveBeenCalledTimes(1);

    act(() => {
      unsubscribeFn?.();
    });
    expect(subscription.unsubscribe).toHaveBeenCalledTimes(1);
  });

  it("연결되지 않은 상태에서 subscribe를 호출하면 활성 구독 없이 cleanup 함수를 반환한다", async () => {
    const { result } = await renderUseStompHelper();

    let unsubscribeFn: (() => void) | undefined;

    act(() => {
      unsubscribeFn = result.current.subscribe("/topic/test", vi.fn());
    });

    expect(unsubscribeFn).toBeInstanceOf(Function);
    act(() => {
      unsubscribeFn?.();
    });
    expect(subscription.unsubscribe).not.toHaveBeenCalled();
  });

  it("연결 전 등록한 custom subscribe를 onConnect 시 구독한다", async () => {
    const { result } = await renderUseStompHelper();
    const topicCallback = vi.fn();

    act(() => {
      result.current.subscribe("/topic/test", topicCallback);
    });

    expect(client.subscribe).not.toHaveBeenCalledWith("/topic/test", expect.any(Function));

    act(() => {
      client.connected = true;
      client.onConnect?.(dummyFrame);
    });

    expect(client.subscribe).toHaveBeenCalledWith("/topic/test", expect.any(Function));
  });

  it("재연결 onConnect 시 custom subscribe를 다시 등록한다", async () => {
    const { result } = await renderUseStompHelper();

    act(() => {
      client.connected = true;
      client.onConnect?.(dummyFrame);
    });
    act(() => {
      result.current.subscribe("/topic/test", vi.fn());
    });
    client.subscribe.mockClear();

    act(() => {
      client.connected = false;
      client.onDisconnect?.(dummyFrame);
    });
    act(() => {
      client.connected = true;
      client.onConnect?.(dummyFrame);
    });

    expect(client.subscribe).toHaveBeenCalledWith("/user/queue/errors", expect.any(Function));
    expect(client.subscribe).toHaveBeenCalledWith("/topic/test", expect.any(Function));
  });

  it("includeAuth 변경으로 재연결되어도 custom subscribe를 다시 등록한다", async () => {
    const { result, rerender } = renderHook(
      ({ includeAuth }: { includeAuth: boolean }) => useStomp({ includeAuth }),
      { initialProps: { includeAuth: false } },
    );
    await act(async () => {
      await Promise.resolve();
    });

    act(() => {
      client.connected = true;
      client.onConnect?.(dummyFrame);
    });
    act(() => {
      result.current.subscribe("/topic/test", vi.fn());
    });
    client.subscribe.mockClear();

    await act(async () => {
      client.connected = false;
      rerender({ includeAuth: true });
      await Promise.resolve();
    });
    act(() => {
      client.connected = true;
      client.onConnect?.(dummyFrame);
    });

    expect(client.subscribe).toHaveBeenCalledWith("/user/queue/errors", expect.any(Function));
    expect(client.subscribe).toHaveBeenCalledWith("/topic/test", expect.any(Function));
  });

  it("이미 동일 토픽을 subscribe 중일 때 재호출하면 이전 구독을 해제하고 덮어쓴다", async () => {
    const { result } = await renderUseStompHelper();

    act(() => {
      client.connected = true;
      client.onConnect?.(dummyFrame);
    });

    act(() => {
      result.current.subscribe("/topic/test", vi.fn());
    });

    act(() => {
      result.current.subscribe("/topic/test", vi.fn());
    });

    expect(subscription.unsubscribe).toHaveBeenCalledTimes(1);
  });

  it("연결된 상태에서 특정 destination으로 sendTo를 수행한다", async () => {
    const { result } = await renderUseStompHelper();

    act(() => {
      client.connected = true;
      client.onConnect?.(dummyFrame);
    });

    act(() => {
      result.current.sendTo("/app/custom", { text: "hello" });
    });

    expect(client.publish).toHaveBeenCalledWith({
      destination: "/app/custom",
      body: JSON.stringify({ text: "hello" }),
    });
  });

  it("연결되지 않은 상태에서 sendTo나 sendMessage를 호출하면 아무 동작도 하지 않는다", async () => {
    const { result } = await renderUseStompHelper();

    act(() => {
      result.current.sendTo("/app/custom", { text: "hello" });
      result.current.sendMessage({ text: "hello" });
    });

    expect(client.publish).not.toHaveBeenCalled();
  });

  it("onConnect 내부의 에러 큐(/user/queue/errors) 구독에서 잘못된 JSON 수신 시 무시한다", async () => {
    await renderUseStompHelper();

    act(() => {
      client.connected = true;
      client.onConnect?.(dummyFrame);
    });

    const errorQueueOnMessage = client.subscribe.mock.calls.find(
      (call) => call[0] === "/user/queue/errors",
    )?.[1];

    expect(errorQueueOnMessage).toBeDefined();

    expect(() => {
      act(() => {
        errorQueueOnMessage?.(makeMessage("invalid-json"));
      });
    }).not.toThrow();
  });

  it("onConnect 내부의 에러 큐(/user/queue/errors) 구독에서 JSON 수신 시 호출부 콜백으로 전달한다", async () => {
    const onServerError = vi.fn();
    await renderUseStompHelper({ onServerError });

    act(() => {
      client.connected = true;
      client.onConnect?.(dummyFrame);
    });

    const errorQueueOnMessage = client.subscribe.mock.calls.find(
      (call) => call[0] === "/user/queue/errors",
    )?.[1];

    act(() => {
      errorQueueOnMessage?.(makeMessage('{"messageType":"ERROR","content":"failed"}'));
    });

    expect(onServerError).toHaveBeenCalledWith({
      messageType: "ERROR",
      content: "failed",
    });
  });

  it("onDisconnect가 호출되면 DISCONNECTED 상태로 전환한다", async () => {
    const { result } = await renderUseStompHelper();

    act(() => {
      client.onDisconnect?.(dummyFrame);
    });

    expect(result.current.connectionStatus).toBe("DISCONNECTED");
  });

  it("onStompError가 호출되면 ERROR 상태로 전환한다", async () => {
    const { result } = await renderUseStompHelper();

    act(() => {
      client.onStompError?.(dummyFrame);
    });

    expect(result.current.connectionStatus).toBe("ERROR");
  });

  it("CONNECTING이나 CONNECTED 상태일 때 connect()를 추가로 호출해도 추가 연결을 수행하지 않는다", async () => {
    const { result } = await renderUseStompHelper();

    expect(result.current.connectionStatus).toBe("CONNECTING");
    client.activate.mockClear();

    act(() => {
      result.current.connect();
    });
    expect(client.activate).not.toHaveBeenCalled();

    act(() => {
      client.connected = true;
      client.onConnect?.(dummyFrame);
    });
    expect(result.current.connectionStatus).toBe("CONNECTED");
    client.activate.mockClear();

    act(() => {
      result.current.connect();
    });
    expect(client.activate).not.toHaveBeenCalled();
  });

  it("마이크로태스크 예약 상태에서 즉시 unmount 되면 connect가 호출되지 않는다", async () => {
    const { unmount } = renderHook(() => useStomp());
    unmount();

    await act(async () => {
      await Promise.resolve();
    });

    expect(client.activate).not.toHaveBeenCalled();
  });
});
