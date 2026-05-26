import { beforeEach, describe, expect, it, vi } from "vitest";
import { createChatSession } from "./chatApi";

const { customFetchMock } = vi.hoisted(() => ({
  customFetchMock: vi.fn(),
}));

vi.mock("@/shared/api/mutator", () => ({
  customFetch: customFetchMock,
}));

describe("chatApi", () => {
  beforeEach(() => {
    customFetchMock.mockReset();
  });

  it("workspaceId로 현재 사용자 채팅 세션을 조회하거나 생성한다", async () => {
    const session = {
      id: 12,
      status: "OPEN" as const,
      channel: "WEB",
      startedAt: "2026-05-22T00:00:00Z",
    };
    customFetchMock.mockResolvedValue(session);

    await expect(createChatSession(3)).resolves.toEqual(session);

    expect(customFetchMock).toHaveBeenCalledWith(
      "/api/v1/workspaces/3/chat/sessions/current",
      { method: "GET" },
    );
  });
});
