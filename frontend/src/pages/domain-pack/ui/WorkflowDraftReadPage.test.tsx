import { fireEvent, render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { WorkflowDraftReadPage } from "./WorkflowDraftReadPage";

vi.mock("../../../shared/ui/layout/DashboardLayout", () => ({
  DashboardLayout: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock("../../../features/workflow-draft-read/ui", () => ({
  WorkflowListPanel: ({
    onSelect,
  }: {
    onSelect: (id: number) => void;
  }) => (
    <button type="button" onClick={() => onSelect(42)}>
      ListPanel
    </button>
  ),
  WorkflowDetailPanel: () => <div>DetailPanel</div>,
}));

vi.mock("../../../features/update-workflow", () => ({
  WorkflowEditSheet: () => null,
}));

const ROUTE =
  "/workspaces/:workspaceId/domain-packs/:packId/versions/:versionId/workflows/:workflowId?";

function renderPage(path: string) {
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path={ROUTE} element={<WorkflowDraftReadPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("WorkflowDraftReadPage", () => {
  it("유효하지 않은 URL 파라미터는 에러 메시지를 보여준다", () => {
    renderPage("/workspaces/abc/domain-packs/2/versions/3/workflows");
    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.getByText("잘못된 URL 파라미터입니다.")).toBeInTheDocument();
  });

  it("유효한 파라미터로 패널을 렌더링한다", () => {
    renderPage("/workspaces/1/domain-packs/2/versions/3/workflows");
    expect(screen.getByText("ListPanel")).toBeInTheDocument();
    expect(screen.getByText("DetailPanel")).toBeInTheDocument();
  });

  it("breadcrumb에 wsId / packId / versionId를 표시한다", () => {
    renderPage("/workspaces/1/domain-packs/2/versions/3/workflows");
    expect(screen.getByText("WS · 1")).toBeInTheDocument();
    expect(screen.getByText("PACK · 2")).toBeInTheDocument();
    expect(screen.getByText("VER · 3")).toBeInTheDocument();
  });

  it("READ ONLY 배지를 표시한다", () => {
    renderPage("/workspaces/1/domain-packs/2/versions/3/workflows");
    expect(screen.getByText("READ ONLY")).toBeInTheDocument();
  });

  it("목록 패널의 onSelect가 호출되어도 오류가 발생하지 않는다", () => {
    renderPage("/workspaces/1/domain-packs/2/versions/3/workflows");
    fireEvent.click(screen.getByText("ListPanel"));
    expect(screen.getByText("ListPanel")).toBeInTheDocument();
  });

  it("workflowId가 있는 경로에서 패널이 정상 렌더링된다", () => {
    renderPage("/workspaces/1/domain-packs/2/versions/3/workflows/10");
    expect(screen.getByText("DetailPanel")).toBeInTheDocument();
  });

  it("workflowId가 있으면 목록 버튼(← 목록)이 보인다", () => {
    renderPage("/workspaces/1/domain-packs/2/versions/3/workflows/10");
    expect(screen.getByRole("button", { name: /목록/ })).toBeInTheDocument();
  });
});
