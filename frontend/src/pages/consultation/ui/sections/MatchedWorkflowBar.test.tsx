import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import "@testing-library/jest-dom/vitest";
import { MatchedWorkflowBar, MatchedWorkflowBarSkeleton } from "./MatchedWorkflowBar";
import type { MatchedWorkflow } from "../../../../features/consultation/api/llmToolWorkflowApi";

const navigateMock = vi.fn();

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return {
    ...actual,
    useNavigate: () => navigateMock,
  };
});

vi.mock("@/entities/workflow", () => ({
  WorkflowGraphMiniSvg: ({ workflowId }: { workflowId: number }) => (
    <svg data-testid={`workflow-graph-mini-${workflowId}`} />
  ),
}));

const baseWorkflow: MatchedWorkflow = {
  sessionId: 7,
  workspaceId: 3,
  domainPackId: 42,
  domainPackVersionId: 12,
  executionId: 41,
  executionStatus: "RUNNING",
  currentState: "COLLECT_INFO",
  workflowDefinitionId: 88,
  workflowCode: "REFUND_FLOW",
  workflowName: "환불 워크플로우",
  workflowDescription: "환불 처리 흐름",
  graphJson: { nodes: [{ id: "n1", type: "START", label: "start" }], edges: [] },
};

function renderBar(workflow: MatchedWorkflow = baseWorkflow) {
  return render(
    <MemoryRouter>
      <MatchedWorkflowBar workflow={workflow} />
    </MemoryRouter>,
  );
}

describe("MatchedWorkflowBar", () => {
  beforeEach(() => {
    navigateMock.mockReset();
  });

  it("renders only the workflow title by default (collapsed)", () => {
    renderBar();

    expect(screen.getByTestId("matched-workflow-bar")).toHaveAttribute("data-state", "closed");
    expect(screen.getByTestId("matched-workflow-bar-title")).toHaveTextContent("환불 워크플로우");
    expect(screen.queryByTestId("matched-workflow-bar-preview")).not.toBeInTheDocument();
    expect(screen.queryByTestId("matched-workflow-bar-meta")).not.toBeInTheDocument();
    expect(screen.queryByText("진행 중")).not.toBeInTheDocument();
  });

  it("expands preview on hover (mouseEnter)", () => {
    renderBar();
    const bar = screen.getByTestId("matched-workflow-bar");

    fireEvent.mouseEnter(bar);

    expect(bar).toHaveAttribute("data-state", "open");
    expect(screen.getByTestId("matched-workflow-bar-preview")).toBeInTheDocument();
    expect(screen.getByText("진행 중")).toBeInTheDocument();
    expect(screen.getByTestId("matched-workflow-bar-meta")).toHaveTextContent(
      "응대 코드 REFUND_FLOW · v12 · COLLECT_INFO",
    );
    expect(screen.getByTestId("matched-workflow-bar-description")).toHaveTextContent(
      "환불 처리 흐름",
    );
    expect(screen.getByTestId("workflow-graph-mini-88")).toBeInTheDocument();
  });

  it("collapses preview on mouseLeave when focus is not inside", () => {
    renderBar();
    const bar = screen.getByTestId("matched-workflow-bar");

    fireEvent.mouseEnter(bar);
    expect(bar).toHaveAttribute("data-state", "open");

    fireEvent.mouseLeave(bar);
    expect(bar).toHaveAttribute("data-state", "closed");
  });

  it("expands preview on focusCapture (keyboard navigation)", () => {
    renderBar();
    const bar = screen.getByTestId("matched-workflow-bar");

    fireEvent.focus(screen.getByTestId("matched-workflow-bar-open"));

    expect(bar).toHaveAttribute("data-state", "open");
  });

  it("navigates to workflow detail page when the title button is clicked", () => {
    renderBar();

    fireEvent.click(screen.getByTestId("matched-workflow-bar-open"));

    expect(navigateMock).toHaveBeenCalledWith(
      "/workspaces/3/domain-packs/42/workflows/88?versionId=12",
    );
  });

  it("does not navigate when domainPackId is missing", () => {
    renderBar({ ...baseWorkflow, domainPackId: null });

    const openBtn = screen.getByTestId("matched-workflow-bar-open");
    expect(openBtn).toBeDisabled();

    fireEvent.click(openBtn);
    expect(navigateMock).not.toHaveBeenCalled();
  });

  it("does not navigate when domainPackVersionId is missing", () => {
    renderBar({ ...baseWorkflow, domainPackVersionId: null });
    expect(screen.getByTestId("matched-workflow-bar-open")).toBeDisabled();
  });

  it("falls back to workflowCode when workflowName is null", () => {
    renderBar({ ...baseWorkflow, workflowName: null });

    expect(screen.getByTestId("matched-workflow-bar-title")).toHaveTextContent("REFUND_FLOW");
  });

  it("falls back to literal label when both workflowName and workflowCode are null", () => {
    renderBar({ ...baseWorkflow, workflowName: null, workflowCode: null });

    expect(screen.getByTestId("matched-workflow-bar-title")).toHaveTextContent("응대 흐름");
  });

  it("shows graph unavailable placeholder when graphJson is missing (after hover)", () => {
    renderBar({ ...baseWorkflow, graphJson: undefined });
    fireEvent.mouseEnter(screen.getByTestId("matched-workflow-bar"));

    expect(screen.getByTestId("matched-workflow-bar-graph")).toHaveTextContent(
      "흐름 미리보기 없음",
    );
    expect(screen.queryByTestId("workflow-graph-mini-88")).not.toBeInTheDocument();
  });

  it("omits description in preview when workflowDescription is null", () => {
    renderBar({ ...baseWorkflow, workflowDescription: null });
    fireEvent.mouseEnter(screen.getByTestId("matched-workflow-bar"));

    expect(screen.queryByTestId("matched-workflow-bar-description")).not.toBeInTheDocument();
  });

  it("renders UNKNOWN status pill in preview when executionStatus is null", () => {
    renderBar({ ...baseWorkflow, executionStatus: null });
    fireEvent.mouseEnter(screen.getByTestId("matched-workflow-bar"));

    expect(screen.getByText("상태 미확인")).toBeInTheDocument();
  });

  it("omits meta in preview when no meta parts are available", () => {
    renderBar({
      ...baseWorkflow,
      workflowCode: null,
      domainPackVersionId: null,
      currentState: null,
    });
    fireEvent.mouseEnter(screen.getByTestId("matched-workflow-bar"));

    expect(screen.queryByTestId("matched-workflow-bar-meta")).not.toBeInTheDocument();
  });

  it("handles unknown execution status with mute tone gracefully in preview", () => {
    renderBar({ ...baseWorkflow, executionStatus: "UNEXPECTED" });
    fireEvent.mouseEnter(screen.getByTestId("matched-workflow-bar"));

    expect(screen.getByText("UNEXPECTED")).toBeInTheDocument();
  });
});

describe("MatchedWorkflowBarSkeleton", () => {
  it("renders a busy placeholder", () => {
    render(<MatchedWorkflowBarSkeleton />);
    const skeleton = screen.getByTestId("matched-workflow-bar-skeleton");
    expect(skeleton).toBeInTheDocument();
    expect(skeleton).toHaveAttribute("aria-busy", "true");
  });
});
