import { describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { Sidebar } from "./Sidebar";

type SidebarProps = Parameters<typeof Sidebar>[0];

function renderSidebar(props: Partial<SidebarProps> = {}) {
  const defaults: SidebarProps = {
    active: "consult",
  };
  return render(
    <MemoryRouter>
      <Sidebar {...defaults} {...props} />
    </MemoryRouter>,
  );
}

describe("Sidebar", () => {
  it("항상 200px 고정 폭과 글로벌 항목 label을 표시한다", () => {
    renderSidebar();

    const nav = screen.getByLabelText("주요 내비게이션");
    expect(nav).toHaveAttribute("data-collapsed", "false");
    expect(nav).toHaveStyle({ width: "200px" });
    expect(screen.getByTitle("Consultation")).toBeInTheDocument();
    expect(screen.getByTitle("Chat")).toBeInTheDocument();
    expect(screen.getByTitle("Uploads")).toBeInTheDocument();
    expect(screen.getByTitle("Domain Packs")).toBeInTheDocument();
    expect(screen.getByText("Consultation")).toBeInTheDocument();
    expect(screen.getByText("Chat")).toBeInTheDocument();
    expect(screen.getByText("Uploads")).toBeInTheDocument();
    expect(screen.queryByTitle("Workflows")).not.toBeInTheDocument();
  });

  it("Domain Packs가 목록 화면 링크만 담당한다", () => {
    renderSidebar();

    const nav = screen.getByLabelText("주요 내비게이션");
    expect(nav).toHaveAttribute("data-collapsed", "false");
    expect(nav).toHaveStyle({ width: "200px" });
    expect(screen.getByTestId("sidebar-domain-link")).toHaveAttribute(
      "href",
      "/workspaces/domain-packs",
    );
    expect(screen.queryByTestId("sidebar-tree")).not.toBeInTheDocument();
  });

  it("도메인팩 하위 화면 active에서도 Domain Packs 링크만 active이고 트리는 표시하지 않는다", () => {
    renderSidebar({ active: "intent" });

    const link = screen.getByTestId("sidebar-domain-link");
    expect(link).toHaveAttribute("data-active", "true");
    expect(link).toHaveAttribute("href", "/workspaces/domain-packs");
    expect(screen.queryByTestId("sidebar-tree")).not.toBeInTheDocument();
    expect(screen.queryByText("Intents")).not.toBeInTheDocument();
  });

  it("Domain Packs 링크는 active=consult이면 비활성이다", () => {
    renderSidebar({ active: "consult" });

    expect(screen.getByTestId("sidebar-domain-link")).toHaveAttribute("data-active", "false");
  });

  it("접기 버튼을 렌더하지 않는다", () => {
    renderSidebar();

    expect(screen.queryByLabelText("사이드바 접기")).not.toBeInTheDocument();
  });

  it("active=consult일 때 Consultation 항목이 강조된다", () => {
    renderSidebar({ active: "consult" });

    expect(screen.getByTitle("Consultation")).toHaveAttribute("data-active", "true");
  });

  it("basePath prop을 지정하면 링크에 반영된다", () => {
    renderSidebar({ basePath: "/workspaces/7" });

    expect(screen.getByTitle("Consultation")).toHaveAttribute("href", "/workspaces/7/consultation");
    expect(screen.getByTitle("Chat")).toHaveAttribute("href", "/demo/workspaces/7/chat");
    expect(screen.getByTitle("Chat")).toHaveAttribute("target", "_blank");
    expect(screen.getByTitle("Chat")).toHaveAttribute("rel", "noopener noreferrer");
    expect(screen.getByTitle("Domain Packs")).toHaveAttribute("href", "/workspaces/7/domain-packs");
  });

  it("workspaceId를 추출할 수 없으면 Chat 링크를 안전한 내부 경로로 보낸다", () => {
    renderSidebar({ basePath: "/workspaces" });

    expect(screen.getByTitle("Chat")).toHaveAttribute("href", "/workspaces");
  });

  it("switcher가 주어지면 렌더링된다", () => {
    renderSidebar({ switcher: <div data-testid="switcher">Switch</div> });

    expect(screen.getByTestId("switcher")).toBeInTheDocument();
  });

  it("inactive 항목에 mouseEnter/Leave 시 배경이 토글된다", () => {
    renderSidebar({ active: "consult" });
    const link = screen.getByTitle("Uploads") as HTMLElement;

    fireEvent.mouseEnter(link);
    expect(link.style.background).toBe("var(--paper-3)");
    fireEvent.mouseLeave(link);
    expect(link.style.background).toBe("transparent");
  });
});
