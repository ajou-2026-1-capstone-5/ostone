import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MessageDetailPanel } from "./MessageDetailPanel";

describe("MessageDetailPanel", () => {
  /* ─── Test 1: empty state ─── */
  it("shows empty state when message is null", () => {
    render(
      <MessageDetailPanel
        message={null}
        domainPackElements={{ slots: [], policies: [], risks: [] }}
        onClose={() => {}}
      />,
    );

    expect(screen.getByText("메시지를 선택하세요")).toBeInTheDocument();

    const aside = document.querySelector("aside");
    expect(aside).toBeInTheDocument();

    expect(screen.queryByText("Slot")).not.toBeInTheDocument();
    expect(screen.queryByText("Policy")).not.toBeInTheDocument();
    expect(screen.queryByText("Risk")).not.toBeInTheDocument();
  });

  /* ─── Test 2: message header ─── */
  it("renders message header with sender role, content, and timestamp", () => {
    render(
      <MessageDetailPanel
        message={{
          id: "1",
          senderRole: "CUSTOMER",
          content: "테스트 메시지입니다",
          timestamp: "14:30",
        }}
        domainPackElements={{ slots: [], policies: [], risks: [] }}
        onClose={() => {}}
      />,
    );

    expect(screen.getByText("CUSTOMER")).toBeInTheDocument();
    expect(screen.getByText("테스트 메시지입니다")).toBeInTheDocument();
    expect(screen.getByText("14:30")).toBeInTheDocument();
  });

  /* ─── Test 3: Slot tags ─── */
  it("renders Slot tags from MOCK_DATA", () => {
    render(
      <MessageDetailPanel
        message={{
          id: "1",
          senderRole: "CUSTOMER",
          content: "test",
          timestamp: "12:00",
        }}
        onClose={() => {}}
      />,
    );

    expect(screen.getByText("가격 문의")).toBeInTheDocument();
    expect(screen.getByText("89,000원")).toBeInTheDocument();
    expect(screen.getByText("배송지 주소")).toBeInTheDocument();
  });

  /* ─── Test 4: Policy tags ─── */
  it("renders Policy tags from MOCK_DATA", () => {
    render(
      <MessageDetailPanel
        message={{
          id: "1",
          senderRole: "CUSTOMER",
          content: "test",
          timestamp: "12:00",
        }}
        onClose={() => {}}
      />,
    );

    expect(screen.getByText("반품 정책")).toBeInTheDocument();
    expect(screen.getByText("환불 정책")).toBeInTheDocument();
    expect(screen.getByText("교환 정책")).toBeInTheDocument();
  });

  /* ─── Test 5: Risk tags ─── */
  it("renders Risk tags from MOCK_DATA", () => {
    render(
      <MessageDetailPanel
        message={{
          id: "1",
          senderRole: "CUSTOMER",
          content: "test",
          timestamp: "12:00",
        }}
        onClose={() => {}}
      />,
    );

    expect(screen.getByText("고객 불만 고조")).toBeInTheDocument();
    expect(screen.getByText("환불 요청")).toBeInTheDocument();
    expect(screen.getByText("법적 대응")).toBeInTheDocument();
  });

  /* ─── Test 6: Close button ─── */
  it("calls onClose when close button is clicked", () => {
    const onClose = vi.fn();

    render(
      <MessageDetailPanel
        message={{
          id: "1",
          senderRole: "CUSTOMER",
          content: "test",
          timestamp: "12:00",
        }}
        domainPackElements={{ slots: [], policies: [], risks: [] }}
        onClose={onClose}
      />,
    );

    fireEvent.click(screen.getByText("닫기"));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
