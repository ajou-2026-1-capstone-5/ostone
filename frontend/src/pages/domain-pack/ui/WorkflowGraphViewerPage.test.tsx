import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import type { WorkflowDefinitionDetail } from "@/shared/api/generated/zod";
import { WorkflowGraphViewerPage } from "./WorkflowGraphViewerPage";

const mockUseGetWorkflowDefinition = vi.hoisted(() => vi.fn());

vi.mock("react-router-dom", async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...(actual as object),
    useParams: () => ({
      workspaceId: "1",
      packId: "2",
      versionId: "3",
      workflowId: "4",
    }),
  };
});

vi.mock("@/entities/workflow", () => ({
  useGetWorkflowDefinition: mockUseGetWorkflowDefinition,
}));

vi.mock("@/features/workflow-viewer/ui/GraphViewer", () => ({
  GraphViewer: () => <div data-testid="graph-viewer">Graph</div>,
}));

function Wrapper({ children }: { children: React.ReactNode }) {
  return <MemoryRouter>{children}</MemoryRouter>;
}

describe("WorkflowGraphViewerPage", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("shows loading state when isLoading is true", () => {
    mockUseGetWorkflowDefinition.mockReturnValue({
      data: undefined,
      isLoading: true,
      error: null,
    });

    render(<WorkflowGraphViewerPage />, { wrapper: Wrapper });
    expect(screen.getByTestId("loading-state")).toBeInTheDocument();
  });

  it("shows error state when error is present", () => {
    mockUseGetWorkflowDefinition.mockReturnValue({
      data: undefined,
      isLoading: false,
      error: new Error("Failed to load"),
    });

    render(<WorkflowGraphViewerPage />, { wrapper: Wrapper });
    expect(screen.getByTestId("error-state")).toBeInTheDocument();
  });

  it("shows GraphViewer when data is loaded", () => {
    const mockData: WorkflowDefinitionDetail = {
      graphJson: JSON.stringify({
        nodes: [],
        edges: [],
      }),
    };
    mockUseGetWorkflowDefinition.mockReturnValue({
      data: mockData,
      isLoading: false,
      error: null,
    });

    render(<WorkflowGraphViewerPage />, { wrapper: Wrapper });
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

    render(<WorkflowGraphViewerPage />, { wrapper: Wrapper });
    expect(screen.getByTestId("empty-state")).toBeInTheDocument();
  });
});
