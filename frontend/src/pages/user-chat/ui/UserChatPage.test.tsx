import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiRequestError } from "@/shared/api";
import { UserChatPage } from "./UserChatPage";

const {
  createChatSessionMock,
  createFreshChatSessionMock,
  listChatMessagesMock,
  listDemoChatMessagesMock,
  registerDemoChatSessionMock,
  sendDemoChatMessageMock,
  useStompOptions,
  routeState,
  searchState,
  stompState,
} = vi.hoisted(() => ({
  createChatSessionMock: vi.fn(),
  createFreshChatSessionMock: vi.fn(),
  listChatMessagesMock: vi.fn(),
  listDemoChatMessagesMock: vi.fn(),
  registerDemoChatSessionMock: vi.fn(),
  sendDemoChatMessageMock: vi.fn(),
  useStompOptions: [] as unknown[],
  routeState: { workspaceId: "42" as string | undefined },
  searchState: { search: "" },
  stompState: {
    connectionStatus: "DISCONNECTED",
    sendMessage: vi.fn(),
    subscribe: vi.fn(),
  },
}));

vi.mock("@/entities/chat", () => ({
  createChatSession: createChatSessionMock,
  createFreshChatSession: createFreshChatSessionMock,
  listChatMessages: listChatMessagesMock,
  listDemoChatMessages: listDemoChatMessagesMock,
  registerDemoChatSession: registerDemoChatSessionMock,
  sendDemoChatMessage: sendDemoChatMessageMock,
}));

vi.mock("@/shared/lib/websocket", () => ({
  useStomp: (options: unknown) => {
    useStompOptions.push(options);
    return stompState;
  },
}));

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return {
    ...actual,
    useParams: () => routeState,
    useSearchParams: () => [new URLSearchParams(searchState.search), () => {}],
  };
});

function createDeferred<T>() {
  let resolve: (value: T | PromiseLike<T>) => void = () => {};
  let reject: (reason?: unknown) => void = () => {};
  const promise = new Promise<T>((promiseResolve, promiseReject) => {
    resolve = promiseResolve;
    reject = promiseReject;
  });
  return { promise, resolve, reject };
}

type DeferredChatMessage = {
  id: string;
  sessionId: number;
  content: string;
  senderType: "USER" | "BOT";
  createdAt: string;
};

function seedAuthUser(name = "하나카드 데모 사용자") {
  window.localStorage.setItem(
    "user",
    JSON.stringify({
      id: 2,
      email: "hanacard.demo@ostone.local",
      name,
      role: "OPERATOR",
    }),
  );
}

