import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { RegisterBillingButton } from "./RegisterBillingButton";
import { useRegisterBilling } from "../api/useRegisterBilling";
import { isTossClientKeyConfigured } from "@/shared/lib/toss/loadToss";

vi.mock("../api/useRegisterBilling");
vi.mock("@/shared/lib/toss/loadToss", () => ({
  loadToss: vi.fn(),
  isTossClientKeyConfigured: vi.fn().mockReturnValue(false),
  TossClientKeyMissingError: class extends Error {},
}));

const mockUseRegisterBilling = vi.mocked(useRegisterBilling);
const mockIsTossClientKeyConfigured = vi.mocked(isTossClientKeyConfigured);
const mockMutate = vi.fn();

describe("RegisterBillingButton", () => {
  beforeEach(() => {
    mockMutate.mockReset();
    mockIsTossClientKeyConfigured.mockReturnValue(false);
    mockUseRegisterBilling.mockReturnValue({
      mutate: mockMutate,
      isPending: false,
    } as never);
  });

  it("기본 label을 렌더링한다", () => {
    render(<RegisterBillingButton workspaceId={1} subscription={null} />);
    expect(screen.getByText("카드 등록하고 구독 시작")).toBeTruthy();
  });

  it("커스텀 label을 렌더링한다", () => {
    render(<RegisterBillingButton workspaceId={1} subscription={null} label="카드 재등록" />);
    expect(screen.getByText("카드 재등록")).toBeTruthy();
  });

  it("clientKey 미설정 시 버튼 비활성화", () => {
    const { container } = render(<RegisterBillingButton workspaceId={1} subscription={null} />);
    const btn = container.querySelector("button");
    expect(btn?.disabled).toBe(true);
  });

  it("clientKey 설정 시 버튼 클릭 가능 — mutate 호출", () => {
    mockIsTossClientKeyConfigured.mockReturnValue(true);
    render(<RegisterBillingButton workspaceId={1} subscription={null} />);
    const btn = screen.getByRole("button");
    expect(btn).not.toBeDisabled();
    fireEvent.click(btn);
    expect(mockMutate).toHaveBeenCalledWith({ workspaceId: 1, subscription: null });
  });

  it("isPending 상태에서 결제창 이동 텍스트 표시", () => {
    mockUseRegisterBilling.mockReturnValue({
      mutate: mockMutate,
      isPending: true,
    } as never);
    mockIsTossClientKeyConfigured.mockReturnValue(true);
    render(<RegisterBillingButton workspaceId={1} subscription={null} />);
    expect(screen.getByText("결제창으로 이동 중…")).toBeTruthy();
  });
});
