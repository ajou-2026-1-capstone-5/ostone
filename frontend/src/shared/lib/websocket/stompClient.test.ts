import { beforeEach, describe, expect, it, vi } from "vitest";
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

  it("채팅 WebSocket broker URL과 인증 헤더로 STOMP Client를 생성한다", () => {
    localStorage.setItem("accessToken", "access-token");

    createStompClient();

    expect(MockedClient).toHaveBeenCalledWith(
      expect.objectContaining({
        brokerURL: "ws://localhost:8080/ws/chat",
        connectHeaders: { Authorization: "Bearer access-token" },
        reconnectDelay: 5000,
        heartbeatIncoming: 10000,
        heartbeatOutgoing: 10000,
      }),
    );
  });
});
