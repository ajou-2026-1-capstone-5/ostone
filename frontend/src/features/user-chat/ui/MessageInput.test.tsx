import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MessageInput } from "./MessageInput";

describe("MessageInput", () => {
  it("지원하지 않는 파일 첨부 버튼을 노출하지 않는다", () => {
    render(<MessageInput onSend={vi.fn()} />);

    expect(screen.queryByRole("button", { name: "파일 첨부" })).not.toBeInTheDocument();
    expect(screen.queryByTestId("message-attach")).not.toBeInTheDocument();
  });

  it("입력 후 버튼 클릭으로 메시지를 전송하고 입력값을 비운다", () => {
    const onSend = vi.fn();
    render(<MessageInput onSend={onSend} />);

    fireEvent.change(screen.getByLabelText("메시지 입력"), { target: { value: "환불 문의" } });
    fireEvent.click(screen.getByRole("button", { name: "메시지 보내기" }));

    expect(onSend).toHaveBeenCalledWith("환불 문의");
    expect(screen.getByLabelText("메시지 입력")).toHaveValue("");
  });

  it("Enter 키로 메시지를 전송한다", () => {
    const onSend = vi.fn();
    render(<MessageInput onSend={onSend} />);

    fireEvent.change(screen.getByLabelText("메시지 입력"), { target: { value: "배송 문의" } });
    fireEvent.keyDown(screen.getByLabelText("메시지 입력"), { key: "Enter" });

    expect(onSend).toHaveBeenCalledWith("배송 문의");
  });

  it("한글 IME 조합 중 Enter 키는 메시지를 전송하지 않는다", () => {
    const onSend = vi.fn();
    render(<MessageInput onSend={onSend} />);

    const input = screen.getByLabelText("메시지 입력");
    fireEvent.change(input, { target: { value: "배송 문의" } });
    const event = new KeyboardEvent("keydown", { key: "Enter", bubbles: true });
    Object.defineProperty(event, "isComposing", { value: true });
    fireEvent(input, event);

    expect(onSend).not.toHaveBeenCalled();
  });

  it("빈 메시지는 전송하지 않는다", () => {
    const onSend = vi.fn();
    render(<MessageInput onSend={onSend} />);

    fireEvent.change(screen.getByLabelText("메시지 입력"), { target: { value: "   " } });
    fireEvent.click(screen.getByRole("button", { name: "메시지 보내기" }));

    expect(onSend).not.toHaveBeenCalled();
  });

  it("disabled 상태에서는 입력과 전송을 막는다", () => {
    const onSend = vi.fn();
    render(<MessageInput onSend={onSend} disabled />);

    expect(screen.getByLabelText("메시지 입력")).toBeDisabled();
    expect(screen.getByRole("button", { name: "메시지 보내기" })).toBeDisabled();
  });
});
