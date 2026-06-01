import { fireEvent, render, screen } from "@testing-library/react";
import { useEffect } from "react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  useChatMessagePage,
  useChatSessions,
} from "../../../../features/consultation/api/chatHistoryApi";
import type {
  ChatMessage,
  ChatSession,
} from "../../../../features/consultation/api/consultationApi";
import { ChatHistoryPage } from "./ChatHistoryPage";

vi.mock("../../../../features/consultation/api/chatHistoryApi", () => ({
  useChatSessions: vi.fn(),
  useChatMessagePage: vi.fn(),
}));

const mockedUseChatSessions = vi.mocked(useChatSessions);
const mockedUseChatMessagePage = vi.mocked(useChatMessagePage);

type MockChatSessionsResult = Pick<
  ReturnType<typeof useChatSessions>,
  "data" | "isLoading" | "isError" | "error" | "refetch"
>;

type MockChatMessagePageResult = Pick<
  ReturnType<typeof useChatMessagePage>,
  "data" | "isLoading" | "isError" | "error" | "refetch"
>;

const makeSessionsResult = (overrides?: Partial<MockChatSessionsResult>) =>
  ({
    data: {
      content: [makeSession(7)],
      page: 0,
      size: 20,
      totalElements: 1,
      totalPages: 1,
    },
    isLoading: false,
    isError: false,
    error: null,
    refetch: vi.fn(),
    ...overrides,
  }) as ReturnType<typeof useChatSessions>;

const makeMessagePageResult = (
  overrides?: Partial<MockChatMessagePageResult> & { data?: ChatMessage[] },
) => {
  const { data = [], ...rest } = overrides ?? {};
  return {
    data: {
      content: data,
      page: 0,
      size: 50,
      totalElements: data.length,
      totalPages: data.length ? 1 : 0,
    },
    isLoading: false,
    isError: false,
    error: null,
    refetch: vi.fn(),
    ...rest,
  } as ReturnType<typeof useChatMessagePage>;
};

function mockMessagePageForSession(
  sessionId: string,
  result: ReturnType<typeof useChatMessagePage>,
) {
  const emptyResult = makeMessagePageResult();
  mockedUseChatMessagePage.mockImplementation((currentSessionId) =>
    currentSessionId === sessionId ? result : emptyResult,
  );
}

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

let currentPathname = "";
let currentSearch = "";

function LocationProbe() {
  const location = useLocation();
  useEffect(() => {
    currentPathname = location.pathname;
    currentSearch = location.search;
  }, [location.pathname, location.search]);
  return null;
}

function renderPage(path = "/workspaces/1/consultation/history") {
  render(
    <MemoryRouter initialEntries={[path]}>
      <LocationProbe />
      <Routes>
        <Route path="/workspaces/:workspaceId/consultation/history" element={<ChatHistoryPage />} />
        <Route
          path="/workspaces/:workspaceId/consultation/history/:sessionId"
          element={<ChatHistoryPage />}
        />
      </Routes>
    </MemoryRouter>,
  );
}

