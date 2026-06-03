import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { PayOnceWidget } from "./PayOnceWidget";

vi.mock("@/shared/lib/toss/loadToss", () => ({
  loadToss: vi.fn().mockRejectedValue(new Error("toss not loaded")),
  isTossClientKeyConfigured: vi.fn().mockReturnValue(false),
  TossClientKeyMissingError: class extends Error {},
}));

vi.mock("sonner", () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));

vi.mock("@/shared/lib/billingRoutes", () => ({
  buildBillingSuccessUrl: vi.fn().mockReturnValue("http://localhost/billing/success"),
  buildBillingFailUrl: vi.fn().mockReturnValue("http://localhost/billing/fail"),
  BILLING_FLOW: { billing: "billing", widget: "widget" },
}));

describe("PayOnceWidget", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("초기 상태에서 결제 진행 버튼이 비활성화", () => {
    render(<PayOnceWidget workspaceId={1} customerKey="ws_1" />);
    const btn = screen.getByRole("button", { name: /결제 진행/ });
    expect(btn).toBeTruthy();
    expect(btn).toBeDisabled();
  });

  it("섹션 heading 렌더링", () => {
    render(<PayOnceWidget workspaceId={1} customerKey="ws_1" />);
    expect(screen.getByText("일회성 결제")).toBeTruthy();
  });

  it("설명 텍스트 렌더링", () => {
    render(<PayOnceWidget workspaceId={1} customerKey="ws_1" />);
    expect(screen.getByText(/단건\s*결제합니다/)).toBeTruthy();
  });

  it("clientKey 설정 시 버튼 클릭 가능", async () => {
    const { isTossClientKeyConfigured } = await import("@/shared/lib/toss/loadToss");
    vi.mocked(isTossClientKeyConfigured).mockReturnValue(true);
    render(<PayOnceWidget workspaceId={1} customerKey="ws_1" />);
    const btn = screen.getByRole("button", { name: /결제 진행/ });
    expect(btn).not.toBeDisabled();
  });

  it("버튼 클릭 후 위젯 로딩 상태", async () => {
    const { isTossClientKeyConfigured } = await import("@/shared/lib/toss/loadToss");
    vi.mocked(isTossClientKeyConfigured).mockReturnValue(true);
    render(<PayOnceWidget workspaceId={1} customerKey="ws_1" />);
    const btn = screen.getByRole("button", { name: /결제 진행/ });
    fireEvent.click(btn);
    expect(screen.getByText(/결제 위젯을 불러오는 중입니다/)).toBeTruthy();
  });
});
