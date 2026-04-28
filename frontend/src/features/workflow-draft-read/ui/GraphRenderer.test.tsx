import { render, screen } from "@testing-library/react";
import { beforeEach, describe, it, vi, expect } from "vitest";
import GraphRenderer from "./GraphRenderer";

const mockReactFlow = vi.hoisted(() =>
  vi.fn(({ children }: { children?: React.ReactNode }) => (
    <div data-testid="react-flow">{children}</div>
  )),
);

vi.mock("@xyflow/react", () => ({
  ReactFlow: mockReactFlow,
  Background: () => null,
  Controls: () => null,
}));

vi.mock("./graphMapper", () => ({
  toFlow: () => ({ nodes: [], edges: [] }),
}));

vi.mock("./nodes/StartNode", () => ({ StartNode: () => null }));
vi.mock("./nodes/ActionNode", () => ({ ActionNode: () => null }));
vi.mock("./nodes/DecisionNode", () => ({ DecisionNode: () => null }));
vi.mock("./nodes/AnswerNode", () => ({ AnswerNode: () => null }));
vi.mock("./nodes/HandoffNode", () => ({ HandoffNode: () => null }));
vi.mock("./nodes/TerminalNode", () => ({ TerminalNode: () => null }));

const stubGraph = {
  direction: "LR" as const,
  nodes: [],
  edges: [],
};

describe("GraphRenderer", () => {
  beforeEach(() => {
    mockReactFlow.mockClear();
  });

  it("ReactFlow 컨테이너를 렌더링한다", () => {
    render(<GraphRenderer graph={stubGraph} />);
    expect(screen.getByTestId("react-flow")).toBeInTheDocument();
  });

  it("노드/엣지 없는 그래프도 오류 없이 렌더링한다", () => {
    const emptyGraph = { direction: "TB" as const, nodes: [], edges: [] };
    render(<GraphRenderer graph={emptyGraph} />);
    expect(screen.getByTestId("react-flow")).toBeInTheDocument();
  });

  it("interaction props가 spec대로 설정된다", () => {
    render(<GraphRenderer graph={stubGraph} />);
    const [receivedProps] = mockReactFlow.mock.calls.at(-1)!;
    expect(receivedProps).toMatchObject({
      panOnDrag: true,
      zoomOnScroll: true,
      nodesDraggable: false,
      nodesConnectable: false,
      elementsSelectable: false,
    });
  });
});
