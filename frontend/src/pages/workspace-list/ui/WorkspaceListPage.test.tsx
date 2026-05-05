import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { toast } from "sonner";
import { domainPackApi } from "@/entities/domain-pack";
import { workspaceApi } from "@/entities/workspace";
import { ApiRequestError } from "@/shared/api";
import { WorkspaceListPage } from "./WorkspaceListPage";

const navigate = vi.fn();

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return {
    ...actual,
    useNavigate: () => navigate,
  };
});

vi.mock("sonner", () => ({
  toast: {
    error: vi.fn(),
  },
}));

vi.mock("@/entities/domain-pack", () => ({
  DOMAIN_PACK_DRAFT_ENTRY_NOT_FOUND: "DOMAIN_PACK_DRAFT_ENTRY_NOT_FOUND",
  domainPackApi: {
    getDraftEntry: vi.fn(),
  },
}));

vi.mock("@/entities/workspace", async () => {
  const actual =
    await vi.importActual<typeof import("@/entities/workspace")>("@/entities/workspace");
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

const activeWorkspace = {
  id: 1,
  workspaceKey: "cs-team",
  name: "CS Team",
  description: null,
  status: "ACTIVE" as const,
  myRole: "OWNER" as const,
  createdAt: "",
  updatedAt: "2025-05-05T00:00:00Z",
};

describe("WorkspaceListPage", () => {
  beforeEach(() => {
    navigate.mockReset();
    vi.mocked(workspaceApi.list).mockReset();
    vi.mocked(domainPackApi.getDraftEntry).mockReset();
    vi.mocked(toast.error).mockReset();
  });

  it("renders hero text and new layout content", async () => {
    vi.mocked(workspaceApi.list).mockResolvedValue([activeWorkspace]);

    render(
      <MemoryRouter>
        <WorkspaceListPage />
      </MemoryRouter>,
    );

    await waitFor(() => expect(workspaceApi.list).toHaveBeenCalled());

    expect(screen.getByText(/상담 로그에서/)).toBeInTheDocument();
    expect(screen.getByText("Active workspaces")).toBeInTheDocument();
    expect(screen.getByText("Drafts in review")).toBeInTheDocument();
    expect(screen.getByText("Pipeline runs · 7d")).toBeInTheDocument();
    expect(screen.getByText("Coverage rate")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "CS Team" })).toBeInTheDocument();
    expect(screen.getByText("Recent pipeline activity")).toBeInTheDocument();
  });

  it("워크스페이스와 정책 편집 진입 경로를 연결한다", async () => {
    vi.mocked(workspaceApi.list).mockResolvedValue([activeWorkspace]);
    vi.mocked(domainPackApi.getDraftEntry).mockResolvedValue({
      workspaceId: 1,
      packId: 7,
      versionId: 101,
      packName: "CS Pack",
      versionNo: 2,
    });

    render(
      <MemoryRouter>
        <WorkspaceListPage />
      </MemoryRouter>,
    );

    await waitFor(() => expect(workspaceApi.list).toHaveBeenCalled());

    fireEvent.click(screen.getByRole("button", { name: "CS Team" }));
    expect(navigate).toHaveBeenCalledWith("/workspaces/1/workflows");

    fireEvent.click(screen.getByRole("button", { name: "Actions" }));
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Policy draft" })).toBeInTheDocument(),
    );
    fireEvent.click(screen.getByRole("button", { name: "Policy draft" }));

    await waitFor(() =>
      expect(navigate).toHaveBeenCalledWith("/workspaces/1/domain-packs/7/versions/101/policies"),
    );
  });

  it("Risk 조회 진입 경로를 연결한다", async () => {
    vi.mocked(workspaceApi.list).mockResolvedValue([activeWorkspace]);
    vi.mocked(domainPackApi.getDraftEntry).mockResolvedValue({
      workspaceId: 1,
      packId: 7,
      versionId: 101,
      packName: "CS Pack",
      versionNo: 2,
    });

    render(
      <MemoryRouter>
        <WorkspaceListPage />
      </MemoryRouter>,
    );

    await waitFor(() => expect(workspaceApi.list).toHaveBeenCalled());

    fireEvent.click(screen.getByRole("button", { name: "Actions" }));
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Risk draft" })).toBeInTheDocument(),
    );
    fireEvent.click(screen.getByRole("button", { name: "Risk draft" }));

    await waitFor(() => expect(domainPackApi.getDraftEntry).toHaveBeenCalledWith(1));
    await waitFor(() =>
      expect(navigate).toHaveBeenCalledWith("/workspaces/1/domain-packs/7/versions/101/risks"),
    );
  });

  it("정책 초안이 없으면 전용 toast를 표시한다", async () => {
    vi.mocked(workspaceApi.list).mockResolvedValue([activeWorkspace]);
    vi.mocked(domainPackApi.getDraftEntry).mockRejectedValue(
      new ApiRequestError(404, "DOMAIN_PACK_DRAFT_ENTRY_NOT_FOUND", "없음"),
    );

    render(
      <MemoryRouter>
        <WorkspaceListPage />
      </MemoryRouter>,
    );

    await waitFor(() => expect(workspaceApi.list).toHaveBeenCalled());

    fireEvent.click(screen.getByRole("button", { name: "Actions" }));
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Policy draft" })).toBeInTheDocument(),
    );
    fireEvent.click(screen.getByRole("button", { name: "Policy draft" }));

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith("수정 가능한 정책 초안이 없습니다."),
    );
  });
});
