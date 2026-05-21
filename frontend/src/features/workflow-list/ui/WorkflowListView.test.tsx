import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

import type { WorkspaceWorkflowEntry } from "@/entities/workflow";
import { WorkflowListView } from "./WorkflowListView";

vi.mock("./WorkflowGraphMini", () => ({
  WorkflowGraphMini: () => <div data-testid="graph-mini-stub" />,
}));

function makeEntry(
  id: number,
  name = `wf-${id}`,
  code = `wf.${String(id).padStart(2, "0")}`,
): WorkspaceWorkflowEntry {
  return {
    packId: 2,
    packName: "Pack",
    versionId: 3,
    workflowId: id,
    workflowCode: code,
    name,
    description: `desc-${id}`,
  };
}

function setup(entries: WorkspaceWorkflowEntry[], onOpen = vi.fn()) {
  return {
    onOpen,
    ...render(
      <MemoryRouter>
        <WorkflowListView entries={entries} onOpen={onOpen} testIdPrefix="wl" />
      </MemoryRouter>,
    ),
  };
}

beforeEach(() => {
  window.localStorage.clear();
});

describe("WorkflowListView", () => {
  const big = Array.from({ length: 20 }, (_, i) =>
    makeEntry(i + 1, `wf-${String(i).padStart(2, "0")}`),
  );

  it("처음에는 기본 page size(12) 만큼만 그리고 pagination 이 노출된다", () => {
    setup(big);
    expect(screen.getByTestId("wl-card-1")).toBeInTheDocument();
    expect(screen.getByTestId("wl-card-12")).toBeInTheDocument();
    expect(screen.queryByTestId("wl-card-13")).not.toBeInTheDocument();
    expect(screen.getByTestId("wl-pagination-info")).toHaveTextContent("1 / 2");
  });

  it("Next 버튼 클릭 시 다음 페이지로 이동", () => {
    setup(big);
    fireEvent.click(screen.getByTestId("wl-pagination-next"));
    expect(screen.getByTestId("wl-pagination-info")).toHaveTextContent("2 / 2");
    expect(screen.getByTestId("wl-card-13")).toBeInTheDocument();
  });

  it("settings 톱니 토글로 panel 펼침/접힘", () => {
    setup(big);
    expect(screen.queryByTestId("wl-settings")).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId("wl-settings-toggle"));
    expect(screen.getByTestId("wl-settings")).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("wl-settings-toggle"));
    expect(screen.queryByTestId("wl-settings")).not.toBeInTheDocument();
  });

  it("page size 6 으로 변경 시 즉시 카드 수와 pagination 갱신", () => {
    setup(big);
    fireEvent.click(screen.getByTestId("wl-settings-toggle"));
    fireEvent.click(screen.getByTestId("wl-settings-pageSize-6"));
    expect(screen.getByTestId("wl-card-6")).toBeInTheDocument();
    expect(screen.queryByTestId("wl-card-7")).not.toBeInTheDocument();
    expect(screen.getByTestId("wl-pagination-info")).toHaveTextContent(/^1 \/ 4$/);
  });

  it("이름 기준 desc 정렬 시 카드 순서가 역전된다", () => {
    setup(big);
    fireEvent.click(screen.getByTestId("wl-settings-toggle"));
    fireEvent.click(screen.getByTestId("wl-settings-sortField-name"));
    fireEvent.click(screen.getByTestId("wl-settings-sortDir-desc"));
    const masonry = screen.getByTestId("wl-masonry");
    const cards = masonry.querySelectorAll<HTMLElement>('[data-testid^="wl-card-"]');
    expect(cards[0].dataset.testid).toBe("wl-card-20");
  });

  it("카드 클릭 시 펼침 상태가 토글된다", () => {
    setup([makeEntry(1)]);
    const card = screen.getByTestId("wl-card-1");
    expect(card.dataset.expanded).toBe("false");
    fireEvent.click(screen.getByTestId("wl-card-1-toggle"));
    expect(screen.getByTestId("wl-card-1").dataset.expanded).toBe("true");
    fireEvent.click(screen.getByTestId("wl-card-1-toggle"));
    expect(screen.getByTestId("wl-card-1").dataset.expanded).toBe("false");
  });

  it("열기 버튼 클릭 시 onOpen 콜백이 entry 와 함께 호출된다", () => {
    const onOpen = vi.fn();
    setup([makeEntry(7, "Lucky")], onOpen);
    fireEvent.click(screen.getByTestId("wl-card-7-toggle"));
    fireEvent.click(screen.getByTestId("wl-card-7-open"));
    expect(onOpen).toHaveBeenCalledWith(expect.objectContaining({ workflowId: 7, name: "Lucky" }));
  });

  it("검색바 입력 후 dropdown 항목 클릭 시 그리드가 그 워크플로우만 남고 필터 칩이 표시된다", () => {
    setup(big);
    fireEvent.change(screen.getByTestId("wl-search-input"), { target: { value: "wf-15" } });
    fireEvent.click(screen.getByTestId("wl-search-item-16"));
    expect(screen.getByTestId("wl-card-16")).toBeInTheDocument();
    expect(screen.queryByTestId("wl-card-1")).not.toBeInTheDocument();
    const chip = screen.getByTestId("wl-filter-chip");
    expect(chip).toHaveTextContent("wf-15");
  });

  it("필터 칩 클릭 시 필터가 해제되고 그리드가 전체로 복원된다", () => {
    setup(big);
    fireEvent.change(screen.getByTestId("wl-search-input"), { target: { value: "wf-15" } });
    fireEvent.click(screen.getByTestId("wl-search-item-16"));
    fireEvent.click(screen.getByTestId("wl-filter-chip"));
    expect(screen.queryByTestId("wl-filter-chip")).not.toBeInTheDocument();
    expect(screen.getByTestId("wl-card-1")).toBeInTheDocument();
  });

  it("settings 변경이 localStorage 에 영속화된다", () => {
    setup(big);
    fireEvent.click(screen.getByTestId("wl-settings-toggle"));
    fireEvent.click(screen.getByTestId("wl-settings-pageSize-24"));
    const raw = window.localStorage.getItem("ostone:page:workflow-settings");
    expect(raw).not.toBeNull();
    expect(JSON.parse(raw!)).toMatchObject({ pageSize: 24 });
  });

  it("빈 entries 도 안전하게 렌더한다 (search 만 노출, masonry empty)", () => {
    render(
      <MemoryRouter>
        <WorkflowListView entries={[]} onOpen={vi.fn()} testIdPrefix="wl" />
      </MemoryRouter>,
    );
    expect(screen.getByTestId("wl-masonry")).toBeInTheDocument();
    expect(screen.queryByTestId("wl-pagination")).not.toBeInTheDocument();
  });
});
