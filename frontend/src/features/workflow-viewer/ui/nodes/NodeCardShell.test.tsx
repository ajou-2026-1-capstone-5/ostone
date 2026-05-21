import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { NodeCardShell } from "./NodeCardShell";

vi.mock("@xyflow/react", () => ({
  Handle: ({ type, id }: { type: string; id: string }) => (
    <div data-testid={`handle-${type}-${id}`} />
  ),
  Position: { Left: "left", Right: "right", Top: "top", Bottom: "bottom" },
}));

const baseProps = {
  kindClassName: "kind-x",
  icon: <span data-testid="icon" />,
  title: "노드 제목",
};

describe("NodeCardShell", () => {
  it("renders title", () => {
    render(<NodeCardShell {...baseProps} />);
    expect(screen.getByText("노드 제목")).toBeInTheDocument();
  });

  it("renders icon", () => {
    render(<NodeCardShell {...baseProps} />);
    expect(screen.getByTestId("icon")).toBeInTheDocument();
  });

  it("renders no handles by default (no connected sides given)", () => {
    render(<NodeCardShell {...baseProps} />);
    expect(screen.queryAllByTestId(/^handle-source-/)).toHaveLength(0);
    expect(screen.queryAllByTestId(/^handle-target-/)).toHaveLength(0);
  });

  it("renders only the connected source handles", () => {
    render(<NodeCardShell {...baseProps} sourceHandles={["right", "bottom"]} />);
    expect(screen.getAllByTestId(/^handle-source-/)).toHaveLength(2);
    expect(screen.getByTestId("handle-source-right")).toBeInTheDocument();
    expect(screen.getByTestId("handle-source-bottom")).toBeInTheDocument();
  });

  it("renders only the connected target handles", () => {
    render(<NodeCardShell {...baseProps} targetHandles={["left"]} />);
    expect(screen.getAllByTestId(/^handle-target-/)).toHaveLength(1);
    expect(screen.getByTestId("handle-target-left")).toBeInTheDocument();
  });

  it("renders description when provided", () => {
    render(<NodeCardShell {...baseProps} description="설명입니다" />);
    expect(screen.getByText("설명입니다")).toBeInTheDocument();
  });

  it("does not render description when undefined", () => {
    const { container } = render(<NodeCardShell {...baseProps} />);
    expect(container.querySelector("p")).not.toBeInTheDocument();
  });

  it("renders footer with policyRef chip", () => {
    render(<NodeCardShell {...baseProps} policyRef="PR-001" />);
    expect(screen.getByText("PR-001")).toBeInTheDocument();
  });

  it("renders footer with badges", () => {
    render(<NodeCardShell {...baseProps} badges={["tag:a", "tag:b"]} />);
    expect(screen.getByText("tag:a")).toBeInTheDocument();
    expect(screen.getByText("tag:b")).toBeInTheDocument();
  });

  it("does not render footer when policyRef undefined and badges undefined", () => {
    render(<NodeCardShell {...baseProps} />);
    expect(screen.queryByText(/PR-/)).not.toBeInTheDocument();
  });

  it("applies kindClassName to outer container", () => {
    render(<NodeCardShell {...baseProps} containerTestId="shell" kindClassName="kind-foo" />);
    const el = screen.getByTestId("shell");
    expect(el.className).toContain("kind-foo");
  });

  it("applies optional statusClassName when provided", () => {
    render(
      <NodeCardShell
        {...baseProps}
        containerTestId="shell"
        kindClassName="kind-foo"
        statusClassName="status-bar"
      />,
    );
    const el = screen.getByTestId("shell");
    expect(el.className).toContain("status-bar");
  });

  it("does NOT leak status classes when statusClassName is omitted (definition view)", () => {
    render(<NodeCardShell {...baseProps} containerTestId="shell" kindClassName="kind-foo" />);
    const el = screen.getByTestId("shell");
    expect(el.className).not.toMatch(/status/);
  });

  it("exposes labelTestId on title element", () => {
    render(<NodeCardShell {...baseProps} labelTestId="custom-label" title="제목" />);
    expect(screen.getByTestId("custom-label").textContent).toBe("제목");
  });

  it("renders all sections together (policyRef + badges + description + handles)", () => {
    render(
      <NodeCardShell
        {...baseProps}
        description="desc"
        policyRef="POL-1"
        badges={["b1"]}
        sourceHandles={["right"]}
        targetHandles={["left"]}
        containerTestId="full"
      />,
    );
    expect(screen.getByTestId("full")).toBeInTheDocument();
    expect(screen.getByText("desc")).toBeInTheDocument();
    expect(screen.getByText("POL-1")).toBeInTheDocument();
    expect(screen.getByText("b1")).toBeInTheDocument();
    expect(screen.getByTestId("handle-source-right")).toBeInTheDocument();
    expect(screen.getByTestId("handle-target-left")).toBeInTheDocument();
  });
});
