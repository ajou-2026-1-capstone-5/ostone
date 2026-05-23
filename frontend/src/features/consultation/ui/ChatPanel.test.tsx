import { describe, expect, it, vi } from "vitest";
import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { ChatPanel } from "./ChatPanel";

describe("ChatPanel", () => {
  it("고객이 선택되지 않으면 빈 상태 안내를 보여준다", () => {
    render(
      <ChatPanel
        customerName={null}
        channel={null}
        messages={[]}
        onSendMessage={vi.fn()}
        selectedMessageId={null}
        onSelectMessage={vi.fn()}
      />,
    );

    expect(screen.getByText("좌측 대기 목록에서 고객을 선택해주세요")).toBeInTheDocument();
    expect(screen.queryByPlaceholderText("메시지를 입력하세요...")).not.toBeInTheDocument();
  });


  it("일반 메시지를 전송하면 입력값이 비워진다", () => {
    const onSendMessage = vi.fn();

    render(
      <ChatPanel
        customerName="김민지"
        channel="카카오톡"
        messages={[]}
        onSendMessage={onSendMessage}
        selectedMessageId={null}
        onSelectMessage={vi.fn()}
      />,
    );

    const input = screen.getByPlaceholderText("메시지를 입력하세요...");
    fireEvent.change(input, { target: { value: "  처리 도와드리겠습니다.  " } });
    fireEvent.click(screen.getAllByRole("button")[1]);

    expect(onSendMessage).toHaveBeenCalledWith("처리 도와드리겠습니다.", false);
    expect(screen.getByPlaceholderText("메시지를 입력하세요...")).toHaveValue("");
  });

  it("고객 메시지는 선택할 수 있고 키보드로도 선택된다", () => {
    const onSelectMessage = vi.fn();

    render(
      <ChatPanel
        customerName="김민지"
        channel="카카오톡"
        messages={[
          {
            id: "customer-1",
            senderRole: "CUSTOMER",
            content: "환불 문의 드립니다.",
            timestamp: "10:02",
          },
        ]}
        onSendMessage={vi.fn()}
        selectedMessageId={null}
        onSelectMessage={onSelectMessage}
      />,
    );

    expect(screen.getByText("김민지")).toBeInTheDocument();
    expect(screen.getByText("환불 문의 드립니다.")).toBeInTheDocument();

    const messageGroup = screen.getByText("환불 문의 드립니다.").closest('[role="button"]');
    if (!messageGroup) throw new Error("message group not found");

    fireEvent.keyDown(messageGroup, { key: "Enter" });

    expect(onSelectMessage).toHaveBeenCalledWith("customer-1");
  });
  it("시스템 메시지와 내부 메모를 렌더링하고 메모 모드로 전송한다", () => {
    const onSendMessage = vi.fn();
    const onSelectMessage = vi.fn();

    render(
      <ChatPanel
        customerName="김민지"
        channel="카카오톡"
        messages={[
          {
            id: "system-1",
            senderRole: "SYSTEM",
            content: "상담이 시작되었습니다",
            timestamp: "10:00",
          },
          {
            id: "note-1",
            senderRole: "NOTE",
            content: "내부 메모 내용",
            timestamp: "10:01",
          },
        ]}
        onSendMessage={onSendMessage}
        selectedMessageId={null}
        onSelectMessage={onSelectMessage}
      />,
    );

    expect(screen.getByText("상담이 시작되었습니다")).toBeInTheDocument();
    expect(screen.getByText("📝 내부 메모")).toBeInTheDocument();
    expect(screen.getByText("내부 메모 내용")).toBeInTheDocument();

    fireEvent.click(screen.getByTitle("내부 메모 모드"));

    const input = screen.getByPlaceholderText("내부 메모를 입력하세요 (고객에게 보이지 않음)...");
    fireEvent.change(input, { target: { value: "메모로 남길 내용" } });
    fireEvent.click(screen.getAllByRole("button")[1]);

    expect(onSendMessage).toHaveBeenCalledWith("메모로 남길 내용", true);
    expect(onSelectMessage).not.toHaveBeenCalled();
  });
});
