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
    fireEvent.click(screen.getByLabelText("메시지 전송"));

    expect(onSendMessage).toHaveBeenCalledWith("처리 도와드리겠습니다.", false);
    expect(screen.getByPlaceholderText("메시지를 입력하세요...")).toHaveValue("");
  });

  it("세션 상태 라벨을 헤더에 표시한다", () => {
    render(
      <ChatPanel
        customerName="김민지"
        channel="카카오톡"
        messages={[]}
        onSendMessage={vi.fn()}
        selectedMessageId={null}
        onSelectMessage={vi.fn()}
        sessionStatusLabel="내 상담 진행중"
      />,
    );

    expect(screen.getByText("내 상담 진행중")).toBeInTheDocument();
  });

  it("disabled 상태에서는 입력 컨트롤을 비활성화하고 전송하지 않는다", () => {
    const onSendMessage = vi.fn();

    render(
      <ChatPanel
        customerName="김민지"
        channel="카카오톡"
        messages={[]}
        onSendMessage={onSendMessage}
        selectedMessageId={null}
        onSelectMessage={vi.fn()}
        disabled
      />,
    );

    const noteToggle = screen.getByTitle("내부 메모 모드");
    const input = screen.getByPlaceholderText("메시지를 입력하세요...");
    const sendButton = screen.getByLabelText("메시지 전송");

    expect(noteToggle).toBeDisabled();
    expect(input).toBeDisabled();
    expect(sendButton).toBeDisabled();

    fireEvent.click(sendButton);
    expect(onSendMessage).not.toHaveBeenCalled();
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

    fireEvent.click(messageGroup);
    expect(onSelectMessage).toHaveBeenLastCalledWith("customer-1");

    fireEvent.keyDown(messageGroup, { key: "Enter" });
    expect(onSelectMessage).toHaveBeenLastCalledWith("customer-1");
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
    fireEvent.click(screen.getByLabelText("메시지 전송"));

    expect(onSendMessage).toHaveBeenCalledWith("메모로 남길 내용", true);
    expect(onSelectMessage).not.toHaveBeenCalled();
  });

  it("공백만 있는 메시지를 전송하려고 할 때 onSendMessage가 호출되지 않는다", () => {
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
    fireEvent.change(input, { target: { value: "   " } });

    const sendButton = screen.getByLabelText("메시지 전송");
    expect(sendButton).toBeDisabled();

    fireEvent.click(sendButton);
    expect(onSendMessage).not.toHaveBeenCalled();
  });

  it("한글 IME 입력 중일 때는 Enter 키로 메시지가 전송되지 않는다", () => {
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

    const textarea = screen.getByPlaceholderText("메시지를 입력하세요...");
    fireEvent.change(textarea, { target: { value: "안녕하세요" } });

    fireEvent.keyDown(textarea, {
      key: "Enter",
      isComposing: true,
      nativeEvent: { isComposing: true },
    });

    expect(onSendMessage).not.toHaveBeenCalled();
  });

  it("Shift+Enter는 메시지를 전송하지 않지만 Enter는 메시지를 전송한다", () => {
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

    const textarea = screen.getByPlaceholderText("메시지를 입력하세요...");

    fireEvent.change(textarea, { target: { value: "안녕하세요" } });
    fireEvent.keyDown(textarea, {
      key: "Enter",
      shiftKey: true,
      nativeEvent: { isComposing: false },
    });
    expect(onSendMessage).not.toHaveBeenCalled();

    fireEvent.keyDown(textarea, {
      key: "Enter",
      shiftKey: false,
      nativeEvent: { isComposing: false },
    });
    expect(onSendMessage).toHaveBeenCalledWith("안녕하세요", false);
  });

  it("이미 선택된 메시지를 다시 클릭하면 null을 인자로 전달하여 선택을 해제한다", () => {
    const onSelectMessage = vi.fn();

    render(
      <ChatPanel
        customerName="김민지"
        channel="카카오톡"
        messages={[
          {
            id: "msg-1",
            senderRole: "CUSTOMER",
            content: "환불 문의 드립니다.",
            timestamp: "10:02",
          },
        ]}
        onSendMessage={vi.fn()}
        selectedMessageId="msg-1"
        onSelectMessage={onSelectMessage}
      />,
    );

    const messageGroup = screen.getByText("환불 문의 드립니다.").closest('[role="button"]');
    if (!messageGroup) throw new Error("message group not found");

    fireEvent.click(messageGroup);
    expect(onSelectMessage).toHaveBeenCalledWith(null);
  });

  it("메시지가 선택된 상태에서 Space 키를 누르면 선택이 해제된다", () => {
    const onSelectMessage = vi.fn();

    render(
      <ChatPanel
        customerName="김민지"
        channel="카카오톡"
        messages={[
          {
            id: "msg-1",
            senderRole: "CUSTOMER",
            content: "환불 문의 드립니다.",
            timestamp: "10:02",
          },
        ]}
        onSendMessage={vi.fn()}
        selectedMessageId="msg-1"
        onSelectMessage={onSelectMessage}
      />,
    );

    const messageGroup = screen.getByText("환불 문의 드립니다.").closest('[role="button"]');
    if (!messageGroup) throw new Error("message group not found");

    fireEvent.keyDown(messageGroup, { key: " " });
    expect(onSelectMessage).toHaveBeenCalledWith(null);
  });

  it("메시지가 선택되지 않은 상태에서 Space 키를 누르면 메시지가 선택된다", () => {
    const onSelectMessage = vi.fn();

    render(
      <ChatPanel
        customerName="김민지"
        channel="카카오톡"
        messages={[
          {
            id: "msg-1",
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

    const messageGroup = screen.getByText("환불 문의 드립니다.").closest('[role="button"]');
    if (!messageGroup) throw new Error("message group not found");

    fireEvent.keyDown(messageGroup, { key: " " });
    expect(onSelectMessage).toHaveBeenCalledWith("msg-1");
  });

  it("COUNSELOR 및 ASSISTANT 메시지 역할을 렌더링하고 라벨을 표시한다", () => {
    render(
      <ChatPanel
        customerName="김민지"
        channel="카카오톡"
        messages={[
          {
            id: "counselor-1",
            senderRole: "COUNSELOR",
            content: "상담사 메시지 내용",
            timestamp: "10:05",
          },
          {
            id: "assistant-1",
            senderRole: "ASSISTANT",
            content: "AI 메시지 내용",
            timestamp: "10:06",
          },
        ]}
        onSendMessage={vi.fn()}
        selectedMessageId={null}
        onSelectMessage={vi.fn()}
      />,
    );

    expect(screen.getByText("상담사 메시지 내용")).toBeInTheDocument();
    expect(screen.getByText("상담사 ·")).toBeInTheDocument();
    expect(screen.getByText("C")).toBeInTheDocument();

    expect(screen.getByText("AI 메시지 내용")).toBeInTheDocument();
    expect(screen.getByText("AI ·")).toBeInTheDocument();
    expect(screen.getByText("A")).toBeInTheDocument();
  });
});
