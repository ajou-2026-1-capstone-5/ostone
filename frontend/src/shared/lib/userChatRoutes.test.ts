import { describe, expect, it } from "vitest";
import {
  buildUserChatPath,
  buildWorkspacePreviewChatPath,
  extractWorkspaceIdFromBasePath,
} from "./userChatRoutes";

describe("userChatRoutes", () => {
  it("사용자 채팅 경로를 workspaceId 기준으로 생성한다", () => {
    expect(buildUserChatPath(7)).toBe("/chat/7");
    expect(buildUserChatPath("team one")).toBe("/chat/team%20one");
  });

  it("workspace basePath에서 workspaceId를 추출한다", () => {
    expect(extractWorkspaceIdFromBasePath("/workspaces/7")).toBe("7");
    expect(extractWorkspaceIdFromBasePath("/workspaces/team%20one/dashboard")).toBe("team one");
    expect(extractWorkspaceIdFromBasePath("/workspaces/7?tab=chat")).toBe("7");
  });

  it("workspaceId가 있는 basePath는 현재 워크스페이스 사용자 채팅 경로로 보낸다", () => {
    expect(buildWorkspacePreviewChatPath("/workspaces/7")).toBe("/chat/7");
    expect(buildWorkspacePreviewChatPath("/workspaces/team%20one/dashboard")).toBe(
      "/chat/team%20one",
    );
  });

  it("workspaceId를 추출할 수 없으면 공개 데모 선택 화면으로 보낸다", () => {
    expect(buildWorkspacePreviewChatPath("/workspaces")).toBe("/demo");
    expect(buildWorkspacePreviewChatPath("/settings")).toBe("/demo");
  });
});
