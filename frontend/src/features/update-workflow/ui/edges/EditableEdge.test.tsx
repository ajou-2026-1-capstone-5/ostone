import React from "react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

const setEdgesMock = vi.fn();

vi.mock("@xyflow/react", () => ({
  BaseEdge: ({ path }: { path: string }) => <path data-testid="base-edge" d={path} />,
  EdgeLabelRenderer: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  getBezierPath: () => ["M0,0 L100,100", 50, 50],
  useReactFlow: () => ({ setEdges: setEdgesMock }),
}));

import { EditableEdge } from "./EditableEdge";

function makeProps(overrides: object = {}) {
  return {
    id: "edge-1",
    sourceX: 0,
    sourceY: 0,
    targetX: 100,
    targetY: 100,
    sourcePosition: "right",
    targetPosition: "left",
    label: "전이 조건",
    ...overrides,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
}

describe("EditableEdge", () => {
  beforeEach(() => {
    setEdgesMock.mockReset();
  });

  it("label이 string이면 input에 해당 값이 렌더된다", () => {
    render(<EditableEdge {...makeProps({ label: "전이 조건" })} />);
    expect(screen.getByLabelText("엣지 레이블")).toHaveValue("전이 조건");
  });

  it("label이 string이 아니면 input이 빈 문자열로 초기화된다", () => {
    render(<EditableEdge {...makeProps({ label: undefined })} />);
    expect(screen.getByLabelText("엣지 레이블")).toHaveValue("");
  });

  it("onChange가 발생하면 input 값이 갱신된다", () => {
    render(<EditableEdge {...makeProps({ label: "초기" })} />);
    const input = screen.getByLabelText("엣지 레이블");
    fireEvent.change(input, { target: { value: "변경됨" } });
    expect(input).toHaveValue("변경됨");
  });

  it("onFocus 중에는 label prop 변경이 input 값에 반영되지 않는다", () => {
    const { rerender } = render(<EditableEdge {...makeProps({ label: "초기" })} />);
    const input = screen.getByLabelText("엣지 레이블");
    fireEvent.focus(input);
    rerender(<EditableEdge {...makeProps({ label: "외부 변경" })} />);
    expect(input).toHaveValue("초기");
  });

  it("onBlur가 발생하면 setEdges가 호출된다", () => {
    render(<EditableEdge {...makeProps({ label: "라벨" })} />);
    fireEvent.blur(screen.getByLabelText("엣지 레이블"));
    expect(setEdgesMock).toHaveBeenCalledTimes(1);
  });

  it("포커스가 없을 때 label prop이 변경되면 input 값이 갱신된다", () => {
    const { rerender } = render(<EditableEdge {...makeProps({ label: "초기" })} />);
    rerender(<EditableEdge {...makeProps({ label: "새 라벨" })} />);
    expect(screen.getByLabelText("엣지 레이블")).toHaveValue("새 라벨");
  });

  it("onBlur 후 setEdges 콜백이 해당 edge의 label을 갱신한다", () => {
    render(<EditableEdge {...makeProps({ id: "e1", label: "변경전" })} />);
    const input = screen.getByLabelText("엣지 레이블");
    fireEvent.change(input, { target: { value: "변경후" } });
    fireEvent.blur(input);
    expect(setEdgesMock).toHaveBeenCalledTimes(1);
    const updater = setEdgesMock.mock.calls[0][0] as (eds: { id: string; label: string }[]) => { id: string; label: string }[];
    const result = updater([
      { id: "e1", label: "변경전" },
      { id: "e2", label: "다른것" },
    ]);
    expect(result[0].label).toBe("변경후");
    expect(result[1].label).toBe("다른것");
  });
});
