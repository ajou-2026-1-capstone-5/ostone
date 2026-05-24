import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { Sidebar } from "./Sidebar";

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

describe("Sidebar", () => {
  it("collapsed 모드에서는 width 72px과 글로벌 아이콘 항목을 표시한다", () => {
    renderSidebar({ collapsed: true });

    const nav = screen.getByLabelText("주요 내비게이션");
    expect(nav).toHaveAttribute("data-collapsed", "true");
    expect(nav).toHaveStyle({ width: "72px" });
    expect(screen.getByTitle("Consultation")).toBeInTheDocument();
    expect(screen.getByTitle("Uploads")).toBeInTheDocument();
    expect(screen.getByTitle("Domain Packs")).toBeInTheDocument();
    expect(screen.queryByTitle("Workflows")).not.toBeInTheDocument();
  });

  it("expanded 모드에서는 Domain Packs가 목록 화면 링크만 담당한다", () => {
    renderSidebar({ collapsed: false });

    const nav = screen.getByLabelText("주요 내비게이션");
    expect(nav).toHaveAttribute("data-collapsed", "false");
    expect(nav).toHaveStyle({ width: "256px" });
    expect(screen.getByTestId("sidebar-domain-link")).toHaveAttribute(
      "href",
      "/workspaces/domain-packs",
    );
    expect(screen.queryByTestId("sidebar-tree")).not.toBeInTheDocument();
  });

  it("도메인팩 하위 화면 active에서도 Domain Packs 링크만 active이고 트리는 표시하지 않는다", () => {
    renderSidebar({ collapsed: false, active: "intent" });

    const link = screen.getByTestId("sidebar-domain-link");
    expect(link).toHaveAttribute("data-active", "true");
    expect(link).toHaveAttribute("href", "/workspaces/domain-packs");
    expect(screen.queryByTestId("sidebar-tree")).not.toBeInTheDocument();
    expect(screen.queryByText("Intents")).not.toBeInTheDocument();
  });

  it("Domain Packs 링크는 active=consult이면 비활성이다", () => {
    renderSidebar({ collapsed: false, active: "consult" });

    expect(screen.getByTestId("sidebar-domain-link")).toHaveAttribute("data-active", "false");
  });

  it("collapsed 시 nav 배경 클릭으로 onToggleCollapsed가 호출된다", () => {
    const onToggleCollapsed = vi.fn();
    renderSidebar({ collapsed: true, onToggleCollapsed });

    fireEvent.click(screen.getByLabelText("주요 내비게이션"));

    expect(onToggleCollapsed).toHaveBeenCalledTimes(1);
  });

  it("collapsed 시에는 별도 접기 버튼이 렌더되지 않는다", () => {
    renderSidebar({ collapsed: true });

    expect(screen.queryByLabelText("사이드바 접기")).not.toBeInTheDocument();
  });

  it("expanded 시 접기 버튼 클릭으로 onToggleCollapsed가 호출된다", () => {
    const onToggleCollapsed = vi.fn();
    renderSidebar({ collapsed: false, onToggleCollapsed });

    fireEvent.click(screen.getByLabelText("사이드바 접기"));

    expect(onToggleCollapsed).toHaveBeenCalledTimes(1);
  });

  it("active=consult일 때 Consultation 항목이 강조된다", () => {
    renderSidebar({ active: "consult", collapsed: true });

    expect(screen.getByTitle("Consultation")).toHaveAttribute("data-active", "true");
  });

  it("basePath prop을 지정하면 링크에 반영된다", () => {
    renderSidebar({ collapsed: true, basePath: "/workspaces/7" });

    expect(screen.getByTitle("Consultation")).toHaveAttribute(
      "href",
      "/workspaces/7/consultation",
    );
    expect(screen.getByTitle("Domain Packs")).toHaveAttribute(
      "href",
      "/workspaces/7/domain-packs",
    );
  });

  it("switcher가 주어지면 렌더링된다", () => {
    renderSidebar({ switcher: <div data-testid="switcher">Switch</div> });

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
});
