import type { ReactElement } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, it, expect, vi } from "vitest";
import { WorkflowEditSheet } from "../../../features/update-workflow";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { WorkflowDraftReadPage } from "./WorkflowDraftReadPage";

vi.mock("@/widgets/ostone-shell", () => ({
  OstoneShell: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
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
    vi.mocked(WorkflowEditSheet).mockReturnValue(null as unknown as ReactElement);
  });

  it("유효하지 않은 URL 파라미터는 에러 메시지를 보여준다", () => {
    renderPage("/workspaces/abc/domain-packs/2/versions/3/workflows");
    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.getByText("잘못된 URL 파라미터입니다.")).toBeInTheDocument();
  });

  it("Pack header에 검토 중 · v0.4 pill을 렌더링한다", () => {
    renderPage("/workspaces/1/domain-packs/2/versions/3/workflows");
    expect(screen.getByText("검토 중 · v0.4")).toBeInTheDocument();
    expect(screen.getByText("Card payment refund flow")).toBeInTheDocument();
  });

  it("7개 탭이 모두 렌더링되고 5번째 탭이 aria-selected=true이다", () => {
    renderPage("/workspaces/1/domain-packs/2/versions/3/workflows");
    const tabs = screen.getAllByRole("tab");
    expect(tabs).toHaveLength(7);
    expect(tabs[4]).toHaveAttribute("aria-selected", "true");
    expect(tabs[4]).toHaveTextContent(/응대 흐름/);
  });

  it("3-pane 구조가 존재한다", () => {
    renderPage("/workspaces/1/domain-packs/2/versions/3/workflows");
    expect(screen.getByRole("heading", { name: /refund\.standard/ })).toBeInTheDocument();
    expect(screen.getByText("Selected node")).toBeInTheDocument();
  });

  it("workflowId가 있는 경로에서 WorkflowEditSheet가 정상 렌더링된다", () => {
    renderPage("/workspaces/1/domain-packs/2/versions/3/workflows/10");
    expect(screen.getByRole("heading", { name: /refund\.standard/ })).toBeInTheDocument();
  });

  it("Edit graph 버튼 클릭 시 WorkflowEditSheet의 isOpen이 true가 된다", () => {
    vi.mocked(WorkflowEditSheet).mockImplementation(({ isOpen }) =>
      (isOpen ? <div data-testid="edit-sheet-open" /> : null) as ReactElement,
    );
    renderPage("/workspaces/1/domain-packs/2/versions/3/workflows/10");
    expect(screen.queryByTestId("edit-sheet-open")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Edit graph/ }));
    expect(screen.getByTestId("edit-sheet-open")).toBeInTheDocument();
  });

  it("WorkflowEditSheet onClose 호출 시 sheet가 닫힌다", () => {
    vi.mocked(WorkflowEditSheet).mockImplementation(({ isOpen, onClose }) =>
      (isOpen ? (
        <button type="button" data-testid="close-btn" onClick={onClose}>
          Close
        </button>
      ) : null) as ReactElement,
    );
    renderPage("/workspaces/1/domain-packs/2/versions/3/workflows/10");
    fireEvent.click(screen.getByRole("button", { name: /Edit graph/ }));
    expect(screen.getByTestId("close-btn")).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("close-btn"));
    expect(screen.queryByTestId("close-btn")).not.toBeInTheDocument();
  });
});
