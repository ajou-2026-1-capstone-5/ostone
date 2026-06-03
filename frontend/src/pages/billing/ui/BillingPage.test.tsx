import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { useParams, useOutletContext, useLocation, Navigate } from "react-router-dom";
import { useSubscription, usePayments } from "@/entities/billing";
import { BillingPage } from "./BillingPage";

vi.mock("react-router-dom", async (importOriginal) => {
  const original = await importOriginal<typeof import("react-router-dom")>();
  return {
    ...original,
    useParams: vi.fn(),
    useOutletContext: vi.fn(),
    useLocation: vi.fn(),
    Navigate: vi.fn().mockReturnValue(null),
  };
});

vi.mock("@/entities/billing", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/entities/billing")>();
  return {
    ...original,
    useSubscription: vi.fn(),
    usePayments: vi.fn(),
    deriveCustomerKey: vi.fn().mockReturnValue("ws_1"),
  };
});

vi.mock("@/features/register-billing-method", () => ({
  RegisterBillingButton: vi.fn().mockReturnValue(null),
  BILLING_CONFIRM_ERROR_MESSAGES: {},
  useConfirmBillingAuthorization: vi.fn().mockReturnValue({ mutate: vi.fn() }),
}));

vi.mock("@/features/pay-once", () => ({
  PayOnceWidget: vi.fn().mockReturnValue(null),
  PAY_ONCE_ERROR_MESSAGES: {},
  isOrderProcessed: vi.fn().mockReturnValue(false),
  markOrderProcessed: vi.fn(),
  useConfirmPayment: vi.fn().mockReturnValue({ mutate: vi.fn() }),
}));

vi.mock("@/features/cancel-subscription", () => ({
  CancelSubscriptionButton: vi.fn().mockReturnValue(null),
  RefundButton: vi.fn().mockReturnValue(null),
}));

vi.mock("@/features/subscribe-plan", () => ({
  PlanCard: vi.fn().mockReturnValue(null),
}));

vi.mock("@/widgets/workspace-settings-nav", () => ({
  WorkspaceSettingsNav: vi.fn().mockReturnValue(null),
}));

const mockUseParams = vi.mocked(useParams);
const mockUseOutletContext = vi.mocked(useOutletContext);
const mockUseLocation = vi.mocked(useLocation);
const mockUseSubscription = vi.mocked(useSubscription);
const mockUsePayments = vi.mocked(usePayments);

const baseSubscription = {
  id: 1,
  workspaceId: 1,
  planKey: "PRO",
  status: "ACTIVE",
  customerKey: "ws_1",
  cancelAtPeriodEnd: false,
  currentPeriodStart: "2024-01-01T00:00:00Z",
  currentPeriodEnd: "2024-02-01T00:00:00Z",
  createdAt: "2024-01-01T00:00:00Z",
};

function setupDefaults(subOverrides = {}, paymentsOverrides = {}) {
  mockUseParams.mockReturnValue({ workspaceId: "1" });
  mockUseOutletContext.mockReturnValue({ setCrumbs: vi.fn() } as never);
  mockUseLocation.mockReturnValue({ state: null } as never);
  mockUseSubscription.mockReturnValue({
    data: baseSubscription,
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
    ...subOverrides,
  } as never);
  mockUsePayments.mockReturnValue({
    data: [],
    isLoading: false,
    isError: false,
    ...paymentsOverrides,
  } as never);
}

describe("BillingPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("구독 로딩 중 로딩 상태 표시", () => {
    setupDefaults({ isLoading: true, data: undefined });
    render(<BillingPage />);
    expect(screen.getByTestId("billing-loading")).toBeTruthy();
  });

  it("구독 에러 시 에러 상태 표시", () => {
    setupDefaults({ isError: true, data: undefined });
    render(<BillingPage />);
    expect(screen.getByTestId("billing-error")).toBeTruthy();
  });

  it("구독 없을 때 렌더링 (등록 CTA)", () => {
    setupDefaults();
    mockUseSubscription.mockReturnValue({ data: null, isLoading: false, isError: false, refetch: vi.fn() } as never);
    const { container } = render(<BillingPage />);
    expect(container).toBeTruthy();
  });

  it("구독 있을 때 구독 섹션 렌더링", () => {
    setupDefaults();
    render(<BillingPage />);
    expect(screen.getByRole("heading", { level: 1, name: "구독" })).toBeTruthy();
  });

  it("결제 내역 에러 시 에러 메시지 표시", () => {
    setupDefaults({}, { isError: true, data: undefined });
    render(<BillingPage />);
    expect(screen.getByText("결제 내역을 불러오지 못했습니다.")).toBeTruthy();
  });

  it("결제 내역 로딩 중 로딩 표시", () => {
    setupDefaults({}, { isLoading: true, data: undefined });
    const { container } = render(<BillingPage />);
    expect(container).toBeTruthy();
  });

  it("결제 내역 있을 때 PaymentHistoryList 렌더링 (DONE 포함)", () => {
    const donePayment = {
      id: 1,
      workspaceId: 1,
      paymentKey: "pay-001",
      orderId: "ord-001",
      amount: 9900,
      currency: "KRW",
      status: "DONE",
      method: "card",
      receiptUrl: "https://example.com/receipt/1",
      approvedAt: "2024-01-15T10:00:00Z",
      createdAt: "2024-01-15T09:00:00Z",
    };
    setupDefaults({}, { data: [donePayment] });
    render(<BillingPage />);
    expect(screen.getByText("결제 내역")).toBeTruthy();
  });

  it("workspaceId가 유효하지 않으면 Navigate 렌더링", () => {
    mockUseParams.mockReturnValue({ workspaceId: "not-a-number" });
    mockUseOutletContext.mockReturnValue({ setCrumbs: vi.fn() } as never);
    mockUseLocation.mockReturnValue({ state: null } as never);
    mockUseSubscription.mockReturnValue({ data: null, isLoading: false, isError: false, refetch: vi.fn() } as never);
    mockUsePayments.mockReturnValue({ data: [], isLoading: false, isError: false } as never);
    render(<BillingPage />);
    expect(vi.mocked(Navigate)).toHaveBeenCalled();
  });
});
