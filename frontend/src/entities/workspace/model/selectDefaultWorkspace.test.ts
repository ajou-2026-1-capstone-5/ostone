import { describe, expect, it } from "vite-plus/test";
import type { WorkspaceResponse } from "./types";
import { selectDefaultWorkspace } from "./selectDefaultWorkspace";

function workspace(id: number, status: WorkspaceResponse["status"]): WorkspaceResponse {
  return {
    id,
    workspaceKey: `workspace-${id}`,
    name: `Workspace ${id}`,
    description: null,
    status,
    myRole: "OWNER",
    createdAt: "2026-06-01T00:00:00Z",
    updatedAt: "2026-06-01T00:00:00Z",
  };
}

describe("selectDefaultWorkspace", () => {
  it("ACTIVE 워크스페이스를 우선 선택한다", () => {
    expect(
      selectDefaultWorkspace([workspace(1, "ARCHIVED"), workspace(2, "ACTIVE")])?.id,
    ).toBe(2);
  });

  it("ACTIVE 워크스페이스가 없으면 첫 워크스페이스를 선택한다", () => {
    expect(selectDefaultWorkspace([workspace(3, "ARCHIVED"), workspace(4, "ARCHIVED")])?.id).toBe(
      3,
    );
  });

  it("워크스페이스가 없으면 null을 반환한다", () => {
    expect(selectDefaultWorkspace([])).toBeNull();
  });
});
