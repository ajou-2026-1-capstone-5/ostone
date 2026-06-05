import { describe, expect, it } from "vitest";
import type {
  ConsultationChatMessage,
  ConsultationChatSession,
  ConsultationResponseMode,
} from "./consultationTypes";

describe("consultation chat API types", () => {
  it("상담 세션 응답 shape을 공통 타입으로 고정한다", () => {
    const responseMode: ConsultationResponseMode = "AI_ASSIST_ONLY";
    const session = {
      id: 20,
      channel: "SIMULATION",
      status: "ACTIVE",
      metaJson: "{}",
      startedAt: "2026-06-04T10:00:00Z",
      assignedCounselorId: null,
      responseMode,
      endedAt: null,
    } satisfies ConsultationChatSession;

    expect(session.responseMode).toBe("AI_ASSIST_ONLY");
  });

  it("상담 메시지 응답 shape을 공통 타입으로 고정한다", () => {
    const message = {
      id: 2,
      seqNo: 1,
      senderRole: "USER",
      messageType: "TEXT",
      content: "환불하고 싶어요",
      createdAt: "2026-06-04T10:01:00Z",
    } satisfies ConsultationChatMessage;

    expect(message.senderRole).toBe("USER");
  });
});
