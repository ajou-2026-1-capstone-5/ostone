import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, it, expect, vi } from "vitest";
import { WorkflowEditSheet } from "../../../features/update-workflow";
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
  WorkflowDetailPanel: ({ onEdit }: { onEdit?: () => void }) => (
    <div>
      <span>DetailPanel</span>
      {onEdit && (
        <button type="button" onClick={onEdit}>
          Edit
        </button>
      )}
    </div>
  ),
}));

vi.mock("../../../features/update-workflow", () => ({
  WorkflowEditSheet: vi.fn(() => null),
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
  beforeEach(() => {
    vi.mocked(WorkflowEditSheet).mockReturnValue(null);
  });

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

  it("Edit 버튼 클릭 시 WorkflowEditSheet의 isOpen이 true가 된다", () => {
    vi.mocked(WorkflowEditSheet).mockImplementation(({ isOpen }) =>
      isOpen ? <div data-testid="edit-sheet-open" /> : null,
    );
    renderPage("/workspaces/1/domain-packs/2/versions/3/workflows/10");
    expect(screen.queryByTestId("edit-sheet-open")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    expect(screen.getByTestId("edit-sheet-open")).toBeInTheDocument();
  });

  it("WorkflowEditSheet onClose 호출 시 sheet가 닫힌다", () => {
    vi.mocked(WorkflowEditSheet).mockImplementation(({ isOpen, onClose }) =>
      isOpen ? (
        <button type="button" data-testid="close-btn" onClick={onClose}>
          Close
        </button>
      ) : null,
    );
    renderPage("/workspaces/1/domain-packs/2/versions/3/workflows/10");
    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    expect(screen.getByTestId("close-btn")).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("close-btn"));
    expect(screen.queryByTestId("close-btn")).not.toBeInTheDocument();
  });
});
