import { beforeEach, describe, it, expect, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { Sidebar, type SidebarTreeData } from "./Sidebar";

type SidebarProps = Parameters<typeof Sidebar>[0];

function renderSidebar(props: Partial<SidebarProps> = {}) {
  const defaults: SidebarProps = {
    active: "consult",
    collapsed: true,
    onToggleCollapsed: vi.fn(),
  };
  return render(
    <MemoryRouter>
      <Sidebar {...defaults} {...props} />
    </MemoryRouter>,
  );
}

const TREE_FIXTURE: SidebarTreeData = {
  loading: false,
  error: null,
  packs: [
    {
      packId: 11,
      name: "CS Support",
      versionId: 22,
      workflows: [
        { id: 100, name: "환불 처리" },
        { id: 101, name: "배송 지연" },
      ],
    },
    {
      packId: 12,
      name: "Billing",
      versionId: 30,
      workflows: [{ id: 200, name: "카드 변경" }],
    },
  ],
};

describe("Sidebar", () => {
  it("collapsed 모드에서는 width 72px과 아이콘 항목을 표시한다 (Workflows 최상위 항목 없음)", () => {
    renderSidebar({ collapsed: true });
    const nav = screen.getByLabelText("주요 내비게이션");
    expect(nav).toHaveAttribute("data-collapsed", "true");
    expect(nav).toHaveStyle({ width: "72px" });
    expect(screen.queryByTitle("Operator")).not.toBeInTheDocument();
    expect(screen.queryByTitle("Pipeline")).not.toBeInTheDocument();
    expect(screen.getByTitle("Consultation")).toBeInTheDocument();
    expect(screen.getByTitle("Uploads")).toBeInTheDocument();
    expect(screen.getByTitle("Domain Packs")).toBeInTheDocument();
    expect(screen.queryByTitle("Workflows")).not.toBeInTheDocument();
  });

  it("expanded 모드에서는 width 256px이고 Domain Packs는 토글 버튼이다 (별도 section label 없음)", () => {
    renderSidebar({ collapsed: false });
    const nav = screen.getByLabelText("주요 내비게이션");
    expect(nav).toHaveAttribute("data-collapsed", "false");
    expect(nav).toHaveStyle({ width: "256px" });
    expect(screen.getByTestId("sidebar-domain-toggle")).toBeInTheDocument();
    expect(
      screen.queryByTestId("sidebar-section-label"),
    ).not.toBeInTheDocument();
  });

  it("expanded 모드에서 Workflows 최상위 항목이 없다", () => {
    renderSidebar({ collapsed: false });
    expect(screen.queryByTitle("Workflows")).not.toBeInTheDocument();
  });

  it("collapsed 시 nav 배경 클릭으로 onToggleCollapsed가 호출된다", () => {
    const onToggleCollapsed = vi.fn();
    renderSidebar({ collapsed: true, onToggleCollapsed });
    const nav = screen.getByLabelText("주요 내비게이션");
    fireEvent.click(nav);
    expect(onToggleCollapsed).toHaveBeenCalledTimes(1);
  });

  it("collapsed 시에는 별도 토글 버튼이 렌더되지 않는다", () => {
    renderSidebar({ collapsed: true });
    expect(screen.queryByLabelText("사이드바 펼치기")).not.toBeInTheDocument();
  });

  it("expanded 시 토글 버튼 클릭으로 onToggleCollapsed가 호출된다", () => {
    const onToggleCollapsed = vi.fn();
    renderSidebar({ collapsed: false, onToggleCollapsed });
    fireEvent.click(screen.getByLabelText("사이드바 접기"));
    expect(onToggleCollapsed).toHaveBeenCalledTimes(1);
  });

  it("active=consult일 때 Consultation 항목이 강조된다", () => {
    renderSidebar({ active: "consult", collapsed: true });
    expect(screen.getByTitle("Consultation")).toHaveAttribute(
      "data-active",
      "true",
    );
  });

  it("Domain Packs 토글이 기본은 active 상태에 따라 펼쳐진다 (active=domain → open)", () => {
    renderSidebar({ collapsed: false, active: "domain", tree: TREE_FIXTURE });
    const toggle = screen.getByTestId("sidebar-domain-toggle");
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    expect(toggle).toHaveAttribute("data-active", "true");
    expect(screen.getByTestId("sidebar-tree")).toBeInTheDocument();
  });

  it("Domain Packs 토글이 기본은 active=consult이면 닫혀 있다가 클릭 시 열린다", () => {
    renderSidebar({ collapsed: false, active: "consult", tree: TREE_FIXTURE });
    const toggle = screen.getByTestId("sidebar-domain-toggle");
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByTestId("sidebar-tree")).not.toBeInTheDocument();
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByTestId("sidebar-tree")).toBeInTheDocument();
  });

  it("tree.loading=true이면 loading placeholder를 렌더한다", () => {
    renderSidebar({
      collapsed: false,
      active: "domain",
      tree: { loading: true, error: null, packs: [] },
    });
    expect(screen.getByTestId("sidebar-tree-loading")).toBeInTheDocument();
  });

  it("tree.error가 있으면 에러 메시지를 렌더한다", () => {
    renderSidebar({
      collapsed: false,
      active: "domain",
      tree: { loading: false, error: "oops", packs: [] },
    });
    expect(screen.getByTestId("sidebar-tree-error")).toBeInTheDocument();
  });

  it("tree.packs가 비어 있으면 empty 메시지를 렌더한다", () => {
    renderSidebar({
      collapsed: false,
      active: "domain",
      tree: { loading: false, error: null, packs: [] },
    });
    expect(screen.getByTestId("sidebar-tree-empty")).toBeInTheDocument();
  });

  it("tree.packs가 있을 때 pack 이름을 렌더한다", () => {
    renderSidebar({ collapsed: false, active: "domain", tree: TREE_FIXTURE });
    expect(screen.getByText("CS Support")).toBeInTheDocument();
    expect(screen.getByText("Billing")).toBeInTheDocument();
  });

  it('pack을 펼치면 5개 카테고리가 NavLink로 노출되고 Workflows 카테고리는 "All Workflows"로 표시된다', () => {
    renderSidebar({ collapsed: false, active: "domain", tree: TREE_FIXTURE });
    fireEvent.click(screen.getByText("CS Support"));
    expect(screen.getByTestId("sidebar-cat-11-intents")).toBeInTheDocument();
    expect(screen.getByTestId("sidebar-cat-11-slots")).toBeInTheDocument();
    expect(screen.getByTestId("sidebar-cat-11-policies")).toBeInTheDocument();
    expect(screen.getByTestId("sidebar-cat-11-risks")).toBeInTheDocument();
    const workflowsLink = screen.getByTestId("sidebar-cat-11-workflows");
    expect(workflowsLink).toBeInTheDocument();
    expect(workflowsLink).toHaveTextContent("All Workflows");
    expect(workflowsLink.tagName).toBe("A");
  });

  it("All Workflows가 active일 때 워크플로우 리스트가 자동으로 그 아래에 표시된다", () => {
    renderSidebar({
      collapsed: false,
      tree: TREE_FIXTURE,
      activePackId: 11,
      active: "workflows",
    });
    expect(screen.getByTestId("sidebar-workflows-list-11")).toBeInTheDocument();
    expect(screen.getByTestId("sidebar-workflow-100")).toBeInTheDocument();
    expect(screen.getByTestId("sidebar-workflow-101")).toBeInTheDocument();
    expect(
      screen.queryByTestId("sidebar-workflows-list-12"),
    ).not.toBeInTheDocument();
  });

  it("다른 카테고리가 active면 워크플로우 리스트는 표시되지 않는다", () => {
    renderSidebar({
      collapsed: false,
      tree: TREE_FIXTURE,
      activePackId: 11,
      active: "intent",
    });
    expect(
      screen.queryByTestId("sidebar-workflows-list-11"),
    ).not.toBeInTheDocument();
  });

  it("All Workflows active이지만 해당 pack에 워크플로우가 없으면 안내를 표시한다", () => {
    const tree: SidebarTreeData = {
      loading: false,
      error: null,
      packs: [{ packId: 77, name: "Empty", versionId: 5, workflows: [] }],
    };
    renderSidebar({
      collapsed: false,
      tree,
      activePackId: 77,
      active: "workflows",
    });
    expect(
      screen.getByTestId("sidebar-workflows-empty-77"),
    ).toBeInTheDocument();
  });

  it("activeWorkflowId 일치 시 해당 워크플로우 링크가 강조된다", () => {
    renderSidebar({
      collapsed: false,
      tree: TREE_FIXTURE,
      activePackId: 11,
      activeWorkflowId: 100,
      active: "workflows",
    });
    const wfLink = screen.getByTestId("sidebar-workflow-100");
    expect(wfLink.getAttribute("style") ?? "").toContain("var(--signal)");
  });

  it("versionId가 null이면 카테고리 링크가 pack base 경로로 fallback한다", () => {
    const tree: SidebarTreeData = {
      loading: false,
      error: null,
      packs: [{ packId: 99, name: "Empty", versionId: null, workflows: [] }],
    };
    renderSidebar({ collapsed: false, active: "domain", tree });
    fireEvent.click(screen.getByText("Empty"));
    const intentsCat = screen.getByTestId("sidebar-cat-99-intents");
    expect(intentsCat).toHaveAttribute("href", "/workspaces/domain-packs/99");
  });

  it("basePath prop을 지정하면 링크에 반영된다", () => {
    renderSidebar({ collapsed: true, basePath: "/workspaces/7" });
    const consultLink = screen.getByTitle("Consultation");
    expect(consultLink).toHaveAttribute("href", "/workspaces/7/consultation");
    const domainLink = screen.getByTitle("Domain Packs");
    expect(domainLink).toHaveAttribute("href", "/workspaces/7/domain-packs");
  });

  it("switcher가 주어지면 렌더링된다", () => {
    const switcher = <div data-testid="switcher">Switch</div>;
    renderSidebar({ switcher });
    expect(screen.getByTestId("switcher")).toBeInTheDocument();
  });

  it("inactive 항목에 mouseEnter/Leave 시 배경이 토글된다", () => {
    renderSidebar({ active: "consult", collapsed: true });
    const link = screen.getByTitle("Uploads") as HTMLElement;
    fireEvent.mouseEnter(link);
    expect(link.style.background).toBe("var(--paper-3)");
    fireEvent.mouseLeave(link);
    expect(link.style.background).toBe("transparent");
  });

  it("Domain Packs 토글 active 시 inactive 카테고리(intent)에 대한 강조 분리", () => {
    renderSidebar({
      collapsed: false,
      tree: TREE_FIXTURE,
      activePackId: 11,
      active: "intent",
    });
    const intentsCat = screen.getByTestId("sidebar-cat-11-intents");
    expect(intentsCat.getAttribute("style") ?? "").toContain("var(--signal)");
    const slotsCat = screen.getByTestId("sidebar-cat-11-slots");
    expect(slotsCat.getAttribute("style") ?? "").not.toContain("var(--signal)");
  });
});

