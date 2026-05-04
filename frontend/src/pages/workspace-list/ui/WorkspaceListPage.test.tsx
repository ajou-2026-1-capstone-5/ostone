import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { workspaceApi } from "@/entities/workspace";
import { WorkspaceListPage } from "./WorkspaceListPage";

const navigate = vi.fn();

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return {
    ...actual,
    useNavigate: () => navigate,
  };
});

vi.mock("@/entities/workspace", async () => {
  const actual = await vi.importActual<typeof import("@/entities/workspace")>(
    "@/entities/workspace",
  );
  return {
    ...actual,
    workspaceApi: {
      list: vi.fn(),
    },
  };
});

vi.mock("@/features/workspace", () => ({
  ArchiveConfirmDialog: () => null,
  CreateWorkspaceDialog: () => null,
  EditWorkspaceDialog: () => null,
}));

vi.mock("@/widgets/app-shell", () => ({
  AppShell: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

const activeWorkspace = {
  id: 1,
  workspaceKey: "cs-team",
  name: "CS Team",
  description: null,
  status: "ACTIVE" as const,
  myRole: "OWNER" as const,
  createdAt: "",
  updatedAt: "",
};

describe("WorkspaceListPage", () => {
  beforeEach(() => {
    navigate.mockReset();
    vi.mocked(workspaceApi.list).mockReset();
  });

  it("테이블 더블클릭으로 워크플로우 페이지로 이동한다", async () => {
    vi.mocked(workspaceApi.list).mockResolvedValue([activeWorkspace]);

    render(
      <MemoryRouter>
        <WorkspaceListPage />
      </MemoryRouter>,
    );

    await waitFor(() => expect(workspaceApi.list).toHaveBeenCalled());

    const row = screen.getByText("CS Team").closest("tr");
    expect(row).not.toBeNull();

    fireEvent.dblClick(row!);

    await waitFor(() => {
      expect(navigate).toHaveBeenCalledWith("/workspaces/1/workflows");
    });
  });

  it("로딩 중일 때 Loading...을 표시한다", async () => {
    vi.mocked(workspaceApi.list).mockImplementation(() => new Promise(() => {}));

    render(
      <MemoryRouter>
        <WorkspaceListPage />
      </MemoryRouter>,
    );

    await waitFor(() => expect(workspaceApi.list).toHaveBeenCalled());
    expect(screen.getByText("Loading...")).toBeInTheDocument();
  });

  it("워크스페이스가 없으면 빈 상태 메시지를 표시한다", async () => {
    vi.mocked(workspaceApi.list).mockResolvedValue([]);

    render(
      <MemoryRouter>
        <WorkspaceListPage />
      </MemoryRouter>,
    );

    await waitFor(() => expect(workspaceApi.list).toHaveBeenCalled());
    expect(screen.getByText("워크스페이스가 없습니다")).toBeInTheDocument();
  });

  it("새 워크스페이스 버튼이 표시된다", async () => {
    vi.mocked(workspaceApi.list).mockResolvedValue([activeWorkspace]);

    render(
      <MemoryRouter>
        <WorkspaceListPage />
      </MemoryRouter>,
    );

    await waitFor(() => expect(workspaceApi.list).toHaveBeenCalled());
    expect(screen.getByText("새 워크스페이스")).toBeInTheDocument();
  });

  it("검색창이 표시된다", async () => {
    vi.mocked(workspaceApi.list).mockResolvedValue([activeWorkspace]);

    render(
      <MemoryRouter>
        <WorkspaceListPage />
      </MemoryRouter>,
    );

    await waitFor(() => expect(workspaceApi.list).toHaveBeenCalled());
    expect(
      screen.getByPlaceholderText("Search workspaces... ⌘K"),
    ).toBeInTheDocument();
  });
});