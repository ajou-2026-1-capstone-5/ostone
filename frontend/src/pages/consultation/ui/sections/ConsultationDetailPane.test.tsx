import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ConsultationDetailPane } from "./ConsultationDetailPane";
import type { ConsultationDetailContentProps } from "./ConsultationDetailContent";

vi.mock("./ConsultationDetailContent", () => ({
  ConsultationDetailContent: () => <div data-testid="detail-content" />,
}));

const contentProps: ConsultationDetailContentProps = {
  activeCustomer: null,
  activeCustomerId: null,
  activeCustomerName: "고객",
  selectedMessage: null,
  matchedWorkflow: null,
  isMatchedWorkflowLoading: false,
  isMessageDomainPackElementsLoading: false,
  messageDomainPackElementsError: null,
  memo: "",
  onMemoChange: () => {},
  onOpenDomainPackElement: () => {},
  onCloseMessageDetail: () => {},
};

describe("ConsultationDetailPane", () => {
  it("renders the inline detail pane (no drawer) on desktop", () => {
    render(
      <ConsultationDetailPane
        {...contentProps}
        isNarrow={false}
        isOpen={false}
        onClose={vi.fn()}
      />,
    );
    expect(screen.getByTestId("detail-content")).toBeInTheDocument();
    expect(screen.queryByRole("complementary")).not.toBeInTheDocument();
  });

  it("renders a non-modal complementary drawer on narrow screens", () => {
    render(<ConsultationDetailPane {...contentProps} isNarrow isOpen={false} onClose={vi.fn()} />);
    const drawer = screen.getByRole("complementary", { name: "고객 컨텍스트" });
    expect(drawer).toBeInTheDocument();
    expect(screen.getByTestId("detail-content")).toBeInTheDocument();
  });

  it("moves focus to the close button when opened and closes on click or Escape", () => {
    const onClose = vi.fn();
    const { rerender } = render(
      <ConsultationDetailPane {...contentProps} isNarrow isOpen onClose={onClose} />,
    );
    const closeButton = screen.getByRole("button", { name: "컨텍스트 닫기" });
    expect(closeButton).toHaveFocus();

    fireEvent.click(closeButton);
    expect(onClose).toHaveBeenCalledTimes(1);

    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(2);

    // Esc no longer fires once the panel is closed.
    rerender(
      <ConsultationDetailPane {...contentProps} isNarrow isOpen={false} onClose={onClose} />,
    );
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it("does not steal focus from another field when the parent re-renders with a new onClose", () => {
    const ui = (onClose: () => void) => (
      <>
        <input data-testid="outside-input" />
        <ConsultationDetailPane {...contentProps} isNarrow isOpen onClose={onClose} />
      </>
    );
    const { rerender } = render(ui(vi.fn()));
    expect(screen.getByRole("button", { name: "컨텍스트 닫기" })).toHaveFocus();

    // 상담사가 작성칸(외부 입력)으로 focus를 옮긴 뒤 부모가 새 onClose 참조로 리렌더.
    const input = screen.getByTestId("outside-input");
    input.focus();
    expect(input).toHaveFocus();

    rerender(ui(vi.fn()));

    // effect가 재실행되지 않아 focus를 닫기 버튼으로 빼앗지 않는다.
    expect(input).toHaveFocus();
  });
});
