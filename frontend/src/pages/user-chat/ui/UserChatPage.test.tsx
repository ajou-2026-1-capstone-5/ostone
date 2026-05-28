import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiRequestError } from "@/shared/api";
import { UserChatPage } from "./UserChatPage";

const { registerDemoChatSessionMock, sendDemoChatMessageMock, routeState } = vi.hoisted(() => ({
  registerDemoChatSessionMock: vi.fn(),
  sendDemoChatMessageMock: vi.fn(),
  routeState: { workspaceId: "42" as string | undefined },
}));

vi.mock("@/entities/chat", () => ({
  registerDemoChatSession: registerDemoChatSessionMock,
  sendDemoChatMessage: sendDemoChatMessageMock,
}));

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return {
    ...actual,
    useParams: () => routeState,
  };
});

describe("UserChatPage", () => {
  beforeEach(() => {
    routeState.workspaceId = "42";
    window.localStorage.clear();
    registerDemoChatSessionMock.mockReset();
    sendDemoChatMessageMock.mockReset();
    registerDemoChatSessionMock.mockResolvedValue({
      id: "77",
      status: "OPEN",
      startedAt: "2026-05-22T00:00:00Z",
      messages: [
        {
          id: "backend-greeting-77",
          sessionId: 77,
          content: "안녕하세요, 김민지님. 무엇을 도와드릴까요?",
          senderType: "BOT",
          createdAt: "2026-05-22T00:00:00Z",
        },
      ],
    });
    sendDemoChatMessageMock.mockResolvedValue([
      {
        id: "81",
        sessionId: 77,
        content: "Hello",
        senderType: "USER",
        createdAt: "2026-05-22T00:00:01Z",
      },
      {
        id: "82",
        sessionId: 77,
        content: "LLM 응답입니다.",
        senderType: "BOT",
        createdAt: "2026-05-22T00:00:02Z",
      },
    ]);
  });

  it("이름 입력 후 URL의 workspaceId와 이름으로 데모 세션을 생성한다", async () => {
    render(<UserChatPage />);

    expect(screen.getByRole("form", { name: "채팅 사용자 이름 입력" })).not.toBeNull();
    fireEvent.change(screen.getByLabelText("이름"), { target: { value: "김민지" } });
    fireEvent.click(screen.getByRole("button", { name: "채팅 시작" }));

    const eyebrow = await screen.findByTestId("chat-header-eyebrow");
    expect(eyebrow).toHaveTextContent("Session #77");
    expect(screen.getByTestId("chat-header-name")).toHaveTextContent("김민지");
    expect(screen.getByText("안녕하세요, 김민지님. 무엇을 도와드릴까요?")).not.toBeNull();
    expect(registerDemoChatSessionMock).toHaveBeenCalledWith(42, "김민지");
  });

  it("같은 이름으로 다시 진입하면 저장된 세션 메시지를 유지한다", async () => {
    const firstRender = render(<UserChatPage />);
    fireEvent.change(screen.getByLabelText("이름"), { target: { value: "김민지" } });
    fireEvent.click(screen.getByRole("button", { name: "채팅 시작" }));

    const input = await screen.findByLabelText("메시지 입력");
    fireEvent.change(input, { target: { value: "Hello" } });
    fireEvent.click(screen.getByRole("button", { name: "메시지 보내기" }));
    expect(await screen.findByText("Hello")).not.toBeNull();
    expect(await screen.findByText("LLM 응답입니다.")).not.toBeNull();
    expect(sendDemoChatMessageMock).toHaveBeenCalledWith(42, "77", "Hello");

    firstRender.unmount();
    registerDemoChatSessionMock.mockClear();
    render(<UserChatPage />);

    fireEvent.change(screen.getByLabelText("이름"), { target: { value: "김민지" } });
    fireEvent.click(screen.getByRole("button", { name: "채팅 시작" }));

    expect(await screen.findByText("Hello")).not.toBeNull();
    expect(screen.getByTestId("chat-header-eyebrow")).toHaveTextContent("Session #77");
    expect(screen.getByTestId("chat-header-name")).toHaveTextContent("김민지");
    expect(registerDemoChatSessionMock).not.toHaveBeenCalled();
  });

  it("메시지 전송 실패 시 optimistic 메시지를 되돌린다", async () => {
    sendDemoChatMessageMock.mockRejectedValueOnce(new Error("LLM failed"));

    render(<UserChatPage />);
    fireEvent.change(screen.getByLabelText("이름"), { target: { value: "김민지" } });
    fireEvent.click(screen.getByRole("button", { name: "채팅 시작" }));

    const input = await screen.findByLabelText("메시지 입력");
    fireEvent.change(input, { target: { value: "Hello" } });
    fireEvent.click(screen.getByRole("button", { name: "메시지 보내기" }));

    expect(
      await screen.findByText("응답을 생성하지 못했습니다. 잠시 후 다시 시도해 주세요."),
    ).not.toBeNull();
    expect(screen.queryByText("Hello")).toBeNull();
  });

  it("이름이 비어 있으면 세션을 생성하지 않는다", async () => {
    render(<UserChatPage />);

    fireEvent.click(screen.getByRole("button", { name: "채팅 시작" }));

    expect(await screen.findByText("이름을 입력해 주세요.")).not.toBeNull();
    expect(window.localStorage.length).toBe(0);
  });

  it("유효하지 않은 workspaceId에서 에러 메시지를 표시한다", async () => {
    routeState.workspaceId = undefined;

    render(<UserChatPage />);

    expect(await screen.findByText("유효하지 않은 워크스페이스입니다.")).not.toBeNull();
    expect(window.localStorage.length).toBe(0);
  });

  describe("session start error handling", () => {
    let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
      consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    });

    afterEach(() => {
      consoleErrorSpy.mockRestore();
    });

    it("DOMAIN_PACK_CURRENT_VERSION_NOT_FOUND 에러를 구체적인 안내로 표시하고 콘솔에 로깅한다", async () => {
      registerDemoChatSessionMock.mockRejectedValueOnce(
        new ApiRequestError(
          404,
          "DOMAIN_PACK_CURRENT_VERSION_NOT_FOUND",
          "현재 운영 중인 PUBLISHED version을 찾을 수 없습니다.",
        ),
      );

      render(<UserChatPage />);
      fireEvent.change(screen.getByLabelText("이름"), { target: { value: "김민지" } });
      fireEvent.click(screen.getByRole("button", { name: "채팅 시작" }));

      expect(
        await screen.findByText(
          "이 워크스페이스에는 운영 중인 도메인 팩 버전이 없습니다. 관리자에게 문의해 주세요.",
        ),
      ).not.toBeNull();
      expect(screen.getByRole("alert")).not.toBeNull();
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "Failed to start demo chat session",
        expect.any(ApiRequestError),
      );
    });

    it("그 외 에러는 기본 메시지로 안내한다", async () => {
      registerDemoChatSessionMock.mockRejectedValueOnce(new Error("Network down"));

      render(<UserChatPage />);
      fireEvent.change(screen.getByLabelText("이름"), { target: { value: "김민지" } });
      fireEvent.click(screen.getByRole("button", { name: "채팅 시작" }));

      expect(
        await screen.findByText("채팅 세션을 시작할 수 없습니다. 잠시 후 다시 시도해 주세요."),
      ).not.toBeNull();
    });

    it("에러 화면의 다시 시도 버튼은 이름 입력 폼으로 복귀한다", async () => {
      registerDemoChatSessionMock.mockRejectedValueOnce(new Error("transient"));

      render(<UserChatPage />);
      fireEvent.change(screen.getByLabelText("이름"), { target: { value: "김민지" } });
      fireEvent.click(screen.getByRole("button", { name: "채팅 시작" }));

      const retryButton = await screen.findByRole("button", { name: "다시 시도" });
      fireEvent.click(retryButton);

      expect(screen.getByRole("form", { name: "채팅 사용자 이름 입력" })).not.toBeNull();
    });
  });
});
