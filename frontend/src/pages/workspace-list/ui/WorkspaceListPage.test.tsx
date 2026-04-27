import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { toast } from "sonner";
import { domainPackApi } from "@/entities/domain-pack";
import { workspaceApi } from "@/entities/workspace";
import { ApiRequestError } from "@/shared/api";
import { WorkspaceListPage } from "./WorkspaceListPage";
import type { WorkspaceResponse } from "@/entities/workspace";

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
  WorkspaceList: ({
    onOpen,
    onOpenPolicyDraft,
    workspaces,
  }: {
    onOpen: (workspace: WorkspaceResponse) => void;
    onOpenPolicyDraft: (workspace: WorkspaceResponse) => void;
    workspaces: WorkspaceResponse[];
  }) => (
    <div>
      <button type="button" onClick={() => onOpen(workspaces[0])}>
        open workspace
      </button>
      <button type="button" onClick={() => onOpenPolicyDraft(workspaces[0])}>
        open policy draft
      </button>
    </div>
  ),
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
  updatedAt: "",
};

describe("WorkspaceListPage", () => {
  beforeEach(() => {
    navigate.mockReset();
    vi.mocked(workspaceApi.list).mockReset();
    vi.mocked(domainPackApi.getDraftEntry).mockReset();
    vi.mocked(toast.error).mockReset();
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
    fireEvent.click(screen.getByRole("button", { name: "open workspace" }));
    fireEvent.click(screen.getByRole("button", { name: "open policy draft" }));

    await waitFor(() =>
      expect(navigate).toHaveBeenCalledWith("/workspaces/1/domain-packs/7/versions/101/policies"),
    );
    expect(navigate).toHaveBeenCalledWith("/workspaces/1/workflows");
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
    fireEvent.click(screen.getByRole("button", { name: "open policy draft" }));

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith("수정 가능한 정책 초안이 없습니다."),
    );
  });
});
