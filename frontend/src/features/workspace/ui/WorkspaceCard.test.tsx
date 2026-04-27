import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vite-plus/test";

import type { WorkspaceResponse } from "@/entities/workspace";

import { WorkspaceCard } from "./WorkspaceCard";

const baseWorkspace: WorkspaceResponse = {
  id: 1,
  workspaceKey: "cs-team-alpha",
  name: "CS Team Alpha",
  description: null,
  status: "ACTIVE",
  myRole: "OWNER",
  createdAt: "2026-04-01T00:00:00Z",
  updatedAt: "2026-04-01T00:00:00Z",
};

describe("WorkspaceCard", () => {
  it("shows edit and delete actions for owner role", () => {
    render(
      <WorkspaceCard
        workspace={baseWorkspace}
        onOpen={vi.fn()}
        onOpenPolicyDraft={vi.fn()}
        isPolicyDraftLoading={false}
        isPolicyDraftDisabled={false}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
      />,
    );

    expect(screen.getByRole("button", { name: /수정/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /삭제/ })).toBeInTheDocument();
  });

  it("hides edit and delete actions when role cannot be normalized", () => {
    render(
      <WorkspaceCard
        workspace={{
          ...baseWorkspace,
          myRole: "UNEXPECTED_ROLE" as unknown as WorkspaceResponse["myRole"],
        }}
        onOpen={vi.fn()}
        onOpenPolicyDraft={vi.fn()}
        isPolicyDraftLoading={false}
        isPolicyDraftDisabled={false}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
      />,
    );

    expect(screen.queryByRole("button", { name: /수정/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /삭제/ })).not.toBeInTheDocument();
  });

  it("invokes onOpen with the workspace when the open button is clicked", () => {
    const onOpen = vi.fn();
    render(
      <WorkspaceCard
        workspace={baseWorkspace}
        onOpen={onOpen}
        onOpenPolicyDraft={vi.fn()}
        isPolicyDraftLoading={false}
        isPolicyDraftDisabled={false}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /Open Workspace/ }));

    expect(onOpen).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 1,
        name: "CS Team Alpha",
      }),
    );
  });

  it("invokes onOpenPolicyDraft with the workspace when the policy edit button is clicked", () => {
    const onOpenPolicyDraft = vi.fn();
    render(
      <WorkspaceCard
        workspace={baseWorkspace}
        onOpen={vi.fn()}
        onOpenPolicyDraft={onOpenPolicyDraft}
        isPolicyDraftLoading={false}
        isPolicyDraftDisabled={false}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /Policy 편집/ }));

    expect(onOpenPolicyDraft).toHaveBeenCalledWith(baseWorkspace);
  });

  it("disables the policy edit button while draft entry navigation is loading", () => {
    render(
      <WorkspaceCard
        workspace={baseWorkspace}
        onOpen={vi.fn()}
        onOpenPolicyDraft={vi.fn()}
        isPolicyDraftLoading
        isPolicyDraftDisabled={false}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
      />,
    );

    expect(screen.getByRole("button", { name: /이동 중/ })).toBeDisabled();
  });
});
