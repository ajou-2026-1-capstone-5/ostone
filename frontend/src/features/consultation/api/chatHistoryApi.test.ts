import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./consultationApi", () => ({
  consultationApi: {
    getSessions: vi.fn(),
    getMessages: vi.fn(),
  },
}));

import { ChatSessionResponse, ChatMessageResponse } from "../../../shared/api/generated/zod";
import { useChatSessions, useChatMessages } from "./chatHistoryApi";
import { consultationApi } from "./consultationApi";

const mockedGetSessions = vi.mocked(consultationApi.getSessions);
const mockedGetMessages = vi.mocked(consultationApi.getMessages);

const stubSession: ChatSessionResponse = {
  id: 1,
  status: "COMPLETED",
  channel: "KAKAO",
  metaJson: null,
  startedAt: "2025-01-01T00:00:00Z",
};

const stubMessage: ChatMessageResponse = {
  id: 1,
  seqNo: 1,
  senderRole: "CUSTOMER",
  messageType: "TEXT",
  content: "안녕하세요",
  createdAt: "2025-01-01T00:00:00Z",
};

function makeWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children);
}

describe("useChatSessions", () => {
  beforeEach(() => {
    mockedGetSessions.mockReset();
  });

  it("세션 목록을 조회한다", async () => {
    mockedGetSessions.mockResolvedValue([stubSession]);

    const { result } = renderHook(
      () =>
        useChatSessions({
          workspaceId: "ws-1",
        }),
      { wrapper: makeWrapper() },
    );

    await waitFor(() => expect(result.current.data).toEqual([stubSession]));
    expect(mockedGetSessions).toHaveBeenCalledWith({ status: undefined, page: 0, size: 20 });
  });

  it("상태 필터로 세션 목록을 조회한다", async () => {
    mockedGetSessions.mockResolvedValue([stubSession]);

    const { result } = renderHook(
      () =>
        useChatSessions({
          workspaceId: "ws-1",
          status: "COMPLETED",
          page: 1,
          size: 10,
        }),
      { wrapper: makeWrapper() },
    );

    await waitFor(() => expect(result.current.data).toEqual([stubSession]));
    expect(mockedGetSessions).toHaveBeenCalledWith({ status: "COMPLETED", page: 1, size: 10 });
  });
});

describe("useChatMessages", () => {
  beforeEach(() => {
    mockedGetMessages.mockReset();
  });

  it("sessionId가 있으면 메시지 목록을 조회한다", async () => {
    mockedGetMessages.mockResolvedValue([stubMessage]);

    const { result } = renderHook(() => useChatMessages("1"), { wrapper: makeWrapper() });

    await waitFor(() => expect(result.current.data).toEqual([stubMessage]));
    expect(mockedGetMessages).toHaveBeenCalledWith(1, { page: 0, size: 50 });
  });

  it("sessionId가 없으면 쿼리를 활성화하지 않는다", async () => {
    const { result } = renderHook(() => useChatMessages(""), { wrapper: makeWrapper() });

    expect(result.current.fetchStatus).toBe("idle");
    expect(mockedGetMessages).not.toHaveBeenCalled();
  });

  it("페이지를 지정해서 메시지 목록을 조회한다", async () => {
    mockedGetMessages.mockResolvedValue([stubMessage]);

    const { result } = renderHook(() => useChatMessages("1", 2, 30), { wrapper: makeWrapper() });

    await waitFor(() => expect(result.current.data).toEqual([stubMessage]));
    expect(mockedGetMessages).toHaveBeenCalledWith(1, { page: 2, size: 30 });
  });
});
