import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter, Outlet, Route, Routes } from "react-router-dom";

import { ApiRequestError } from "@/shared/api";

import { WorkspaceMembersPage } from "./WorkspaceMembersPage";

const mockUseWorkspaceMembers = vi.fn();

vi.mock("@/entities/workspace", async () => {
  const actual = await vi.importActual<typeof import("@/entities/workspace")>(
    "@/entities/workspace",
  );
  return {
    ...actual,
    useWorkspaceMembers: (...args: unknown[]) => mockUseWorkspaceMembers(...args),
  };
});

function ShellWrapper() {
  return (
    <Outlet
      context={{
        setCrumbs: vi.fn(),
        setTopbarRight: vi.fn(),
        workspace: {
          id: 1,
          name: "CS Team",
          workspaceKey: "cs-team",
          description: null,
          status: "ACTIVE",
          myRole: "OWNER",
          createdAt: "2026-04-01T00:00:00Z",
          updatedAt: "2026-04-01T00:00:00Z",
        },
      }}
    />
  );
}

function renderPage(path = "/workspaces/1/settings/members") {
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/workspaces/:workspaceId" element={<ShellWrapper />}>
          <Route path="settings/members" element={<WorkspaceMembersPage />} />
        </Route>
        <Route path="/workspaces" element={<div data-testid="workspace-root" />} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  mockUseWorkspaceMembers.mockReset();
});

describe("WorkspaceMembersPage", () => {
  it("잘못된 workspaceId면 /workspaces로 리다이렉트한다", () => {
    mockUseWorkspaceMembers.mockReturnValue({
      data: [],
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    });
    renderPage("/workspaces/abc/settings/members");
    expect(screen.getByTestId("workspace-root")).toBeInTheDocument();
  });

  it("loading 상태에서는 loading panel을 보여준다", () => {
    mockUseWorkspaceMembers.mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
      error: null,
      refetch: vi.fn(),
    });
    renderPage();
    expect(screen.getByTestId("workspace-members-loading")).toBeInTheDocument();
  });

  it("error 상태에서는 ErrorState를 보여준다", () => {
    mockUseWorkspaceMembers.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      error: new ApiRequestError(403, "WORKSPACE_ACCESS_DENIED", "접근 권한이 없습니다."),
      refetch: vi.fn(),
    });
    renderPage();
    expect(screen.getByTestId("workspace-members-error")).toBeInTheDocument();
    expect(screen.getByText("접근 권한이 없습니다.")).toBeInTheDocument();
  });

  it("목록이 비어 있으면 empty state를 보여준다", () => {
    mockUseWorkspaceMembers.mockReturnValue({
      data: [],
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    });
    renderPage();
    expect(screen.getByTestId("workspace-members-empty")).toBeInTheDocument();
    expect(screen.getByText("조건에 맞는 멤버가 없습니다.")).toBeInTheDocument();
  });

  it("멤버 목록을 표로 보여준다", () => {
    mockUseWorkspaceMembers.mockReturnValue({
      data: [
        {
          memberId: 10,
          userId: 7,
          name: "Admin",
          email: "admin@ostone.com",
          workspaceRole: "OWNER",
          joinedAt: "2026-04-14T00:00:00Z",
          accountStatus: "ACTIVE",
        },
      ],
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    });
    renderPage();
    const row = screen.getByRole("row", { name: /Admin admin@ostone\.com/ });
    expect(within(row).getByText("Admin")).toBeInTheDocument();
    expect(within(row).getByText("admin@ostone.com")).toBeInTheDocument();
    expect(within(row).getByText("소유자")).toBeInTheDocument();
    expect(within(row).getByText("활성")).toBeInTheDocument();
  });

  it("검색어와 role 필터를 hook에 전달한다", () => {
    mockUseWorkspaceMembers.mockReturnValue({
      data: [],
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    });
    renderPage();

    fireEvent.change(screen.getByPlaceholderText("이름 또는 이메일 검색"), {
      target: { value: "admin" },
    });
    fireEvent.change(screen.getByLabelText("역할 필터"), {
      target: { value: "ADMIN" },
    });

    expect(mockUseWorkspaceMembers).toHaveBeenLastCalledWith({
      workspaceId: 1,
      search: "admin",
      role: "ADMIN",
    });
  });
});
