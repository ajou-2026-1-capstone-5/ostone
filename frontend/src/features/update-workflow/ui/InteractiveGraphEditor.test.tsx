import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import type { Connection, Edge, Node } from "@xyflow/react";
import { toast } from "sonner";

const xyflowMock = vi.hoisted(() => ({
  currentNodes: [] as Node[],
}));

vi.mock("sonner", () => ({
  toast: {
    warning: vi.fn(),
  },
}));

vi.mock("@/shared/ui/react-flow/FitOnInit", () => ({
  FitOnInit: () => null,
}));

vi.mock("@xyflow/react", async () => {
  const React = await vi.importActual<typeof import("react")>("react");

  return {
    ReactFlow: ({
      children,
      edges,
      nodes,
      onConnect,
    }: {
      children?: React.ReactNode;
      edges: Edge[];
      nodes: Node[];
      onConnect?: (connection: Connection) => void;
    }) => {
      xyflowMock.currentNodes = nodes;
      return (
        <div data-testid="react-flow" data-edge-count={edges.length}>
          <button
            type="button"
            data-testid="connect-self"
            onClick={() =>
              onConnect?.({
                source: "decision-1",
                target: "decision-1",
                sourceHandle: null,
                targetHandle: null,
              })
            }
          />
          <button
            type="button"
            data-testid="connect-normal"
            onClick={() =>
              onConnect?.({
                source: "decision-1",
                target: "answer-1",
                sourceHandle: null,
                targetHandle: null,
              })
            }
          />
          <button
            type="button"
            data-testid="connect-default"
            onClick={() =>
              onConnect?.({
                source: "answer-1",
                target: "decision-1",
                sourceHandle: null,
                targetHandle: null,
              })
            }
          />
          {children}
        </div>
      );
    },
    ReactFlowProvider: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
    Background: () => null,
    Controls: () => null,
    Handle: () => null,
    NodeToolbar: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
    BaseEdge: () => null,
    EdgeLabelRenderer: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
    BackgroundVariant: { Dots: "dots" },
    MarkerType: { ArrowClosed: "arrowclosed" },
    Position: {
      Top: "top",
      Right: "right",
      Bottom: "bottom",
      Left: "left",
    },
    addEdge: (edge: Edge, edges: Edge[]) => [...edges, edge],
    useEdgesState: (initialEdges: Edge[]) => {
      const [edges, setEdges] = React.useState(initialEdges);
      return [edges, setEdges, vi.fn()];
    },
    useNodesState: (initialNodes: Node[]) => {
      const [nodes, setNodes] = React.useState(initialNodes);
      return [nodes, setNodes, vi.fn()];
    },
    useNodesInitialized: () => true,
    useReactFlow: () => ({
      fitView: vi.fn(),
      screenToFlowPosition: ({ x, y }: { x: number; y: number }) => ({ x, y }),
      getNode: (id: string) => xyflowMock.currentNodes.find((node) => node.id === id),
    }),
  };
});

import { InteractiveGraphEditor } from "./InteractiveGraphEditor";

const initialNodes: Node[] = [
  {
    id: "decision-1",
    type: "decision",
    data: { label: "분기" },
    position: { x: 0, y: 0 },
  },
  {
    id: "answer-1",
    type: "answer",
    data: { label: "답변" },
    position: { x: 160, y: 0 },
  },
];

function renderEditor(onStateChange = vi.fn()) {
  render(
    <InteractiveGraphEditor initialNodes={initialNodes} initialEdges={[]} onStateChange={onStateChange} />,
  );
  return { onStateChange };
}

describe("InteractiveGraphEditor", () => {
  beforeEach(() => {
    vi.mocked(toast.warning).mockReset();
  });

  it("같은 노드를 source와 target으로 연결하면 엣지를 추가하지 않고 안내한다", async () => {
    renderEditor();

    screen.getByTestId("connect-self").click();

    expect(toast.warning).toHaveBeenCalledWith("같은 노드로 연결할 수 없습니다.");
    expect(screen.getByTestId("react-flow")).toHaveAttribute("data-edge-count", "0");
  });

  it("서로 다른 노드는 기존처럼 decision edge로 연결한다", async () => {
    const { onStateChange } = renderEditor();

    screen.getByTestId("connect-normal").click();

    await waitFor(() =>
      expect(screen.getByTestId("react-flow")).toHaveAttribute("data-edge-count", "1"),
    );
    expect(toast.warning).not.toHaveBeenCalled();
    await waitFor(() =>
      expect(onStateChange).toHaveBeenLastCalledWith(
        expect.any(Array),
        expect.arrayContaining([
          expect.objectContaining({
            source: "decision-1",
            target: "answer-1",
            type: "decision",
          }),
        ]),
      ),
    );
  });

  it("decision 노드가 아닌 source의 정상 연결은 기본 edge로 유지한다", async () => {
    const { onStateChange } = renderEditor();

    screen.getByTestId("connect-default").click();

    await waitFor(() =>
      expect(screen.getByTestId("react-flow")).toHaveAttribute("data-edge-count", "1"),
    );
    const latestEdges = vi.mocked(onStateChange).mock.calls.at(-1)?.[1] ?? [];
    expect(latestEdges).toEqual([
      expect.objectContaining({
        source: "answer-1",
        target: "decision-1",
        type: undefined,
      }),
    ]);
  });
});
