import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vite-plus/test";
import type { WorkspaceResponse } from "@/entities/workspace";
import { WorkspaceList } from "./WorkspaceList";

const activeWorkspace: WorkspaceResponse = {
  id: 1,
  workspaceKey: "cs-team-alpha",
  name: "CS Team Alpha",
  description: null,
  status: "ACTIVE",
  myRole: "OWNER",
  createdAt: "2026-04-01T00:00:00Z",
  updatedAt: "2026-04-01T00:00:00Z",
};

describe("WorkspaceList", () => {
  it("renders loading state", () => {
    render(
      <WorkspaceList
        workspaces={[]}
        isLoading
        error=""
        onRetry={vi.fn()}
        onCreate={vi.fn()}
        onOpen={vi.fn()}
        onOpenPolicyDraft={vi.fn()}
        onOpenRiskDraft={vi.fn()}
        policyDraftLoadingWorkspaceId={null}
        riskDraftLoadingWorkspaceId={null}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
      />,
    );

    expect(screen.getByText("워크스페이스를 불러오는 중입니다.")).toBeInTheDocument();
  });

  it("renders error state with retry action", () => {
    const onRetry = vi.fn();
    render(
      <WorkspaceList
        workspaces={[]}
        isLoading={false}
        error="네트워크 오류"
        onRetry={onRetry}
        onCreate={vi.fn()}
        onOpen={vi.fn()}
        onOpenPolicyDraft={vi.fn()}
        onOpenRiskDraft={vi.fn()}
        policyDraftLoadingWorkspaceId={null}
        riskDraftLoadingWorkspaceId={null}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /다시 시도/ }));

    expect(screen.getByText("네트워크 오류")).toBeInTheDocument();
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("renders empty state with create action", () => {
    const onCreate = vi.fn();
    render(
      <WorkspaceList
        workspaces={[]}
        isLoading={false}
        error=""
        onRetry={vi.fn()}
        onCreate={onCreate}
        onOpen={vi.fn()}
        onOpenPolicyDraft={vi.fn()}
        onOpenRiskDraft={vi.fn()}
        policyDraftLoadingWorkspaceId={null}
        riskDraftLoadingWorkspaceId={null}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "워크스페이스 생성" }));

    expect(screen.getByText("워크스페이스가 없습니다")).toBeInTheDocument();
    expect(onCreate).toHaveBeenCalledTimes(1);
  });

  it("renders workspace cards and opens a selected workspace", () => {
    const onOpen = vi.fn();
    render(
      <WorkspaceList
        workspaces={[activeWorkspace]}
        isLoading={false}
        error=""
        onRetry={vi.fn()}
        onCreate={vi.fn()}
        onOpen={onOpen}
        onOpenPolicyDraft={vi.fn()}
        onOpenRiskDraft={vi.fn()}
        policyDraftLoadingWorkspaceId={null}
        riskDraftLoadingWorkspaceId={null}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /Open Workspace/ }));

    expect(screen.getByText("CS Team Alpha")).toBeInTheDocument();
    expect(onOpen).toHaveBeenCalledWith(activeWorkspace);
  });

  it("opens policy draft editing for a selected workspace", () => {
    const onOpenPolicyDraft = vi.fn();
    render(
      <WorkspaceList
        workspaces={[activeWorkspace]}
        isLoading={false}
        error=""
        onRetry={vi.fn()}
        onCreate={vi.fn()}
        onOpen={vi.fn()}
        onOpenPolicyDraft={onOpenPolicyDraft}
        onOpenRiskDraft={vi.fn()}
        policyDraftLoadingWorkspaceId={null}
        riskDraftLoadingWorkspaceId={null}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /Policy 편집/ }));

    expect(onOpenPolicyDraft).toHaveBeenCalledWith(activeWorkspace);
  });

  it("opens risk draft read page for a selected workspace", () => {
    const onOpenRiskDraft = vi.fn();
    render(
      <WorkspaceList
        workspaces={[activeWorkspace]}
        isLoading={false}
        error=""
        onRetry={vi.fn()}
        onCreate={vi.fn()}
        onOpen={vi.fn()}
        onOpenPolicyDraft={vi.fn()}
        onOpenRiskDraft={onOpenRiskDraft}
        policyDraftLoadingWorkspaceId={null}
        riskDraftLoadingWorkspaceId={null}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /Risk 조회/ }));

    expect(onOpenRiskDraft).toHaveBeenCalledWith(activeWorkspace);
  });
});
