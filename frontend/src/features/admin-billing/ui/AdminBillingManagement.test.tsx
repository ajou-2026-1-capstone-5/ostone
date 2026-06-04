import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { ApiRequestError } from "@/shared/api";
import {
  fetchAdminBillingCustomers,
  refundAdminBillingPayment,
  type AdminBillingCustomerResponse,
} from "../api/adminBillingApi";
import { AdminBillingManagement } from "./AdminBillingManagement";

vi.mock("../api/adminBillingApi", () => ({
  fetchAdminBillingCustomers: vi.fn(),
  refundAdminBillingPayment: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

const mockedFetchAdminBillingCustomers = vi.mocked(fetchAdminBillingCustomers);
const mockedRefundAdminBillingPayment = vi.mocked(refundAdminBillingPayment);

const customer: AdminBillingCustomerResponse = {
  workspaceId: 1,
  workspaceKey: "acme",
  workspaceName: "Acme",
  subscription: {
    status: "ACTIVE",
    currentPeriodStart: "2026-06-01T00:00:00Z",
    currentPeriodEnd: "2026-07-01T00:00:00Z",
    nextBillingAt: "2026-07-01T00:00:00Z",
    planName: "Pro",
    planAmount: 29000,
  },
  recentPayment: {
    id: 10,
    amount: 29000,
    status: "DONE",
    approvedAt: "2026-06-01T00:00:00Z",
  },
  failedStatus: null,
};

describe("AdminBillingManagement", () => {
  beforeEach(() => {
    mockedFetchAdminBillingCustomers.mockReset();
    mockedRefundAdminBillingPayment.mockReset();
  });

  it("고객사별 결제 현황을 표시한다", async () => {
    mockedFetchAdminBillingCustomers.mockResolvedValueOnce([customer]);

    render(<AdminBillingManagement />);

    expect(await screen.findByText("Acme")).toBeInTheDocument();
    expect(screen.getByText("acme")).toBeInTheDocument();
    expect(screen.getByText("ACTIVE")).toBeInTheDocument();
    expect(screen.getByText("DONE")).toBeInTheDocument();
  });

  it("조회 결과가 없으면 empty 상태를 표시한다", async () => {
    mockedFetchAdminBillingCustomers.mockResolvedValueOnce([]);

    render(<AdminBillingManagement />);

    expect(await screen.findByText("조회할 결제 현황이 없습니다.")).toBeInTheDocument();
  });

  it("조회 실패 후 다시 시도하면 목록을 표시한다", async () => {
    mockedFetchAdminBillingCustomers
      .mockRejectedValueOnce(new ApiRequestError(403, "FORBIDDEN", "권한이 없습니다."))
      .mockResolvedValueOnce([customer]);

    render(<AdminBillingManagement />);

    expect(await screen.findByRole("alert")).toHaveTextContent("권한이 없습니다.");
    await userEvent.click(screen.getByRole("button", { name: "다시 시도" }));

    expect(await screen.findByText("Acme")).toBeInTheDocument();
  });

  it("검색어에 맞는 고객사만 표시한다", async () => {
    mockedFetchAdminBillingCustomers.mockResolvedValueOnce([
      customer,
      {
        ...customer,
        workspaceId: 2,
        workspaceKey: "beta",
        workspaceName: "Beta",
        recentPayment: null,
        subscription: {
          status: null,
          currentPeriodStart: null,
          currentPeriodEnd: null,
          nextBillingAt: null,
          planName: null,
          planAmount: null,
        },
        failedStatus: "PAYMENT_FAILED",
      },
    ]);

    render(<AdminBillingManagement />);

    await screen.findByText("Acme");
    await userEvent.type(screen.getByLabelText("고객사 검색"), "beta");

    expect(screen.queryByText("Acme")).not.toBeInTheDocument();
    expect(screen.getByText("Beta")).toBeInTheDocument();
    expect(screen.getByText("결제 없음")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /전체 환불/ })).toBeDisabled();
  });

  it("환불 사유가 없으면 전체 환불 API를 호출하지 않는다", async () => {
    mockedFetchAdminBillingCustomers.mockResolvedValueOnce([customer]);

    render(<AdminBillingManagement />);

    await userEvent.click(await screen.findByRole("button", { name: /전체 환불/ }));
    const dialog = screen.getByRole("dialog");
    await userEvent.click(within(dialog).getByRole("button", { name: /전체 환불 실행/ }));

    expect(await within(dialog).findByRole("alert")).toHaveTextContent("환불 사유를 입력해주세요.");
    expect(mockedRefundAdminBillingPayment).not.toHaveBeenCalled();
  });

  it("환불 사유를 입력하면 전체 환불 API를 호출하고 목록을 다시 불러온다", async () => {
    mockedFetchAdminBillingCustomers.mockResolvedValue([customer]);
    mockedRefundAdminBillingPayment.mockResolvedValueOnce({
      paymentId: 10,
      workspaceId: 1,
      refundAmount: 29000,
      paymentStatus: "CANCELED",
      transactionKey: "tx_cancel_1",
      canceledAt: "2026-06-03T12:00:00Z",
      reason: "고객 요청",
    });

    render(<AdminBillingManagement />);

    await userEvent.click(await screen.findByRole("button", { name: /전체 환불/ }));
    const dialog = screen.getByRole("dialog");
    await userEvent.type(within(dialog).getByLabelText("환불 사유"), "고객 요청");
    await userEvent.click(within(dialog).getByRole("button", { name: /전체 환불 실행/ }));

    await waitFor(() => {
      expect(mockedRefundAdminBillingPayment).toHaveBeenCalledWith(10, "고객 요청");
    });
    await waitFor(() => {
      expect(mockedFetchAdminBillingCustomers).toHaveBeenCalledTimes(2);
    });
  });

  it("환불 API 실패 메시지를 dialog에 표시한다", async () => {
    mockedFetchAdminBillingCustomers.mockResolvedValueOnce([customer]);
    mockedRefundAdminBillingPayment.mockRejectedValueOnce(
      new ApiRequestError(409, "PAYMENT_ALREADY_REFUNDED", "이미 환불된 결제입니다."),
    );

    render(<AdminBillingManagement />);

    await userEvent.click(await screen.findByRole("button", { name: /전체 환불/ }));
    const dialog = screen.getByRole("dialog");
    await userEvent.type(within(dialog).getByLabelText("환불 사유"), "고객 요청");
    await userEvent.click(within(dialog).getByRole("button", { name: /전체 환불 실행/ }));

    expect(await within(dialog).findByRole("alert")).toHaveTextContent("이미 환불된 결제입니다.");
  });
});
