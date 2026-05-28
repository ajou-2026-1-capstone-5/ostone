import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { NodeDeleteToolbar } from "./NodeDeleteToolbar";

vi.mock("@xyflow/react", () => ({
  NodeToolbar: ({ isVisible, children }: { isVisible?: boolean; children: React.ReactNode }) =>
    isVisible ? <div data-testid="toolbar">{children}</div> : null,
  Position: { Top: "top" },
}));

describe("NodeDeleteToolbar", () => {
  it("selected가 true이면 삭제 버튼을 렌더링한다", () => {
    render(<NodeDeleteToolbar selected={true} onDelete={vi.fn()} />);
    expect(screen.getByRole("button", { name: "삭제" })).toBeInTheDocument();
  });

  it("selected가 false이면 버튼을 렌더링하지 않는다", () => {
    render(<NodeDeleteToolbar selected={false} onDelete={vi.fn()} />);
    expect(screen.queryByRole("button", { name: "삭제" })).not.toBeInTheDocument();
  });

  it("selected가 undefined이면 버튼을 렌더링하지 않는다", () => {
    render(<NodeDeleteToolbar selected={undefined} onDelete={vi.fn()} />);
    expect(screen.queryByRole("button", { name: "삭제" })).not.toBeInTheDocument();
  });

  it("삭제 버튼 클릭 시 onDelete가 호출된다", () => {
    const onDelete = vi.fn();
    render(<NodeDeleteToolbar selected={true} onDelete={onDelete} />);
    fireEvent.click(screen.getByRole("button", { name: "삭제" }));
    expect(onDelete).toHaveBeenCalledTimes(1);
  });
});
