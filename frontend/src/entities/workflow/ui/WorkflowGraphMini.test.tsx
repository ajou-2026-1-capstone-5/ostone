import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../api/useGetWorkflowDefinition", () => ({
  useGetWorkflowDefinition: vi.fn(),
}));

import { useGetWorkflowDefinition } from "../api/useGetWorkflowDefinition";

import { WorkflowGraphMini } from "./WorkflowGraphMini";

const mockedHook = vi.mocked(useGetWorkflowDefinition);

function renderMini(workflowId = 42) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0, staleTime: 0 } },
  });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <WorkflowGraphMini workspaceId={1} packId={1} versionId={1} workflowId={workflowId} />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  mockedHook.mockReset();
});

describe("WorkflowGraphMini (enhanced)", () => {
  it("loading 상태 노출", () => {
    mockedHook.mockReturnValue({ isLoading: true, isError: false, data: undefined } as never);
    renderMini();
    expect(screen.getByTestId("workflow-graph-mini-loading-42")).toBeInTheDocument();
  });

  it("error 상태 노출", async () => {
    mockedHook.mockReturnValue({ isLoading: false, isError: true, data: undefined } as never);
    renderMini();
    await waitFor(() =>
      expect(screen.getByTestId("workflow-graph-mini-error-42")).toBeInTheDocument(),
    );
  });

  it("empty graph 노출", async () => {
    mockedHook.mockReturnValue({
      isLoading: false,
      isError: false,
      data: { graphJson: { nodes: [], edges: [] } },
    } as never);
    renderMini();
    await waitFor(() =>
      expect(screen.getByTestId("workflow-graph-mini-empty-42")).toBeInTheDocument(),
    );
  });

  it("정상 graph: marker, 엣지 라벨, 노드 데이터 속성", async () => {
    mockedHook.mockReturnValue({
      isLoading: false,
      isError: false,
      data: {
        graphJson: {
          nodes: [
            { id: "a", type: "START", label: "시작", position: { x: 0, y: 0 } },
            { id: "b", type: "DECISION", label: "조건?", position: { x: 100, y: 0 } },
            { id: "c", type: "TERMINAL", label: "끝", position: { x: 200, y: 0 } },
          ],
          edges: [
            { from: "a", to: "b" },
            { from: "b", to: "c", label: "예" },
          ],
        },
      },
    } as never);
    renderMini();
    const svg = await screen.findByTestId("workflow-graph-mini-42");
    expect(svg).toBeInTheDocument();
    expect(svg.querySelector("marker")).not.toBeNull();
    expect(svg.querySelectorAll("path").length).toBeGreaterThan(0);
    expect(svg.textContent ?? "").toContain("예");
    expect(svg.querySelector('[data-node-type="DECISION"]')).not.toBeNull();
  });

  it("사이클 그래프는 data-has-cycle=true", async () => {
    mockedHook.mockReturnValue({
      isLoading: false,
      isError: false,
      data: {
        graphJson: {
          nodes: [{ id: "a" }, { id: "b" }, { id: "c" }],
          edges: [
            { from: "a", to: "b" },
            { from: "b", to: "c" },
            { from: "c", to: "a" },
          ],
        },
      },
    } as never);
    renderMini();
    const svg = await screen.findByTestId("workflow-graph-mini-42");
    expect(svg.dataset.hasCycle).toBe("true");
  });
});
