import { fireEvent, render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { IntentDetailWithApproval } from "./IntentDetailWithApproval";

type MockIntentDetail = {
  name: string;
  status: "DRAFT" | "PUBLISHED" | "REJECTED";
};

interface IntentDetailPanelMockProps {
  headerActions?: (detail: MockIntentDetail) => ReactNode;
  children: (detail: MockIntentDetail) => ReactNode;
}

const intentDetailPanelMocks = vi.hoisted(() => ({
  status: "DRAFT" as MockIntentDetail["status"],
}));

vi.mock("../../intent-draft-read/ui", () => ({
  IntentDetailPanel: ({ headerActions, children }: IntentDetailPanelMockProps) => {
    const detail: MockIntentDetail = { name: "test_intent", status: intentDetailPanelMocks.status };
    return (
      <section>
        <header>{headerActions?.(detail)}</header>
        {children(detail)}
      </section>
    );
  },
}));

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

const mockMutate = vi.fn();

interface UseApproveIntentMockParams {
  onStatusChanged?: (status: "PUBLISHED" | "REJECTED") => void;
}

vi.mock("../api/useApproveIntent", () => ({
  useApproveIntent: vi.fn(({ onStatusChanged }: UseApproveIntentMockParams) => ({
    mutate: (status: string) => {
      mockMutate(status);
      onStatusChanged?.(status === "PUBLISHED" ? "PUBLISHED" : "REJECTED");
    },
    isPending: false,
  })),
}));

interface ApproveIntentDialogMockProps {
  open: boolean;
  onConfirm: () => void;
  onOpenChange: (open: boolean) => void;
  intentName: string;
  action: "publish" | "reject";
  isLoading: boolean;
}

vi.mock("../ui/ApproveIntentDialog", () => ({
  ApproveIntentDialog: ({
    open,
    onConfirm,
    onOpenChange,
    intentName,
    action,
    isLoading,
  }: ApproveIntentDialogMockProps) => {
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

interface IntentStatusControlMockProps {
  intentStatus: "DRAFT" | "PUBLISHED" | "REJECTED";
  onPublish: () => void;
  onReject: () => void;
  isPending: boolean;
}

vi.mock("../ui/IntentStatusControl", () => ({
  IntentStatusControl: ({
    intentStatus,
    onPublish,
    onReject,
    isPending,
  }: IntentStatusControlMockProps) => (
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
    intentDetailPanelMocks.status = "DRAFT";
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
    const { rerender } = render(<IntentDetailWithApproval wsId={1} pId={2} vId={3} iId={4} />);

    const publishButtons = screen.getAllByRole("button", { name: "승인" });
    fireEvent.click(publishButtons[0]);
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    rerender(<IntentDetailWithApproval wsId={1} pId={2} vId={3} iId={5} />);

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("DRAFT가 아니면 승인 액션 대신 nonDraftHeaderActions를 렌더링한다", () => {
    intentDetailPanelMocks.status = "PUBLISHED";

    render(
      <IntentDetailWithApproval
        wsId={1}
        pId={2}
        vId={3}
        iId={4}
        nonDraftHeaderActions={() => <button type="button">수정</button>}
      />,
    );

    expect(screen.getByRole("button", { name: "수정" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "승인" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "반려" })).not.toBeInTheDocument();
  });
});
