import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { QueuePanel } from "./QueuePanel";

type QueuePanelProps = Parameters<typeof QueuePanel>[0];

const makeCustomer = (
  id: string,
  extra?: Partial<QueuePanelProps["customers"][0]>,
) => ({
  id,
  name: `고객${id}`,
  channel: "CHAT",
  handoffReason: "환불 문의",
  waitMinutes: 2,
  hasUnread: false,
  ...extra,
});

const renderQueuePanel = (props: Partial<QueuePanelProps> = {}) =>
  render(
    <QueuePanel
      customers={props.customers ?? []}
      activeCustomerId={props.activeCustomerId ?? null}
      currentCounselorId={props.currentCounselorId === undefined ? 7 : props.currentCounselorId}
      onSelectCustomer={props.onSelectCustomer ?? vi.fn()}
      isLoading={props.isLoading}
      loadError={props.loadError}
      onRetry={props.onRetry}
    />,
  );

const getQueueItem = (customerName: string) =>
  screen.getByText(customerName).closest('[role="button"]') as HTMLElement;

const getFilterButton = (filterName: string) => {
  const element = screen.getAllByText(filterName).find((item) => item.closest("button"));
  if (!element) throw new Error(`Filter not found: ${filterName}`);
  return element.closest("button")!;
};

const getSortButton = (sortName: string) => screen.getByRole("button", { name: sortName });

const getRenderedQueueItems = () =>
  screen
    .getAllByRole("button")
    .filter((button) => button.textContent?.includes("고객"));

