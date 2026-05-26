import { describe, expect, it } from "vitest";
import type { ChatMessage, ChatSession, ConnectionStatus } from "./types";

describe("chat model types", () => {
  it("ChatMessage shape을 고정한다", () => {
    const message = {
      id: "msg-1",
      sessionId: 10,
      content: "배송이 지연됐어요",
      senderType: "USER",
      senderId: 3,
      senderName: "고객",
      createdAt: "2026-05-22T00:00:00Z",
    } satisfies ChatMessage;

    expect(message.senderType).toBe("USER");
  });

  it("ChatSession과 ConnectionStatus union을 고정한다", () => {
    const session = {
      id: 10,
      status: "OPEN",
      channel: "WEB",
      startedAt: "2026-05-22T00:00:00Z",
    } satisfies ChatSession;
    const status: ConnectionStatus = "CONNECTED";

    expect(session.status).toBe("OPEN");
    expect(status).toBe("CONNECTED");
  });
});
