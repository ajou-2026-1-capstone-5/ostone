import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createChatSession,
  createDemoChatSession,
  listChatMessages,
  listDemoChatMessages,
  registerDemoChatSession,
  sendDemoChatMessage,
} from "./chatApi";

const { customFetchMock, getMessagesMock, getChatWorkflowMock } = vi.hoisted(() => ({
  customFetchMock: vi.fn(),
  getMessagesMock: vi.fn(),
  getChatWorkflowMock: vi.fn(),
}));

vi.mock("@/shared/api/mutator", () => ({
  customFetch: customFetchMock,
}));

vi.mock("@/shared/api/generated/endpoints/consultation-controller/consultation-controller", () => ({
  getMessages: getMessagesMock,
}));

vi.mock("@/shared/api/generated/endpoints/demo-runtime-controller/demo-runtime-controller", () => ({
  getChatWorkflow: getChatWorkflowMock,
}));

describe("chatApi", () => {
  beforeEach(() => {
    customFetchMock.mockReset();
    getMessagesMock.mockReset();
    getChatWorkflowMock.mockReset();
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
    getMessagesMock.mockResolvedValue({
      data: [
        {
          id: 21,
          seqNo: 1,
          senderRole: "ASSISTANT",
          messageType: "TEXT",
          content: "안녕하세요",
          createdAt: "2026-05-22T00:00:00Z",
        },
      ],
    });

    await expect(listChatMessages(7)).resolves.toEqual([
      {
        id: "21",
        sessionId: 7,
        senderType: "BOT",
        content: "안녕하세요",
        createdAt: "2026-05-22T00:00:00Z",
      },
    ]);

    expect(getMessagesMock).toHaveBeenCalledWith(7);
    expect(customFetchMock).not.toHaveBeenCalled();
  });

  it("pagination 응답의 세션 메시지를 채팅 UI 모델로 변환한다", async () => {
    getMessagesMock.mockResolvedValue({
      content: [
        {
          id: 22,
          seqNo: 2,
          senderRole: "USER",
          messageType: "TEXT",
          content: "배송 조회 부탁드립니다",
          createdAt: "2026-05-22T00:01:00Z",
        },
      ],
      page: 0,
      size: 50,
      totalElements: 1,
      totalPages: 1,
    });

    await expect(listChatMessages(7)).resolves.toEqual([
      {
        id: "22",
        sessionId: 7,
        senderType: "USER",
        content: "배송 조회 부탁드립니다",
        createdAt: "2026-05-22T00:01:00Z",
      },
    ]);

    expect(getMessagesMock).toHaveBeenCalledWith(7);
    expect(customFetchMock).not.toHaveBeenCalled();
  });

  it("데모 채팅 워크플로우를 채팅 UI 모델로 변환한다", async () => {
    getChatWorkflowMock.mockResolvedValue({
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

    expect(getChatWorkflowMock).toHaveBeenCalledWith(2);
    expect(customFetchMock).not.toHaveBeenCalled();
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
      messages: [],
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

    await expect(sendDemoChatMessage(2, " 77 ", "Hello")).resolves.toEqual([
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

  it("백엔드 데모 채팅 메시지를 조회한다", async () => {
    customFetchMock.mockResolvedValue([
      {
        id: 91,
        seqNo: 4,
        senderRole: "COUNSELOR",
        messageType: "TEXT",
        content: "상담사 답변입니다.",
        createdAt: "2026-05-22T00:00:03Z",
      },
    ]);

    await expect(listDemoChatMessages(2, "77")).resolves.toEqual([
      {
        id: "91",
        sessionId: 77,
        senderType: "AGENT",
        content: "상담사 답변입니다.",
        createdAt: "2026-05-22T00:00:03Z",
      },
    ]);

    expect(customFetchMock).toHaveBeenCalledWith(
      "/api/v1/workspaces/2/demo/chat-sessions/77/messages",
      { method: "GET" },
    );
  });

  it("숫자가 아닌 데모 세션 id로 메시지를 보내지 않는다", async () => {
    await expect(sendDemoChatMessage(2, "workspace-2-demo-session", "Hello")).rejects.toThrow(
      "Demo chat session id must be numeric.",
    );
    expect(customFetchMock).not.toHaveBeenCalled();
  });

  it("정수 문자열이 아닌 데모 세션 id로 메시지를 조회하지 않는다", async () => {
    await expect(listDemoChatMessages(2, "1e2")).rejects.toThrow(
      "Demo chat session id must be numeric.",
    );
    await expect(listDemoChatMessages(2, "77.5")).rejects.toThrow(
      "Demo chat session id must be numeric.",
    );
    expect(customFetchMock).not.toHaveBeenCalled();
  });
});
