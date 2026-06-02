import { createElement, type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useWorkspaceMembers } from "./useWorkspaceMembers";

vi.mock("@/shared/api/generated/endpoints/workspace-controller/workspace-controller", () => ({
  listWorkspaceMembers: vi.fn(),
}));

import { listWorkspaceMembers } from "@/shared/api/generated/endpoints/workspace-controller/workspace-controller";

const mockedListWorkspaceMembers = vi.mocked(listWorkspaceMembers);

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0, staleTime: 0 } },
  });
  return createElement(QueryClientProvider, { client }, children);
}

beforeEach(() => {
  mockedListWorkspaceMembers.mockReset();
});

describe("useWorkspaceMembers", () => {
  it("workspaceId가 null이면 API를 호출하지 않는다", () => {
    renderHook(
      () => useWorkspaceMembers({ workspaceId: null, search: "", role: "" }),
      { wrapper },
    );

    expect(mockedListWorkspaceMembers).not.toHaveBeenCalled();
  });

  it("검색어와 role 필터를 generated endpoint params로 전달한다", async () => {
    mockedListWorkspaceMembers.mockResolvedValue({
      data: [
        {
          memberId: 10,
          userId: 7,
          name: "Admin",
          email: "admin@ostone.com",
          workspaceRole: "ADMIN",
          joinedAt: "2026-04-14T00:00:00Z",
          accountStatus: "ACTIVE",
        },
      ],
      status: 200,
      headers: new Headers(),
    });

    const { result } = renderHook(
      () => useWorkspaceMembers({ workspaceId: 1, search: " admin ", role: "ADMIN" }),
      { wrapper },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockedListWorkspaceMembers).toHaveBeenCalledWith(1, { q: "admin", role: "ADMIN" });
    expect(result.current.data?.[0]?.email).toBe("admin@ostone.com");
  });
});
