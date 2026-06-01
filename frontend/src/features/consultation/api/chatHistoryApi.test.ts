import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./consultationApi", () => ({
  consultationApi: {
    getSessionPage: vi.fn(),
    getMessages: vi.fn(),
    getMessagePage: vi.fn(),
  },
}));

import { ChatSessionResponse, ChatMessageResponse } from "../../../shared/api/generated/zod";
import { useChatSessions, useChatMessages, useChatMessagePage } from "./chatHistoryApi";
import { consultationApi } from "./consultationApi";

const mockedGetSessionPage = vi.mocked(consultationApi.getSessionPage);
const mockedGetMessages = vi.mocked(consultationApi.getMessages);
const mockedGetMessagePage = vi.mocked(consultationApi.getMessagePage);

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
    mockedGetSessionPage.mockReset();
  });

  it("세션 목록을 조회한다", async () => {
    const stubPage = {
      content: [stubSession],
      page: 0,
      size: 20,
      totalElements: 1,
      totalPages: 1,
    };
    mockedGetSessionPage.mockResolvedValue(stubPage);

    const { result } = renderHook(
      () =>
        useChatSessions({
          workspaceId: 1,
        }),
      { wrapper: makeWrapper() },
    );

    await waitFor(() => expect(result.current.data).toEqual(stubPage));
    expect(mockedGetSessionPage).toHaveBeenCalledWith(1, {
      status: undefined,
      keyword: undefined,
      startedFrom: undefined,
      startedTo: undefined,
      assignedCounselorId: undefined,
      page: 0,
      size: 20,
    });
  });

  it("상태 필터로 세션 목록을 조회한다", async () => {
    const stubPage = {
      content: [stubSession],
      page: 1,
      size: 10,
      totalElements: 11,
      totalPages: 2,
    };
    mockedGetSessionPage.mockResolvedValue(stubPage);

    const { result } = renderHook(
      () =>
        useChatSessions({
          workspaceId: 1,
          status: "COMPLETED",
          keyword: "환불",
          startedFrom: "2026-05-01",
          startedTo: "2026-05-31",
          assignedCounselorId: 42,
          page: 1,
          size: 10,
        }),
      { wrapper: makeWrapper() },
    );

    await waitFor(() => expect(result.current.data).toEqual(stubPage));
    expect(mockedGetSessionPage).toHaveBeenCalledWith(1, {
      status: "COMPLETED",
      keyword: "환불",
      startedFrom: "2026-05-01",
      startedTo: "2026-05-31",
      assignedCounselorId: 42,
      page: 1,
      size: 10,
    });
  });

  it("workspaceId가 없으면 세션 목록을 조회하지 않는다", () => {
    const { result } = renderHook(
      () =>
        useChatSessions({
          workspaceId: null,
        }),
      { wrapper: makeWrapper() },
    );

    expect(result.current.fetchStatus).toBe("idle");
    expect(mockedGetSessionPage).not.toHaveBeenCalled();
  });
});

describe("useChatMessages", () => {
  beforeEach(() => {
    mockedGetMessages.mockReset();
    mockedGetMessagePage.mockReset();
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

  it("메시지 page metadata를 조회한다", async () => {
    const page = {
      content: [stubMessage],
      page: 0,
      size: 50,
      totalElements: 75,
      totalPages: 2,
    };
    mockedGetMessagePage.mockResolvedValue(page);

    const { result } = renderHook(() => useChatMessagePage("1"), { wrapper: makeWrapper() });

    await waitFor(() => expect(result.current.data).toEqual(page));
    expect(mockedGetMessagePage).toHaveBeenCalledWith(1, { page: 0, size: 50 });
  });
});
