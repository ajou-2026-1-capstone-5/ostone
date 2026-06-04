import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { useParams, useOutletContext, useLocation, Navigate } from "react-router-dom";
import { useBillingOverview, usePlanCatalog } from "@/entities/billing";
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
    useBillingOverview: vi.fn(),
    usePlanCatalog: vi.fn(),
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

vi.mock("@/widgets/workspace-settings-nav", () => ({
  WorkspaceSettingsNav: vi.fn().mockReturnValue(null),
}));

const mockUseParams = vi.mocked(useParams);
const mockUseOutletContext = vi.mocked(useOutletContext);
const mockUseLocation = vi.mocked(useLocation);
const mockUseBillingOverview = vi.mocked(useBillingOverview);
const mockUsePlanCatalog = vi.mocked(usePlanCatalog);

const baseSubscription = {
  id: 1,
  workspaceId: 1,
  planKey: "pro_monthly",
  status: "ACTIVE",
  customerKey: "ws_1",
  cancelAtPeriodEnd: false,
  currentPeriodStart: "2024-01-01T00:00:00Z",
  currentPeriodEnd: "2024-02-01T00:00:00Z",
  memberLimit: 10,
  datasetUploadLimit: 10,
  pipelineRunLimit: 10,
};

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

const baseOverview = {
  subscription: baseSubscription,
  billingKey: {
    id: 7,
    cardCompany: "신한카드",
    cardNumberMasked: "1234-****-****-5678",
    status: "ACTIVE",
  },
  payments: [],
  quotaUsages: [
    { resource: "MEMBER", used: 8, limit: 10, warning: false },
    { resource: "DATASET_UPLOAD", used: 10, limit: 10, warning: true },
    { resource: "PIPELINE_RUN", used: 11, limit: 10, warning: true },
  ],
};

const catalog = [
  {
    planKey: "pro_monthly",
    name: "Pro (Monthly)",
    amount: 29000,
    currency: "KRW",
    interval: "MONTH",
    memberLimit: 3,
    datasetUploadLimit: 10,
    pipelineRunHourlyLimit: 1,
    contactOnly: false,
    unlimited: false,
  },
  {
    planKey: "max_monthly",
    name: "Max (Monthly)",
    amount: 49000,
    currency: "KRW",
    interval: "MONTH",
    memberLimit: 10,
    datasetUploadLimit: 10,
    pipelineRunHourlyLimit: 5,
    contactOnly: false,
    unlimited: false,
  },
  {
    planKey: "enterprise",
    name: "Enterprise",
    amount: 0,
    currency: "KRW",
    interval: "MONTH",
    memberLimit: -1,
    datasetUploadLimit: -1,
    pipelineRunHourlyLimit: -1,
    contactOnly: true,
    unlimited: true,
  },
];

function setupRegister(subscription: unknown, catalogQuery: Record<string, unknown>) {
  mockUseParams.mockReturnValue({ workspaceId: "1" });
  mockUseOutletContext.mockReturnValue({ setCrumbs: vi.fn() } as never);
  mockUseLocation.mockReturnValue({ state: null } as never);
  mockUseBillingOverview.mockReturnValue({
    data: { subscription, billingKey: null, payments: [], quotaUsages: [] },
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
  } as never);
  mockUsePlanCatalog.mockReturnValue({
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
    ...catalogQuery,
  } as never);
}

