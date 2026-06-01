import { render, screen } from "@testing-library/react";
import { beforeEach, describe, it, vi, expect } from "vitest";
import GraphRenderer from "./GraphRenderer";

const mockReactFlow = vi.hoisted(() =>
  vi.fn((props: Record<string, unknown>) => (
    <div data-testid="react-flow">{props.children as React.ReactNode}</div>
  )),
);

const mockToFlow = vi.hoisted(() => vi.fn((): any => ({ nodes: [], edges: [] })));

vi.mock("@xyflow/react", () => ({
  ReactFlow: mockReactFlow,
  Background: () => null,
  Controls: () => null,
}));

vi.mock("@/entities/workflow", () => ({
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
    mockToFlow.mockReturnValueOnce({
      nodes: [{ id: "N1", type: "action", data: { label: "N1" }, position: { x: 0, y: 0 } }],
      edges: [],
    });
    render(<GraphRenderer graph={stubGraph} />);
    expect(screen.getByTestId("react-flow")).toBeInTheDocument();
  });

  it("노드/엣지 없는 그래프도 오류 없이 렌더링한다", () => {
    const emptyGraph = { direction: "TB" as const, nodes: [], edges: [] };
    render(<GraphRenderer graph={emptyGraph} />);
    expect(screen.getByText("워크플로우 데이터 없음")).toBeInTheDocument();
  });

  it("interaction props가 spec대로 설정된다", () => {
    mockToFlow.mockReturnValueOnce({
      nodes: [{ id: "N1", type: "action", data: { label: "N1" }, position: { x: 0, y: 0 } }],
      edges: [],
    });
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
    mockToFlow.mockReturnValueOnce({
      nodes: [{ id: "N1", type: "action", data: { label: "N1" }, position: { x: 0, y: 0 } }],
      edges: [],
    });
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
        {
          id: "COMPLETED",
          type: "action",
          data: { label: "Completed" },
          position: { x: 200, y: 0 },
        },
        { id: "OTHER", type: "action", data: { label: "Other" }, position: { x: 400, y: 0 } },
      ],
      edges: [],
    });
    render(<GraphRenderer graph={stubGraph} selectedNodeIds={["INITIAL", "COMPLETED"]} />);
    const [receivedProps] = mockReactFlow.mock.calls.at(-1)! as [
      { nodes: Array<{ id: string; data: { selected?: boolean } }> },
    ];
    const initialNode = receivedProps.nodes.find((n) => n.id === "INITIAL");
    const otherNode = receivedProps.nodes.find((n) => n.id === "OTHER");
    expect(initialNode?.data.selected).toBe(true);
    expect(otherNode?.data.selected).toBeUndefined();
  });

  it("works without optional props (backward compatibility)", () => {
    mockToFlow.mockReturnValueOnce({
      nodes: [{ id: "N1", type: "action", data: { label: "N1" }, position: { x: 0, y: 0 } }],
      edges: [],
    });
    render(<GraphRenderer graph={stubGraph} />);
    expect(screen.getByTestId("react-flow")).toBeInTheDocument();
  });

  it("does not set data.selected when selectedNodeIds is empty", () => {
    mockToFlow.mockReturnValueOnce({
      nodes: [{ id: "N1", type: "action", data: { label: "N1" }, position: { x: 0, y: 0 } }],
      edges: [],
    });
    render(<GraphRenderer graph={stubGraph} selectedNodeIds={[]} />);
    const [receivedProps] = mockReactFlow.mock.calls.at(-1)! as [
      { nodes: Array<{ id: string; data: { selected?: boolean } }> },
    ];
    expect(receivedProps.nodes[0]?.data.selected).toBeUndefined();
  });

  it("handles empty selectedNodeIds gracefully", () => {
    mockToFlow.mockReturnValueOnce({
      nodes: [{ id: "N1", type: "action", data: { label: "N1" }, position: { x: 0, y: 0 } }],
      edges: [],
    });
    render(<GraphRenderer graph={stubGraph} selectedNodeIds={[]} />);
    expect(screen.getByTestId("react-flow")).toBeInTheDocument();
  });

  it("handles null selectedNodeIds gracefully", () => {
    mockToFlow.mockReturnValueOnce({
      nodes: [{ id: "N1", type: "action", data: { label: "N1" }, position: { x: 0, y: 0 } }],
      edges: [],
    });
    render(<GraphRenderer graph={stubGraph} selectedNodeIds={null as unknown as string[]} />);
    expect(screen.getByTestId("react-flow")).toBeInTheDocument();
  });

  it("sets data.current=true for the node matching currentNodeId", () => {
    mockToFlow.mockReturnValueOnce({
      nodes: [
        { id: "NODE_1", type: "action", data: { label: "1" }, position: { x: 0, y: 0 } },
        { id: "NODE_2", type: "action", data: { label: "2" }, position: { x: 200, y: 0 } },
      ],
      edges: [],
    });
    render(<GraphRenderer graph={stubGraph} currentNodeId="NODE_1" />);
    const [receivedProps] = mockReactFlow.mock.calls.at(-1) as unknown as [Record<string, unknown>];
    const richProps = receivedProps as {
      nodes?: Array<{ id: string; data: Record<string, unknown> }>;
    };
    const node1 = richProps.nodes?.find((n) => n.id === "NODE_1");
    const node2 = richProps.nodes?.find((n) => n.id === "NODE_2");
    expect(node1?.data.current).toBe(true);
    expect(node2?.data.current).toBeUndefined();
  });
});
