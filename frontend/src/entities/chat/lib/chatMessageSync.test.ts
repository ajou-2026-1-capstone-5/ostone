import { describe, expect, it } from "vitest";
import type { ChatMessage } from "../model/types";
import {
  isChatMessageResponse,
  isRealtimeChatMessage,
  mergeMessages,
  mergePersistedMessages,
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
      content: "상담사 답변입니다.",
      createdAt: "2026-05-22T00:00:03Z",
    });
  });

  it("백엔드 메시지 id와 시간이 없으면 안정적인 fallback으로 변환한다", () => {
    expect(toChatMessage({ seqNo: 4, content: "동일 메시지" }, 77)).toEqual({
      id: "srv-77-seq-4",
      sessionId: 77,
      senderType: "BOT",
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

  it("저장 메시지는 optimistic/greeting 메시지를 유지한 뒤 백엔드 메시지와 병합한다", () => {
    const currentMessages: ChatMessage[] = [
      {
        id: "local-user-1",
        sessionId: 0,
        senderType: "USER",
        content: "전송 중",
        createdAt: "2026-05-22T00:00:01Z",
      },
      {
        id: "backend-greeting-77",
        sessionId: 77,
        senderType: "BOT",
        content: "안녕하세요",
        createdAt: "2026-05-22T00:00:00Z",
      },
      {
        id: "old-1",
        sessionId: 77,
        senderType: "BOT",
        content: "오래된 응답",
        createdAt: "2026-05-22T00:00:00Z",
      },
    ];
    const persistedMessages = withCustomerNames(
      [
        {
          id: "91",
          sessionId: 77,
          senderType: "USER",
          content: "저장된 질문",
          createdAt: "2026-05-22T00:00:02Z",
        },
      ],
      "김민지",
    );

    expect(mergePersistedMessages(currentMessages, persistedMessages)).toEqual([
      currentMessages[1],
      currentMessages[0],
      {
        ...persistedMessages[0],
        senderName: "김민지",
      },
    ]);
  });
});
