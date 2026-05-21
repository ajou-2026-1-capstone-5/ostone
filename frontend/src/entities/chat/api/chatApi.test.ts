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

  it("workspaceId로 채팅 세션을 생성한다", async () => {
    const session = {
      id: 12,
      workspaceId: 3,
      status: "ACTIVE" as const,
      createdAt: "2026-05-22T00:00:00Z",
    };
    customFetchMock.mockResolvedValue(session);

    await expect(createChatSession(3)).resolves.toEqual(session);

    expect(customFetchMock).toHaveBeenCalledWith("/api/v1/chat/sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ workspaceId: 3 }),
    });
  });
});
