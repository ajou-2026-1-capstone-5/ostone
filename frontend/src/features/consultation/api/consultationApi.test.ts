import { describe, it, expect, vi, beforeEach } from "vite-plus/test";
import { consultationApi } from "./consultationApi";
import {
  getMessages,
  sendMessage,
  updateStatus,
  getGetMessagesUrl,
} from "@/shared/api/generated/endpoints/consultation-controller/consultation-controller";
import { customFetch } from "@/shared/api/mutator";
import type { ChatMessageResponse, ChatSessionResponse } from "@/shared/api/generated/zod";

vi.mock("@/shared/api/generated/endpoints/consultation-controller/consultation-controller", () => ({
  getMessages: vi.fn(),
  sendMessage: vi.fn(),
  updateStatus: vi.fn(),
  getGetMessagesUrl: vi.fn((sessionId: number) => `/api/v1/consultation/sessions/${sessionId}/messages`),
}));

vi.mock("@/shared/api/mutator", () => ({
  customFetch: vi.fn(),
}));

const mockedGetMessages = vi.mocked(getMessages);
const mockedSendMessage = vi.mocked(sendMessage);
const mockedUpdateStatus = vi.mocked(updateStatus);
const mockedGetGetMessagesUrl = vi.mocked(getGetMessagesUrl);
const mockedCustomFetch = vi.mocked(customFetch);

