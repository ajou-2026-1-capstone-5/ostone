import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useChatSessions } from "../../api/chatHistoryApi";
import type { ChatSession } from "../../api/consultationApi";
import { SessionList } from "./SessionList";

vi.mock("../../api/chatHistoryApi", () => ({
  useChatSessions: vi.fn(),
}));

const mockedUseChatSessions = vi.mocked(useChatSessions);

type MockChatSessionsResult = Pick<
  ReturnType<typeof useChatSessions>,
  "data" | "isLoading" | "isError" | "error" | "refetch"
>;

const makeQueryResult = (overrides?: Partial<MockChatSessionsResult>) => ({
  data: [],
  isLoading: false,
  isError: false,
  error: null,
  refetch: vi.fn(),
  ...overrides,
}) as ReturnType<typeof useChatSessions>;

const makeSession = (id: number, meta?: Record<string, unknown>): ChatSession => ({
  id,
  status: "COMPLETED",
  channel: "카카오톡",
  metaJson: JSON.stringify({
    messageCount: 3,
    lastMessagePreview: "배송 상태를 확인해주세요",
    ...meta,
  }),
  startedAt: "2026-05-22T09:00:00+09:00",
});

describe("SessionList", () => {
  beforeEach(() => {
    mockedUseChatSessions.mockReset();
  });

  it("완료된 세션 목록을 기본 필터로 요청한다", () => {
    mockedUseChatSessions.mockReturnValue(makeQueryResult());

    render(
      <SessionList workspaceId="workspace-1" selectedSessionId={null} onSelectSession={vi.fn()} />,
    );

    expect(mockedUseChatSessions).toHaveBeenCalledWith({
      workspaceId: "workspace-1",
      status: "completed",
    });
  });

  it("로딩 상태를 표시한다", () => {
    mockedUseChatSessions.mockReturnValue(makeQueryResult({ isLoading: true }));

    render(
      <SessionList workspaceId="workspace-1" selectedSessionId={null} onSelectSession={vi.fn()} />,
    );

    expect(screen.getByText("불러오는 중")).toBeTruthy();
  });

  it("세션이 없으면 빈 상태 메시지를 표시한다", () => {
    mockedUseChatSessions.mockReturnValue(makeQueryResult({ data: [] }));

    render(
      <SessionList workspaceId="workspace-1" selectedSessionId={null} onSelectSession={vi.fn()} />,
    );

    expect(screen.getByText("아직 채팅 기록이 없습니다")).toBeTruthy();
  });

  it("오류 상태에서 메시지와 다시 시도 버튼을 표시한다", () => {
    const refetch = vi.fn();
    mockedUseChatSessions.mockReturnValue(
      makeQueryResult({
        isError: true,
        error: new Error("목록을 불러오지 못했습니다"),
        refetch,
      }),
    );

    render(
      <SessionList workspaceId="workspace-1" selectedSessionId={null} onSelectSession={vi.fn()} />,
    );

    expect(screen.getByText("목록을 불러오지 못했습니다")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "다시 시도" }));
    expect(refetch).toHaveBeenCalled();
  });

  it("세션 카드에 채널, 날짜, 메시지 수, 마지막 메시지를 표시한다", () => {
    mockedUseChatSessions.mockReturnValue(makeQueryResult({ data: [makeSession(7)] }));

    render(
      <SessionList workspaceId="workspace-1" selectedSessionId={null} onSelectSession={vi.fn()} />,
    );

    expect(screen.getByText("채널")).toBeTruthy();
    expect(screen.getByText("카카오톡")).toBeTruthy();
    expect(screen.getByText(new Date("2026-05-22T09:00:00+09:00").toLocaleDateString("ko-KR"))).toBeTruthy();
    expect(screen.getByText("메시지 3개")).toBeTruthy();
    expect(screen.getByText("배송 상태를 확인해주세요")).toBeTruthy();
  });

  it("선택된 세션은 aria-pressed로 활성 상태를 드러낸다", () => {
    mockedUseChatSessions.mockReturnValue(makeQueryResult({ data: [makeSession(7)] }));

    render(
      <SessionList workspaceId="workspace-1" selectedSessionId="7" onSelectSession={vi.fn()} />,
    );

    expect(screen.getByRole("button", { pressed: true })).toBeTruthy();
  });

  it("카드를 클릭하면 onSelectSession이 호출된다", () => {
    const onSelect = vi.fn();
    mockedUseChatSessions.mockReturnValue(makeQueryResult({ data: [makeSession(7)] }));

    render(<SessionList workspaceId="workspace-1" selectedSessionId={null} onSelectSession={onSelect} />);

    fireEvent.click(screen.getByRole("button", { name: /카카오톡/ }));

    expect(onSelect).toHaveBeenCalledWith("7");
  });
});
