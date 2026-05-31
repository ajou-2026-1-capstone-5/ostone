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

    expect(screen.getByText("고객")).toBeInTheDocument();
    expect(screen.queryByText("CUSTOMER")).not.toBeInTheDocument();
    expect(screen.getByText("테스트 메시지입니다")).toBeInTheDocument();
    expect(screen.getByText("14:30")).toBeInTheDocument();
  });

  /* ─── Test 3: domain empty state ─── */
  it("shows a stable domain pack empty state when elements are not connected", () => {
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

    expect(screen.getByText("연결된 도메인 팩 요소가 없습니다")).toBeInTheDocument();
    expect(
      screen.getByText("Slot, Policy, Risk 추출 결과가 연결되면 이 영역에 표시됩니다."),
    ).toBeInTheDocument();
    expect(screen.queryByText("가격 문의")).not.toBeInTheDocument();
  });

  /* ─── Test 4: domain elements ─── */
  it("renders connected Slot, Policy, and Risk tags", () => {
    render(
      <MessageDetailPanel
        message={{
          id: "1",
          senderRole: "CUSTOMER",
          content: "test",
          timestamp: "12:00",
        }}
        domainPackElements={{
          slots: [
            { name: "가격 문의", extracted: true, value: "89,000원" },
            { name: "배송지 주소", extracted: false },
          ],
          policies: [
            { name: "반품 정책", extracted: true, matched: true },
            { name: "환불 정책", extracted: true, matched: false },
          ],
          risks: [
            { name: "고객 불만 고조", extracted: true, level: "high" as const },
            { name: "환불 요청", extracted: true, level: "medium" as const },
          ],
        }}
        onClose={() => {}}
      />,
    );

    expect(screen.queryByTestId("message-domain-empty")).not.toBeInTheDocument();
    expect(screen.getByText("가격 문의")).toBeInTheDocument();
    expect(screen.getByText("89,000원")).toBeInTheDocument();
    expect(screen.getByText("배송지 주소")).toBeInTheDocument();
    expect(screen.getByText("반품 정책")).toBeInTheDocument();
    expect(screen.getByText("환불 정책")).toBeInTheDocument();
    expect(screen.getByText("고객 불만 고조")).toBeInTheDocument();
    expect(screen.getByText("환불 요청")).toBeInTheDocument();
  });

  /* ─── Test 5: partially connected elements ─── */
  it("shows section-level empty labels for missing element groups", () => {
    render(
      <MessageDetailPanel
        message={{
          id: "1",
          senderRole: "CUSTOMER",
          content: "test",
          timestamp: "12:00",
        }}
        domainPackElements={{
          slots: [{ name: "주문 번호", extracted: true, value: "#ORD-1" }],
          policies: [],
          risks: [],
        }}
        onClose={() => {}}
      />,
    );

    expect(screen.getByText("주문 번호")).toBeInTheDocument();
    expect(screen.getByText("매칭된 policy 없음")).toBeInTheDocument();
    expect(screen.getByText("감지된 risk 없음")).toBeInTheDocument();
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
