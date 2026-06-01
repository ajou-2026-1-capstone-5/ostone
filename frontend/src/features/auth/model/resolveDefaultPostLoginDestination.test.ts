import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { listWorkspaces } from "@/shared/api/generated/endpoints/workspace-controller/workspace-controller";
import type { WorkspaceResponse } from "@/shared/api/generated/zod";
import { DEFAULT_POST_LOGIN_PATH } from "./resolvePostLoginDestination";
import { resolveDefaultPostLoginDestination } from "./resolveDefaultPostLoginDestination";

vi.mock("@/shared/api/generated/endpoints/workspace-controller/workspace-controller", () => ({
  listWorkspaces: vi.fn(),
}));

const mockedListWorkspaces = vi.mocked(listWorkspaces);

function listResponse(data: WorkspaceResponse[]): Awaited<ReturnType<typeof listWorkspaces>> {
  return {
    data,
    status: 200,
    headers: new Headers(),
  };
}

describe("resolveDefaultPostLoginDestination", () => {
  beforeEach(() => {
    mockedListWorkspaces.mockReset();
  });

  it("ACTIVE 워크스페이스의 workflows 경로를 반환한다", async () => {
    mockedListWorkspaces.mockResolvedValueOnce(
      listResponse([
        { id: 1, name: "Archived", status: "ARCHIVED" },
        { id: 2, name: "Active", status: "ACTIVE" },
      ]),
    );

    await expect(resolveDefaultPostLoginDestination()).resolves.toBe("/workspaces/2/workflows");
  });

  it("워크스페이스가 없으면 /workspaces fallback을 반환한다", async () => {
    mockedListWorkspaces.mockResolvedValueOnce(listResponse([]));

    await expect(resolveDefaultPostLoginDestination()).resolves.toBe(DEFAULT_POST_LOGIN_PATH);
  });

  it("기본 워크스페이스 id가 없으면 /workspaces fallback을 반환한다", async () => {
    mockedListWorkspaces.mockResolvedValueOnce(
      listResponse([{ name: "Missing id", status: "ACTIVE" }]),
    );

    await expect(resolveDefaultPostLoginDestination()).resolves.toBe(DEFAULT_POST_LOGIN_PATH);
  });

  it("워크스페이스 조회 실패 시 /workspaces fallback을 반환한다", async () => {
    mockedListWorkspaces.mockRejectedValueOnce(new Error("network error"));

    await expect(resolveDefaultPostLoginDestination()).resolves.toBe(DEFAULT_POST_LOGIN_PATH);
  });
});
