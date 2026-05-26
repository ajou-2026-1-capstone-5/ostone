import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { UserChatPage } from "./UserChatPage";

const { createChatSessionMock, routeState } = vi.hoisted(() => ({
  createChatSessionMock: vi.fn(),
  routeState: { workspaceId: "42" as string | undefined },
}));

vi.mock("@/entities/chat", () => ({
  createChatSession: createChatSessionMock,
}));

vi.mock("@/features/user-chat", () => ({
  ChatRoom: ({ sessionId }: { sessionId: number }) => <div>ChatRoom session {sessionId}</div>,
}));

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return {
    ...actual,
    useParams: () => routeState,
    useOutletContext: () => ({ setTopbarRight: vi.fn(), setCrumbs: vi.fn() }),
  };
});

describe("UserChatPage", () => {
  beforeEach(() => {
    routeState.workspaceId = "42";
    createChatSessionMock.mockReset();
  });

  it("mount 시 URL의 workspaceId로 채팅 세션을 생성한다", async () => {
    createChatSessionMock.mockResolvedValue({
      id: 7,
      status: "OPEN",
      channel: "WEB",
      startedAt: "2026-05-22T00:00:00Z",
    });

    render(<UserChatPage />);

    expect(screen.getByText("채팅방을 여는 중입니다...")).not.toBeNull();
    await waitFor(() => expect(createChatSessionMock).toHaveBeenCalledWith(42));
  });

  it("생성된 session id를 ChatRoom에 전달한다", async () => {
    createChatSessionMock.mockResolvedValue({
      id: 9,
      status: "OPEN",
      channel: "WEB",
      startedAt: "2026-05-22T00:00:00Z",
    });

    render(<UserChatPage />);

    expect(await screen.findByText("ChatRoom session 9")).not.toBeNull();
  });

  it("세션 생성 실패 시 에러 메시지를 표시한다", async () => {
    createChatSessionMock.mockRejectedValue(new Error("failed"));

    render(<UserChatPage />);

    expect(await screen.findByText("채팅 세션을 시작할 수 없습니다.")).not.toBeNull();
  });

  it("유효하지 않은 workspaceId에서 에러 메시지를 표시한다", async () => {
    routeState.workspaceId = undefined;
    createChatSessionMock.mockReset();

    render(<UserChatPage />);

    expect(await screen.findByText("유효하지 않은 워크스페이스입니다.")).not.toBeNull();
    expect(createChatSessionMock).not.toHaveBeenCalled();
  });
});