describe("consultationApi", () => {
  beforeEach(() => {
    mockedGetMessages.mockClear();
    mockedSendMessage.mockClear();
    mockedUpdateStatus.mockClear();
    mockedCustomFetch.mockClear();
  });

  it("getQueue가 queue 데이터를 반환한다", async () => {
    const stubSessions = [
      {
        id: 1,
        status: "OPEN",
        channel: "카카오톡",
        metaJson: "{}",
        startedAt: new Date().toISOString(),
      },
    ];
    mockedCustomFetch.mockResolvedValue({ data: stubSessions, status: 200, headers: new Headers() });

    const result = await consultationApi.getQueue(2);

    expect(mockedCustomFetch).toHaveBeenCalledWith(
      "/api/v1/workspaces/2/consultation/queue",
      { method: "GET" },
    );
    expect(result).toEqual(stubSessions);
    expect(result).toHaveLength(1);
  });

  it("getQueue가 plain array 응답도 반환한다", async () => {
    const stubSessions = [
      {
        id: 1,
        status: "OPEN",
        channel: "WEB",
        metaJson: "{}",
        startedAt: new Date().toISOString(),
      },
    ];
    mockedCustomFetch.mockResolvedValue(stubSessions as never);

    const result = await consultationApi.getQueue(2);

    expect(result).toEqual(stubSessions);
  });

  it("getMessages가 메시지 데이터를 반환한다", async () => {
    const stubMessages = [
      {
        id: 1,
        seqNo: 1,
        senderRole: "AGENT",
        messageType: "TEXT",
        content: "안녕하세요",
        createdAt: new Date().toISOString(),
      },
    ];
    mockedGetMessages.mockResolvedValue({
      data: stubMessages,
      status: 200,
      headers: new Headers(),
    });

    const result = await consultationApi.getMessages(1);

    expect(mockedGetMessages).toHaveBeenCalledWith(1);
    expect(result).toEqual(stubMessages);
  });

  it("sendMessage가 전송된 메시지를 반환한다", async () => {
    const stubMessage = {
      id: 99,
      seqNo: 1,
      senderRole: "AGENT",
      messageType: "TEXT",
      content: "test",
      createdAt: new Date().toISOString(),
    };
    mockedSendMessage.mockResolvedValue({ data: stubMessage, status: 200, headers: new Headers() });

    const result = await consultationApi.sendMessage(1, "test");

    expect(mockedSendMessage).toHaveBeenCalledWith(1, { content: "test", isNote: false });
    expect(result).toEqual(stubMessage);
  });

  it("sendMessage가 plain object 응답도 반환한다", async () => {
    const stubMessage = {
      id: 99,
      seqNo: 1,
      senderRole: "AGENT",
      messageType: "TEXT",
      content: "plain",
      createdAt: new Date().toISOString(),
    };
    mockedSendMessage.mockResolvedValue(stubMessage as never);

    const result = await consultationApi.sendMessage(1, "plain");

    expect(result).toEqual(stubMessage);
  });

  it("sendMessage가 isNote=true를 전달한다", async () => {
    const stubNote = {
      id: 100,
      seqNo: 1,
      senderRole: "AGENT",
      messageType: "NOTE",
      content: "메모",
      createdAt: new Date().toISOString(),
    };
    mockedSendMessage.mockResolvedValue({ data: stubNote, status: 200, headers: new Headers() });

    const result = await consultationApi.sendMessage(1, "메모", true);

    expect(mockedSendMessage).toHaveBeenCalledWith(1, { content: "메모", isNote: true });
    expect(result).toEqual(stubNote);
  });

  it("updateStatus가 업데이트된 세션을 반환한다", async () => {
    const stubSession = {
      id: 1,
      status: "COMPLETED",
      channel: "카카오톡",
      metaJson: "{}",
      startedAt: new Date().toISOString(),
    };
    mockedUpdateStatus.mockResolvedValue({
      data: stubSession,
      status: 200,
      headers: new Headers(),
    });

    const result = await consultationApi.updateStatus(1, "COMPLETED");

    expect(mockedUpdateStatus).toHaveBeenCalledWith(1, { status: "COMPLETED" });
    expect(result).toEqual(stubSession);
  });

  it("getSessions가 모든 세션을 반환한다", async () => {
    const stubSessions = [
      {
        id: 1,
        status: "OPEN",
        channel: "카카오톡",
        metaJson: "{}",
        startedAt: new Date().toISOString(),
      },
    ];
    mockedCustomFetch.mockResolvedValue({ data: stubSessions, status: 200, headers: new Headers() });

    const result = await consultationApi.getSessions();

    expect(mockedCustomFetch).toHaveBeenCalledWith("/api/v1/consultation/sessions", { method: "GET" });
    expect(result).toEqual(stubSessions);
  });

  it("getSessions가 paged content 응답도 반환한다", async () => {
    const stubSessions = [
      {
        id: 1,
        status: "ACTIVE",
        channel: "WEB",
        metaJson: "{}",
        startedAt: new Date().toISOString(),
      },
    ];
    mockedCustomFetch.mockResolvedValue({ content: stubSessions, page: 0, size: 20 });

    const result = await consultationApi.getSessions();

    expect(result).toEqual(stubSessions);
  });

  it("getSessions가 status 필터를 전달한다", async () => {
    const stubSessions: ChatSessionResponse[] = [];
    mockedCustomFetch.mockResolvedValue({ data: stubSessions, status: 200, headers: new Headers() });

    await consultationApi.getSessions({ status: "OPEN" });

    expect(mockedCustomFetch).toHaveBeenCalledWith(
      "/api/v1/consultation/sessions?status=OPEN",
      { method: "GET" },
    );
  });

  it("getSessions가 page/size를 전달한다", async () => {
    const stubSessions: ChatSessionResponse[] = [];
    mockedCustomFetch.mockResolvedValue({ data: stubSessions, status: 200, headers: new Headers() });

    await consultationApi.getSessions({ page: 1, size: 20 });

    expect(mockedCustomFetch).toHaveBeenCalledWith(
      "/api/v1/consultation/sessions?page=1&size=20",
      { method: "GET" },
    );
  });

  it("getMessages가 params 없이 호출되면 generated 함수를 사용한다", async () => {
    const stubMessages: ChatMessageResponse[] = [];
    mockedGetMessages.mockResolvedValue({ data: stubMessages, status: 200, headers: new Headers() });

    const result = await consultationApi.getMessages(1);

    expect(mockedGetMessages).toHaveBeenCalledWith(1);
    expect(mockedCustomFetch).not.toHaveBeenCalled();
    expect(result).toEqual(stubMessages);
  });

  it("getMessages가 page/size 파라미터와 함께 호출되면 customFetch를 사용한다", async () => {
    const stubMessages: ChatMessageResponse[] = [
      {
        id: 1,
        seqNo: 1,
        senderRole: "AGENT",
        messageType: "TEXT",
        content: "안녕하세요",
        createdAt: new Date().toISOString(),
      },
    ];
    mockedCustomFetch.mockResolvedValue({ data: stubMessages, status: 200, headers: new Headers() });

    const result = await consultationApi.getMessages(1, { page: 0, size: 10 });

    expect(mockedGetGetMessagesUrl).toHaveBeenCalledWith(1);
    expect(mockedCustomFetch).toHaveBeenCalledWith(
      "/api/v1/consultation/sessions/1/messages?page=0&size=10",
      { method: "GET" },
    );
    expect(result).toEqual(stubMessages);
  });

  it("assignSession이 상담사 ID와 함께 assign API를 호출한다", async () => {
    const stubSession = {
      id: 1,
      status: "ACTIVE",
      channel: "WEB",
      metaJson: "{}",
      startedAt: new Date().toISOString(),
      assignedCounselorId: 7,
    };
    mockedCustomFetch.mockResolvedValue(stubSession);

    const result = await consultationApi.assignSession(1, 7);

    expect(mockedCustomFetch).toHaveBeenCalledWith(
      "/api/v1/consultation/sessions/1/assign?counselorId=7",
      { method: "POST" },
    );
    expect(result).toEqual(stubSession);
  });

  it("releaseSession이 상담사 ID와 함께 release API를 호출한다", async () => {
    const stubSession = {
      id: 1,
      status: "OPEN",
      channel: "WEB",
      metaJson: "{}",
      startedAt: new Date().toISOString(),
      assignedCounselorId: null,
    };
    mockedCustomFetch.mockResolvedValue({ data: stubSession });

    const result = await consultationApi.releaseSession(1, 7);

    expect(mockedCustomFetch).toHaveBeenCalledWith(
      "/api/v1/consultation/sessions/1/release?counselorId=7",
      { method: "POST" },
    );
    expect(result).toEqual(stubSession);
  });
});
