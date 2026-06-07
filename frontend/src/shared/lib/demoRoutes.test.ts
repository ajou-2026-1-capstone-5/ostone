import { describe, expect, it } from "vitest";

import { buildDemoChatPath, buildWorkspaceSimulationPath } from "./demoRoutes";

describe("demoRoutes", () => {
  it("buildWorkspaceSimulationPath가 워크스페이스 시뮬레이션 경로를 만든다", () => {
    expect(buildWorkspaceSimulationPath(42)).toBe("/workspaces/42/simulation");
    expect(buildWorkspaceSimulationPath("space key")).toBe(
      "/workspaces/space%20key/simulation",
    );
    expect(buildWorkspaceSimulationPath("a/b?c&d")).toBe(
      "/workspaces/a%2Fb%3Fc%26d/simulation",
    );
  });

  it("buildDemoChatPath가 고객용 데모 채팅 경로와 query string을 만든다", () => {
    expect(buildDemoChatPath(42)).toBe("/demo/chat/42");
    expect(
      buildDemoChatPath("space key", new URLSearchParams({ name: "김민지" })),
    ).toBe("/demo/chat/space%20key?name=%EA%B9%80%EB%AF%BC%EC%A7%80");
  });
});
