import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { QueuePanel } from "./QueuePanel";

const makeCustomer = (id: string, extra?: Partial<Parameters<typeof QueuePanel>[0]["customers"][0]>) => ({
  id,
  name: `고객${id}`,
  channel: "CHAT",
  handoffReason: "환불 문의",
  waitMinutes: 2,
  hasUnread: false,
  ...extra,
});

describe("QueuePanel", () => {
  it("고객이 없으면 빈 상태 메시지를 표시한다", () => {
    render(<QueuePanel customers={[]} activeCustomerId={null} onSelectCustomer={vi.fn()} />);
    expect(screen.getByText("대기중인 고객이 없습니다")).toBeInTheDocument();
  });

  it("대기 고객 수를 헤더에 표시한다", () => {
    const customers = [makeCustomer("1"), makeCustomer("2")];
    render(<QueuePanel customers={customers} activeCustomerId={null} onSelectCustomer={vi.fn()} />);
    expect(screen.getByText("2명 대기중")).toBeInTheDocument();
  });

  it("고객 이름과 handoffReason을 표시한다", () => {
    render(
      <QueuePanel
        customers={[makeCustomer("1", { handoffReason: "카드 오류" })]}
        activeCustomerId={null}
        onSelectCustomer={vi.fn()}
      />,
    );
    expect(screen.getByText("고객1")).toBeInTheDocument();
    expect(screen.getByText("카드 오류")).toBeInTheDocument();
  });

  it("고객 이름이 없으면 Unknown을 표시한다", () => {
    render(
      <QueuePanel
        customers={[makeCustomer("1", { name: undefined })]}
        activeCustomerId={null}
        onSelectCustomer={vi.fn()}
      />,
    );

    expect(screen.getByText("Unknown")).toBeInTheDocument();
  });

  it("클릭하면 onSelectCustomer가 호출된다", () => {
    const onSelect = vi.fn();
    render(
      <QueuePanel customers={[makeCustomer("42")]} activeCustomerId={null} onSelectCustomer={onSelect} />,
    );
    fireEvent.click(screen.getByRole("button"));
    expect(onSelect).toHaveBeenCalledWith("42");
  });

  it("Enter 키로 onSelectCustomer가 호출된다", () => {
    const onSelect = vi.fn();
    render(
      <QueuePanel customers={[makeCustomer("5")]} activeCustomerId={null} onSelectCustomer={onSelect} />,
    );
    fireEvent.keyDown(screen.getByRole("button"), { key: "Enter" });
    expect(onSelect).toHaveBeenCalledWith("5");
  });

  it("스페이스 키로 onSelectCustomer가 호출된다", () => {
    const onSelect = vi.fn();
    render(
      <QueuePanel customers={[makeCustomer("7")]} activeCustomerId={null} onSelectCustomer={onSelect} />,
    );
    fireEvent.keyDown(screen.getByRole("button"), { key: " " });
    expect(onSelect).toHaveBeenCalledWith("7");
  });

  it("다른 키는 onSelectCustomer를 호출하지 않는다", () => {
    const onSelect = vi.fn();
    render(
      <QueuePanel customers={[makeCustomer("8")]} activeCustomerId={null} onSelectCustomer={onSelect} />,
    );
    fireEvent.keyDown(screen.getByRole("button"), { key: "Tab" });
    expect(onSelect).not.toHaveBeenCalled();
  });

  it("hasUnread가 true이면 읽지 않음 표시가 나타난다", () => {
    render(
      <QueuePanel
        customers={[makeCustomer("9", { hasUnread: true })]}
        activeCustomerId={null}
        onSelectCustomer={vi.fn()}
      />,
    );
    expect(document.querySelector('[class*="unreadDot"]')).toBeInTheDocument();
  });

  it("대기 시간을 표시한다", () => {
    render(
      <QueuePanel
        customers={[makeCustomer("10", { waitMinutes: 5 })]}
        activeCustomerId={null}
        onSelectCustomer={vi.fn()}
      />,
    );
    expect(screen.getByText("5분 전")).toBeInTheDocument();
  });
});