describe("QueuePanel", () => {
  it("고객이 없으면 큐 empty 상태 메시지를 표시한다", () => {
    renderQueuePanel();
    expect(screen.getByText("현재 상담 큐가 비어 있습니다")).toBeInTheDocument();
  });

  it("로딩 중이면 로딩 상태를 표시한다", () => {
    renderQueuePanel({ customers: [makeCustomer("1")], isLoading: true });

    expect(screen.getByText("대기열을 불러오는 중입니다")).toBeInTheDocument();
    expect(screen.queryByText("고객1")).not.toBeInTheDocument();
  });

  it("에러가 있으면 재시도 버튼을 표시하고 클릭을 전달한다", () => {
    const onRetry = vi.fn();
    renderQueuePanel({
      customers: [makeCustomer("1")],
      loadError: "대기열을 불러오지 못했습니다.",
      onRetry,
    });

    expect(screen.getByRole("alert")).toHaveTextContent("대기열을 불러오지 못했습니다.");
    fireEvent.click(screen.getByText("다시 시도"));
    expect(onRetry).toHaveBeenCalledTimes(1);
    expect(screen.queryByText("고객1")).not.toBeInTheDocument();
  });

  it("큐 의미에 맞는 미배정/진행 카운트를 헤더에 표시한다", () => {
    const customers = [
      makeCustomer("1", { assignedCounselorId: null, status: "OPEN" }),
      makeCustomer("2", { assignedCounselorId: 7, status: "ACTIVE" }),
      makeCustomer("3", { assignedCounselorId: 9, status: "ACTIVE" }),
    ];
    renderQueuePanel({ customers });

    expect(screen.getByText("상담 큐")).toBeInTheDocument();
    expect(screen.getByText("연결 요청 0건 · 미배정 1건 · 진행 2건")).toBeInTheDocument();
    expect(screen.queryByText(/대기중$/)).not.toBeInTheDocument();
  });

  it("고객 이름과 handoffReason을 표시한다", () => {
    renderQueuePanel({ customers: [makeCustomer("1", { handoffReason: "카드 오류" })] });
    expect(screen.getByText("고객1")).toBeInTheDocument();
    expect(screen.getByText("카드 오류")).toBeInTheDocument();
  });

  it("handoffRequired 세션은 상담사 연결 요청 배지와 사유를 표시한다", () => {
    renderQueuePanel({
      customers: [makeCustomer("1", { handoffRequired: true, handoffReason: "관리자 승인 필요" })],
    });

    expect(screen.getAllByText("상담사 연결 요청").length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText("사유: 관리자 승인 필요")).toBeInTheDocument();
    expect(screen.getByText("연결 요청 1건 · 미배정 1건 · 진행 0건")).toBeInTheDocument();
  });

  it("title이 있으면 handoffReason보다 우선 표시한다", () => {
    renderQueuePanel({
      customers: [makeCustomer("1", { title: "VIP 환불 상담", handoffReason: "카드 오류" })],
    });

    expect(screen.getByText("VIP 환불 상담")).toBeInTheDocument();
    expect(screen.queryByText("카드 오류")).not.toBeInTheDocument();
  });

  it("마지막 메시지 미리보기가 있으면 title보다 우선 표시한다", () => {
    renderQueuePanel({
      customers: [
        makeCustomer("1", {
          title: "VIP 환불 상담",
          lastMessagePreview: "방금 고객이 남긴 메시지입니다",
        }),
      ],
    });

    expect(screen.getByText("방금 고객이 남긴 메시지입니다")).toBeInTheDocument();
    expect(screen.queryByText("VIP 환불 상담")).not.toBeInTheDocument();
  });

  it("고객 이름이 없으면 Unknown을 표시한다", () => {
    renderQueuePanel({ customers: [makeCustomer("1", { name: undefined })] });

    expect(screen.getByText("Unknown")).toBeInTheDocument();
  });

  it("클릭하면 onSelectCustomer가 호출된다", () => {
    const onSelect = vi.fn();
    renderQueuePanel({ customers: [makeCustomer("42")], onSelectCustomer: onSelect });
    fireEvent.click(getQueueItem("고객42"));
    expect(onSelect).toHaveBeenCalledWith("42");
  });

  it("Enter 키로 onSelectCustomer가 호출된다", () => {
    const onSelect = vi.fn();
    renderQueuePanel({ customers: [makeCustomer("5")], onSelectCustomer: onSelect });
    fireEvent.keyDown(getQueueItem("고객5"), { key: "Enter" });
    expect(onSelect).toHaveBeenCalledWith("5");
  });

  it("스페이스 키로 onSelectCustomer가 호출된다", () => {
    const onSelect = vi.fn();
    renderQueuePanel({ customers: [makeCustomer("7")], onSelectCustomer: onSelect });
    fireEvent.keyDown(getQueueItem("고객7"), { key: " " });
    expect(onSelect).toHaveBeenCalledWith("7");
  });

  it("다른 키는 onSelectCustomer를 호출하지 않는다", () => {
    const onSelect = vi.fn();
    renderQueuePanel({ customers: [makeCustomer("8")], onSelectCustomer: onSelect });
    fireEvent.keyDown(getQueueItem("고객8"), { key: "Tab" });
    expect(onSelect).not.toHaveBeenCalled();
  });

  it("hasUnread가 true이면 읽지 않음 표시가 나타난다", () => {
    renderQueuePanel({ customers: [makeCustomer("9", { hasUnread: true })] });
    expect(screen.getByLabelText("읽지 않은 고객 메시지")).toBeInTheDocument();
  });

  it("대기 시간을 표시한다", () => {
    renderQueuePanel({ customers: [makeCustomer("10", { waitMinutes: 5 })] });
    expect(screen.getByText("5분 전")).toBeInTheDocument();
  });

  it("대기 시간이 60분을 넘으면 시간 단위로 표시한다", () => {
    renderQueuePanel({ customers: [makeCustomer("10", { waitMinutes: 60 })] });
    expect(screen.getByText("1시간 전")).toBeInTheDocument();
  });

  it("대기 시간이 24시간을 넘으면 일 단위로 표시한다", () => {
    renderQueuePanel({ customers: [makeCustomer("10", { waitMinutes: 60 * 24 })] });
    expect(screen.getByText("1일 전")).toBeInTheDocument();
  });

  it("마지막 메시지 시간이 있으면 대기 시간보다 우선 표시한다", () => {
    renderQueuePanel({
      customers: [
        makeCustomer("10", {
          waitMinutes: 20,
          lastMessageAt: "2026-06-01T12:03:00+09:00",
          lastMessageTimeLabel: "2분 전",
        }),
      ],
    });
    expect(screen.getByText("2분 전")).toBeInTheDocument();
    expect(screen.queryByText("20분 전")).not.toBeInTheDocument();
  });

  it("기본 정렬은 연결 요청을 우선하고 이관 시각이 오래된 고객을 먼저 표시한다", () => {
    renderQueuePanel({
      customers: [
        makeCustomer("1", {
          name: "일반 고객",
          waitMinutes: 60,
          handoffRequired: false,
          startedAt: "2026-06-01T09:00:00+09:00",
        }),
        makeCustomer("2", {
          name: "새 이관 고객",
          waitMinutes: 10,
          handoffRequired: true,
          handoffAt: "2026-06-01T11:00:00+09:00",
        }),
        makeCustomer("3", {
          name: "오래된 이관 고객",
          waitMinutes: 20,
          handoffRequired: true,
          handoffAt: "2026-06-01T10:00:00+09:00",
        }),
      ],
    });

    expect(getSortButton("연결 요청 우선")).toHaveAttribute("aria-pressed", "true");
    expect(getRenderedQueueItems().map((button) => button.textContent)).toEqual([
      expect.stringContaining("오래된 이관 고객"),
      expect.stringContaining("새 이관 고객"),
      expect.stringContaining("일반 고객"),
    ]);
  });

  it("오래 기다린 순 정렬을 선택하면 waitMinutes가 큰 고객부터 표시한다", () => {
    renderQueuePanel({
      customers: [
        makeCustomer("1", { name: "짧게 기다린 고객", waitMinutes: 3 }),
        makeCustomer("2", { name: "오래 기다린 고객", waitMinutes: 42 }),
        makeCustomer("3", { name: "중간 대기 고객", waitMinutes: 17 }),
      ],
    });

    fireEvent.click(getSortButton("오래 기다린 순"));

    expect(getSortButton("오래 기다린 순")).toHaveAttribute("aria-pressed", "true");
    expect(getRenderedQueueItems().map((button) => button.textContent)).toEqual([
      expect.stringContaining("오래 기다린 고객"),
      expect.stringContaining("중간 대기 고객"),
      expect.stringContaining("짧게 기다린 고객"),
    ]);
  });

  it("최신순 정렬을 선택하면 최근 활동 고객부터 표시한다", () => {
    renderQueuePanel({
      customers: [
        makeCustomer("1", {
          name: "오전 고객",
          startedAt: "2026-06-01T09:00:00+09:00",
          lastMessageAt: "2026-06-01T09:10:00+09:00",
        }),
        makeCustomer("2", {
          name: "정오 고객",
          startedAt: "2026-06-01T12:00:00+09:00",
        }),
        makeCustomer("3", {
          name: "오후 고객",
          startedAt: "2026-06-01T10:00:00+09:00",
          lastMessageAt: "2026-06-01T13:30:00+09:00",
        }),
      ],
    });

    fireEvent.click(getSortButton("최신순"));

    expect(getSortButton("최신순")).toHaveAttribute("aria-pressed", "true");
    expect(getRenderedQueueItems().map((button) => button.textContent)).toEqual([
      expect.stringContaining("오후 고객"),
      expect.stringContaining("정오 고객"),
      expect.stringContaining("오전 고객"),
    ]);
  });

  it("정렬을 변경해도 active selection과 unread 표시를 유지한다", () => {
    renderQueuePanel({
      activeCustomerId: "2",
      customers: [
        makeCustomer("1", { waitMinutes: 5 }),
        makeCustomer("2", { waitMinutes: 30 }),
        makeCustomer("3", { waitMinutes: 10, hasUnread: true }),
      ],
    });

    fireEvent.click(getSortButton("오래 기다린 순"));

    expect(getQueueItem("고객2")).toHaveAttribute("aria-current", "true");
    expect(screen.getByLabelText("읽지 않은 고객 메시지")).toBeInTheDocument();
  });

  it("세션 상태 라벨을 표시한다", () => {
    renderQueuePanel({ customers: [makeCustomer("11", { statusLabel: "내 상담 진행중" })] });
    expect(screen.getByText("내 상담 진행중")).toBeInTheDocument();
  });

  it("내 상담 필터를 선택하면 현재 상담사에게 배정된 세션만 표시한다", () => {
    renderQueuePanel({
      customers: [
        makeCustomer("1", { assignedCounselorId: 7 }),
        makeCustomer("2", { assignedCounselorId: 8 }),
        makeCustomer("3", { assignedCounselorId: null }),
      ],
    });

    fireEvent.click(getFilterButton("내 상담"));

    expect(screen.getByText("고객1")).toBeInTheDocument();
    expect(screen.queryByText("고객2")).not.toBeInTheDocument();
    expect(screen.queryByText("고객3")).not.toBeInTheDocument();
    expect(screen.getByText("현재 1건 표시")).toBeInTheDocument();
  });

  it("미배정 필터를 선택하면 배정되지 않은 세션만 표시한다", () => {
    renderQueuePanel({
      customers: [
        makeCustomer("1", { assignedCounselorId: null }),
        makeCustomer("2", { assignedCounselorId: 7 }),
      ],
    });

    fireEvent.click(getFilterButton("미배정"));

    expect(screen.getByText("고객1")).toBeInTheDocument();
    expect(screen.queryByText("고객2")).not.toBeInTheDocument();
  });

  it("상담사 연결 요청 필터를 선택하면 handoffRequired 세션만 표시한다", () => {
    renderQueuePanel({
      customers: [
        makeCustomer("1", { handoffRequired: true, handoffReason: "상담사 확인 필요" }),
        makeCustomer("2", { handoffRequired: false }),
      ],
    });

    fireEvent.click(getFilterButton("상담사 연결 요청"));

    expect(screen.getByText("고객1")).toBeInTheDocument();
    expect(screen.queryByText("고객2")).not.toBeInTheDocument();
  });

  it("상담사 연결 요청 필터 결과가 없으면 연결 요청 빈 상태를 표시한다", () => {
    renderQueuePanel({
      customers: [makeCustomer("1", { handoffRequired: false })],
    });

    fireEvent.click(getFilterButton("상담사 연결 요청"));

    expect(screen.getByText("상담사 연결 요청이 없습니다")).toBeInTheDocument();
  });

  it("읽지 않음 필터를 선택하면 읽지 않은 세션만 표시한다", () => {
    renderQueuePanel({
      customers: [
        makeCustomer("1", { hasUnread: true }),
        makeCustomer("2", { hasUnread: false }),
      ],
    });

    fireEvent.click(getFilterButton("읽지 않음"));

    expect(screen.getByText("고객1")).toBeInTheDocument();
    expect(screen.queryByText("고객2")).not.toBeInTheDocument();
  });

  it("고객명, 제목, 마지막 메시지, handoffReason 기준으로 검색한다", () => {
    renderQueuePanel({
      customers: [
        makeCustomer("1", { name: "홍길동", handoffReason: "일반 문의" }),
        makeCustomer("2", { title: "배송 문의" }),
        makeCustomer("3", { lastMessagePreview: "카드 결제가 실패했어요" }),
        makeCustomer("4", { handoffReason: "환불 문의" }),
      ],
    });

    fireEvent.change(screen.getByLabelText("상담 큐 검색"), { target: { value: "카드" } });

    expect(screen.getByText("고객3")).toBeInTheDocument();
    expect(screen.queryByText("홍길동")).not.toBeInTheDocument();
    expect(screen.queryByText("고객2")).not.toBeInTheDocument();
    expect(screen.queryByText("고객4")).not.toBeInTheDocument();
  });

  it("필터와 검색어를 함께 적용한다", () => {
    renderQueuePanel({
      customers: [
        makeCustomer("1", { assignedCounselorId: 7, title: "환불 상담" }),
        makeCustomer("2", {
          assignedCounselorId: 7,
          title: "배송 상담",
          handoffReason: "배송 문의",
        }),
        makeCustomer("3", { assignedCounselorId: null, title: "환불 상담" }),
      ],
    });

    fireEvent.click(getFilterButton("내 상담"));
    fireEvent.change(screen.getByLabelText("상담 큐 검색"), { target: { value: "환불" } });

    expect(screen.getByText("고객1")).toBeInTheDocument();
    expect(screen.queryByText("고객2")).not.toBeInTheDocument();
    expect(screen.queryByText("고객3")).not.toBeInTheDocument();
    expect(screen.getByText("현재 1건 표시")).toBeInTheDocument();
  });

  it("필터 결과가 없으면 조건에 맞는 빈 상태를 표시한다", () => {
    renderQueuePanel({ customers: [makeCustomer("1", { assignedCounselorId: 7 })] });

    fireEvent.click(getFilterButton("미배정"));

    expect(screen.getByText("미배정 상담이 없습니다")).toBeInTheDocument();
  });

  it("검색 결과가 없으면 검색 빈 상태를 표시한다", () => {
    renderQueuePanel({ customers: [makeCustomer("1", { title: "환불 상담" })] });

    fireEvent.change(screen.getByLabelText("상담 큐 검색"), { target: { value: "없는 검색어" } });

    expect(screen.getByText("검색 조건에 맞는 상담이 없습니다")).toBeInTheDocument();
  });
});
