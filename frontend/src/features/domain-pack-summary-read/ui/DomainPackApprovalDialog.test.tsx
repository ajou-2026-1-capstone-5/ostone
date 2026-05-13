import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DomainPackApprovalDialog } from "./DomainPackApprovalDialog";

describe("DomainPackApprovalDialog", () => {
  it("확인 클릭 시 onConfirm을 호출한다", () => {
    const onConfirm = vi.fn();
    render(
      <DomainPackApprovalDialog
        open
        onOpenChange={vi.fn()}
        onConfirm={onConfirm}
        isLoading={false}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "승인" }));

    expect(onConfirm).toHaveBeenCalled();
  });

  it("취소 클릭 시 onOpenChange(false)를 호출한다", () => {
    const onOpenChange = vi.fn();
    render(
      <DomainPackApprovalDialog
        open
        onOpenChange={onOpenChange}
        onConfirm={vi.fn()}
        isLoading={false}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "취소" }));

    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("pending 중 확인/취소 버튼이 disabled 된다", () => {
    render(
      <DomainPackApprovalDialog
        open
        onOpenChange={vi.fn()}
        onConfirm={vi.fn()}
        isLoading
      />,
    );

    expect(screen.getByRole("button", { name: "취소" })).toBeDisabled();
    expect(screen.getByRole("button", { name: /처리 중/ })).toBeDisabled();
  });
});