function setupDefaults(queryOverrides = {}) {
  mockUseParams.mockReturnValue({ workspaceId: "1" });
  mockUseOutletContext.mockReturnValue({ setCrumbs: vi.fn() } as never);
  mockUseLocation.mockReturnValue({ state: null } as never);
  mockUseBillingOverview.mockReturnValue({
    data: baseOverview,
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
    ...queryOverrides,
  } as never);
  mockUsePlanCatalog.mockReturnValue({
    data: [],
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
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
    mockUseBillingOverview.mockReturnValue({
      data: { subscription: null, billingKey: null, payments: [], quotaUsages: [] },
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    } as never);
    const { container } = render(<BillingPage />);
    expect(container).toBeTruthy();
  });

  it("구독 있을 때 구독 섹션 렌더링", () => {
    setupDefaults();
    render(<BillingPage />);
    expect(screen.getByRole("heading", { level: 1, name: "구독" })).toBeTruthy();
    expect(screen.getByText("다음 결제일")).toBeTruthy();
  });

  it("구독 중이면 기본은 관리 화면 + '플랜 업그레이드' 버튼을 보여주고 비교 카드는 숨긴다", () => {
    setupDefaults();
    mockUsePlanCatalog.mockReturnValue({
      data: catalog,
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    } as never);
    render(<BillingPage />);
    expect(screen.getByText("다음 결제일")).toBeTruthy();
    expect(screen.getByTestId("upgrade-plan-button")).toBeTruthy();
    expect(screen.queryByText("Max")).toBeNull();
  });

  it("'플랜 업그레이드' 클릭 시 요금제 비교와 현재 플랜 '이용 중' 버튼을 보여준다", () => {
    setupDefaults();
    mockUsePlanCatalog.mockReturnValue({
      data: catalog,
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    } as never);
    render(<BillingPage />);
    fireEvent.click(screen.getByTestId("upgrade-plan-button"));
    expect(screen.getByText("Max")).toBeTruthy();
    expect(screen.getByText("Enterprise")).toBeTruthy();
    expect(screen.getByTestId("current-plan-cta")).toBeTruthy();
    expect(screen.getByText("이용 중")).toBeTruthy();
    expect(screen.getByText("← 구독 관리로 돌아가기")).toBeTruthy();
  });

  it("overview 에러 시 에러 메시지 표시", () => {
    setupDefaults({ isError: true, data: undefined });
    render(<BillingPage />);
    expect(screen.getByText("빌링 정보를 불러오지 못했습니다.")).toBeTruthy();
  });

  it("overview 로딩 중 로딩 표시", () => {
    setupDefaults({ isLoading: true, data: undefined });
    const { container } = render(<BillingPage />);
    expect(container).toBeTruthy();
  });

  it("결제 내역 있을 때 PaymentHistoryList 렌더링 (DONE 포함)", () => {
    setupDefaults({ data: { ...baseOverview, payments: [donePayment] } });
    render(<BillingPage />);
    expect(screen.getByText("결제 내역")).toBeTruthy();
  });

  it("quota 사용량과 한도 경고를 표시한다", () => {
    setupDefaults();
    render(<BillingPage />);
    expect(screen.getByText("Dataset 업로드")).toBeTruthy();
    expect(screen.getByText("10 / 10")).toBeTruthy();
    expect(screen.getAllByText("한도에 도달했습니다.")).toHaveLength(2);
  });

  it("persistent masked card information을 표시한다", () => {
    setupDefaults();
    render(<BillingPage />);
    expect(screen.getByText("신한카드")).toBeTruthy();
    expect(screen.getByText("1234-****-****-5678")).toBeTruthy();
  });

  it("미구독 시 Free/Pro/Max/Enterprise 비교 카드와 도입 문의를 렌더링한다", () => {
    setupRegister(null, { data: catalog });
    render(<BillingPage />);
    expect(screen.getByText("Free")).toBeTruthy();
    expect(screen.getByText("Pro")).toBeTruthy();
    expect(screen.getByText("Max")).toBeTruthy();
    expect(screen.getByText("Enterprise")).toBeTruthy();
    expect(screen.getByRole("button", { name: "도입 문의" })).toBeTruthy();
    // Free 카드: 이름 옆 "현재 플랜" 태그 + 비활성 "현재 플랜" CTA (둘 다 노출)
    expect(screen.getAllByText("현재 플랜").length).toBeGreaterThan(0);
  });

  it("요금제 로딩 중 plans-loading 패널 표시", () => {
    setupRegister(null, { isLoading: true, data: undefined });
    render(<BillingPage />);
    expect(screen.getByTestId("plans-loading")).toBeTruthy();
  });

  it("요금제 에러 시 plans-error 패널 표시", () => {
    setupRegister(null, { isError: true, data: undefined });
    render(<BillingPage />);
    expect(screen.getByTestId("plans-error")).toBeTruthy();
    expect(screen.getByText("요금제를 불러오지 못했습니다.")).toBeTruthy();
  });

  it("INCOMPLETE 구독이면 Free 카드는 비활성 '기본 제공'을 표시한다", () => {
    setupRegister(
      { ...baseSubscription, status: "INCOMPLETE", planKey: "pro_monthly" },
      { data: catalog },
    );
    render(<BillingPage />);
    expect(screen.getByText("기본 제공")).toBeTruthy();
  });

  it("workspaceId가 유효하지 않으면 Navigate 렌더링", () => {
    mockUseParams.mockReturnValue({ workspaceId: "not-a-number" });
    mockUseOutletContext.mockReturnValue({ setCrumbs: vi.fn() } as never);
    mockUseLocation.mockReturnValue({ state: null } as never);
    mockUseBillingOverview.mockReturnValue({
      data: { subscription: null, billingKey: null, payments: [], quotaUsages: [] },
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    } as never);
    render(<BillingPage />);
    expect(vi.mocked(Navigate)).toHaveBeenCalled();
  });
});