describe("ChatHistoryPage", () => {
  beforeEach(() => {
    mockedUseChatSessions.mockReset();
    mockedUseChatMessagePage.mockReset();
    mockedUseChatSessions.mockReturnValue(makeSessionsResult());
    mockedUseChatMessagePage.mockReturnValue(makeMessagePageResult());
  });

  it("URL의 workspaceId로 상담 이력 목록을 요청한다", () => {
    renderPage();

    expect(mockedUseChatSessions).toHaveBeenCalledWith({
      workspaceId: 1,
      status: "COMPLETED",
      keyword: undefined,
      startedFrom: undefined,
      startedTo: undefined,
      assignedCounselorId: undefined,
      page: 0,
      size: 20,
    });
  });

  it("URL query로 상담 이력 검색 조건을 복원한다", () => {
    renderPage(
      "/workspaces/1/consultation/history?q=환불&status=RESOLVED&startedFrom=2026-05-01&startedTo=2026-05-31&assignedCounselorId=42&page=2",
    );

    expect(mockedUseChatSessions).toHaveBeenCalledWith({
      workspaceId: 1,
      status: "RESOLVED",
      keyword: "환불",
      startedFrom: "2026-05-01",
      startedTo: "2026-05-31",
      assignedCounselorId: 42,
      page: 2,
      size: 20,
    });
  });

  it("전체 상태 query는 백엔드 status 조건 없이 조회한다", () => {
    renderPage("/workspaces/1/consultation/history?status=ALL");

    expect(mockedUseChatSessions).toHaveBeenCalledWith({
      workspaceId: 1,
      status: undefined,
      keyword: undefined,
      startedFrom: undefined,
      startedTo: undefined,
      assignedCounselorId: undefined,
      page: 0,
      size: 20,
    });
  });

  it("세션을 선택하지 않으면 안내 문구를 표시한다", () => {
    renderPage();

    expect(screen.getByText("좌측 목록에서 세션을 선택해주세요")).toBeTruthy();
  });

  it("세션을 선택하면 해당 세션의 메시지 내역을 표시한다", async () => {
    mockMessagePageForSession("7", makeMessagePageResult({ data: [makeMessage()] }));

    renderPage();
    fireEvent.click(screen.getByRole("button", { name: /카카오톡/ }));

    expect(mockedUseChatMessagePage).toHaveBeenLastCalledWith("7");
    expect(await screen.findByText("고객")).toBeTruthy();
    expect(screen.getByText("환불 문의 드립니다")).toBeTruthy();
    expect(screen.getByText("TEXT")).toBeTruthy();
    expect(
      screen.getByText(new Date("2026-05-22T09:10:00+09:00").toLocaleString("ko-KR")),
    ).toBeTruthy();
    expect(currentPathname).toBe("/workspaces/1/consultation/history/7");
  });

  it("세션 선택 시 검색 query를 유지한다", () => {
    renderPage("/workspaces/1/consultation/history?q=환불&status=RESOLVED&page=1");
    fireEvent.click(screen.getByRole("button", { name: /카카오톡/ }));

    expect(currentPathname).toBe("/workspaces/1/consultation/history/7");
    const search = new URLSearchParams(currentSearch);
    expect(search.get("q")).toBe("환불");
    expect(search.get("status")).toBe("RESOLVED");
    expect(search.get("page")).toBe("1");
  });

  it("검색어를 변경하면 URL query를 갱신하고 page를 초기화한다", () => {
    renderPage("/workspaces/1/consultation/history?page=3");

    fireEvent.change(screen.getByLabelText("상담 기록 검색"), { target: { value: "배송" } });

    const search = new URLSearchParams(currentSearch);
    expect(search.get("q")).toBe("배송");
    expect(search.has("page")).toBe(false);
  });

  it("전체 상태 선택을 URL query에 유지한다", () => {
    renderPage("/workspaces/1/consultation/history");

    fireEvent.change(screen.getByLabelText("상태 필터"), { target: { value: "ALL" } });

    const search = new URLSearchParams(currentSearch);
    expect(search.get("status")).toBe("ALL");
  });

  it("상담사 메시지는 상담사 역할로 표시한다", async () => {
    mockMessagePageForSession(
      "7",
      makeMessagePageResult({
        data: [makeMessage({ senderRole: "AGENT", content: "처리해드리겠습니다" })],
      }),
    );

    renderPage();
    fireEvent.click(screen.getByRole("button", { name: /카카오톡/ }));

    expect(await screen.findByText("상담사")).toBeTruthy();
    expect(screen.getByText("처리해드리겠습니다")).toBeTruthy();
  });

  it("AI와 내부 메모 역할을 한국어 라벨로 표시한다", async () => {
    mockMessagePageForSession(
      "7",
      makeMessagePageResult({
        data: [
          makeMessage({ id: 12, senderRole: "ASSISTANT", content: "AI 안내입니다" }),
          makeMessage({ id: 13, senderRole: "NOTE", content: "내부 공유 메모" }),
        ],
      }),
    );

    renderPage();
    fireEvent.click(screen.getByRole("button", { name: /카카오톡/ }));

    expect(await screen.findByText("AI")).toBeTruthy();
    expect(screen.getByText("내부 메모")).toBeTruthy();
    expect(screen.getByText("AI 안내입니다")).toBeTruthy();
    expect(screen.getByText("내부 공유 메모")).toBeTruthy();
  });

  it("선택한 세션에 메시지가 없으면 빈 상태를 표시한다", () => {
    mockMessagePageForSession("7", makeMessagePageResult({ data: [] }));

    renderPage();
    fireEvent.click(screen.getByRole("button", { name: /카카오톡/ }));

    expect(screen.getByText("아직 메시지가 없습니다")).toBeTruthy();
  });

  it("메시지 로딩 상태를 표시한다", () => {
    mockMessagePageForSession("7", makeMessagePageResult({ isLoading: true }));

    renderPage();
    fireEvent.click(screen.getByRole("button", { name: /카카오톡/ }));

    expect(screen.getByText("불러오는 중")).toBeTruthy();
  });

  it("메시지 오류 상태에서 다시 시도할 수 있다", () => {
    const refetch = vi.fn();
    mockMessagePageForSession(
      "7",
      makeMessagePageResult({ isError: true, error: new Error("메시지 오류"), refetch }),
    );

    renderPage();
    fireEvent.click(screen.getByRole("button", { name: /카카오톡/ }));
    fireEvent.click(screen.getByRole("button", { name: "다시 시도" }));

    expect(screen.getByText("메시지 오류")).toBeTruthy();
    expect(refetch).toHaveBeenCalled();
  });

  it("URL의 sessionId로 초기 세션을 선택한다", () => {
    mockMessagePageForSession("7", makeMessagePageResult({ data: [makeMessage()] }));
    renderPage("/workspaces/1/consultation/history/7");

    expect(mockedUseChatMessagePage).toHaveBeenLastCalledWith("7");
  });

  it("URL의 sessionId가 현재 목록 페이지에 없어도 메시지 조회를 시도한다", async () => {
    mockMessagePageForSession(
      "999",
      makeMessagePageResult({ data: [makeMessage({ content: "직접 진입 상세입니다" })] }),
    );

    renderPage("/workspaces/1/consultation/history/999");

    expect(mockedUseChatMessagePage).toHaveBeenLastCalledWith("999");
    expect(await screen.findByText("직접 진입 상세입니다")).toBeTruthy();
  });

  it("현재 목록 로딩 중에도 URL sessionId로 메시지 조회를 시도한다", () => {
    mockedUseChatSessions.mockReturnValue(makeSessionsResult({ isLoading: true }));

    renderPage("/workspaces/1/consultation/history/999");

    expect(mockedUseChatMessagePage).toHaveBeenLastCalledWith("999");
  });

  it("URL sessionId의 메시지 조회가 실패하면 오류 상태를 표시한다", () => {
    const refetch = vi.fn();
    mockMessagePageForSession(
      "999",
      makeMessagePageResult({ isError: true, error: new Error("세션을 찾을 수 없습니다"), refetch }),
    );

    renderPage("/workspaces/1/consultation/history/999");

    expect(screen.getByText("세션을 찾을 수 없습니다")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "다시 시도" }));
    expect(refetch).toHaveBeenCalled();
  });
});
