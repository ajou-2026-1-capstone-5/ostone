import { render, screen, fireEvent, within } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { toast } from "sonner";
import { CancelSubscriptionButton } from "./CancelSubscriptionButton";
import { useCancelSubscription } from "../api/useCancelSubscription";
import { ApiRequestError } from "@/shared/api";

vi.mock("../api/useCancelSubscription");
vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

const mockUseCancelSubscription = vi.mocked(useCancelSubscription);
const mockMutate = vi.fn();
const mockToastSuccess = vi.mocked(toast.success);
const mockToastError = vi.mocked(toast.error);

function clickConfirmButton() {
  fireEvent.click(screen.getByRole("button", { name: "구독 해지" }));
  fireEvent.click(
    within(screen.getByRole("alertdialog")).getByRole("button", { name: "구독 해지" }),
  );
}

describe("CancelSubscriptionButton", () => {
  beforeEach(() => {
    mockMutate.mockReset();
    mockToastSuccess.mockReset();
    mockToastError.mockReset();
    mockUseCancelSubscription.mockReturnValue({
      mutate: mockMutate,
      isPending: false,
    } as never);
  });

  it("구독 해지 버튼을 렌더링한다", () => {
    render(<CancelSubscriptionButton workspaceId={1} />);
    expect(screen.getByRole("button", { name: "구독 해지" })).toBeTruthy();
  });

  it("버튼 클릭 시 다이얼로그가 열린다", () => {
    render(<CancelSubscriptionButton workspaceId={1} />);
    fireEvent.click(screen.getByRole("button", { name: "구독 해지" }));
    expect(screen.getByText("구독을 해지할까요?")).toBeTruthy();
  });

  it("다이얼로그의 닫기 버튼으로 닫힌다", () => {
    render(<CancelSubscriptionButton workspaceId={1} />);
    fireEvent.click(screen.getByRole("button", { name: "구독 해지" }));
    fireEvent.click(screen.getByRole("button", { name: "닫기" }));
  });

  it("isPending 상태에서 처리 중 텍스트 표시", () => {
    mockUseCancelSubscription.mockReturnValue({
      mutate: mockMutate,
      isPending: true,
    } as never);
    render(<CancelSubscriptionButton workspaceId={1} />);
    fireEvent.click(screen.getByRole("button", { name: "구독 해지" }));
    expect(screen.getByText("처리 중…")).toBeTruthy();
  });

  it("확인 버튼 클릭 시 mutate 호출", () => {
    render(<CancelSubscriptionButton workspaceId={1} />);
    clickConfirmButton();
    expect(mockMutate).toHaveBeenCalledWith(
      { workspaceId: 1 },
      expect.objectContaining({ onSuccess: expect.any(Function), onError: expect.any(Function) }),
    );
  });

  it("onSuccess: CANCELED 상태이면 해지 완료 토스트", () => {
    render(<CancelSubscriptionButton workspaceId={1} />);
    clickConfirmButton();
    const { onSuccess } = mockMutate.mock.calls[0][1];
    onSuccess({ id: 1, status: "CANCELED" });
    expect(mockToastSuccess).toHaveBeenCalledWith("구독을 해지했습니다.");
  });

  it("onSuccess: 비CANCELED 상태이면 주기말 해지 토스트", () => {
    render(<CancelSubscriptionButton workspaceId={1} />);
    clickConfirmButton();
    const { onSuccess } = mockMutate.mock.calls[0][1];
    onSuccess({ id: 1, status: "ACTIVE" });
    expect(mockToastSuccess).toHaveBeenCalledWith("현재 결제 주기가 끝나면 구독이 해지됩니다.");
  });

  it("onError: WORKSPACE_ACCESS_DENIED이면 권한 오류 토스트", () => {
    render(<CancelSubscriptionButton workspaceId={1} />);
    clickConfirmButton();
    const { onError } = mockMutate.mock.calls[0][1];
    onError(new ApiRequestError(403, "WORKSPACE_ACCESS_DENIED", "접근 거부"));
    expect(mockToastError).toHaveBeenCalled();
  });

  it("onError: SUBSCRIPTION_NOT_FOUND이면 구독 없음 토스트", () => {
    render(<CancelSubscriptionButton workspaceId={1} />);
    clickConfirmButton();
    const { onError } = mockMutate.mock.calls[0][1];
    onError(new ApiRequestError(404, "SUBSCRIPTION_NOT_FOUND", "없음"));
    expect(mockToastError).toHaveBeenCalled();
  });

  it("onError: 기타 에러이면 일반 실패 토스트", () => {
    render(<CancelSubscriptionButton workspaceId={1} />);
    clickConfirmButton();
    const { onError } = mockMutate.mock.calls[0][1];
    onError(new Error("unknown"));
    expect(mockToastError).toHaveBeenCalled();
  });
});
