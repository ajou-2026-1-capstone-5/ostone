import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ApiRequestError } from "@/shared/api";
import {
  createDeferred,
  sendDemoChatMessageMock,
  stompState,
} from "./UserChatPage.test-helper";
import { UserChatPage } from "./UserChatPage";

describe("UserChatPage realtime messaging", () => {
  it("WebSocket user 메시지는 optimistic 메시지를 서버 메시지로 교체한다", async () => {
    const response = createDeferred<[]>();
    let topicHandler: ((message: unknown) => void) | undefined;
    stompState.connectionStatus = "CONNECTED";
    sendDemoChatMessageMock.mockReturnValueOnce(response.promise);
    stompState.subscribe.mockImplementation(
      (_topic: string, cb: (message: unknown) => void) => {
        topicHandler = cb;
        return () => {};
      },
    );

    render(<UserChatPage />);
    fireEvent.change(screen.getByLabelText("이름"), {
      target: { value: "김민지" },
    });
    fireEvent.click(screen.getByRole("button", { name: "미리보기 시작" }));

    const input = await screen.findByLabelText("메시지 입력");
    await waitFor(() => {
      expect(stompState.subscribe).toHaveBeenCalledWith(
        "/topic/chat.77",
        expect.any(Function),
      );
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
    stompState.subscribe.mockImplementation(
      (_topic: string, cb: (message: unknown) => void) => {
        topicHandler = cb;
        return () => {};
      },
    );

    render(<UserChatPage />);
    fireEvent.change(screen.getByLabelText("이름"), {
      target: { value: "김민지" },
    });
    fireEvent.click(screen.getByRole("button", { name: "미리보기 시작" }));

    const input = await screen.findByLabelText("메시지 입력");
    await waitFor(() => {
      expect(topicHandler).toBeDefined();
    });

    fireEvent.change(input, { target: { value: "상담사 연결 부탁드립니다" } });
    fireEvent.click(screen.getByRole("button", { name: "메시지 보내기" }));

    expect(
      await screen.findByTestId("bot-typing-indicator"),
    ).toBeInTheDocument();

    act(() => {
      topicHandler?.({
        id: 90,
        senderRole: "SYSTEM",
        content: "상담사가 배정되었습니다.",
        createdAt: "2026-05-22T00:00:03Z",
      });
    });

    expect(
      await screen.findByText("상담사가 배정되었습니다."),
    ).toBeInTheDocument();
    await waitFor(() => {
      expect(
        screen.queryByTestId("bot-typing-indicator"),
      ).not.toBeInTheDocument();
    });

    await act(async () => {
      response.resolve([]);
      await response.promise;
    });
  });

  it("사용자 전송 후 WebSocket 봇 응답을 최소 입력 표시 시간 이후 렌더링한다", async () => {
    let topicHandler: ((message: unknown) => void) | undefined;
    stompState.connectionStatus = "CONNECTED";
    stompState.subscribe.mockImplementation(
      (_topic: string, cb: (message: unknown) => void) => {
        topicHandler = cb;
        return () => {};
      },
    );

    render(<UserChatPage />);
    fireEvent.change(screen.getByLabelText("이름"), {
      target: { value: "김민지" },
    });
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
    expect(
      screen.queryByTestId("bot-typing-indicator"),
    ).not.toBeInTheDocument();
  });

  it("WebSocket user/assistant 메시지를 표시하고 같은 id는 한 번만 렌더링한다", async () => {
    let topicHandler: ((message: unknown) => void) | undefined;
    stompState.connectionStatus = "CONNECTED";
    stompState.subscribe.mockImplementation(
      (_topic: string, cb: (message: unknown) => void) => {
        topicHandler = cb;
        return () => {};
      },
    );

    render(<UserChatPage />);
    fireEvent.change(screen.getByLabelText("이름"), {
      target: { value: "김민지" },
    });
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
    fireEvent.change(screen.getByLabelText("이름"), {
      target: { value: "김민지" },
    });
    fireEvent.click(screen.getByRole("button", { name: "미리보기 시작" }));

    const input = await screen.findByLabelText("메시지 입력");
    fireEvent.change(input, { target: { value: "Hello" } });
    fireEvent.click(screen.getByRole("button", { name: "메시지 보내기" }));

    expect(
      await screen.findByText(
        "응답을 생성하지 못했습니다. 잠시 후 다시 시도해 주세요.",
      ),
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
    fireEvent.change(screen.getByLabelText("이름"), {
      target: { value: "김민지" },
    });
    fireEvent.click(screen.getByRole("button", { name: "미리보기 시작" }));

    const input = await screen.findByLabelText("메시지 입력");
    fireEvent.change(input, { target: { value: "Hello" } });
    fireEvent.click(screen.getByRole("button", { name: "메시지 보내기" }));

    expect(
      await screen.findByText(
        "AI 응답 생성 중입니다. 잠시 후 다시 시도해 주세요.",
      ),
    ).not.toBeNull();
    expect(screen.queryByText("Hello")).toBeNull();
  });

  it("상담사 WebSocket 메시지를 고객 화면에 반영한다", async () => {
    let topicHandler: ((message: unknown) => void) | undefined;
    stompState.connectionStatus = "CONNECTED";
    stompState.subscribe.mockImplementation(
      (_topic: string, cb: (message: unknown) => void) => {
        topicHandler = cb;
        return () => {};
      },
    );

    render(<UserChatPage />);
    fireEvent.change(screen.getByLabelText("이름"), {
      target: { value: "김민지" },
    });
    fireEvent.click(screen.getByRole("button", { name: "미리보기 시작" }));

    await screen.findByTestId("chat-header-eyebrow");

    await waitFor(() => {
      expect(stompState.subscribe).toHaveBeenCalledWith(
        "/topic/chat.77",
        expect.any(Function),
      );
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
});
