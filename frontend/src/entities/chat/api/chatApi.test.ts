import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createChatSession,
  createDemoChatSession,
  listChatMessages,
  registerDemoChatSession,
  sendDemoChatMessage,
} from "./chatApi";

const { customFetchMock } = vi.hoisted(() => ({
  customFetchMock: vi.fn(),
}));

vi.mock("@/shared/api/mutator", () => ({
  customFetch: customFetchMock,
}));

describe("chatApi", () => {
  beforeEach(() => {
    customFetchMock.mockReset();
  });

  it("workspaceId로 현재 사용자 채팅 세션을 조회하거나 생성한다", async () => {
    const session = {
      id: 12,
      status: "OPEN" as const,
      channel: "WEB",
      startedAt: "2026-05-22T00:00:00Z",
    };
    customFetchMock.mockResolvedValue(session);

    await expect(createChatSession(3, "김민지")).resolves.toEqual(session);

    expect(customFetchMock).toHaveBeenCalledWith(
      "/api/v1/workspaces/3/chat/sessions/current?customerName=%EA%B9%80%EB%AF%BC%EC%A7%80",
      { method: "GET" },
    );
  });

  it("세션 메시지를 채팅 UI 모델로 변환한다", async () => {
    customFetchMock.mockResolvedValue([
      {
        id: 21,
        seqNo: 1,
        senderRole: "ASSISTANT",
        messageType: "TEXT",
        content: "안녕하세요",
        createdAt: "2026-05-22T00:00:00Z",
      },
    ]);

    await expect(listChatMessages(7)).resolves.toEqual([
      {
        id: "21",
        sessionId: 7,
        senderType: "BOT",
        content: "안녕하세요",
        createdAt: "2026-05-22T00:00:00Z",
      },
    ]);

    expect(customFetchMock).toHaveBeenCalledWith("/api/v1/consultation/sessions/7/messages", {
      method: "GET",
    });
  });

  it("데모 채팅 워크플로우를 채팅 UI 모델로 변환한다", async () => {
    customFetchMock.mockResolvedValue({
      chatSession: {
        id: "session-2",
        status: "completed",
        startedAt: "2026-05-10T10:00:00Z",
      },
      messages: [
        {
          id: "card-msg-1",
          role: "user",
          content: "안녕하세요",
          timestamp: "2026-05-10T10:00:00Z",
        },
      ],
    });

    await expect(createDemoChatSession(2, "김민지")).resolves.toEqual({
      id: "session-2",
      status: "completed",
      startedAt: "2026-05-10T10:00:00Z",
      messages: [
        {
          id: "card-msg-1",
          sessionId: 0,
          senderType: "USER",
          senderName: "김민지",
          content: "안녕하세요",
          createdAt: "2026-05-10T10:00:00Z",
        },
      ],
    });

    expect(customFetchMock).toHaveBeenCalledWith("/api/v1/workspaces/2/demo/chat-workflow", {
      method: "GET",
    });
  });

  it("백엔드에 데모 채팅 세션을 등록한다", async () => {
    customFetchMock.mockResolvedValue({
      id: 77,
      status: "OPEN",
      startedAt: "2026-05-22T00:00:00Z",
    });

    await expect(registerDemoChatSession(2, "김민지")).resolves.toEqual({
      id: "77",
      status: "OPEN",
      startedAt: "2026-05-22T00:00:00Z",
      messages: [
        {
          id: "backend-greeting-77",
          sessionId: 77,
          senderType: "BOT",
          content: "안녕하세요, 김민지님. 무엇을 도와드릴까요?",
          createdAt: "2026-05-22T00:00:00Z",
        },
      ],
    });

    expect(customFetchMock).toHaveBeenCalledWith("/api/v1/workspaces/2/demo/chat-sessions", {
      method: "POST",
      body: JSON.stringify({ customerName: "김민지" }),
    });
  });

  it("백엔드 데모 채팅 세션 응답에 숫자 id가 없으면 실패한다", async () => {
    customFetchMock.mockResolvedValue({
      status: "OPEN",
      startedAt: "2026-05-22T00:00:00Z",
    });

    await expect(registerDemoChatSession(2, "김민지")).rejects.toThrow(
      "Demo chat session response is missing a numeric id.",
    );
  });

  it("데모 채팅 메시지를 백엔드에 등록한다", async () => {
    customFetchMock.mockResolvedValue([
      {
        id: 81,
        seqNo: 2,
        senderRole: "USER",
        messageType: "TEXT",
        content: "Hello",
        createdAt: "2026-05-22T00:00:01Z",
      },
      {
        id: 82,
        seqNo: 3,
        senderRole: "ASSISTANT",
        messageType: "TEXT",
        content: "LLM 응답입니다.",
        createdAt: "2026-05-22T00:00:02Z",
      },
    ]);

    await expect(sendDemoChatMessage(2, "77", "Hello")).resolves.toEqual([
      {
        id: "81",
        sessionId: 77,
        senderType: "USER",
        content: "Hello",
        createdAt: "2026-05-22T00:00:01Z",
      },
      {
        id: "82",
        sessionId: 77,
        senderType: "BOT",
        content: "LLM 응답입니다.",
        createdAt: "2026-05-22T00:00:02Z",
      },
    ]);

    expect(customFetchMock).toHaveBeenCalledWith(
      "/api/v1/workspaces/2/demo/chat-sessions/77/messages",
      {
        method: "POST",
        body: JSON.stringify({ content: "Hello" }),
      },
    );
  });

  it("숫자가 아닌 데모 세션 id로 메시지를 보내지 않는다", async () => {
    await expect(sendDemoChatMessage(2, "workspace-2-demo-session", "Hello")).rejects.toThrow(
      "Demo chat session id must be numeric.",
    );
    expect(customFetchMock).not.toHaveBeenCalled();
  });
});