describe("Sidebar — workflow settings", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  const overflowTree: SidebarTreeData = {
    loading: false,
    error: null,
    packs: [
      {
        packId: 50,
        name: "Big Pack",
        versionId: 99,
        workflows: Array.from({ length: 8 }, (_, i) => ({
          id: 500 + i,
          name: `wf-${String(i).padStart(2, "0")}`,
        })),
      },
    ],
  };

  it("All Workflows 행 옆에 settings 톱니 버튼이 렌더된다", () => {
    renderSidebar({
      collapsed: false,
      tree: overflowTree,
      activePackId: 50,
      active: "workflows",
    });
    expect(
      screen.getByTestId("sidebar-workflows-settings-toggle-50"),
    ).toBeInTheDocument();
    expect(
      screen
        .getByTestId("sidebar-workflows-settings-toggle-50")
        .getAttribute("aria-expanded"),
    ).toBe("false");
  });

  it("settings 톱니 클릭 시 panel이 펼쳐지고 다시 누르면 닫힌다", () => {
    renderSidebar({
      collapsed: false,
      tree: overflowTree,
      activePackId: 50,
      active: "workflows",
    });
    const toggle = screen.getByTestId("sidebar-workflows-settings-toggle-50");
    fireEvent.click(toggle);
    expect(toggle.getAttribute("aria-expanded")).toBe("true");
    expect(
      screen.getByTestId("sidebar-workflows-settings-50"),
    ).toBeInTheDocument();
    fireEvent.click(toggle);
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    expect(
      screen.queryByTestId("sidebar-workflows-settings-50"),
    ).not.toBeInTheDocument();
  });

  it("기본 Top N=5 적용 시 8개 중 5개만 표시되고 +3 more 가 노출된다", () => {
    renderSidebar({
      collapsed: false,
      tree: overflowTree,
      activePackId: 50,
      active: "workflows",
    });
    expect(screen.getByTestId("sidebar-workflow-500")).toBeInTheDocument();
    expect(screen.getByTestId("sidebar-workflow-504")).toBeInTheDocument();
    expect(
      screen.queryByTestId("sidebar-workflow-505"),
    ).not.toBeInTheDocument();
    const overflow = screen.getByTestId("sidebar-workflows-overflow-50");
    expect(overflow).toHaveTextContent("+3 more");
  });

  it("Top N=3 으로 변경 시 즉시 3개만 + 5 more 가 표시된다", () => {
    renderSidebar({
      collapsed: false,
      tree: overflowTree,
      activePackId: 50,
      active: "workflows",
    });
    fireEvent.click(screen.getByTestId("sidebar-workflows-settings-toggle-50"));
    fireEvent.click(screen.getByTestId("sidebar-workflows-settings-50-topN-3"));
    expect(screen.getByTestId("sidebar-workflow-500")).toBeInTheDocument();
    expect(screen.getByTestId("sidebar-workflow-502")).toBeInTheDocument();
    expect(
      screen.queryByTestId("sidebar-workflow-503"),
    ).not.toBeInTheDocument();
    expect(
      screen.getByTestId("sidebar-workflows-overflow-50"),
    ).toHaveTextContent("+5 more");
  });

  it("이름 기준 desc 정렬 시 워크플로우 순서가 역전된다", () => {
    renderSidebar({
      collapsed: false,
      tree: overflowTree,
      activePackId: 50,
      active: "workflows",
    });
    fireEvent.click(screen.getByTestId("sidebar-workflows-settings-toggle-50"));
    fireEvent.click(
      screen.getByTestId("sidebar-workflows-settings-50-sortField-name"),
    );
    fireEvent.click(
      screen.getByTestId("sidebar-workflows-settings-50-sortDir-desc"),
    );
    const list = screen.getByTestId("sidebar-workflows-list-50");
    const first = list.querySelector<HTMLAnchorElement>(
      'a[data-testid^="sidebar-workflow-"]',
    );
    expect(first?.dataset.testid).toBe("sidebar-workflow-507");
  });

  it("settings 변경이 localStorage 에 영속화된다", () => {
    renderSidebar({
      collapsed: false,
      tree: overflowTree,
      activePackId: 50,
      active: "workflows",
    });
    fireEvent.click(screen.getByTestId("sidebar-workflows-settings-toggle-50"));
    fireEvent.click(
      screen.getByTestId("sidebar-workflows-settings-50-topN-10"),
    );
    const raw = window.localStorage.getItem("ostone:sidebar:workflow-settings");
    expect(raw).not.toBeNull();
    expect(JSON.parse(raw!)).toMatchObject({ topN: 10 });
  });

  it("영속화된 settings 가 mount 시 hydrate 된다 (topN=3)", () => {
    window.localStorage.setItem(
      "ostone:sidebar:workflow-settings",
      JSON.stringify({ topN: 3, sortField: "workflowCode", sortDir: "asc" }),
    );
    renderSidebar({
      collapsed: false,
      tree: overflowTree,
      activePackId: 50,
      active: "workflows",
    });
    expect(
      screen.getByTestId("sidebar-workflows-overflow-50"),
    ).toHaveTextContent("+5 more");
  });

  it("워크플로우 수 ≤ Top N 인 경우 +M more 미노출", () => {
    renderSidebar({
      collapsed: false,
      tree: TREE_FIXTURE,
      activePackId: 11,
      active: "workflows",
    });
    expect(
      screen.queryByTestId("sidebar-workflows-overflow-11"),
    ).not.toBeInTheDocument();
  });
});
