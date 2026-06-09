import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { listWorkspaces } from "@/shared/api/generated/endpoints/workspace-controller/workspace-controller";
import type { WorkspaceResponse } from "@/shared/api/generated/zod";
import { DEFAULT_POST_LOGIN_PATH } from "./resolvePostLoginDestination";
import {
  resolveAuthenticatedPostLoginDestination,
  resolveDefaultPostLoginDestination,
} from "./resolveDefaultPostLoginDestination";

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

  it("SUPER_ADMIN이면 /admin을 반환하고 워크스페이스를 조회하지 않는다", async () => {
    await expect(resolveDefaultPostLoginDestination("SUPER_ADMIN")).resolves.toBe("/admin");
    expect(mockedListWorkspaces).not.toHaveBeenCalled();
  });

  it("ACTIVE 워크스페이스의 dashboard 경로를 반환한다", async () => {
    mockedListWorkspaces.mockResolvedValueOnce(
      listResponse([
        { id: 1, name: "Archived", status: "ARCHIVED" },
        { id: 2, name: "Active", status: "ACTIVE" },
      ]),
    );

    await expect(resolveDefaultPostLoginDestination()).resolves.toBe("/workspaces/2/dashboard");
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

  it("현재 계정에 소속된 workspace return-to는 query string과 함께 유지한다", async () => {
    mockedListWorkspaces.mockResolvedValueOnce(
      listResponse([{ id: 4, name: "Current", status: "ACTIVE" }]),
    );

    await expect(
      resolveAuthenticatedPostLoginDestination({
        from: { pathname: "/workspaces/4/upload", search: "?tab=logs" },
      }),
    ).resolves.toBe("/workspaces/4/upload?tab=logs");
  });

  it("workspace가 없는 계정의 stale workspace return-to는 /workspaces fallback으로 보낸다", async () => {
    mockedListWorkspaces.mockResolvedValueOnce(listResponse([]));

    await expect(
      resolveAuthenticatedPostLoginDestination({
        from: { pathname: "/workspaces/1/upload" },
      }),
    ).resolves.toBe(DEFAULT_POST_LOGIN_PATH);
  });

  it("다른 계정 workspace return-to는 현재 계정 기본 workspace로 대체한다", async () => {
    mockedListWorkspaces.mockResolvedValueOnce(
      listResponse([{ id: 7, name: "Current", status: "ACTIVE" }]),
    );

    await expect(
      resolveAuthenticatedPostLoginDestination({
        from: { pathname: "/workspaces/4/upload" },
      }),
    ).resolves.toBe("/workspaces/7/dashboard");
  });

  it("이전 계정 domain pack return-to는 현재 계정 기본 workspace로 대체한다", async () => {
    mockedListWorkspaces.mockResolvedValueOnce(
      listResponse([{ id: 7, name: "Current", status: "ACTIVE" }]),
    );

    await expect(
      resolveAuthenticatedPostLoginDestination({
        from: { pathname: "/workspaces/99/domain-packs", search: "?versionId=1" },
      }),
    ).resolves.toBe("/workspaces/7/dashboard");
  });

  it("workspace 루트 return-to는 현재 계정 workspace 목록 확인 뒤 유지한다", async () => {
    mockedListWorkspaces.mockResolvedValueOnce(listResponse([]));

    await expect(
      resolveAuthenticatedPostLoginDestination({
        from: { pathname: "/workspaces", search: "?tab=logs" },
      }),
    ).resolves.toBe("/workspaces?tab=logs");
    expect(mockedListWorkspaces).toHaveBeenCalledTimes(1);
  });

  it("demo return-to는 workspace 조회 없이 유지한다", async () => {
    await expect(
      resolveAuthenticatedPostLoginDestination({
        from: { pathname: "/demo/chat/1", search: "?preview=true" },
      }),
    ).resolves.toBe("/demo/chat/1?preview=true");
    expect(mockedListWorkspaces).not.toHaveBeenCalled();
  });

  it("일반 사용자의 admin return-to는 role 기준 기본 목적지로 대체한다", async () => {
    mockedListWorkspaces.mockResolvedValueOnce(listResponse([]));

    await expect(
      resolveAuthenticatedPostLoginDestination({
        from: { pathname: "/admin/super-admins" },
      }),
    ).resolves.toBe(DEFAULT_POST_LOGIN_PATH);
  });
});
