import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApproveIntentDialog } from "./ApproveIntentDialog";

describe("ApproveIntentDialog", () => {
  const onOpenChange = vi.fn();
  const onConfirm = vi.fn();

  beforeEach(() => {
    onOpenChange.mockReset();
    onConfirm.mockReset();
  });

  it("publish action일 때 confirm 버튼 텍스트가 '승인'이다", () => {
    render(
      <ApproveIntentDialog
        intentName="order_cancel"
        action="publish"
        open={true}
        onOpenChange={onOpenChange}
        onConfirm={onConfirm}
        isLoading={false}
      />,
    );

    expect(screen.getByRole("button", { name: "승인" })).toBeInTheDocument();
  });

  it("reject action일 때 confirm 버튼 텍스트가 '반려'이다", () => {
    render(
      <ApproveIntentDialog
        intentName="order_cancel"
        action="reject"
        open={true}
        onOpenChange={onOpenChange}
        onConfirm={onConfirm}
        isLoading={false}
      />,
    );

    expect(screen.getByRole("button", { name: "반려" })).toBeInTheDocument();
  });

  it("isLoading=true일 때 confirm 버튼이 disabled이고 '처리 중...' 텍스트를 표시한다", () => {
    render(
      <ApproveIntentDialog
        intentName="order_cancel"
        action="publish"
        open={true}
        onOpenChange={onOpenChange}
        onConfirm={onConfirm}
        isLoading={true}
      />,
    );

    const confirmButton = screen.getByRole("button", { name: "처리 중..." });
    expect(confirmButton).toBeDisabled();
  });

  it("isLoading=true일 때 onOpenChange가 무시된다", () => {
    render(
      <ApproveIntentDialog
        intentName="order_cancel"
        action="publish"
        open={true}
        onOpenChange={onOpenChange}
        onConfirm={onConfirm}
        isLoading={true}
      />,
    );

    fireEvent.keyDown(document, { key: "Escape" });

    expect(onOpenChange).not.toHaveBeenCalled();
  });

  it("상담 유형 이름이 다이얼로그 제목과 설명에 표시된다", () => {
    render(
      <ApproveIntentDialog
        intentName="order_cancel"
        action="publish"
        open={true}
        onOpenChange={onOpenChange}
        onConfirm={onConfirm}
        isLoading={false}
      />,
    );

    expect(screen.getByText(/상담 유형 승인/)).toBeInTheDocument();
    expect(screen.getByText(/order_cancel/)).toBeInTheDocument();
  });
});
