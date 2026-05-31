import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { toast } from "sonner";

import type { WorkspaceResponse } from "@/entities/workspace";

import { CreateWorkspaceDialog } from "./CreateWorkspaceDialog";

const mocks = vi.hoisted(() => ({
  mutate: vi.fn(),
}));

vi.mock("@/shared/api/generated/endpoints/workspace-controller/workspace-controller", () => ({
  useCreateWorkspace: () => ({
    mutate: mocks.mutate,
  }),
}));

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

type CreateWorkspaceCallbacks = {
  onSuccess?: (result: unknown) => Promise<void> | void;
  onError?: (error: unknown) => void;
};

const createdWorkspace: WorkspaceResponse = {
  id: 351,
  workspaceKey: "support-team-abc123",
  name: "Support Team",
  status: "ACTIVE",
};

function renderDialog() {
  const onOpenChange = vi.fn();
  const onSuccess = vi.fn();

  render(<CreateWorkspaceDialog open={true} onOpenChange={onOpenChange} onSuccess={onSuccess} />);

  return { onOpenChange, onSuccess };
}

function submitWorkspaceName(name = "Support Team") {
  fireEvent.change(screen.getByLabelText("제목"), { target: { value: name } });
  fireEvent.click(screen.getByRole("button", { name: "생성" }));
}

describe("CreateWorkspaceDialog", () => {
  beforeEach(() => {
    mocks.mutate.mockReset();
    vi.mocked(toast.success).mockReset();
    vi.mocked(toast.error).mockReset();
  });

  it("raw WorkspaceResponse 응답이면 생성 성공 콜백을 호출한다", async () => {
    mocks.mutate.mockImplementation((_variables: unknown, callbacks: CreateWorkspaceCallbacks) => {
      callbacks.onSuccess?.(createdWorkspace);
    });
    const { onOpenChange, onSuccess } = renderDialog();

    submitWorkspaceName();

    await waitFor(() => expect(onSuccess).toHaveBeenCalledWith(createdWorkspace));
    expect(toast.success).toHaveBeenCalledWith("워크스페이스를 생성했습니다.");
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("{ data: WorkspaceResponse } 응답이어도 생성 성공 콜백을 호출한다", async () => {
    mocks.mutate.mockImplementation((_variables: unknown, callbacks: CreateWorkspaceCallbacks) => {
      callbacks.onSuccess?.({ data: createdWorkspace });
    });
    const { onSuccess } = renderDialog();

    submitWorkspaceName();

    await waitFor(() => expect(onSuccess).toHaveBeenCalledWith(createdWorkspace));
    expect(toast.success).toHaveBeenCalledWith("워크스페이스를 생성했습니다.");
  });

  it("생성 응답에서 id를 확인할 수 없으면 성공 콜백을 호출하지 않는다", async () => {
    mocks.mutate.mockImplementation((_variables: unknown, callbacks: CreateWorkspaceCallbacks) => {
      callbacks.onSuccess?.({ name: "Support Team", status: "ACTIVE" });
    });
    const { onOpenChange, onSuccess } = renderDialog();

    submitWorkspaceName();

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith(
        "워크스페이스 생성 응답을 확인하지 못했습니다. 잠시 후 다시 시도해주세요.",
      ),
    );
    expect(onSuccess).not.toHaveBeenCalled();
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
    expect(toast.success).not.toHaveBeenCalled();
  });

  it("이름이 비어 있으면 생성 mutation을 호출하지 않는다", () => {
    renderDialog();

    fireEvent.click(screen.getByRole("button", { name: "생성" }));

    expect(mocks.mutate).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent("이름을 입력해주세요.");
  });
});
