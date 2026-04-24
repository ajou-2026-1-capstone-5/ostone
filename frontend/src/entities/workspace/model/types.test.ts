import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { ApiRequestError } from "@/shared/api";
import {
  generateWorkspaceKey,
  mapWorkspaceActionError,
  normalizeWorkspaceMemberRole,
  validateCreateWorkspaceForm,
  validateUpdateWorkspaceForm,
} from "./types";

describe("workspace model helpers", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("generates a lowercase workspace key from a name with a random suffix", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.123456789);

    expect(generateWorkspaceKey("CS Team Alpha")).toBe("cs-team-alpha-4fzzzx");
  });

  it("falls back to workspace when a name cannot produce a valid slug", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.123456789);

    expect(generateWorkspaceKey("운영팀")).toBe("workspace-4fzzzx");
  });

  it("validates create and update names", () => {
    expect(validateCreateWorkspaceForm("", "")).toEqual({ name: "이름을 입력해주세요." });
    expect(validateUpdateWorkspaceForm("a".repeat(256), "")).toEqual({
      name: "이름은 255자 이하여야 합니다.",
    });
    expect(validateCreateWorkspaceForm("CS Team", "")).toEqual({});
  });

  it("normalizes backend role variants", () => {
    expect(normalizeWorkspaceMemberRole("ROLE_OWNER")).toBe("OWNER");
    expect(normalizeWorkspaceMemberRole(" admin ")).toBe("ADMIN");
    expect(normalizeWorkspaceMemberRole("unknown")).toBeNull();
    expect(normalizeWorkspaceMemberRole(null)).toBeNull();
  });

  it("maps workspace api errors to user-facing messages", () => {
    expect(
      mapWorkspaceActionError(
        new ApiRequestError(409, "WORKSPACE_KEY_CONFLICT", "duplicated"),
      ),
    ).toBe("이미 사용 중인 워크스페이스 키입니다.");
    expect(mapWorkspaceActionError(new Error("network"))).toBe("서버에 연결할 수 없습니다.");
  });
});
