import { fireEvent, render, screen } from "@testing-library/react";
import type { ComponentProps } from "react";
import { describe, expect, it, vi } from "vitest";
import type { ChatSession } from "../../api/consultationApi";
import { SessionList } from "./SessionList";

const makeSession = (id: number, meta?: Record<string, unknown>): ChatSession => ({
  id,
  status: "COMPLETED",
  channel: "카카오톡",
  metaJson: JSON.stringify({
    messageCount: 3,
    lastMessagePreview: "배송 상태를 확인해주세요",
    ...meta,
  }),
  startedAt: "2026-05-22T09:00:00+09:00",
});

function renderSessionList(props?: Partial<ComponentProps<typeof SessionList>>) {
  return render(
    <SessionList
      sessions={[]}
      selectedSessionId={null}
      onSelectSession={vi.fn()}
      filters={{
        keyword: "",
        status: "COMPLETED",
        startedFrom: "",
        startedTo: "",
        assignedCounselorId: "",
      }}
      onFiltersChange={vi.fn()}
      onResetFilters={vi.fn()}
      page={0}
      totalPages={0}
      totalElements={0}
      onPageChange={vi.fn()}
      onRetry={vi.fn()}
      {...props}
    />,
  );
}

describe("SessionList", () => {
  it("로딩 상태를 표시한다", () => {
    renderSessionList({ isLoading: true });

    expect(screen.getByText("불러오는 중")).toBeTruthy();
  });

  it("세션이 없으면 빈 상태 메시지를 표시한다", () => {
    renderSessionList({ sessions: [] });

    expect(screen.getByText("아직 채팅 기록이 없습니다")).toBeTruthy();
  });

  it("검색 조건이 있으면 필터 빈 상태 메시지를 표시한다", () => {
    renderSessionList({
      sessions: [],
      filters: {
        keyword: "환불",
        status: "COMPLETED",
        startedFrom: "",
        startedTo: "",
        assignedCounselorId: "",
      },
    });

    expect(screen.getByText("검색 조건에 맞는 상담 기록이 없습니다")).toBeTruthy();
  });

  it("오류 상태에서 메시지와 다시 시도 버튼을 표시한다", () => {
    const refetch = vi.fn();
    renderSessionList({
      isError: true,
      error: new Error("목록을 불러오지 못했습니다"),
      onRetry: refetch,
    });

    expect(screen.getByText("목록을 불러오지 못했습니다")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "다시 시도" }));
    expect(refetch).toHaveBeenCalled();
  });

  it("세션 카드에 채널, 날짜, 메시지 수, 마지막 메시지를 표시한다", () => {
    renderSessionList({ sessions: [makeSession(7)] });

    expect(screen.getByText("카카오톡")).toBeTruthy();
    expect(
      screen.getByText(new Date("2026-05-22T09:00:00+09:00").toLocaleDateString("ko-KR")),
    ).toBeTruthy();
    expect(screen.getByText("메시지 3개")).toBeTruthy();
    expect(screen.getAllByText("상담 종료").length).toBeGreaterThan(0);
    expect(screen.getByText("배송 상태를 확인해주세요")).toBeTruthy();
  });

  it("RESOLVED 세션과 처리 결과를 상담 기록에 표시한다", () => {
    renderSessionList({
      sessions: [
        {
          ...makeSession(7, {
            resolution: {
              label: "후속 연락 필요",
              reason: "배송사 확인 필요",
              followUpRequired: true,
            },
          }),
          status: "RESOLVED",
        },
      ],
    });

    expect(screen.getAllByText("해결됨").length).toBeGreaterThan(0);
    expect(screen.getAllByText("후속 연락 필요")).toHaveLength(2);
    expect(screen.getByText("배송사 확인 필요")).toBeTruthy();
  });

  it("세션 카드 제목은 meta title을 우선 표시한다", () => {
    renderSessionList({ sessions: [makeSession(7, { title: "VIP 환불 상담" })] });

    expect(screen.getByText("VIP 환불 상담")).toBeTruthy();
    expect(screen.getByText("카카오톡")).toBeTruthy();
  });

  it("선택된 세션은 aria-pressed로 활성 상태를 드러낸다", () => {
    renderSessionList({ sessions: [makeSession(7)], selectedSessionId: "7" });

    expect(screen.getByRole("button", { pressed: true })).toBeTruthy();
  });

  it("카드를 클릭하면 onSelectSession이 호출된다", () => {
    const onSelect = vi.fn();
    renderSessionList({ sessions: [makeSession(7)], onSelectSession: onSelect });

    fireEvent.click(screen.getByRole("button", { name: /카카오톡/ }));

    expect(onSelect).toHaveBeenCalledWith("7");
  });

  it("검색과 페이지 이동 이벤트를 전달한다", () => {
    const onFiltersChange = vi.fn();
    const onPageChange = vi.fn();
    renderSessionList({
      sessions: [makeSession(7)],
      totalPages: 3,
      totalElements: 45,
      onFiltersChange,
      onPageChange,
    });

    fireEvent.change(screen.getByLabelText("상담 기록 검색"), { target: { value: "배송" } });
    fireEvent.click(screen.getByRole("button", { name: "다음 페이지" }));

    expect(onFiltersChange).toHaveBeenCalledWith({ keyword: "배송" });
    expect(onPageChange).toHaveBeenCalledWith(1);
  });
});
