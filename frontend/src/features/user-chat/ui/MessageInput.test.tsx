import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MessageInput } from "./MessageInput";

describe("MessageInput", () => {
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
