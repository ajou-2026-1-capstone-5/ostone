import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { toast } from "sonner";
import { RefundButton } from "./RefundButton";
import { useRefundPayment } from "../api/useRefundPayment";
import type { PaymentResponse } from "@/entities/billing";

vi.mock("../api/useRefundPayment");
vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

const mockUseRefundPayment = vi.mocked(useRefundPayment);
const mockMutate = vi.fn();
const mockToastError = vi.mocked(toast.error);

const stubPayment: PaymentResponse = {
  id: 1,
  workspaceId: 1,
  paymentKey: "pay-001",
  orderId: "order-001",
  amount: 9900,
  currency: "KRW",
  status: "DONE",
  method: "card",
  receiptUrl: undefined,
  approvedAt: "2024-01-15T10:00:00Z",
  createdAt: "2024-01-15T09:59:00Z",
};

describe("RefundButton", () => {
  beforeEach(() => {
    mockMutate.mockReset();
    mockToastError.mockReset();
    mockUseRefundPayment.mockReturnValue({
      mutate: mockMutate,
      isPending: false,
    } as never);
  });

  it("환불 버튼을 렌더링한다", () => {
    render(<RefundButton workspaceId={1} payment={stubPayment} />);
    expect(screen.getByText("환불")).toBeTruthy();
  });

  it("환불 버튼 클릭 시 다이얼로그가 열린다", () => {
    render(<RefundButton workspaceId={1} payment={stubPayment} />);
    fireEvent.click(screen.getByText("환불"));
    expect(screen.getByText("결제를 환불할까요?")).toBeTruthy();
  });

  it("다이얼로그의 닫기 버튼으로 닫힌다", () => {
    render(<RefundButton workspaceId={1} payment={stubPayment} />);
    fireEvent.click(screen.getByText("환불"));
    const closeBtn = screen.getByRole("button", { name: "닫기" });
    fireEvent.click(closeBtn);
  });

  it("환불 사유 없이 확인 클릭 시 에러 토스트", () => {
    render(<RefundButton workspaceId={1} payment={stubPayment} />);
    fireEvent.click(screen.getByText("환불"));
    const reasonInput = screen.getByPlaceholderText("환불 사유를 입력해주세요");
    fireEvent.change(reasonInput, { target: { value: "" } });
    const allButtons = screen.getAllByRole("button");
    const confirmBtn = allButtons.find((b) => b.textContent === "환불");
    if (confirmBtn) fireEvent.click(confirmBtn);
    expect(mockToastError).toHaveBeenCalled();
    expect(mockMutate).not.toHaveBeenCalled();
  });

  it("paymentKey 없을 때 확인 클릭 시 에러 토스트", () => {
    const noKeyPayment = { ...stubPayment, paymentKey: undefined };
    render(<RefundButton workspaceId={1} payment={noKeyPayment as never} />);
    fireEvent.click(screen.getByText("환불"));
    const allButtons = screen.getAllByRole("button");
    const confirmBtn = allButtons.find((b) => b.textContent === "환불");
    if (confirmBtn) fireEvent.click(confirmBtn);
    expect(mockMutate).not.toHaveBeenCalled();
  });

  it("유효한 사유로 확인 클릭 시 mutate 호출", () => {
    render(<RefundButton workspaceId={1} payment={stubPayment} />);
    fireEvent.click(screen.getByText("환불"));
    const allButtons = screen.getAllByRole("button");
    const confirmBtn = allButtons.find((b) => b.textContent === "환불");
    if (confirmBtn) fireEvent.click(confirmBtn);
    expect(mockMutate).toHaveBeenCalledWith(
      expect.objectContaining({ workspaceId: 1, paymentKey: "pay-001", cancelReason: "고객 요청" }),
      expect.objectContaining({ onSuccess: expect.any(Function), onError: expect.any(Function) }),
    );
  });

  it("onSuccess: 환불 완료 토스트", () => {
    render(<RefundButton workspaceId={1} payment={stubPayment} />);
    fireEvent.click(screen.getByText("환불"));
    const allButtons = screen.getAllByRole("button");
    const confirmBtn = allButtons.find((b) => b.textContent === "환불");
    if (confirmBtn) fireEvent.click(confirmBtn);
    const { onSuccess } = mockMutate.mock.calls[0][1];
    onSuccess();
    expect(vi.mocked(toast.success)).toHaveBeenCalledWith("환불을 요청했습니다.");
  });
});
