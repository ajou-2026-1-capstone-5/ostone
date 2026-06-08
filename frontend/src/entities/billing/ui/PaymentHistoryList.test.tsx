import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PaymentHistoryList } from "./PaymentHistoryList";
import type { PaymentResponse } from "../model/types";

const stubPayment: PaymentResponse = {
  id: 1,
  workspaceId: 1,
  paymentKey: "pay-001",
  orderId: "order-001",
  amount: 9900,
  currency: "KRW",
  status: "DONE",
  method: "card",
  receiptUrl: "https://example.com/receipt/1",
  approvedAt: "2024-01-15T10:00:00Z",
  createdAt: "2024-01-15T09:59:00Z",
};

describe("PaymentHistoryList", () => {
  it("결제 내역을 렌더링한다", () => {
    render(<PaymentHistoryList payments={[stubPayment]} />);
    expect(screen.getByRole("heading", { name: "결제 내역" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "영수증 보기" })).toHaveAttribute(
      "href",
      stubPayment.receiptUrl,
    );
  });

  it("빈 목록도 에러 없이 렌더링", () => {
    render(<PaymentHistoryList payments={[]} />);
    expect(screen.getByRole("heading", { name: "결제 내역" })).toBeInTheDocument();
  });

  it("receiptUrl 없으면 '-' 표시", () => {
    const noReceiptPayment: PaymentResponse = { ...stubPayment, receiptUrl: undefined };
    render(<PaymentHistoryList payments={[noReceiptPayment]} />);
    expect(screen.getAllByText("-").length).toBeGreaterThan(0);
  });

  it("renderActions prop이 있으면 관리 컬럼 표시", () => {
    render(
      <PaymentHistoryList
        payments={[stubPayment]}
        renderActions={() => <button type="button">환불</button>}
      />,
    );
    expect(screen.getByRole("button", { name: "환불" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "관리" })).toBeInTheDocument();
  });
});
