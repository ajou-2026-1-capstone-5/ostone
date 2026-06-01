import { describe, it, expect, vi } from "vite-plus/test";
import { render, screen, fireEvent } from "@testing-library/react";
import { Message, HandoffDivider } from "./Message";
import { Queue } from "./Queue";
import { DetectedItems } from "./DetectedItems";
import { WorkflowProgress } from "./WorkflowProgress";
import { CustomerPanel } from "./CustomerPanel";

describe("Message", () => {
  it("renders customer variant with correct data-msg and left alignment", () => {
    render(<Message variant="customer" name="김민지" time="14:20" text="안녕하세요" />);
    const msg = document.querySelector('[data-msg="customer"]');
    expect(msg).toBeInTheDocument();
    expect(msg).toHaveTextContent("김민지");
    expect(msg).toHaveTextContent("안녕하세요");
    expect(msg).toHaveTextContent("14:20");
    const container = msg as HTMLElement;
    expect(container.style.alignSelf).toBe("flex-start");
  });

  it("renders bot variant with correct data-msg and right alignment", () => {
    render(<Message variant="bot" name="AI" time="14:21" text="도와드리겠습니다" />);
    const msg = document.querySelector('[data-msg="bot"]');
    expect(msg).toBeInTheDocument();
    const container = msg as HTMLElement;
    expect(container.style.alignSelf).toBe("flex-end");
    expect(container.style.flexDirection).toBe("row-reverse");
  });

  it("renders agent variant with correct data-msg and right alignment", () => {
    render(<Message variant="agent" name="상담사" time="14:22" text="확인해 드리겠습니다" />);
    const msg = document.querySelector('[data-msg="agent"]');
    expect(msg).toBeInTheDocument();
    const container = msg as HTMLElement;
    expect(container.style.alignSelf).toBe("flex-end");
    expect(container.style.flexDirection).toBe("row-reverse");
  });
});

describe("HandoffDivider", () => {
  it('renders "상담사에게 연결됨" text with default time', () => {
    render(<HandoffDivider />);
    expect(screen.getByText("상담사에게 연결됨 · 14:24")).toBeInTheDocument();
  });

  it("renders custom time", () => {
    render(<HandoffDivider time="15:30" />);
    expect(screen.getByText("상담사에게 연결됨 · 15:30")).toBeInTheDocument();
  });
});

describe("Queue", () => {
  const items = [
    {
      id: "c1",
      name: "김민지",
      channel: "카카오톡",
      waitMinutes: 4,
      preview: "카드 결제 취소 문의드립니다",
      topic: "카드 환불",
      urgent: true,
    },
    {
      id: "c2",
      name: "이성민",
      channel: "라이브챗",
      waitMinutes: 7,
      preview: "부분 환불이 가능한지 확인 부탁드립니다",
      topic: "부분환불",
      urgent: true,
    },
    {
      id: "c3",
      name: "박정희",
      channel: "카카오톡",
      waitMinutes: 12,
      preview: "환불 처리 기간이 얼마나 걸리나요?",
      topic: "환불 처리",
      urgent: true,
    },
    {
      id: "c4",
      name: "최수진",
      channel: "라이브챗",
      waitMinutes: 3,
      preview: "중복 결제된 금액 확인 요청",
      topic: "중복 결제",
    },
    {
      id: "c5",
      name: "홍길동",
      channel: "카카오톡",
      waitMinutes: 1,
      preview: "포인트 환불 문의",
      topic: "포인트",
    },
  ];

  it("renders 5 items with preview text", () => {
    render(<Queue items={items} />);
    expect(screen.getByText("김민지")).toBeInTheDocument();
    expect(screen.getByText("이성민")).toBeInTheDocument();
    expect(screen.getByText("박정희")).toBeInTheDocument();
    expect(screen.getByText("최수진")).toBeInTheDocument();
    expect(screen.getByText("홍길동")).toBeInTheDocument();
    expect(
      screen.getByText((content) => content.includes("카드 결제 취소 문의드립니다")),
    ).toBeInTheDocument();
  });

  it("applies active styles to active item", () => {
    render(<Queue items={items} activeId="c2" />);
    const activeItem = screen.getByText("이성민").closest("div")?.parentElement;
    expect(activeItem).toBeInTheDocument();
    expect(activeItem!.style.background).toBe("var(--paper-3)");
    expect(activeItem!.style.borderLeft).toBe("3px solid var(--signal)");
  });

  it("calls onSelect when item clicked", () => {
    const onSelect = vi.fn();
    render(<Queue items={items} onSelect={onSelect} />);
    fireEvent.click(screen.getByText("김민지"));
    expect(onSelect).toHaveBeenCalledWith("c1");
  });

  it("calls onSelect on Enter key on queue item", () => {
    const onSelect = vi.fn();
    render(<Queue items={items} onSelect={onSelect} />);
    const item = screen.getByText("김민지");
    fireEvent.keyDown(item, { key: "Enter" });
    expect(onSelect).toHaveBeenCalledWith("c1");
  });

  it("calls onSelect on Space key on queue item", () => {
    const onSelect = vi.fn();
    render(<Queue items={items} onSelect={onSelect} />);
    const item = screen.getByText("이성민");
    fireEvent.keyDown(item, { key: " " });
    expect(onSelect).toHaveBeenCalledWith("c2");
  });
});

