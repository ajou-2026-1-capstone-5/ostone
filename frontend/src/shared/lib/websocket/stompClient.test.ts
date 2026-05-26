import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { Client } from "@stomp/stompjs";
import { createStompClient } from "./stompClient";

vi.mock("@stomp/stompjs", () => ({
  Client: vi.fn(),
}));

const MockedClient = vi.mocked(Client);

describe("createStompClient", () => {
  beforeEach(() => {
    MockedClient.mockClear();
    localStorage.clear();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("채팅 WebSocket broker URL과 기본 설정으로 STOMP Client를 생성하고, beforeConnect로 동적 토큰을 설정한다", () => {
    localStorage.setItem("accessToken", "access-token");

    const client = createStompClient();

    expect(MockedClient).toHaveBeenCalledWith(
      expect.objectContaining({
        brokerURL: "ws://localhost:8080/ws/chat",
        reconnectDelay: 5000,
        heartbeatIncoming: 10000,
        heartbeatOutgoing: 10000,
      }),
    );

    expect(typeof client.beforeConnect).toBe("function");
    (client.beforeConnect as () => void)();
    expect(client.connectHeaders).toEqual({ Authorization: "Bearer access-token" });
  });

  it("VITE_WS_URL 환경 변수가 https 프로토콜일 때 wss로 자동 변환하고 trailing slash를 제거한다", () => {
    vi.stubEnv("VITE_WS_URL", "https://example.com/api/");

    createStompClient();

    expect(MockedClient).toHaveBeenCalledWith(
      expect.objectContaining({
        brokerURL: "wss://example.com/api/ws/chat",
      }),
    );
  });

  it("VITE_WS_URL 환경 변수가 http 프로토콜일 때 ws로 자동 변환한다", () => {
    vi.stubEnv("VITE_WS_URL", "http://example.com:9000");

    createStompClient();

    expect(MockedClient).toHaveBeenCalledWith(
      expect.objectContaining({
        brokerURL: "ws://example.com:9000/ws/chat",
      }),
    );
  });
});