describe("UserChatPage", () => {
  beforeEach(() => {
    routeState.workspaceId = "42";
    searchState.search = "";
    window.localStorage.clear();
    useStompOptions.length = 0;
    stompState.connectionStatus = "DISCONNECTED";
    stompState.sendMessage.mockReset();
    stompState.subscribe.mockReset();
    stompState.subscribe.mockReturnValue(() => {});
    createChatSessionMock.mockReset();
    createChatSessionMock.mockResolvedValue({
      id: 177,
      status: "OPEN",
      channel: "WEB",
      startedAt: "2026-05-22T00:00:00Z",
    });
    createFreshChatSessionMock.mockReset();
    createFreshChatSessionMock.mockResolvedValue({
      id: 188,
      status: "OPEN",
      channel: "WEB",
      startedAt: "2026-05-22T00:10:00Z",
    });
    listChatMessagesMock.mockReset();
    listChatMessagesMock.mockResolvedValue([]);
    listDemoChatMessagesMock.mockReset();
    listDemoChatMessagesMock.mockResolvedValue([
      {
        id: "80",
        sessionId: 77,
        content: "안녕하세요, 김민지님. 무엇을 도와드릴까요?",
        senderType: "BOT",
        createdAt: "2026-05-22T00:00:00Z",
      },
    ]);
    registerDemoChatSessionMock.mockReset();
    sendDemoChatMessageMock.mockReset();
    registerDemoChatSessionMock.mockResolvedValue({
      id: "77",
      status: "OPEN",
      startedAt: "2026-05-22T00:00:00Z",
      messages: [
        {
          id: "80",
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
    fireEvent.click(screen.getByRole("button", { name: "미리보기 시작" }));

    const eyebrow = await screen.findByTestId("chat-header-eyebrow");
    expect(eyebrow).toHaveTextContent("Session #77");
    expect(screen.getByTestId("chat-header-name")).toHaveTextContent("김민지");
    expect(await screen.findByText("안녕하세요, 김민지님. 무엇을 도와드릴까요?")).not.toBeNull();
    expect(registerDemoChatSessionMock).toHaveBeenCalledWith(42, "김민지");
  });

  it("세션 진입 시 메시지를 한 번만 조회하고 polling interval을 만들지 않는다", async () => {
    const setIntervalSpy = vi.spyOn(window, "setInterval");

    try {
      render(<UserChatPage />);
      fireEvent.change(screen.getByLabelText("이름"), { target: { value: "김민지" } });
      fireEvent.click(screen.getByRole("button", { name: "미리보기 시작" }));

      await waitFor(() => {
        expect(listDemoChatMessagesMock).toHaveBeenCalledWith(42, "77");
      });
      expect(listDemoChatMessagesMock).toHaveBeenCalledTimes(1);
      expect(setIntervalSpy).not.toHaveBeenCalledWith(expect.any(Function), 3000);
    } finally {
      setIntervalSpy.mockRestore();
    }
  });

  it("name 쿼리 파라미터가 있으면 이름 입력 화면을 건너뛰고 세션을 자동 생성한다", async () => {
    searchState.search = "name=박서준";

    render(<UserChatPage />);

    expect(await screen.findByTestId("chat-conversation-screen")).not.toBeNull();
    expect(registerDemoChatSessionMock).toHaveBeenCalledWith(42, "박서준");
    expect(screen.queryByTestId("chat-entry-screen")).toBeNull();
  });

  it("workspaceId나 name 쿼리가 바뀌면 이전 세션을 버리고 새 세션을 자동 생성한다", async () => {
    searchState.search = "name=김민지";
    registerDemoChatSessionMock.mockReset();
    registerDemoChatSessionMock
      .mockResolvedValueOnce({
        id: "77",
        status: "OPEN",
        startedAt: "2026-05-22T00:00:00Z",
        messages: [],
      })
      .mockResolvedValueOnce({
        id: "88",
        status: "OPEN",
        startedAt: "2026-05-22T00:10:00Z",
        messages: [],
      });
    listDemoChatMessagesMock.mockReset();
    listDemoChatMessagesMock.mockImplementation((_workspaceId: number, sessionId: string) =>
      Promise.resolve(
        sessionId === "88"
          ? [
              {
                id: "90",
                sessionId: 88,
                content: "이하나 세션 안내입니다.",
                senderType: "BOT",
                createdAt: "2026-05-22T00:10:00Z",
              },
            ]
          : [
              {
                id: "80",
                sessionId: 77,
                content: "김민지 세션 안내입니다.",
                senderType: "BOT",
                createdAt: "2026-05-22T00:00:00Z",
              },
            ],
      ),
    );

    const view = render(<UserChatPage />);

    expect(await screen.findByText("김민지 세션 안내입니다.")).toBeInTheDocument();
    expect(screen.getByTestId("chat-header-eyebrow")).toHaveTextContent("Session #77");
    expect(screen.getByTestId("chat-header-name")).toHaveTextContent("김민지");

    routeState.workspaceId = "43";
    searchState.search = "name=이하나";
    view.rerender(<UserChatPage />);

    await waitFor(() => {
      expect(registerDemoChatSessionMock).toHaveBeenCalledWith(43, "이하나");
    });
    expect(await screen.findByText("이하나 세션 안내입니다.")).toBeInTheDocument();
    expect(screen.getByTestId("chat-header-eyebrow")).toHaveTextContent("Session #88");
    expect(screen.getByTestId("chat-header-name")).toHaveTextContent("이하나");
    expect(screen.queryByText("김민지 세션 안내입니다.")).toBeNull();
  });

  it("name 쿼리 파라미터가 공백이면 이름 입력 화면으로 폴백한다", () => {
    searchState.search = "name=%20%20";

    render(<UserChatPage />);

    expect(screen.getByTestId("chat-entry-screen")).not.toBeNull();
    expect(registerDemoChatSessionMock).not.toHaveBeenCalled();
  });

  it("인증 모드는 로그인 사용자 이름으로 실제 사용자 채팅 세션을 자동 시작한다", async () => {
    seedAuthUser();
    listChatMessagesMock.mockResolvedValueOnce([
      {
        id: "201",
        sessionId: 177,
        content: "하나카드 상담을 시작합니다.",
        senderType: "BOT",
        createdAt: "2026-05-22T00:00:00Z",
      },
    ]);

    render(<UserChatPage mode="authenticated" />);

    expect(await screen.findByTestId("chat-conversation-screen")).not.toBeNull();
    expect(screen.getByTestId("chat-header-eyebrow")).toHaveTextContent("Session #177");
    expect(screen.getByTestId("chat-header-name")).toHaveTextContent("하나카드 데모 사용자");
    expect(await screen.findByText("하나카드 상담을 시작합니다.")).not.toBeNull();
    expect(createChatSessionMock).toHaveBeenCalledWith(42, "하나카드 데모 사용자");
    expect(listChatMessagesMock).toHaveBeenCalledWith(177);
    expect(registerDemoChatSessionMock).not.toHaveBeenCalled();
    expect(useStompOptions[useStompOptions.length - 1]).toEqual({ includeAuth: true });
  });

  it("인증 모드는 메시지를 demo REST가 아니라 인증 WebSocket으로 전송한다", async () => {
    seedAuthUser("하나카드 고객");
    stompState.connectionStatus = "CONNECTED";

    render(<UserChatPage mode="authenticated" />);

    const input = await screen.findByLabelText("메시지 입력");
    await waitFor(() => {
      expect(stompState.subscribe).toHaveBeenCalledWith("/topic/chat.177", expect.any(Function));
    });

    fireEvent.change(input, { target: { value: "카드 한도 올리고 싶어요" } });
    fireEvent.click(screen.getByRole("button", { name: "메시지 보내기" }));

    expect(stompState.sendMessage).toHaveBeenCalledWith({
      sessionId: 177,
      content: "카드 한도 올리고 싶어요",
    });
    expect(sendDemoChatMessageMock).not.toHaveBeenCalled();
    expect(screen.getByText("카드 한도 올리고 싶어요")).not.toBeNull();
  });

  it("인증 모드의 새 테스트 세션 시작은 실제 새 사용자 세션을 생성한다", async () => {
    seedAuthUser("액티벤처 고객");
    listChatMessagesMock.mockImplementation((sessionId: number) =>
      Promise.resolve(
        sessionId === 188
          ? [
              {
                id: "301",
                sessionId: 188,
                content: "새 인증 테스트 세션입니다.",
                senderType: "BOT",
                createdAt: "2026-05-22T00:10:00Z",
              },
            ]
          : [],
      ),
    );

    render(<UserChatPage mode="authenticated" />);

    expect(await screen.findByTestId("chat-conversation-screen")).not.toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "새 테스트 세션 시작" }));

    expect(await screen.findByText("새 인증 테스트 세션입니다.")).not.toBeNull();
    expect(screen.getByTestId("chat-header-eyebrow")).toHaveTextContent("Session #188");
    expect(createFreshChatSessionMock).toHaveBeenCalledWith(42, "액티벤처 고객");
    expect(registerDemoChatSessionMock).not.toHaveBeenCalled();
  });

  it("같은 이름으로 다시 진입하면 백엔드 저장 메시지를 다시 불러온다", async () => {
    listDemoChatMessagesMock
      .mockResolvedValueOnce([
        {
          id: "80",
          sessionId: 77,
          content: "안녕하세요, 김민지님. 무엇을 도와드릴까요?",
          senderType: "BOT",
          createdAt: "2026-05-22T00:00:00Z",
        },
      ])
      .mockResolvedValueOnce([
        {
          id: "80",
          sessionId: 77,
          content: "안녕하세요, 김민지님. 무엇을 도와드릴까요?",
          senderType: "BOT",
          createdAt: "2026-05-22T00:00:00Z",
        },
        {
          id: "81",
          sessionId: 77,
          content: "Hello",
          senderType: "USER",
          senderName: "김민지",
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

    const firstRender = render(<UserChatPage />);
    fireEvent.change(screen.getByLabelText("이름"), { target: { value: "김민지" } });
    fireEvent.click(screen.getByRole("button", { name: "미리보기 시작" }));

    expect(await screen.findByText("안녕하세요, 김민지님. 무엇을 도와드릴까요?")).not.toBeNull();

    firstRender.unmount();
    registerDemoChatSessionMock.mockClear();
    render(<UserChatPage />);

    fireEvent.change(screen.getByLabelText("이름"), { target: { value: "김민지" } });
    fireEvent.click(screen.getByRole("button", { name: "미리보기 시작" }));

    expect(await screen.findByText("Hello")).not.toBeNull();
    expect(screen.getByTestId("chat-header-eyebrow")).toHaveTextContent("Session #77");
    expect(screen.getByTestId("chat-header-name")).toHaveTextContent("김민지");
    expect(registerDemoChatSessionMock).not.toHaveBeenCalled();
    expect(listDemoChatMessagesMock).toHaveBeenCalledTimes(2);
  });

  it("새 테스트 세션 시작은 새 백엔드 세션으로 저장 세션을 교체한다", async () => {
    listDemoChatMessagesMock.mockImplementation((_workspaceId: number, sessionId: string) =>
      Promise.resolve(
        sessionId === "77"
          ? [
              {
                id: "80",
                sessionId: 77,
                content: "첫 테스트 세션입니다.",
                senderType: "BOT",
                createdAt: "2026-05-22T00:00:00Z",
              },
            ]
          : [
              {
                id: "90",
                sessionId: 88,
                content: "새 테스트 세션입니다.",
                senderType: "BOT",
                createdAt: "2026-05-22T00:10:00Z",
              },
            ],
      ),
    );
    registerDemoChatSessionMock
      .mockResolvedValueOnce({
        id: "77",
        status: "OPEN",
        startedAt: "2026-05-22T00:00:00Z",
        messages: [],
      })
      .mockResolvedValueOnce({
        id: "88",
        status: "OPEN",
        startedAt: "2026-05-22T00:10:00Z",
        messages: [],
      });

    render(<UserChatPage />);
    fireEvent.change(screen.getByLabelText("이름"), { target: { value: "김민지" } });
    fireEvent.click(screen.getByRole("button", { name: "미리보기 시작" }));

    expect(await screen.findByText("첫 테스트 세션입니다.")).not.toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "새 테스트 세션 시작" }));

    expect(await screen.findByText("새 테스트 세션입니다.")).not.toBeNull();
    expect(screen.getByTestId("chat-header-eyebrow")).toHaveTextContent("Session #88");
    expect(registerDemoChatSessionMock).toHaveBeenCalledTimes(2);
  });

  it("새 테스트 세션 생성 실패 시 운영 도메인팩 안내 에러를 표시한다", async () => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    listDemoChatMessagesMock.mockResolvedValueOnce([
      {
        id: "80",
        sessionId: 77,
        content: "첫 테스트 세션입니다.",
        senderType: "BOT",
        createdAt: "2026-05-22T00:00:00Z",
      },
    ]);
    registerDemoChatSessionMock
      .mockResolvedValueOnce({
        id: "77",
        status: "OPEN",
        startedAt: "2026-05-22T00:00:00Z",
        messages: [],
      })
      .mockRejectedValueOnce(
        new ApiRequestError(
          404,
          "DOMAIN_PACK_CURRENT_VERSION_NOT_FOUND",
          "현재 운영 중인 PUBLISHED version을 찾을 수 없습니다.",
        ),
      );

    render(<UserChatPage />);
    fireEvent.change(screen.getByLabelText("이름"), { target: { value: "김민지" } });
    fireEvent.click(screen.getByRole("button", { name: "미리보기 시작" }));

    expect(await screen.findByText("첫 테스트 세션입니다.")).not.toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "새 테스트 세션 시작" }));

    expect(
      await screen.findByText(
        "이 워크스페이스에는 운영 중인 도메인 팩 버전이 없습니다. 관리자에게 문의해 주세요.",
      ),
    ).not.toBeNull();
    const storedSession = window.localStorage.getItem(window.localStorage.key(0) ?? "");
    expect(storedSession).toContain("첫 테스트 세션입니다.");
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      "Failed to restart user chat session",
      expect.any(ApiRequestError),
    );

    consoleErrorSpy.mockRestore();
  });

  it("백엔드에 저장된 상담사 메시지를 동기화해 화면에 표시한다", async () => {
    listDemoChatMessagesMock.mockResolvedValueOnce([
      {
        id: "91",
        sessionId: 77,
        content: "저장된 상담사 답변입니다.",
        senderType: "AGENT",
        createdAt: "2026-05-22T00:00:03Z",
      },
    ]);

    render(<UserChatPage />);
    fireEvent.change(screen.getByLabelText("이름"), { target: { value: "김민지" } });
    fireEvent.click(screen.getByRole("button", { name: "미리보기 시작" }));

    expect(await screen.findByText("저장된 상담사 답변입니다.")).not.toBeNull();
    expect(listDemoChatMessagesMock).toHaveBeenCalledWith(42, "77");
  });

  it("기존 localStorage 임시 greeting은 초기 REST 메시지로 대체한다", async () => {
    const storageKey = `ostone:demo-chat-session:42:${encodeURIComponent("김민지")}`;
    window.localStorage.setItem(
      storageKey,
      JSON.stringify({
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
      }),
    );

    render(<UserChatPage />);
    fireEvent.change(screen.getByLabelText("이름"), { target: { value: "김민지" } });
    fireEvent.click(screen.getByRole("button", { name: "미리보기 시작" }));

    expect(await screen.findByText("안녕하세요, 김민지님. 무엇을 도와드릴까요?")).not.toBeNull();
    expect(screen.getAllByText("안녕하세요, 김민지님. 무엇을 도와드릴까요?")).toHaveLength(1);
    await waitFor(() => {
      expect(window.localStorage.getItem(storageKey)).not.toContain("backend-greeting-77");
    });
  });

  it("빈 데모 저장 세션은 재사용하지 않고 greeting이 있는 새 세션을 만든다", async () => {
    const storageKey = `ostone:demo-chat-session:42:${encodeURIComponent("김민지")}`;
    window.localStorage.setItem(
      storageKey,
      JSON.stringify({
        id: "66",
        status: "OPEN",
        startedAt: "2026-05-22T00:00:00Z",
        messages: [],
      }),
    );

    render(<UserChatPage />);
    fireEvent.change(screen.getByLabelText("이름"), { target: { value: "김민지" } });
    fireEvent.click(screen.getByRole("button", { name: "미리보기 시작" }));

    expect(await screen.findByText("안녕하세요, 김민지님. 무엇을 도와드릴까요?")).not.toBeNull();
    expect(registerDemoChatSessionMock).toHaveBeenCalledWith(42, "김민지");
    expect(screen.getByTestId("chat-header-eyebrow")).toHaveTextContent("Session #77");
  });

  it("REST 응답에 봇 메시지가 있으면 최소 입력 표시 시간 이후 렌더링한다", async () => {
    stompState.connectionStatus = "CONNECTED";

    render(<UserChatPage />);
    fireEvent.change(screen.getByLabelText("이름"), { target: { value: "김민지" } });
    fireEvent.click(screen.getByRole("button", { name: "미리보기 시작" }));

    const input = await screen.findByLabelText("메시지 입력");
    await waitFor(() => {
      expect(stompState.subscribe).toHaveBeenCalledWith("/topic/chat.77", expect.any(Function));
    });
    fireEvent.change(input, { target: { value: "Hello" } });
    fireEvent.click(screen.getByRole("button", { name: "메시지 보내기" }));

    await waitFor(() => {
      expect(sendDemoChatMessageMock).toHaveBeenCalledWith(42, "77", "Hello");
    });
    expect(screen.getByText("Hello")).not.toBeNull();
    expect(screen.queryByText("LLM 응답입니다.")).toBeNull();
    expect(screen.getByTestId("bot-typing-indicator")).toBeInTheDocument();
    expect(
      await screen.findByText("LLM 응답입니다.", undefined, { timeout: 1500 }),
    ).toBeInTheDocument();
    expect(screen.queryByTestId("bot-typing-indicator")).not.toBeInTheDocument();
  });

  it("USER-only 성공 응답은 사용자 메시지를 유지하고 봇 타이핑을 종료한다", async () => {
    const response = createDeferred<DeferredChatMessage[]>();
    stompState.connectionStatus = "CONNECTED";
    sendDemoChatMessageMock.mockReturnValueOnce(response.promise);

    render(<UserChatPage />);
    fireEvent.change(screen.getByLabelText("이름"), { target: { value: "김민지" } });
    fireEvent.click(screen.getByRole("button", { name: "미리보기 시작" }));

    const input = await screen.findByLabelText("메시지 입력");
    await waitFor(() => {
      expect(stompState.subscribe).toHaveBeenCalledWith("/topic/chat.77", expect.any(Function));
    });
    fireEvent.change(input, { target: { value: "아직 답변 없나요?" } });
    fireEvent.click(screen.getByRole("button", { name: "메시지 보내기" }));

    expect(await screen.findByTestId("bot-typing-indicator")).toBeInTheDocument();

    await act(async () => {
      response.resolve([
        {
          id: "81",
          sessionId: 77,
          content: "아직 답변 없나요?",
          senderType: "USER",
          createdAt: "2026-05-22T00:00:01Z",
        },
      ]);
      await response.promise;
    });

    await waitFor(() => {
      expect(screen.queryByTestId("bot-typing-indicator")).not.toBeInTheDocument();
    });
    expect(screen.getAllByText("아직 답변 없나요?")).toHaveLength(1);
    expect(screen.getByTestId("message-81")).toBeInTheDocument();
    expect(
      screen.queryByText("응답을 생성하지 못했습니다. 잠시 후 다시 시도해 주세요."),
    ).toBeNull();
  });

  it("이전 세션 전송 응답이 늦게 도착해도 현재 세션 봇 타이핑을 종료하지 않는다", async () => {
    const previousResponse = createDeferred<DeferredChatMessage[]>();
    const currentResponse = createDeferred<DeferredChatMessage[]>();
    stompState.connectionStatus = "CONNECTED";
    registerDemoChatSessionMock
      .mockResolvedValueOnce({
        id: "77",
        status: "OPEN",
        startedAt: "2026-05-22T00:00:00Z",
        messages: [],
      })
      .mockResolvedValueOnce({
        id: "88",
        status: "OPEN",
        startedAt: "2026-05-22T00:10:00Z",
        messages: [],
      });
    listDemoChatMessagesMock.mockImplementation((_workspaceId: number, sessionId: string) =>
      Promise.resolve([
        {
          id: `greeting-${sessionId}`,
          sessionId: Number(sessionId),
          content: `세션 ${sessionId} 안내입니다.`,
          senderType: "BOT",
          createdAt: "2026-05-22T00:00:00Z",
        },
      ]),
    );
    sendDemoChatMessageMock
      .mockReturnValueOnce(previousResponse.promise)
      .mockReturnValueOnce(currentResponse.promise);

    render(<UserChatPage />);
    fireEvent.change(screen.getByLabelText("이름"), { target: { value: "김민지" } });
    fireEvent.click(screen.getByRole("button", { name: "미리보기 시작" }));

    const firstInput = await screen.findByLabelText("메시지 입력");
    await waitFor(() => {
      expect(stompState.subscribe).toHaveBeenCalledWith("/topic/chat.77", expect.any(Function));
    });
    fireEvent.change(firstInput, { target: { value: "첫 번째 문의" } });
    fireEvent.click(screen.getByRole("button", { name: "메시지 보내기" }));
    expect(await screen.findByTestId("bot-typing-indicator")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "새 테스트 세션 시작" }));
    expect(await screen.findByText("세션 88 안내입니다.")).toBeInTheDocument();

    const secondInput = screen.getByLabelText("메시지 입력");
    fireEvent.change(secondInput, { target: { value: "두 번째 문의" } });
    fireEvent.click(screen.getByRole("button", { name: "메시지 보내기" }));

    await waitFor(() => {
      expect(sendDemoChatMessageMock).toHaveBeenCalledWith(42, "88", "두 번째 문의");
    });
    expect(screen.getByTestId("bot-typing-indicator")).toBeInTheDocument();

    await act(async () => {
      previousResponse.resolve([
        {
          id: "81",
          sessionId: 77,
          content: "첫 번째 문의",
          senderType: "USER",
          createdAt: "2026-05-22T00:00:01Z",
        },
      ]);
      await previousResponse.promise;
    });

    expect(screen.getByTestId("bot-typing-indicator")).toBeInTheDocument();
    expect(screen.queryByTestId("message-81")).toBeNull();

    await act(async () => {
      currentResponse.resolve([
        {
          id: "91",
          sessionId: 88,
          content: "두 번째 문의",
          senderType: "USER",
          createdAt: "2026-05-22T00:10:01Z",
        },
      ]);
      await currentResponse.promise;
    });

    await waitFor(() => {
      expect(screen.queryByTestId("bot-typing-indicator")).not.toBeInTheDocument();
    });
    expect(screen.getByTestId("message-91")).toBeInTheDocument();
  });

  it("WebSocket user 메시지는 optimistic 메시지를 서버 메시지로 교체한다", async () => {
    const response = createDeferred<[]>();
    let topicHandler: ((message: unknown) => void) | undefined;
    stompState.connectionStatus = "CONNECTED";
    sendDemoChatMessageMock.mockReturnValueOnce(response.promise);
    stompState.subscribe.mockImplementation((_topic: string, cb: (message: unknown) => void) => {
      topicHandler = cb;
      return () => {};
    });

    render(<UserChatPage />);
    fireEvent.change(screen.getByLabelText("이름"), { target: { value: "김민지" } });
    fireEvent.click(screen.getByRole("button", { name: "미리보기 시작" }));

    const input = await screen.findByLabelText("메시지 입력");
    await waitFor(() => {
      expect(stompState.subscribe).toHaveBeenCalledWith("/topic/chat.77", expect.any(Function));
    });
    fireEvent.change(input, { target: { value: "Hello" } });
    fireEvent.click(screen.getByRole("button", { name: "메시지 보내기" }));

    expect(await screen.findByText("Hello")).not.toBeNull();

    act(() => {
      topicHandler?.({
        id: 81,
        senderRole: "USER",
        content: "Hello",
        createdAt: "2026-05-22T00:00:01Z",
      });
    });

    expect(screen.getAllByText("Hello")).toHaveLength(1);
    expect(screen.getByTestId("message-81")).not.toBeNull();

    await act(async () => {
      response.resolve([]);
      await response.promise;
    });
  });

  it("상담사 배정 SYSTEM 메시지가 오면 봇 타이핑을 종료한다", async () => {
    const response = createDeferred<[]>();
    let topicHandler: ((message: unknown) => void) | undefined;
    stompState.connectionStatus = "CONNECTED";
    sendDemoChatMessageMock.mockReturnValueOnce(response.promise);
    stompState.subscribe.mockImplementation((_topic: string, cb: (message: unknown) => void) => {
      topicHandler = cb;
      return () => {};
    });

    render(<UserChatPage />);
    fireEvent.change(screen.getByLabelText("이름"), { target: { value: "김민지" } });
    fireEvent.click(screen.getByRole("button", { name: "미리보기 시작" }));

    const input = await screen.findByLabelText("메시지 입력");
    await waitFor(() => {
      expect(topicHandler).toBeDefined();
    });

    fireEvent.change(input, { target: { value: "상담사 연결 부탁드립니다" } });
    fireEvent.click(screen.getByRole("button", { name: "메시지 보내기" }));

    expect(await screen.findByTestId("bot-typing-indicator")).toBeInTheDocument();

    act(() => {
      topicHandler?.({
        id: 90,
        senderRole: "SYSTEM",
        content: "상담사가 배정되었습니다.",
        createdAt: "2026-05-22T00:00:03Z",
      });
    });

    expect(await screen.findByText("상담사가 배정되었습니다.")).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.queryByTestId("bot-typing-indicator")).not.toBeInTheDocument();
    });

    await act(async () => {
      response.resolve([]);
      await response.promise;
    });
  });

  it("사용자 전송 후 WebSocket 봇 응답을 최소 입력 표시 시간 이후 렌더링한다", async () => {
    let topicHandler: ((message: unknown) => void) | undefined;
    stompState.connectionStatus = "CONNECTED";
    stompState.subscribe.mockImplementation((_topic: string, cb: (message: unknown) => void) => {
      topicHandler = cb;
      return () => {};
    });

    render(<UserChatPage />);
    fireEvent.change(screen.getByLabelText("이름"), { target: { value: "김민지" } });
    fireEvent.click(screen.getByRole("button", { name: "미리보기 시작" }));

    const input = await screen.findByLabelText("메시지 입력");
    await waitFor(() => {
      expect(topicHandler).toBeDefined();
    });

    fireEvent.change(input, { target: { value: "Hello" } });
    fireEvent.click(screen.getByRole("button", { name: "메시지 보내기" }));

    expect(screen.getByTestId("bot-typing-indicator")).toBeInTheDocument();

    act(() => {
      topicHandler?.({
        id: 82,
        senderRole: "ASSISTANT",
        content: "LLM 응답입니다.",
        createdAt: "2026-05-22T00:00:02Z",
      });
    });

    expect(screen.queryByText("LLM 응답입니다.")).toBeNull();
    expect(
      await screen.findByText("LLM 응답입니다.", undefined, { timeout: 1500 }),
    ).toBeInTheDocument();
    expect(screen.queryByTestId("bot-typing-indicator")).not.toBeInTheDocument();
  });

  it("WebSocket user/assistant 메시지를 표시하고 같은 id는 한 번만 렌더링한다", async () => {
    let topicHandler: ((message: unknown) => void) | undefined;
    stompState.connectionStatus = "CONNECTED";
    stompState.subscribe.mockImplementation((_topic: string, cb: (message: unknown) => void) => {
      topicHandler = cb;
      return () => {};
    });

    render(<UserChatPage />);
    fireEvent.change(screen.getByLabelText("이름"), { target: { value: "김민지" } });
    fireEvent.click(screen.getByRole("button", { name: "미리보기 시작" }));

    await screen.findByTestId("chat-header-eyebrow");
    await waitFor(() => {
      expect(topicHandler).toBeDefined();
    });

    act(() => {
      topicHandler?.({
        id: 81,
        senderRole: "USER",
        content: "Hello",
        createdAt: "2026-05-22T00:00:01Z",
      });
      topicHandler?.({
        id: 82,
        senderRole: "ASSISTANT",
        content: "LLM 응답입니다.",
        createdAt: "2026-05-22T00:00:02Z",
      });
      topicHandler?.({
        id: 82,
        senderRole: "ASSISTANT",
        content: "LLM 응답입니다.",
        createdAt: "2026-05-22T00:00:02Z",
      });
    });

    expect(await screen.findByText("Hello")).not.toBeNull();
    expect(await screen.findByText("LLM 응답입니다.")).not.toBeNull();
    expect(screen.getAllByText("LLM 응답입니다.")).toHaveLength(1);
  });

  it("메시지 전송 실패 시 에러를 표시한다", async () => {
    stompState.connectionStatus = "CONNECTED";
    sendDemoChatMessageMock.mockRejectedValueOnce(new Error("LLM failed"));

    render(<UserChatPage />);
    fireEvent.change(screen.getByLabelText("이름"), { target: { value: "김민지" } });
    fireEvent.click(screen.getByRole("button", { name: "미리보기 시작" }));

    const input = await screen.findByLabelText("메시지 입력");
    fireEvent.change(input, { target: { value: "Hello" } });
    fireEvent.click(screen.getByRole("button", { name: "메시지 보내기" }));

    expect(
      await screen.findByText("응답을 생성하지 못했습니다. 잠시 후 다시 시도해 주세요."),
    ).not.toBeNull();
    expect(screen.queryByText("Hello")).toBeNull();
  });

  it("AI 응답 생성 중 충돌이면 전송 중 안내를 표시한다", async () => {
    stompState.connectionStatus = "CONNECTED";
    sendDemoChatMessageMock.mockRejectedValueOnce(
      new ApiRequestError(
        409,
        "AI_RESPONSE_IN_PROGRESS",
        "AI 응답 생성 중입니다. 잠시 후 다시 시도해 주세요.",
      ),
    );

    render(<UserChatPage />);
    fireEvent.change(screen.getByLabelText("이름"), { target: { value: "김민지" } });
    fireEvent.click(screen.getByRole("button", { name: "미리보기 시작" }));

    const input = await screen.findByLabelText("메시지 입력");
    fireEvent.change(input, { target: { value: "Hello" } });
    fireEvent.click(screen.getByRole("button", { name: "메시지 보내기" }));

    expect(
      await screen.findByText("AI 응답 생성 중입니다. 잠시 후 다시 시도해 주세요."),
    ).not.toBeNull();
    expect(screen.queryByText("Hello")).toBeNull();
  });

  it("상담사 WebSocket 메시지를 고객 화면에 반영한다", async () => {
    let topicHandler: ((message: unknown) => void) | undefined;
    stompState.connectionStatus = "CONNECTED";
    stompState.subscribe.mockImplementation((_topic: string, cb: (message: unknown) => void) => {
      topicHandler = cb;
      return () => {};
    });

    render(<UserChatPage />);
    fireEvent.change(screen.getByLabelText("이름"), { target: { value: "김민지" } });
    fireEvent.click(screen.getByRole("button", { name: "미리보기 시작" }));

    await screen.findByTestId("chat-header-eyebrow");

    await waitFor(() => {
      expect(stompState.subscribe).toHaveBeenCalledWith("/topic/chat.77", expect.any(Function));
    });

    act(() => {
      topicHandler?.({
        id: 91,
        senderRole: "COUNSELOR",
        content: "상담사 답변입니다.",
        createdAt: "2026-05-22T00:00:03Z",
      });
    });

    expect(await screen.findByText("상담사 답변입니다.")).not.toBeNull();
  });

  it("이름이 비어 있으면 세션을 생성하지 않는다", async () => {
    render(<UserChatPage />);

    fireEvent.click(screen.getByRole("button", { name: "미리보기 시작" }));

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
      fireEvent.click(screen.getByRole("button", { name: "미리보기 시작" }));

      expect(
        await screen.findByText(
          "이 워크스페이스에는 운영 중인 도메인 팩 버전이 없습니다. 관리자에게 문의해 주세요.",
        ),
      ).not.toBeNull();
      expect(screen.getByRole("alert")).not.toBeNull();
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "Failed to start user chat session",
        expect.any(ApiRequestError),
      );
    });

    it("그 외 에러는 기본 메시지로 안내한다", async () => {
      registerDemoChatSessionMock.mockRejectedValueOnce(new Error("Network down"));

      render(<UserChatPage />);
      fireEvent.change(screen.getByLabelText("이름"), { target: { value: "김민지" } });
      fireEvent.click(screen.getByRole("button", { name: "미리보기 시작" }));

      expect(
        await screen.findByText("채팅 세션을 시작할 수 없습니다. 잠시 후 다시 시도해 주세요."),
      ).not.toBeNull();
    });

    it("에러 화면의 다시 시도 버튼은 이름 입력 폼으로 복귀한다", async () => {
      registerDemoChatSessionMock.mockRejectedValueOnce(new Error("transient"));

      render(<UserChatPage />);
      fireEvent.change(screen.getByLabelText("이름"), { target: { value: "김민지" } });
      fireEvent.click(screen.getByRole("button", { name: "미리보기 시작" }));

      const retryButton = await screen.findByRole("button", { name: "다시 시도" });
      fireEvent.click(retryButton);

      expect(screen.getByRole("form", { name: "채팅 사용자 이름 입력" })).not.toBeNull();
    });
  });
});