describe("DetectedItems", () => {
  const items = [
    { label: "주문번호", value: "ORD-44218", ok: true },
    { label: "결제금액", value: "12,800원", ok: true },
    { label: "환불 요청액", value: "5,000원", ok: true },
    { label: "환불 사유", value: "missing", ok: false },
  ];

  it("renders 3 ok + 1 missing item", () => {
    render(<DetectedItems items={items} />);
    expect(screen.getByText("주문번호")).toBeInTheDocument();
    expect(screen.getByText("ORD-44218")).toBeInTheDocument();
    expect(screen.getByText("환불 사유")).toBeInTheDocument();
    expect(screen.getByText("missing")).toBeInTheDocument();
  });
});

describe("WorkflowProgress", () => {
  const steps = [
    { id: "s1", label: "필요 정보 수집", status: "done" as const },
    { id: "s2", label: "환불 조건 확인", status: "active" as const },
    { id: "s3", label: "환불 처리", status: "pending" as const },
    { id: "s4", label: "완료 안내", status: "pending" as const },
  ];

  it("renders 4 steps with correct status indicators", () => {
    render(<WorkflowProgress steps={steps} />);
    expect(screen.getByText("필요 정보 수집")).toBeInTheDocument();
    expect(screen.getByText("환불 조건 확인")).toBeInTheDocument();
    expect(screen.getByText("환불 처리")).toBeInTheDocument();
    expect(screen.getByText("완료 안내")).toBeInTheDocument();
  });
});

describe("CustomerPanel", () => {
  it("does not show concrete mock business data when only session customer fields are available", () => {
    render(
      <CustomerPanel
        customer={{
          name: "김민지",
          channel: "WEB",
        }}
        memo=""
        onMemoChange={vi.fn()}
      />,
    );

    expect(screen.getByText("김민지")).toBeInTheDocument();
    expect(screen.getAllByText("WEB").length).toBeGreaterThan(0);
    expect(screen.getAllByText("확인된 정보 없음").length).toBeGreaterThan(0);
    expect(screen.getByText("연동된 주문 정보가 없습니다.")).toBeInTheDocument();
    expect(screen.getByText("자동 발췌로 확인된 정보가 없습니다.")).toBeInTheDocument();
    expect(screen.getByText("확인된 처리 단계가 없습니다.")).toBeInTheDocument();
    expect(screen.queryByText("010-****-1234")).not.toBeInTheDocument();
    expect(screen.queryByText("mi***@example.com")).not.toBeInTheDocument();
    expect(screen.queryByText("#ORD-2024-08921")).not.toBeInTheDocument();
    expect(screen.queryByText("89,000원")).not.toBeInTheDocument();
    expect(screen.queryByText("5432 **** **** 8912")).not.toBeInTheDocument();
    expect(screen.queryByText("45,000원")).not.toBeInTheDocument();
  });

  it("renders customer panel values only when provided by session data", () => {
    render(
      <CustomerPanel
        customer={{
          name: "이성민",
          channel: "카카오톡",
          membershipTier: "VIP",
          contact: "010-1111-2222",
          email: "customer@example.com",
        }}
        orderInfo={{
          orderNumber: "ORD-REAL-1",
          orderDate: "2026-06-01",
          paymentAmount: "12,000원",
          deliveryStatus: "배송 준비",
        }}
        extractedInfo={{
          cardNumber: "1111 **** **** 2222",
          refundAmount: "3,000원",
          refundReason: "오배송",
          dueDate: "2026-06-05",
        }}
        workflowSteps={[{ label: "확인", value: "완료", state: "done" }]}
        memo=""
        onMemoChange={vi.fn()}
      />,
    );

    expect(screen.getByText("VIP")).toBeInTheDocument();
    expect(screen.getByText("010-1111-2222")).toBeInTheDocument();
    expect(screen.getByText("customer@example.com")).toBeInTheDocument();
    expect(screen.getAllByText("ORD-REAL-1").length).toBeGreaterThan(0);
    expect(screen.getByText("12,000원")).toBeInTheDocument();
    expect(screen.getByText("1111 **** **** 2222")).toBeInTheDocument();
    expect(screen.getByText("3,000원")).toBeInTheDocument();
    expect(screen.getByText("확인")).toBeInTheDocument();
  });

  it("renders AI handoff reason when selected customer requires handoff", () => {
    render(
      <CustomerPanel
        customer={{
          name: "김민지",
          channel: "WEB",
          handoffRequired: true,
          handoffReason: "관리자 승인 필요",
          handoffAt: "2026-06-01T10:00:00+09:00",
        }}
        memo=""
        onMemoChange={vi.fn()}
      />,
    );

    expect(screen.getByText("AI 이관")).toBeInTheDocument();
    expect(screen.getByText("상담사 확인 필요")).toBeInTheDocument();
    expect(screen.getByText("관리자 승인 필요")).toBeInTheDocument();
    expect(screen.getByText("2026-06-01T10:00:00+09:00")).toBeInTheDocument();
  });
});
