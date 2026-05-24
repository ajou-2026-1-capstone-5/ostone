import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";

import { PackWorkflowListPage } from "./PackWorkflowListPage";

const mockUseListWorkflows = vi.fn();

vi.mock(
  "@/shared/api/generated/endpoints/workflow-definition-controller/workflow-definition-controller",
  () => ({
    useListWorkflows: (...args: unknown[]) => mockUseListWorkflows(...args),
  }),
);

vi.mock("@/features/workflow-list", () => ({
  WorkflowListView: vi.fn(({ entries, onOpen }) => (
    <div data-testid="workflow-list-view">
      {entries.map((entry: { workflowId: number; name: string }) => (
        <button
          key={entry.workflowId}
          type="button"
          data-testid={`mock-card-${entry.workflowId}`}
          onClick={() =>
            onOpen({
              packId: 2,
              packName: "pack-2",
              versionId: 3,
              workflowId: entry.workflowId,
              workflowCode: null,
              name: entry.name,
              description: null,
            })
          }
        >
          {entry.name}
        </button>
      ))}
    </div>
  )),
}));

vi.mock("@/widgets/ostone-shell", () => ({
  OstoneShell: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

const ROUTE = "/workspaces/:workspaceId/domain-packs/:packId/workflows";

function NavigatedRoute() {
  const loc = useLocation();
  return <div data-testid="navigated">{loc.pathname + loc.search}</div>;
}

function renderPage(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path={ROUTE} element={<PackWorkflowListPage />} />
        <Route path="/workspaces" element={<div data-testid="workspaces-root">root</div>} />
        <Route path="*" element={<NavigatedRoute />} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  mockUseListWorkflows.mockReset();
});

describe("PackWorkflowListPage", () => {
  it("유효하지 않은 wsId는 /workspaces 로 redirect", () => {
    mockUseListWorkflows.mockReturnValue({ isLoading: false, isError: false, data: undefined });
    renderPage("/workspaces/abc/domain-packs/2/workflows?versionId=3");
    expect(screen.getByTestId("workspaces-root")).toBeInTheDocument();
  });

  it("loading 시 loading state 가 노출된다", () => {
    mockUseListWorkflows.mockReturnValue({ isLoading: true, isError: false, data: undefined });
    renderPage("/workspaces/1/domain-packs/2/workflows?versionId=3");
    expect(screen.getByTestId("pack-workflows-loading")).toBeInTheDocument();
  });

  it("error 시 error state 가 노출된다", () => {
    mockUseListWorkflows.mockReturnValue({
      isLoading: false,
      isError: true,
      data: undefined,
      refetch: vi.fn(),
    });
    renderPage("/workspaces/1/domain-packs/2/workflows?versionId=3");
    expect(screen.getByTestId("pack-workflows-error")).toBeInTheDocument();
  });

  it("결과가 비어 있으면 empty state 가 노출된다", () => {
    mockUseListWorkflows.mockReturnValue({
      isLoading: false,
      isError: false,
      data: { data: [] },
    });
    renderPage("/workspaces/1/domain-packs/2/workflows?versionId=3");
    expect(screen.getByTestId("pack-workflows-empty")).toBeInTheDocument();
  });

  it("워크플로우 데이터를 WorkflowListView 로 전달한다", () => {
    mockUseListWorkflows.mockReturnValue({
      isLoading: false,
      isError: false,
      data: {
        data: [
          { id: 10, name: "Alpha", workflowCode: "wf.a", description: null },
          { id: 11, name: "Beta", workflowCode: "wf.b", description: null },
        ],
      },
    });
    renderPage("/workspaces/1/domain-packs/2/workflows?versionId=3");
    expect(screen.getByTestId("workflow-list-view")).toBeInTheDocument();
    expect(screen.getByTestId("mock-card-10")).toHaveTextContent("Alpha");
    expect(screen.getByTestId("mock-card-11")).toHaveTextContent("Beta");
  });

  it("ID 없는 워크플로우 항목은 필터링한다", () => {
    mockUseListWorkflows.mockReturnValue({
      isLoading: false,
      isError: false,
      data: {
        data: [
          { name: "noid", workflowCode: "wf.x", description: null },
          { id: 22, name: "withId", workflowCode: "wf.y", description: null },
        ],
      },
    });
    renderPage("/workspaces/1/domain-packs/2/workflows?versionId=3");
    expect(screen.queryByTestId("mock-card-22")).toBeInTheDocument();
    expect(screen.queryByText("noid")).not.toBeInTheDocument();
  });

  it("plain array 응답도 지원한다 (unwrapApiResponse fallback)", () => {
    mockUseListWorkflows.mockReturnValue({
      isLoading: false,
      isError: false,
      data: [{ id: 99, name: "Plain", workflowCode: null, description: null }],
    });
    renderPage("/workspaces/1/domain-packs/2/workflows?versionId=3");
    expect(screen.getByTestId("mock-card-99")).toBeInTheDocument();
  });

  it("카드 클릭 시 워크플로우 상세 경로로 navigate", () => {
    mockUseListWorkflows.mockReturnValue({
      isLoading: false,
      isError: false,
      data: { data: [{ id: 42, name: "Click me", workflowCode: null, description: null }] },
    });
    renderPage("/workspaces/1/domain-packs/2/workflows?versionId=3");
    fireEvent.click(screen.getByTestId("mock-card-42"));
    expect(screen.getByTestId("navigated")).toHaveTextContent(
      "/workspaces/1/domain-packs/2/workflows/42?versionId=3",
    );
  });
});
