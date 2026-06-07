import { useState } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import {
  MemoryRouter,
  Outlet,
  Route,
  Routes,
  useLocation,
} from "react-router-dom";
import type { WorkflowDefinitionDetail } from "@/shared/api/generated/zod";
import { WorkflowGraphViewerPage } from "./WorkflowGraphViewerPage";

const mockUseGetWorkflowDefinition = vi.fn();
const mockUsePackDetail = vi.fn();

vi.mock("@/features/domain-pack-summary-read", () => ({
  usePackDetail: (...args: unknown[]) => mockUsePackDetail(...args),
}));

vi.mock("@/entities/workflow", () => ({
  useGetWorkflowDefinition: (...args: unknown[]) =>
    mockUseGetWorkflowDefinition(...args),
}));

vi.mock("@/features/workflow-viewer/ui/GraphViewer", () => ({
  GraphViewer: () => <div data-testid="graph-viewer">Graph</div>,
}));

function LocationProbe() {
  const location = useLocation();
  return (
    <div data-testid="location">{`${location.pathname}${location.search}`}</div>
  );
}

function ShellHost() {
  const [crumbs, setCrumbs] = useState<Array<string | { label: string }>>([]);
  const [topbarRight, setTopbarRight] = useState<React.ReactNode>();

  return (
    <>
      <div data-testid="shell-crumbs">
        {crumbs
          .map((crumb) => (typeof crumb === "string" ? crumb : crumb.label))
          .join(" / ")}
      </div>
      <div data-testid="shell-topbar">{topbarRight}</div>
      <Outlet context={{ setCrumbs, setTopbarRight, workspace: null }} />
    </>
  );
}

function renderPage(
  path = "/workspaces/1/domain-packs/2/workflows/4/graph?versionId=3",
) {
  render(
    <MemoryRouter
      initialEntries={[
        {
          pathname: path.split("?")[0],
          search: path.includes("?") ? `?${path.split("?")[1]}` : "",
        },
      ]}
    >
      <Routes>
        <Route
          path="/workspaces/:workspaceId/domain-packs/:packId"
          element={<ShellHost />}
        >
          <Route
            path="workflows/:workflowId/graph"
            element={
              <>
                <WorkflowGraphViewerPage />
                <LocationProbe />
              </>
            }
          />
        </Route>
        <Route path="*" element={<LocationProbe />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("WorkflowGraphViewerPage", () => {
  beforeEach(() => {
    mockUseGetWorkflowDefinition.mockReset();
    mockUsePackDetail.mockReset();
    mockUsePackDetail.mockReturnValue({
      data: {
        name: "CS Pack",
        versions: [{ versionId: 3, versionNo: 1 }],
      },
    });
  });

  it("shows loading state when isLoading is true", () => {
    mockUseGetWorkflowDefinition.mockReturnValue({
      data: undefined,
      isLoading: true,
      error: null,
    });

    renderPage();
    expect(screen.getByTestId("loading-state")).toBeInTheDocument();
    expect(screen.getByTestId("shell-crumbs")).toHaveTextContent("워크플로우");
  });

  it("shows error state when error is present", () => {
    mockUseGetWorkflowDefinition.mockReturnValue({
      data: undefined,
      isLoading: false,
      error: new Error("Failed to load"),
    });

    renderPage();
    expect(screen.getByTestId("error-state")).toBeInTheDocument();
  });

  it("shows GraphViewer when data is loaded", () => {
    const mockData: WorkflowDefinitionDetail = {
      graphJson: JSON.stringify({
        direction: "LR",
        nodes: [],
        edges: [],
      }),
    };
    mockUseGetWorkflowDefinition.mockReturnValue({
      data: mockData,
      isLoading: false,
      error: null,
    });

    renderPage();
    expect(screen.getByTestId("graph-viewer")).toBeInTheDocument();
  });

  it("shows GraphViewer when graphJson is already an object and versionId exists", () => {
    const mockData: WorkflowDefinitionDetail = {
      workflowCode: "WF_REFUND",
      graphJson: {
        nodes: [],
        edges: [],
      },
    };
    mockUseGetWorkflowDefinition.mockReturnValue({
      data: mockData,
      isLoading: false,
      error: null,
    });

    renderPage();

    expect(screen.getByTestId("graph-viewer")).toBeInTheDocument();
  });

  it("shows empty state when graphJson is null", () => {
    const mockData: WorkflowDefinitionDetail = {
      graphJson: undefined,
    };
    mockUseGetWorkflowDefinition.mockReturnValue({
      data: mockData,
      isLoading: false,
      error: null,
    });

    renderPage();
    expect(screen.getByTestId("empty-state")).toBeInTheDocument();
  });

  it("shows URL error state when versionId query is missing", () => {
    mockUseGetWorkflowDefinition.mockReturnValue({
      data: undefined,
      isLoading: false,
      error: null,
    });

    renderPage("/workspaces/1/domain-packs/2/workflows/4/graph");
    expect(screen.getByTestId("url-error-state")).toHaveTextContent(
      "잘못된 URL 파라미터입니다.",
    );
  });

  it("shows graph data error state when graphJson is malformed", () => {
    const mockData: WorkflowDefinitionDetail = {
      graphJson: "not-json",
    };
    mockUseGetWorkflowDefinition.mockReturnValue({
      data: mockData,
      isLoading: false,
      error: null,
    });

    renderPage();
    expect(screen.getByTestId("graph-data-error-state")).toHaveTextContent(
      "워크플로우 그래프 데이터 형식이 올바르지 않습니다.",
    );
    expect(screen.queryByTestId("empty-state")).not.toBeInTheDocument();
  });

  it("moves back to workflow list from graph page", () => {
    const mockData: WorkflowDefinitionDetail = {
      id: 4,
      name: "환불 처리",
      workflowCode: "refund.standard",
      graphJson: JSON.stringify({
        direction: "LR",
        nodes: [],
        edges: [],
      }),
    };
    mockUseGetWorkflowDefinition.mockReturnValue({
      data: mockData,
      isLoading: false,
      error: null,
    });

    renderPage();
    fireEvent.click(screen.getByRole("button", { name: "목록" }));
    expect(screen.getByTestId("location")).toHaveTextContent(
      "/workspaces/1/domain-packs/2/workflows?versionId=3",
    );
  });

  it("moves back to workflow detail from graph page", () => {
    const mockData: WorkflowDefinitionDetail = {
      id: 4,
      name: "환불 처리",
      workflowCode: "refund.standard",
      graphJson: JSON.stringify({
        direction: "LR",
        nodes: [],
        edges: [],
      }),
    };
    mockUseGetWorkflowDefinition.mockReturnValue({
      data: mockData,
      isLoading: false,
      error: null,
    });

    renderPage();
    fireEvent.click(screen.getByRole("button", { name: "상세" }));
    expect(screen.getByTestId("location")).toHaveTextContent(
      "/workspaces/1/domain-packs/2/workflows/4?versionId=3",
    );
  });
});
