import { describe, expect, it } from "vitest";
import type { ChatMessage } from "../model/types";
import {
  compareMessageOrder,
  isChatMessageResponse,
  isRealtimeChatMessage,
  mergeMessages,
  parseDemoSessionId,
  toChatMessage,
  toRealtimeChatMessage,
  toSenderType,
  tryParseDemoSessionId,
  withCustomerNames,
} from "./chatMessageSync";

describe("chatMessageSync", () => {
  it("데모 세션 id를 정수 문자열로만 파싱한다", () => {
    expect(parseDemoSessionId(" 77 ")).toBe(77);
    expect(tryParseDemoSessionId("88")).toBe(88);
    expect(tryParseDemoSessionId("1e2")).toBeNull();
    expect(() => parseDemoSessionId("77.5")).toThrow("Demo chat session id must be numeric.");
    expect(() => parseDemoSessionId("workspace-2-demo-session")).toThrow(
      "Demo chat session id must be numeric.",
    );
    expect(() => parseDemoSessionId(`${Number.MAX_SAFE_INTEGER + 1}`)).toThrow(
      "Demo chat session id must be numeric.",
    );
  });

  it("백엔드 메시지 응답 여부를 판별하고 UI 모델로 변환한다", () => {
    const response = {
      id: 91,
      seqNo: 4,
      senderRole: "COUNSELOR",
      messageType: "TEXT",
      content: "상담사 답변입니다.",
      createdAt: "2026-05-22T00:00:03Z",
    };

    expect(isChatMessageResponse(response)).toBe(true);
    expect(isChatMessageResponse({ id: 92, content: "부분 응답" })).toBe(true);
    expect(isChatMessageResponse({})).toBe(false);
    expect(isChatMessageResponse({ ...response, seqNo: "4" })).toBe(false);
    expect(toChatMessage(response, 77)).toEqual({
      id: "91",
      sessionId: 77,
      senderType: "AGENT",
      seqNo: 4,
      content: "상담사 답변입니다.",
      createdAt: "2026-05-22T00:00:03Z",
    });
  });

  it("백엔드 메시지 id와 시간이 없으면 안정적인 fallback으로 변환한다", () => {
    expect(toChatMessage({ seqNo: 4, content: "동일 메시지" }, 77)).toEqual({
      id: "srv-77-seq-4",
      sessionId: 77,
      senderType: "BOT",
      seqNo: 4,
      content: "동일 메시지",
      createdAt: "1970-01-01T00:00:00.000Z",
    });

    expect(toChatMessage({ senderRole: "COUNSELOR", content: "상담사 답변" }, 77)).toEqual({
      id: "srv-77-1970-01-01T00:00:00.000Z-COUNSELOR-상담사 답변",
      sessionId: 77,
      senderType: "AGENT",
      content: "상담사 답변",
      createdAt: "1970-01-01T00:00:00.000Z",
    });
  });

  it("실시간 메시지를 판별하고 고객 이름을 사용자 메시지에만 부여한다", () => {
    expect(
      isRealtimeChatMessage({
        id: "local-1",
        senderRole: "customer",
        content: "안녕하세요",
        createdAt: "2026-05-22T00:00:01Z",
      }),
    ).toBe(true);
    expect(isRealtimeChatMessage({ id: "local-1", senderRole: "USER" })).toBe(false);
    expect(toSenderType("ASSISTANT")).toBe("BOT");
    expect(toSenderType("SYSTEM")).toBe("SYSTEM");
    expect(toSenderType("system")).toBe("SYSTEM");

    expect(
      toRealtimeChatMessage(
        {
          id: "local-1",
          senderRole: "CUSTOMER",
          content: "안녕하세요",
          createdAt: "2026-05-22T00:00:01Z",
        },
        77,
        "김민지",
      ),
    ).toEqual({
      id: "local-1",
      sessionId: 77,
      senderType: "USER",
      senderName: "김민지",
      content: "안녕하세요",
      createdAt: "2026-05-22T00:00:01Z",
    });

    expect(
      toRealtimeChatMessage(
        {
          id: 92,
          senderRole: "COUNSELOR",
          content: "도와드릴게요.",
          createdAt: "2026-05-22T00:00:02Z",
        },
        77,
        "김민지",
      ),
    ).not.toHaveProperty("senderName");
  });

  it("메시지를 id 기준으로 병합하고 생성 시각 순으로 정렬한다", () => {
    const currentMessages: ChatMessage[] = [
      {
        id: "2",
        sessionId: 77,
        senderType: "BOT",
        content: "이전 답변",
        createdAt: "2026-05-22T00:00:02Z",
      },
      {
        id: "1",
        sessionId: 77,
        senderType: "USER",
        content: "이전 질문",
        createdAt: "2026-05-22T00:00:01Z",
      },
    ];
    const nextMessages: ChatMessage[] = [
      {
        id: "2",
        sessionId: 77,
        senderType: "AGENT",
        content: "상담사 답변",
        createdAt: "2026-05-22T00:00:03Z",
      },
    ];

    expect(mergeMessages(currentMessages, nextMessages)).toEqual([
      currentMessages[1],
      nextMessages[0],
    ]);
  });

  it("WebSocket 이벤트가 역순으로 도착해도 seqNo 순서로 정렬한다", () => {
    const userMessage: ChatMessage = {
      id: "10",
      sessionId: 77,
      senderType: "USER",
      seqNo: 1,
      content: "환불 가능한가요?",
      // 시계 오차로 사용자 메시지가 봇 응답보다 늦은 시각으로 기록됨
      createdAt: "2026-05-22T00:00:05Z",
    };
    const botMessage: ChatMessage = {
      id: "11",
      sessionId: 77,
      senderType: "BOT",
      seqNo: 2,
      content: "네, 7일 이내 가능합니다.",
      createdAt: "2026-05-22T00:00:04Z",
    };

    // 봇 응답(seqNo 2)이 사용자 질문(seqNo 1)보다 먼저 도착해도 seqNo 순서를 따른다.
    expect(mergeMessages([botMessage], [userMessage])).toEqual([userMessage, botMessage]);
  });

  it("seqNo가 없는 optimistic 메시지는 서버 확정 메시지 뒤로 안정 정렬한다", () => {
    const serverUserMessage: ChatMessage = {
      id: "20",
      sessionId: 77,
      senderType: "USER",
      seqNo: 7,
      content: "첫 질문",
      createdAt: "2026-05-22T00:00:01Z",
    };
    const localUserMessage: ChatMessage = {
      id: "local-user-77-1",
      sessionId: 77,
      senderType: "USER",
      content: "다음 질문",
      createdAt: "2026-05-22T00:00:02Z",
    };

    // optimistic 메시지(seqNo 없음)는 시각과 무관하게 seqNo가 있는 메시지 뒤로 간다.
    expect(mergeMessages([localUserMessage], [serverUserMessage])).toEqual([
      serverUserMessage,
      localUserMessage,
    ]);
  });

  it("동일 seqNo·동일 시각이면 원래(병합) 순서를 유지한다", () => {
    const first: ChatMessage = {
      id: "30",
      sessionId: 77,
      senderType: "USER",
      seqNo: 9,
      content: "먼저",
      createdAt: "2026-05-22T00:00:09Z",
    };
    const second: ChatMessage = {
      id: "31",
      sessionId: 77,
      senderType: "BOT",
      seqNo: 9,
      content: "나중",
      createdAt: "2026-05-22T00:00:09Z",
    };

    expect(mergeMessages([first, second], [])).toEqual([first, second]);
    expect(compareMessageOrder(first, second)).toBe(0);
  });

  it("실시간 메시지의 seqNo를 보존해 정렬에 활용한다", () => {
    expect(
      toRealtimeChatMessage(
        {
          id: 50,
          seqNo: 3,
          senderRole: "BOT",
          content: "봇 응답",
          createdAt: "2026-05-22T00:00:02Z",
        },
        77,
      ),
    ).toEqual({
      id: "50",
      sessionId: 77,
      senderType: "BOT",
      seqNo: 3,
      content: "봇 응답",
      createdAt: "2026-05-22T00:00:02Z",
    });

    expect(
      isRealtimeChatMessage({
        id: "rt-1",
        seqNo: "3",
        senderRole: "BOT",
        content: "봇 응답",
        createdAt: "2026-05-22T00:00:02Z",
      }),
    ).toBe(false);
  });

  it("사용자 메시지에 고객 이름을 보강한다", () => {
    const messages = withCustomerNames(
      [
        {
          id: "91",
          sessionId: 77,
          senderType: "USER",
          content: "저장된 질문",
          createdAt: "2026-05-22T00:00:02Z",
        },
        {
          id: "92",
          sessionId: 77,
          senderType: "BOT",
          content: "저장된 답변",
          createdAt: "2026-05-22T00:00:03Z",
        },
      ],
      "김민지",
    );

    expect(messages).toEqual([
      {
        id: "91",
        sessionId: 77,
        senderType: "USER",
        senderName: "김민지",
        content: "저장된 질문",
        createdAt: "2026-05-22T00:00:02Z",
      },
      {
        id: "92",
        sessionId: 77,
        senderType: "BOT",
        content: "저장된 답변",
        createdAt: "2026-05-22T00:00:03Z",
      },
    ]);
  });
});
