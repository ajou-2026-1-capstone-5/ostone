import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";

import { WorkflowGraphMini } from "./WorkflowGraphMini";

const mockUseGetWorkflowDefinition = vi.fn();
vi.mock("@/entities/workflow", () => ({
  useGetWorkflowDefinition: (...args: unknown[]) => mockUseGetWorkflowDefinition(...args),
}));

function renderMini(workspaceId: number | null, packId = 2, versionId = 3, workflowId = 10) {
  return render(
    <MemoryRouter initialEntries={["/workspaces/1/something"]}>
      <Routes>
        <Route
          path="/workspaces/:workspaceId/*"
          element={
            <WorkflowGraphMini
              workspaceId={workspaceId}
              packId={packId}
              versionId={versionId}
              workflowId={workflowId}
            />
          }
        />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  mockUseGetWorkflowDefinition.mockReset();
});

describe("WorkflowGraphMini", () => {
  it("isLoading 시 loading placeholder 노출", () => {
    mockUseGetWorkflowDefinition.mockReturnValue({ isLoading: true });
    renderMini(null);
    expect(screen.getByTestId("workflow-graph-mini-loading-10")).toBeInTheDocument();
  });

  it("isError 시 unavailable 메시지 노출", () => {
    mockUseGetWorkflowDefinition.mockReturnValue({ isLoading: false, isError: true });
    renderMini(null);
    expect(screen.getByTestId("workflow-graph-mini-error-10")).toBeInTheDocument();
  });

  it("graphJson 이 빈 객체이면 empty graph 표시", () => {
    mockUseGetWorkflowDefinition.mockReturnValue({
      isLoading: false,
      isError: false,
      data: { graphJson: { nodes: [], edges: [] } },
    });
    renderMini(null);
    expect(screen.getByTestId("workflow-graph-mini-empty-10")).toBeInTheDocument();
  });

  it("graphJson 이 string 으로 전달되면 파싱하여 노드+엣지+라벨 렌더", () => {
    mockUseGetWorkflowDefinition.mockReturnValue({
      isLoading: false,
      isError: false,
      data: {
        graphJson: JSON.stringify({
          nodes: [
            { id: "a", label: "start", position: { x: 0, y: 0 } },
            { id: "b", label: "check_status", position: { x: 100, y: 50 } },
          ],
          edges: [{ id: "e1", from: "a", to: "b" }],
        }),
      },
    });
    renderMini(null);
    const svg = screen.getByTestId("workflow-graph-mini-10");
    expect(svg).toBeInTheDocument();
    expect(svg.querySelectorAll("circle").length).toBe(2);
    expect(svg.querySelectorAll("line").length).toBe(1);
    expect(svg.querySelectorAll("text").length).toBe(2);
    expect(svg.textContent).toContain("start");
  });

  it("legacy source/target 형식도 fallback 지원한다", () => {
    mockUseGetWorkflowDefinition.mockReturnValue({
      isLoading: false,
      isError: false,
      data: {
        graphJson: {
          nodes: [
            { id: "a", position: { x: 0, y: 0 } },
            { id: "b", position: { x: 50, y: 0 } },
          ],
          edges: [{ source: "a", target: "b" }],
        },
      },
    });
    renderMini(null);
    expect(screen.getByTestId("workflow-graph-mini-10").querySelectorAll("line").length).toBe(1);
  });

  it("라벨이 14자 초과면 말줄임표로 잘린다", () => {
    mockUseGetWorkflowDefinition.mockReturnValue({
      isLoading: false,
      isError: false,
      data: {
        graphJson: {
          nodes: [{ id: "a", label: "abcdefghijklmnopqrstuvwxyz", position: { x: 0, y: 0 } }],
          edges: [],
        },
      },
    });
    renderMini(null);
    expect(screen.getByTestId("workflow-graph-mini-10").textContent).toContain("…");
  });

  it("graphJson 이 손상되면 empty 처리", () => {
    mockUseGetWorkflowDefinition.mockReturnValue({
      isLoading: false,
      isError: false,
      data: { graphJson: "{not-json" },
    });
    renderMini(null);
    expect(screen.getByTestId("workflow-graph-mini-empty-10")).toBeInTheDocument();
  });

  it("workspaceId prop 으로 직접 전달하면 useParams 보다 우선한다", () => {
    mockUseGetWorkflowDefinition.mockReturnValue({
      isLoading: false,
      isError: false,
      data: {
        graphJson: { nodes: [{ id: "a", position: { x: 0, y: 0 } }], edges: [] },
      },
    });
    renderMini(7, 1, 2, 3);
    expect(mockUseGetWorkflowDefinition).toHaveBeenCalledWith(
      expect.objectContaining({ workspaceId: 7, packId: 1, versionId: 2, workflowId: 3 }),
    );
  });
});
