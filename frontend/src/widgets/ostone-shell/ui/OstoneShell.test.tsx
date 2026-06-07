import { describe, it, expect, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { OstoneShell } from "./OstoneShell";

function Wrapper({ children }: { children: React.ReactNode }) {
  return <MemoryRouter>{children}</MemoryRouter>;
}

beforeEach(() => {
  window.localStorage.clear();
});

describe("OstoneShell", () => {
  it("renders Sidebar with dashboard as the first workspace nav item", () => {
    render(
      <OstoneShell active="consult" crumbs={[]}>
        <div>content</div>
      </OstoneShell>,
      { wrapper: Wrapper },
    );
    expect(screen.queryByTitle("Operator")).not.toBeInTheDocument();
    expect(screen.queryByTitle("Pipeline")).not.toBeInTheDocument();
    expect(screen.getByTitle("대시보드")).toBeInTheDocument();
    expect(screen.getByTitle("상담 응대")).toBeInTheDocument();
    expect(screen.getByTitle("공개 데모 선택")).toBeInTheDocument();
    expect(screen.getByTitle("상담 로그 수집")).toBeInTheDocument();
    expect(screen.getByTitle("도메인팩 관리")).toBeInTheDocument();
    expect(screen.queryByTitle("Workflows")).not.toBeInTheDocument();
  });

  it("renders Topbar with CStone brand", () => {
    render(
      <OstoneShell active="workflows" crumbs={["CARD-CS", "Domain Packs"]}>
        <div>content</div>
      </OstoneShell>,
      { wrapper: Wrapper },
    );
    expect(screen.getByText("CStone")).toBeInTheDocument();
    expect(screen.getByText("CARD-CS")).toBeInTheDocument();
    expect(screen.getAllByText("도메인팩 관리")).toHaveLength(2);
  });

  it("상위 화면의 workspace breadcrumb를 업무 라벨로 표시한다", () => {
    render(
      <OstoneShell active="upload" crumbs={["CARD-CS"]}>
        <div>content</div>
      </OstoneShell>,
      { wrapper: Wrapper },
    );

    expect(screen.queryByText("CARD-CS")).not.toBeInTheDocument();
    expect(screen.getAllByText("상담 로그 수집").length).toBeGreaterThanOrEqual(1);
  });

  it("chat 상위 화면 breadcrumb를 운영자 미리보기 라벨로 표시한다", () => {
    render(
      <OstoneShell active="chat" crumbs={["CARD-CS"]} basePath="/workspaces/7">
        <div>content</div>
      </OstoneShell>,
      { wrapper: Wrapper },
    );

    expect(screen.queryByText("CARD-CS")).not.toBeInTheDocument();
    expect(screen.getAllByText("운영자 미리보기").length).toBeGreaterThanOrEqual(1);
  });

  it("상세 화면의 여러 breadcrumb는 그대로 유지한다", () => {
    render(
      <OstoneShell active="workflows" crumbs={["WS · 1", "Domain Packs", "Workflows"]}>
        <div>content</div>
      </OstoneShell>,
      { wrapper: Wrapper },
    );

    expect(screen.getByText("WS · 1")).toBeInTheDocument();
    expect(screen.getAllByText("도메인팩 관리")).toHaveLength(2);
    expect(screen.getByText("워크플로우")).toBeInTheDocument();
  });

  it("renders children in main area", () => {
    render(
      <OstoneShell active="workflows" crumbs={[]}>
        <div data-testid="shell-child">Hello Shell</div>
      </OstoneShell>,
      { wrapper: Wrapper },
    );
    expect(screen.getByTestId("shell-child")).toBeInTheDocument();
  });

  it("starts with fixed expanded sidebar", () => {
    render(
      <OstoneShell active="workflows" crumbs={[]}>
        <div>content</div>
      </OstoneShell>,
      { wrapper: Wrapper },
    );
    expect(screen.getByLabelText("주요 내비게이션")).toHaveAttribute("data-collapsed", "false");
    expect(screen.getByLabelText("주요 내비게이션")).toHaveStyle({
      width: "200px",
    });
  });

  it("sidebar collapsed localStorage 값이 있어도 fixed expanded 상태를 유지한다", () => {
    window.localStorage.setItem("ostone:sidebar:collapsed", "true");
    render(
      <OstoneShell active="workflows" crumbs={[]}>
        <div>content</div>
      </OstoneShell>,
      { wrapper: Wrapper },
    );
    const nav = screen.getByLabelText("주요 내비게이션");
    expect(nav).toHaveAttribute("data-collapsed", "false");
    expect(screen.queryByLabelText("사이드바 접기")).not.toBeInTheDocument();
    expect(window.localStorage.getItem("ostone:sidebar:collapsed")).toBe("true");
  });

  it("localStorage에 false가 저장돼 있어도 sidebar 값을 다시 쓰지 않는다", () => {
    window.localStorage.setItem("ostone:sidebar:collapsed", "false");
    render(
      <OstoneShell active="workflows" crumbs={[]}>
        <div>content</div>
      </OstoneShell>,
      { wrapper: Wrapper },
    );
    expect(screen.getByLabelText("주요 내비게이션")).toHaveAttribute("data-collapsed", "false");
    expect(window.localStorage.getItem("ostone:sidebar:collapsed")).toBe("false");
  });

  it("renders dark variant", () => {
    render(
      <OstoneShell active="consult" crumbs={[]} dark>
        <div>dark</div>
      </OstoneShell>,
      { wrapper: Wrapper },
    );
    expect(screen.getByText("dark")).toBeInTheDocument();
  });
});
