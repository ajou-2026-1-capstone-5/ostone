import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { toast } from "sonner";
import type { ComponentProps, ReactNode } from "react";

import type { WorkspaceResponse } from "@/entities/workspace";
import { ApiRequestError } from "@/shared/api";

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

vi.mock("@/shared/ui/dialog", () => ({
  Dialog: ({
    open,
    onOpenChange,
    children,
  }: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    children: ReactNode;
  }) =>
    open ? (
      <div data-testid="dialog-root">
        <button type="button" onClick={() => onOpenChange(false)}>
          mock close dialog
        </button>
        <button type="button" onClick={() => onOpenChange(true)}>
          mock keep dialog open
        </button>
        {children}
      </div>
    ) : null,
  DialogContent: ({ children, ...props }: ComponentProps<"div">) => (
    <div data-testid="dialog-content" {...props}>
      {children}
    </div>
  ),
  DialogDescription: ({ children }: { children: ReactNode }) => <p>{children}</p>,
  DialogFooter: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DialogHeader: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children: ReactNode }) => <h2>{children}</h2>,
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

  it("워크스페이스 이름을 trim하고 생성 요청 payload를 만든다", () => {
    mocks.mutate.mockImplementation(() => undefined);
    renderDialog();

    submitWorkspaceName("  Support Team  ");

    expect(mocks.mutate).toHaveBeenCalledWith(
      {
        data: {
          name: "Support Team",
          workspaceKey: expect.stringMatching(/^support-team-[a-z0-9]{6}$/),
        },
      },
      expect.any(Object),
    );
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

  it("부모 성공 콜백이 실패하면 목록 갱신 실패 toast를 표시한다", async () => {
    mocks.mutate.mockImplementation((_variables: unknown, callbacks: CreateWorkspaceCallbacks) => {
      callbacks.onSuccess?.(createdWorkspace);
    });
    const onOpenChange = vi.fn();
    const onSuccess = vi.fn().mockRejectedValue(new Error("navigation failed"));
    render(<CreateWorkspaceDialog open={true} onOpenChange={onOpenChange} onSuccess={onSuccess} />);

    submitWorkspaceName();

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith(
        "워크스페이스 목록을 새로고침하지 못했습니다. 잠시 후 다시 시도해주세요.",
      ),
    );
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("생성 요청 중에는 제출 버튼을 비활성화한다", async () => {
    mocks.mutate.mockImplementation(() => undefined);
    renderDialog();

    submitWorkspaceName();

    await waitFor(() => expect(screen.getByRole("button", { name: "생성 중..." })).toBeDisabled());
  });

  it("생성 요청 중 재제출되어도 mutation을 중복 호출하지 않는다", async () => {
    mocks.mutate.mockImplementation(() => undefined);
    renderDialog();

    submitWorkspaceName();
    await waitFor(() => expect(screen.getByRole("button", { name: "생성 중..." })).toBeDisabled());
    const form = screen.getByLabelText("제목").closest("form");
    if (!form) {
      throw new Error("workspace create form not found");
    }

    fireEvent.submit(form);

    expect(mocks.mutate).toHaveBeenCalledTimes(1);
  });

  it("취소 버튼을 누르면 모달 닫기 콜백을 호출한다", () => {
    const { onOpenChange } = renderDialog();

    fireEvent.click(screen.getByRole("button", { name: "취소" }));

    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("Dialog close 이벤트로 닫히면 입력 오류를 초기화하고 닫기 콜백을 호출한다", async () => {
    const { onOpenChange } = renderDialog();
    fireEvent.click(screen.getByRole("button", { name: "생성" }));
    expect(screen.getByRole("alert")).toHaveTextContent("이름을 입력해주세요.");

    fireEvent.click(screen.getByRole("button", { name: "mock close dialog" }));

    await waitFor(() => expect(screen.queryByRole("alert")).not.toBeInTheDocument());
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("Dialog open 이벤트는 입력값을 유지하고 열림 상태를 전달한다", () => {
    const { onOpenChange } = renderDialog();
    fireEvent.change(screen.getByLabelText("제목"), { target: { value: "Support Team" } });

    fireEvent.click(screen.getByRole("button", { name: "mock keep dialog open" }));

    expect(screen.getByLabelText("제목")).toHaveValue("Support Team");
    expect(onOpenChange).toHaveBeenCalledWith(true);
  });

  it("Dialog open 이벤트는 기존 검증 오류를 reset하지 않는다", () => {
    const { onOpenChange } = renderDialog();
    fireEvent.click(screen.getByRole("button", { name: "생성" }));
    expect(screen.getByRole("alert")).toHaveTextContent("이름을 입력해주세요.");

    fireEvent.click(screen.getByRole("button", { name: "mock keep dialog open" }));

    expect(screen.getByRole("alert")).toHaveTextContent("이름을 입력해주세요.");
    expect(onOpenChange).toHaveBeenCalledWith(true);
  });

  it("이름이 비어 있으면 생성 mutation을 호출하지 않는다", () => {
    renderDialog();

    fireEvent.click(screen.getByRole("button", { name: "생성" }));

    expect(mocks.mutate).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent("이름을 입력해주세요.");
  });

  it("서버 이름 검증 오류는 name field error로 표시한다", async () => {
    mocks.mutate.mockImplementation((_variables: unknown, callbacks: CreateWorkspaceCallbacks) => {
      callbacks.onError?.(
        new ApiRequestError(400, "WORKSPACE_INVALID_NAME", "이름은 255자 이하여야 합니다."),
      );
    });
    renderDialog();

    submitWorkspaceName();

    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent("이름은 255자 이하여야 합니다."),
    );
    expect(toast.error).not.toHaveBeenCalled();
  });

  it("workspace key 충돌은 이름 재시도 안내로 표시한다", async () => {
    mocks.mutate.mockImplementation((_variables: unknown, callbacks: CreateWorkspaceCallbacks) => {
      callbacks.onError?.(
        new ApiRequestError(409, "WORKSPACE_KEY_CONFLICT", "이미 사용 중인 키입니다."),
      );
    });
    renderDialog();

    submitWorkspaceName();

    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent(
        "다른 워크스페이스 이름으로 다시 시도해주세요.",
      ),
    );
    expect(toast.error).not.toHaveBeenCalled();
  });

  it("알 수 없는 생성 실패는 공통 오류 toast로 표시한다", async () => {
    mocks.mutate.mockImplementation((_variables: unknown, callbacks: CreateWorkspaceCallbacks) => {
      callbacks.onError?.(new Error("network error"));
    });
    renderDialog();

    submitWorkspaceName();

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("서버에 연결할 수 없습니다."));
  });

  it("필드 오류가 아닌 ApiRequestError는 공통 workspace 오류 메시지를 표시한다", async () => {
    mocks.mutate.mockImplementation((_variables: unknown, callbacks: CreateWorkspaceCallbacks) => {
      callbacks.onError?.(
        new ApiRequestError(400, "WORKSPACE_INVALID_KEY", "workspaceKey 형식이 올바르지 않습니다."),
      );
    });
    renderDialog();

    submitWorkspaceName();

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith("워크스페이스 키 형식이 올바르지 않습니다."),
    );
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});
