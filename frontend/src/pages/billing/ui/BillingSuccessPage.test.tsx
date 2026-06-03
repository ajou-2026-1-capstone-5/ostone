import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { BillingSuccessPage } from "./BillingSuccessPage";

const mockNavigate = vi.fn();
let mockSearchParams = new URLSearchParams();

vi.mock("react-router-dom", async (importOriginal) => {
  const original = await importOriginal<typeof import("react-router-dom")>();
  return {
    ...original,
    useNavigate: vi.fn(() => mockNavigate),
    useSearchParams: vi.fn(() => [mockSearchParams, vi.fn()]),
  };
});

const mockConfirmBillingMutate = vi.fn();
const mockConfirmPaymentMutate = vi.fn();

vi.mock("@/features/register-billing-method", () => ({
  BILLING_CONFIRM_ERROR_MESSAGES: {
    CONFIRM_FAILED: "빌링 인증 실패",
    SUBSCRIPTION_ALREADY_EXISTS: "이미 구독 중",
  },
  useConfirmBillingAuthorization: vi.fn(() => ({
    mutate: mockConfirmBillingMutate,
    isPending: false,
  })),
}));

vi.mock("@/features/pay-once", () => ({
  PAY_ONCE_ERROR_MESSAGES: {
    CONFIRM_FAILED: "결제 승인 실패",
    WIDGET_FAILED: "위젯 초기화 실패",
  },
  isOrderProcessed: vi.fn().mockReturnValue(false),
  markOrderProcessed: vi.fn(),
  useConfirmPayment: vi.fn(() => ({
    mutate: mockConfirmPaymentMutate,
    isPending: false,
  })),
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

describe("BillingSuccessPage", () => {
  beforeEach(() => {
    mockNavigate.mockReset();
    mockConfirmBillingMutate.mockReset();
    mockConfirmPaymentMutate.mockReset();
    mockSearchParams = new URLSearchParams();
  });

  it("초기 처리 중 상태를 렌더링한다", async () => {
    mockSearchParams = new URLSearchParams("workspaceId=1&flow=billing&authKey=auth&customerKey=ws_1");
    render(<BillingSuccessPage />);
    expect(screen.getByText("결제 결과를 처리하고 있습니다")).toBeTruthy();
  });

  it("workspaceId 없으면 에러 상태 표시", async () => {
    mockSearchParams = new URLSearchParams("");
    render(<BillingSuccessPage />);
    await waitFor(() => {
      expect(screen.getByText("결제 처리에 실패했습니다")).toBeTruthy();
    });
  });

  it("workspaceId 유효하지 않으면 에러 상태 표시", async () => {
    mockSearchParams = new URLSearchParams("workspaceId=not-a-number");
    render(<BillingSuccessPage />);
    await waitFor(() => {
      expect(screen.getByText("결제 처리에 실패했습니다")).toBeTruthy();
    });
  });

  it("billing flow — confirmBilling mutate 호출", async () => {
    mockSearchParams = new URLSearchParams("workspaceId=1&flow=billing&authKey=auth-key&customerKey=ws_1");
    render(<BillingSuccessPage />);
    await waitFor(() => {
      expect(mockConfirmBillingMutate).toHaveBeenCalledWith(
        { workspaceId: 1, authKey: "auth-key", customerKey: "ws_1" },
        expect.objectContaining({ onSuccess: expect.any(Function), onError: expect.any(Function) }),
      );
    });
  });

  it("widget flow — confirmPayment mutate 호출", async () => {
    mockSearchParams = new URLSearchParams(
      "workspaceId=1&flow=widget&paymentKey=pay-key&orderId=order-001&amount=9900",
    );
    render(<BillingSuccessPage />);
    await waitFor(() => {
      expect(mockConfirmPaymentMutate).toHaveBeenCalledWith(
        { workspaceId: 1, paymentKey: "pay-key", orderId: "order-001", amount: 9900 },
        expect.objectContaining({ onSuccess: expect.any(Function), onError: expect.any(Function) }),
      );
    });
  });

  it("widget flow — amount가 NaN이면 에러 상태", async () => {
    mockSearchParams = new URLSearchParams(
      "workspaceId=1&flow=widget&paymentKey=pay-key&orderId=order-001&amount=not-a-number",
    );
    render(<BillingSuccessPage />);
    await waitFor(() => {
      expect(screen.getByText("결제 처리에 실패했습니다")).toBeTruthy();
    });
  });

  it("flow 파라미터가 없으면 에러 상태", async () => {
    mockSearchParams = new URLSearchParams("workspaceId=1");
    render(<BillingSuccessPage />);
    await waitFor(() => {
      expect(screen.getByText("결제 처리에 실패했습니다")).toBeTruthy();
    });
  });

  it("에러 상태에서 구독 화면으로 이동 버튼 렌더링", async () => {
    mockSearchParams = new URLSearchParams("");
    render(<BillingSuccessPage />);
    await waitFor(() => {
      expect(screen.getByText("구독 화면으로 이동")).toBeTruthy();
    });
  });

  it("widget flow — 이미 처리된 orderId이면 navigate 호출", async () => {
    const { isOrderProcessed } = await import("@/features/pay-once");
    vi.mocked(isOrderProcessed).mockReturnValue(true);
    mockSearchParams = new URLSearchParams(
      "workspaceId=1&flow=widget&paymentKey=pay-key&orderId=dup-order&amount=9900",
    );
    render(<BillingSuccessPage />);
    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalled();
    });
  });
});
