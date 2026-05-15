import { render, screen } from "@testing-library/react";
import { beforeEach, describe, it, vi, expect } from "vitest";
import GraphRenderer from "./GraphRenderer";

const mockReactFlow = vi.hoisted(() =>
  vi.fn(({ children }: { children?: React.ReactNode }) => (
    <div data-testid="react-flow">{children}</div>
  )),
);

const mockToFlow = vi.hoisted(() => vi.fn(() => ({ nodes: [], edges: [] })));

vi.mock("@xyflow/react", () => ({
  ReactFlow: mockReactFlow,
  Background: () => null,
  Controls: () => null,
}));

vi.mock("./graphMapper", () => ({
  toFlow: mockToFlow,
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
    mockToFlow.mockClear();
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

describe("GraphRenderer new props", () => {
  beforeEach(() => {
    mockReactFlow.mockClear();
    mockToFlow.mockClear();
  });

  it("calls onNodeSelect when ReactFlow node is clicked", () => {
    const onNodeSelect = vi.fn();
    render(<GraphRenderer graph={stubGraph} onNodeSelect={onNodeSelect} />);
    const [receivedProps] = mockReactFlow.mock.calls.at(-1)!;
    expect(typeof receivedProps.onNodeClick).toBe("function");
    // @ts-expect-error - mock event object
    receivedProps.onNodeClick?.(undefined, { id: "test-node" });
    expect(onNodeSelect).toHaveBeenCalledWith("test-node");
  });

  it("sets data.selected=true for nodes in selectedNodeIds", () => {
    mockToFlow.mockReturnValueOnce({
      nodes: [
        { id: "INITIAL", type: "action", data: { label: "Initial" }, position: { x: 0, y: 0 } },
        { id: "COMPLETED", type: "action", data: { label: "Completed" }, position: { x: 200, y: 0 } },
        { id: "OTHER", type: "action", data: { label: "Other" }, position: { x: 400, y: 0 } },
      ],
      edges: [],
    });
    render(<GraphRenderer graph={stubGraph} selectedNodeIds={["INITIAL", "COMPLETED"]} />);
    const [receivedProps] = mockReactFlow.mock.calls.at(-1)!;
    const initialNode = receivedProps.nodes.find((n: { id: string }) => n.id === "INITIAL");
    const otherNode = receivedProps.nodes.find((n: { id: string }) => n.id === "OTHER");
    expect(initialNode.data.selected).toBe(true);
    expect(otherNode.data.selected).toBeUndefined();
  });

  it("works without optional props (backward compatibility)", () => {
    render(<GraphRenderer graph={stubGraph} />);
    expect(screen.getByTestId("react-flow")).toBeInTheDocument();
  });

  it("returns default undefined selected when selectedNodeIds is empty", () => {
    render(<GraphRenderer graph={stubGraph} />);
    const [receivedProps] = mockReactFlow.mock.calls.at(-1)!;
    expect(receivedProps.nodes).toEqual([]);
  });

  it("handles empty selectedNodeIds gracefully", () => {
    render(<GraphRenderer graph={stubGraph} selectedNodeIds={[]} />);
    expect(screen.getByTestId("react-flow")).toBeInTheDocument();
  });

  it("handles null selectedNodeIds gracefully", () => {
    render(<GraphRenderer graph={stubGraph} selectedNodeIds={null as unknown as string[]} />);
    expect(screen.getByTestId("react-flow")).toBeInTheDocument();
  });
});
