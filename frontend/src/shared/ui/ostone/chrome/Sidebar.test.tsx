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
    expect(screen.getByTitle("상담 응대")).toBeInTheDocument();
    expect(screen.getByTitle("사용자 화면 미리보기")).toBeInTheDocument();
    expect(screen.getByTitle("상담 로그 수집")).toBeInTheDocument();
    expect(screen.getByTitle("도메인팩 관리")).toBeInTheDocument();
    expect(screen.getByText("상담 응대")).toBeInTheDocument();
    expect(screen.getByText("사용자 화면 미리보기")).toBeInTheDocument();
    expect(screen.getByText("상담 로그 수집")).toBeInTheDocument();
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

    expect(screen.getByTitle("상담 응대")).toHaveAttribute("data-active", "true");
  });

  it("basePath prop을 지정하면 링크에 반영된다", () => {
    renderSidebar({ basePath: "/workspaces/7" });

    expect(screen.getByTitle("상담 응대")).toHaveAttribute("href", "/workspaces/7/consultation");
    expect(screen.getByTitle("사용자 화면 미리보기")).toHaveAttribute("href", "/demo/chat/7");
    expect(screen.getByTitle("사용자 화면 미리보기")).toHaveAttribute("target", "_blank");
    expect(screen.getByTitle("사용자 화면 미리보기")).toHaveAttribute("rel", "noopener noreferrer");
    expect(screen.getByTitle("도메인팩 관리")).toHaveAttribute(
      "href",
      "/workspaces/7/domain-packs",
    );
  });

  it("workspaceId를 추출할 수 없으면 사용자 화면 미리보기 링크를 안전한 내부 경로로 보낸다", () => {
    renderSidebar({ basePath: "/workspaces" });

    expect(screen.getByTitle("사용자 화면 미리보기")).toHaveAttribute("href", "/workspaces");
  });

  it("외부 링크(사용자 화면 미리보기)에만 새 탭 안내 아이콘을 표시한다", () => {
    renderSidebar({ basePath: "/workspaces/7" });

    const externalIcon = screen.getByLabelText("새 탭에서 열림");
    expect(externalIcon).toBeInTheDocument();
    expect(screen.getByTestId("sidebar-link-chat")).toContainElement(externalIcon);
    expect(screen.getAllByLabelText("새 탭에서 열림")).toHaveLength(1);

    expect(
      screen.getByTestId("sidebar-link-consult").querySelector('[aria-label="새 탭에서 열림"]'),
    ).toBeNull();
    expect(
      screen.getByTestId("sidebar-domain-link").querySelector('[aria-label="새 탭에서 열림"]'),
    ).toBeNull();
  });

  it("switcher가 주어지면 렌더링된다", () => {
    renderSidebar({ switcher: <div data-testid="switcher">Switch</div> });

    expect(screen.getByTestId("switcher")).toBeInTheDocument();
  });

  it("inactive 항목에 mouseEnter/Leave 시 배경이 토글된다", () => {
    renderSidebar({ active: "consult" });
    const link = screen.getByTitle("상담 로그 수집") as HTMLElement;

    fireEvent.mouseEnter(link);
    expect(link.style.background).toBe("var(--paper-3)");
    fireEvent.mouseLeave(link);
    expect(link.style.background).toBe("transparent");
  });

  it("redesign: active 링크는 fontWeight 540, idle은 450 으로 그려진다", () => {
    renderSidebar({ active: "consult" });

    const activeLink = screen.getByTitle("상담 응대") as HTMLElement;
    const idleLink = screen.getByTitle("상담 로그 수집") as HTMLElement;

    expect(activeLink.style.fontWeight).toBe("540");
    expect(idleLink.style.fontWeight).toBe("450");
  });

  it("redesign: 모든 링크는 13.5px / letter-spacing -0.18px / Pretendard 변수 폰트를 사용한다", () => {
    renderSidebar({ active: "consult" });

    const link = screen.getByTitle("상담 응대") as HTMLElement;
    expect(link.style.fontSize).toBe("13.5px");
    expect(link.style.letterSpacing).toBe("-0.18px");
    expect(link.style.fontFamily).toBe("var(--font-sans)");
  });

  it("redesign: TOP_NAV 항목마다 sidebar-link-{key} data-testid를 노출한다", () => {
    renderSidebar({ active: "consult" });

    expect(screen.getByTestId("sidebar-link-consult")).toBeInTheDocument();
    expect(screen.getByTestId("sidebar-link-chat")).toBeInTheDocument();
    expect(screen.getByTestId("sidebar-link-upload")).toBeInTheDocument();
  });
});
