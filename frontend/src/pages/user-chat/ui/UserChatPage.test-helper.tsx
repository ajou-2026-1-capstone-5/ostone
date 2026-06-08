import { beforeEach, vi } from "vitest";

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
  const actual =
    await vi.importActual<typeof import("react-router-dom")>(
      "react-router-dom",
    );
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

export {
  createChatSessionMock,
  createDeferred,
  createFreshChatSessionMock,
  listChatMessagesMock,
  listDemoChatMessagesMock,
  registerDemoChatSessionMock,
  routeState,
  searchState,
  seedAuthUser,
  sendDemoChatMessageMock,
  stompState,
  useStompOptions,
};
export type { DeferredChatMessage };
