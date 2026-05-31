import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { EditableStartNode } from "./EditableStartNode";
import { EditableActionNode } from "./EditableActionNode";
import { EditableDecisionNode } from "./EditableDecisionNode";
import { EditableAnswerNode } from "./EditableAnswerNode";
import { EditableHandoffNode } from "./EditableHandoffNode";
import { EditableTerminalNode } from "./EditableTerminalNode";

const updateNodeData = vi.fn();
const deleteElements = vi.fn();

vi.mock("@xyflow/react", () => ({
  Handle: ({ type, id }: { type: string; id: string }) => (
    <div data-testid={`handle-${type}-${id}`} />
  ),
  Position: { Left: "left", Right: "right", Top: "top", Bottom: "bottom" },
  NodeToolbar: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useReactFlow: () => ({ updateNodeData, deleteElements }),
  // Run the selector against an empty edges store so every node sees zero
  // connected sides — that matches the "fresh editor" case and lets the
  // hook's natural return shape (object vs. array) flow through unchanged.
  useStore: (selector: (s: { edges: never[] }) => unknown) => selector({ edges: [] }),
}));

const baseProps = {
  id: "n1",
  type: "start" as const,
  selected: false,
  dragging: false,
  zIndex: 0,
  selectable: true,
  deletable: false,
  draggable: true,
  isConnectable: false,
  positionAbsoluteX: 0,
  positionAbsoluteY: 0,
};

describe("EditableStartNode", () => {
  it("renders card with start testid and label input", () => {
    render(<EditableStartNode {...baseProps} data={{ label: "시작" }} />);
    expect(screen.getByTestId("editable-start-node")).toBeInTheDocument();
    expect(screen.getByLabelText("노드 이름")).toHaveValue("시작");
  });

  it("commits label change on blur via updateNodeData", () => {
    updateNodeData.mockClear();
    render(<EditableStartNode {...baseProps} data={{ label: "" }} />);
    const input = screen.getByLabelText("노드 이름");
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "새 라벨" } });
    fireEvent.blur(input);
    expect(updateNodeData).toHaveBeenCalledWith("n1", { label: "새 라벨" });
  });

  it("exposes 4 source handles (target side disabled for START)", () => {
    render(<EditableStartNode {...baseProps} data={{ label: "시작" }} />);
    expect(screen.getAllByTestId(/^handle-source-/)).toHaveLength(4);
    expect(screen.queryAllByTestId(/^handle-target-/)).toHaveLength(0);
  });

  it("renders description and badges to mirror the viewer", () => {
    render(
      <EditableStartNode
        {...baseProps}
        data={{ label: "시작", description: "트리거 시점", badges: ["트리거", "1회"] }}
      />,
    );
    expect(screen.getByText("트리거 시점")).toBeInTheDocument();
    expect(screen.getByText("트리거")).toBeInTheDocument();
    expect(screen.getByText("1회")).toBeInTheDocument();
  });
});

describe("EditableActionNode", () => {
  it("renders both label and policyRef inputs", () => {
    render(
      <EditableActionNode
        {...baseProps}
        type="action"
        data={{ label: "처리", policyRef: "PR-001" }}
      />,
    );
    expect(screen.getByLabelText("노드 이름")).toHaveValue("처리");
    expect(screen.getByLabelText("응대 기준 참조 코드")).toHaveValue("PR-001");
  });

  it("renders container testid", () => {
    render(<EditableActionNode {...baseProps} type="action" data={{ label: "x" }} />);
    expect(screen.getByTestId("editable-action-node")).toBeInTheDocument();
  });

  it("commits policyRef change", () => {
    updateNodeData.mockClear();
    render(
      <EditableActionNode {...baseProps} type="action" data={{ label: "x", policyRef: "" }} />,
    );
    const input = screen.getByLabelText("응대 기준 참조 코드");
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "PR-NEW" } });
    fireEvent.blur(input);
    expect(updateNodeData).toHaveBeenCalledWith("n1", { policyRef: "PR-NEW" });
  });

  it("exposes 4 source + 4 target handles", () => {
    render(<EditableActionNode {...baseProps} type="action" data={{ label: "x" }} />);
    expect(screen.getAllByTestId(/^handle-source-/)).toHaveLength(4);
    expect(screen.getAllByTestId(/^handle-target-/)).toHaveLength(4);
  });

  it("renders description + badges", () => {
    render(
      <EditableActionNode
        {...baseProps}
        type="action"
        data={{
          label: "잠금 해제",
          policyRef: "ACT-UNLOCK-001",
          description: "계정 자동 잠금 해제",
          badges: ["policy:unlock", "audit:on"],
        }}
      />,
    );
    expect(screen.getByText("계정 자동 잠금 해제")).toBeInTheDocument();
    expect(screen.getByText("policy:unlock")).toBeInTheDocument();
    expect(screen.getByText("audit:on")).toBeInTheDocument();
  });
});

describe("EditableDecisionNode", () => {
  it("renders decision testid with label input", () => {
    render(<EditableDecisionNode {...baseProps} type="decision" data={{ label: "분기" }} />);
    expect(screen.getByTestId("editable-decision-node")).toBeInTheDocument();
    expect(screen.getByLabelText("노드 이름")).toHaveValue("분기");
  });
});

describe("EditableAnswerNode", () => {
  it("renders answer testid with label input", () => {
    render(<EditableAnswerNode {...baseProps} type="answer" data={{ label: "응답" }} />);
    expect(screen.getByTestId("editable-answer-node")).toBeInTheDocument();
    expect(screen.getByLabelText("노드 이름")).toHaveValue("응답");
  });

  it("commits answer label change", () => {
    updateNodeData.mockClear();
    render(<EditableAnswerNode {...baseProps} type="answer" data={{ label: "" }} />);
    const input = screen.getByLabelText("노드 이름");
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "환영합니다" } });
    fireEvent.blur(input);
    expect(updateNodeData).toHaveBeenCalledWith("n1", { label: "환영합니다" });
  });
});

describe("EditableHandoffNode", () => {
  it("renders handoff testid with label input", () => {
    render(<EditableHandoffNode {...baseProps} type="handoff" data={{ label: "배정" }} />);
    expect(screen.getByTestId("editable-handoff-node")).toBeInTheDocument();
    expect(screen.getByLabelText("노드 이름")).toHaveValue("배정");
  });

  it("commits handoff label change", () => {
    updateNodeData.mockClear();
    render(<EditableHandoffNode {...baseProps} type="handoff" data={{ label: "" }} />);
    const input = screen.getByLabelText("노드 이름");
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "VIP 큐" } });
    fireEvent.blur(input);
    expect(updateNodeData).toHaveBeenCalledWith("n1", { label: "VIP 큐" });
  });
});

describe("EditableTerminalNode", () => {
  it("renders terminal testid + only target handles (no source)", () => {
    render(<EditableTerminalNode {...baseProps} type="terminal" data={{ label: "종료" }} />);
    expect(screen.getByTestId("editable-terminal-node")).toBeInTheDocument();
    expect(screen.getAllByTestId(/^handle-target-/)).toHaveLength(4);
    expect(screen.queryAllByTestId(/^handle-source-/)).toHaveLength(0);
  });

  it("commits terminal label change on blur", () => {
    updateNodeData.mockClear();
    render(<EditableTerminalNode {...baseProps} type="terminal" data={{ label: "" }} />);
    const input = screen.getByLabelText("노드 이름");
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "끝" } });
    fireEvent.blur(input);
    expect(updateNodeData).toHaveBeenCalledWith("n1", { label: "끝" });
  });
});
