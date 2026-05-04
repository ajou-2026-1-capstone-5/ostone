import { fireEvent, render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { IntentApprovalAction, IntentApprovalStatus } from "../model/types";
import { IntentDetailWithApproval } from "./IntentDetailWithApproval";

type MockIntentDetail = {
  name: string;
  status: "DRAFT" | IntentApprovalStatus;
};

type IntentDetailPanelProps = {
  children?: (detail: MockIntentDetail) => ReactNode;
};

type ApproveIntentDialogProps = {
  open: boolean;
  onConfirm: () => void;
  onOpenChange: (open: boolean) => void;
  intentName: string;
  action: IntentApprovalAction;
  isLoading: boolean;
};

type IntentStatusControlProps = {
  intentStatus: "DRAFT" | IntentApprovalStatus;
  onPublish: () => void;
  onReject: () => void;
  isPending: boolean;
};

vi.mock("../../intent-draft-read/ui", () => ({
  IntentDetailPanel: ({ children }: IntentDetailPanelProps) =>
    children?.({ name: "test_intent", status: "DRAFT" }),
}));

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

const mockMutate = vi.fn();

vi.mock("../api/useApproveIntent", () => ({
  useApproveIntent: vi.fn(
    ({ onStatusChanged }: { onStatusChanged?: (status: IntentApprovalStatus) => void }) => ({
      mutate: (status: IntentApprovalStatus) => {
        mockMutate(status);
        onStatusChanged?.(status === "PUBLISHED" ? "PUBLISHED" : "REJECTED");
      },
      isPending: false,
    }),
  ),
}));

vi.mock("../ui/ApproveIntentDialog", () => ({
  ApproveIntentDialog: ({
    open,
    onConfirm,
    onOpenChange,
    intentName,
    action,
    isLoading,
  }: ApproveIntentDialogProps) => {
    if (!open) return null;
    return (
      <div role="dialog">
        <span>intentName: {intentName}</span>
        <span>action: {action}</span>
        <button onClick={onConfirm} disabled={isLoading}>
          {action === "publish" ? "승인" : "반려"}
        </button>
        <button onClick={() => onOpenChange(false)}>취소</button>
      </div>
    );
  },
}));

vi.mock("../ui/IntentStatusControl", () => ({
  IntentStatusControl: ({
    intentStatus,
    onPublish,
    onReject,
    isPending,
  }: IntentStatusControlProps) => (
    <div>
      <button onClick={onPublish} disabled={isPending || intentStatus !== "DRAFT"}>
        {isPending ? "처리 중..." : "승인"}
      </button>
      <button onClick={onReject} disabled={isPending || intentStatus !== "DRAFT"}>
        {isPending ? "처리 중..." : "반려"}
      </button>
    </div>
  ),
}));

describe("IntentDetailWithApproval", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("DRAFT intent에서 publish 버튼 클릭 → dialog 열림", () => {
    render(<IntentDetailWithApproval wsId={1} pId={2} vId={3} iId={4} />);

    fireEvent.click(screen.getByRole("button", { name: "승인" }));

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText(/test_intent/)).toBeInTheDocument();
  });

  it("DRAFT intent에서 reject 버튼 클릭 → dialog 열림", () => {
    render(<IntentDetailWithApproval wsId={1} pId={2} vId={3} iId={4} />);

    fireEvent.click(screen.getByRole("button", { name: "반려" }));

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText(/action: reject/)).toBeInTheDocument();
  });

  it("dialog에서 취소 버튼 클릭 → dialog 닫힘", () => {
    render(<IntentDetailWithApproval wsId={1} pId={2} vId={3} iId={4} />);

    fireEvent.click(screen.getByRole("button", { name: "승인" }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "취소" }));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("publish confirm 시 mutate('PUBLISHED')가 호출된다", () => {
    render(<IntentDetailWithApproval wsId={1} pId={2} vId={3} iId={4} />);

    const publishButtons = screen.getAllByRole("button", { name: "승인" });
    fireEvent.click(publishButtons[0]);

    const dialog = screen.getByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "승인" }));

    expect(mockMutate).toHaveBeenCalledWith("PUBLISHED");
  });

  it("reject confirm 시 mutate('REJECTED')가 호출된다", () => {
    render(<IntentDetailWithApproval wsId={1} pId={2} vId={3} iId={4} />);

    const rejectButtons = screen.getAllByRole("button", { name: "반려" });
    fireEvent.click(rejectButtons[0]);

    const dialog = screen.getByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "반려" }));

    expect(mockMutate).toHaveBeenCalledWith("REJECTED");
  });

  it("iId가 변경되면 상태가 초기화된다", () => {
    const { rerender } = render(
      <IntentDetailWithApproval wsId={1} pId={2} vId={3} iId={4} />,
    );

    const publishButtons = screen.getAllByRole("button", { name: "승인" });
    fireEvent.click(publishButtons[0]);
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    rerender(<IntentDetailWithApproval wsId={1} pId={2} vId={3} iId={5} />);

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
