import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";

import { DashboardStatePanel, WorkspaceDashboardPage } from "./WorkspaceDashboardPage";

const setCrumbs = vi.fn();

function renderPage(path = "/workspaces/1/dashboard") {
  setCrumbs.mockClear();
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route
          path="/workspaces/:workspaceId/dashboard"
          element={<WorkspaceDashboardPage />}
        />
        <Route path="/workspaces" element={<div data-testid="workspace-root" />} />
      </Routes>
    </MemoryRouter>,
  );
}

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return {
    ...actual,
    useOutletContext: () => ({ setCrumbs, workspace: { id: 1, name: "CS Team" } }),
  };
});

describe("WorkspaceDashboardPage", () => {
  it("잘못된 workspaceId면 /workspaces로 리다이렉트한다", () => {
    renderPage("/workspaces/abc/dashboard");
    expect(screen.getByTestId("workspace-root")).toBeInTheDocument();
  });

  it("공통 필터와 빈 상태 CTA를 표시한다", () => {
    renderPage();

    expect(screen.getByRole("heading", { name: "대시보드" })).toBeInTheDocument();
    expect(screen.getByLabelText("기간 필터")).toBeInTheDocument();
    expect(screen.getByLabelText("Domain Pack Version 필터")).toHaveValue("all");
    expect(screen.getByLabelText("채널 필터")).toHaveValue("all");
    expect(screen.getByLabelText("워크플로우 상태 필터")).toHaveValue("all");
    expect(screen.getByTestId("dashboard-empty")).toBeInTheDocument();
    expect(screen.getByTestId("dashboard-upload-cta")).toHaveAttribute(
      "href",
      "/workspaces/1/upload",
    );
    expect(screen.getByTestId("dashboard-pack-cta")).toHaveAttribute(
      "href",
      "/workspaces/1/domain-packs",
    );
    expect(screen.getByTestId("dashboard-simulation-cta")).toHaveAttribute(
      "href",
      "/demo/chat/1",
    );
  });

  it("기간과 공통 필터 변경을 요약 상태에 반영한다", () => {
    renderPage();

    fireEvent.click(screen.getByRole("button", { name: "사용자 지정" }));
    fireEvent.change(screen.getByLabelText("시작일"), { target: { value: "2026-06-01" } });
    fireEvent.change(screen.getByLabelText("종료일"), { target: { value: "2026-06-03" } });
    fireEvent.change(screen.getByLabelText("Domain Pack Version 필터"), {
      target: { value: "published" },
    });
    fireEvent.change(screen.getByLabelText("채널 필터"), { target: { value: "email" } });
    fireEvent.change(screen.getByLabelText("워크플로우 상태 필터"), {
      target: { value: "handoff" },
    });

    const summary = screen.getByLabelText("대시보드 필터 요약");
    expect(summary).toHaveTextContent("2026-06-01 ~ 2026-06-03");
    expect(summary).toHaveTextContent("운영 버전");
    expect(summary).toHaveTextContent("이메일");
    expect(summary).toHaveTextContent("상담원 연결");
  });

  it("loading, error, partial 상태 패널이 같은 shell 영역에서 렌더링된다", () => {
    const { rerender } = render(
      <MemoryRouter>
        <DashboardStatePanel state="loading" workspaceId={1} />
      </MemoryRouter>,
    );
    expect(screen.getByTestId("dashboard-loading")).toBeInTheDocument();

    rerender(
      <MemoryRouter>
        <DashboardStatePanel state="error" workspaceId={1} />
      </MemoryRouter>,
    );
    expect(screen.getByTestId("dashboard-error")).toBeInTheDocument();

    rerender(
      <MemoryRouter>
        <DashboardStatePanel state="partial" workspaceId={1} />
      </MemoryRouter>,
    );
    expect(screen.getByTestId("dashboard-partial")).toBeInTheDocument();
  });
});
