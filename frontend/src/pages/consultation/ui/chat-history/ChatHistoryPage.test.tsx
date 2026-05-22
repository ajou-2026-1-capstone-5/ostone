import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useChatMessages, useChatSessions } from "../../../../features/consultation/api/chatHistoryApi";
import type { ChatMessage, ChatSession } from "../../../../features/consultation/api/consultationApi";
import { ChatHistoryPage } from "./ChatHistoryPage";

vi.mock("../../../../features/consultation/api/chatHistoryApi", () => ({
  useChatSessions: vi.fn(),
  useChatMessages: vi.fn(),
}));

const mockedUseChatSessions = vi.mocked(useChatSessions);
const mockedUseChatMessages = vi.mocked(useChatMessages);

type MockChatSessionsResult = Pick<
  ReturnType<typeof useChatSessions>,
  "data" | "isLoading" | "isError" | "error" | "refetch"
>;

type MockChatMessagesResult = Pick<
  ReturnType<typeof useChatMessages>,
  "data" | "isLoading" | "isError" | "error" | "refetch"
>;

const makeSessionsResult = (overrides?: Partial<MockChatSessionsResult>) => ({
  data: [makeSession(7)],
  isLoading: false,
  isError: false,
  error: null,
  refetch: vi.fn(),
  ...overrides,
}) as ReturnType<typeof useChatSessions>;

const makeMessagesResult = (overrides?: Partial<MockChatMessagesResult>) => ({
  data: [],
  isLoading: false,
  isError: false,
  error: null,
  refetch: vi.fn(),
  ...overrides,
}) as ReturnType<typeof useChatMessages>;

function makeSession(id: number): ChatSession {
  return {
    id,
    status: "COMPLETED",
    channel: "카카오톡",
    metaJson: JSON.stringify({ messageCount: 2, lastMessagePreview: "상담 종료 내역입니다" }),
    startedAt: "2026-05-22T09:00:00+09:00",
  };
}

function makeMessage(overrides?: Partial<ChatMessage>): ChatMessage {
  return {
    id: 11,
    seqNo: 1,
    senderRole: "CUSTOMER",
    messageType: "TEXT",
    content: "환불 문의 드립니다",
    createdAt: "2026-05-22T09:10:00+09:00",
    ...overrides,
  };
}

function renderPage(path = "/workspaces/workspace-1/consultation/history") {
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/workspaces/:workspaceId/consultation/history" element={<ChatHistoryPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("ChatHistoryPage", () => {
  beforeEach(() => {
    mockedUseChatSessions.mockReset();
    mockedUseChatMessages.mockReset();
    mockedUseChatSessions.mockReturnValue(makeSessionsResult());
    mockedUseChatMessages.mockReturnValue(makeMessagesResult());
  });

  it("URL의 workspaceId로 완료 세션 목록을 요청한다", () => {
    renderPage();

    expect(mockedUseChatSessions).toHaveBeenCalledWith({
      workspaceId: "workspace-1",
      status: "completed",
    });
  });

  it("세션을 선택하지 않으면 안내 문구를 표시한다", () => {
    renderPage();

    expect(screen.getByText("좌측 목록에서 세션을 선택해주세요")).toBeTruthy();
  });

  it("세션을 선택하면 해당 세션의 메시지 내역을 표시한다", () => {
    mockedUseChatMessages.mockReturnValue(makeMessagesResult({ data: [makeMessage()] }));

    renderPage();
    fireEvent.click(screen.getByRole("button", { name: /카카오톡/ }));

    expect(mockedUseChatMessages).toHaveBeenLastCalledWith("7");
    expect(screen.getByText("고객")).toBeTruthy();
    expect(screen.getByText("환불 문의 드립니다")).toBeTruthy();
    expect(screen.getByText("TEXT")).toBeTruthy();
    expect(screen.getByText(new Date("2026-05-22T09:10:00+09:00").toLocaleString("ko-KR"))).toBeTruthy();
  });

  it("상담사 메시지는 상담사 역할로 표시한다", () => {
    mockedUseChatMessages.mockReturnValue(
      makeMessagesResult({ data: [makeMessage({ senderRole: "AGENT", content: "처리해드리겠습니다" })] }),
    );

    renderPage();
    fireEvent.click(screen.getByRole("button", { name: /카카오톡/ }));

    expect(screen.getByText("상담사")).toBeTruthy();
    expect(screen.getByText("처리해드리겠습니다")).toBeTruthy();
  });

  it("선택한 세션에 메시지가 없으면 빈 상태를 표시한다", () => {
    mockedUseChatMessages.mockReturnValue(makeMessagesResult({ data: [] }));

    renderPage();
    fireEvent.click(screen.getByRole("button", { name: /카카오톡/ }));

    expect(screen.getByText("아직 메시지가 없습니다")).toBeTruthy();
  });

  it("메시지 로딩 상태를 표시한다", () => {
    mockedUseChatMessages.mockReturnValue(makeMessagesResult({ isLoading: true }));

    renderPage();
    fireEvent.click(screen.getByRole("button", { name: /카카오톡/ }));

    expect(screen.getByText("불러오는 중")).toBeTruthy();
  });

  it("메시지 오류 상태에서 다시 시도할 수 있다", () => {
    const refetch = vi.fn();
    mockedUseChatMessages.mockReturnValue(
      makeMessagesResult({ isError: true, error: new Error("메시지 오류"), refetch }),
    );

    renderPage();
    fireEvent.click(screen.getByRole("button", { name: /카카오톡/ }));
    fireEvent.click(screen.getByRole("button", { name: "다시 시도" }));

    expect(screen.getByText("메시지 오류")).toBeTruthy();
    expect(refetch).toHaveBeenCalled();
  });
});
