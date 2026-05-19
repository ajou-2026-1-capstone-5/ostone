import { describe, it, expect, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

import type { WorkspaceWorkflowEntry } from "@/entities/workflow";
import { WorkflowSearchBar } from "./WorkflowSearchBar";

function makeEntry(id: number, name: string): WorkspaceWorkflowEntry {
  return {
    packId: 2,
    packName: "Pack",
    versionId: 3,
    workflowId: id,
    workflowCode: `wf.${id}`,
    name,
    description: null,
  };
}

const ENTRIES = [
  makeEntry(1, "Refund standard"),
  makeEntry(2, "Refund express"),
  makeEntry(3, "Shipping delay"),
  makeEntry(4, "Payment failure"),
];

describe("WorkflowSearchBar", () => {
  it("처음에는 dropdown 이 보이지 않는다", () => {
    render(<WorkflowSearchBar entries={ENTRIES} onFilter={vi.fn()} />);
    expect(screen.queryByTestId("workflow-search-dropdown")).not.toBeInTheDocument();
  });

  it("타이핑 시 매칭 항목이 dropdown 에 표시된다", () => {
    render(<WorkflowSearchBar entries={ENTRIES} onFilter={vi.fn()} />);
    fireEvent.change(screen.getByTestId("workflow-search-input"), { target: { value: "refund" } });
    const dropdown = screen.getByTestId("workflow-search-dropdown");
    expect(dropdown).toBeInTheDocument();
    expect(screen.getByTestId("workflow-search-item-1")).toBeInTheDocument();
    expect(screen.getByTestId("workflow-search-item-2")).toBeInTheDocument();
    expect(screen.queryByTestId("workflow-search-item-3")).not.toBeInTheDocument();
  });

  it("dropdown 항목 클릭 시 onFilter 가 workflowId 와 함께 호출된다", () => {
    const onFilter = vi.fn();
    render(<WorkflowSearchBar entries={ENTRIES} onFilter={onFilter} />);
    fireEvent.change(screen.getByTestId("workflow-search-input"), { target: { value: "refund" } });
    fireEvent.click(screen.getByTestId("workflow-search-item-2"));
    expect(onFilter).toHaveBeenCalledWith(2);
  });

  it("maxResults 가 초과하는 매칭은 잘라낸다", () => {
    render(<WorkflowSearchBar entries={ENTRIES} onFilter={vi.fn()} maxResults={1} />);
    fireEvent.change(screen.getByTestId("workflow-search-input"), { target: { value: "Refund" } });
    expect(screen.getByTestId("workflow-search-item-1")).toBeInTheDocument();
    expect(screen.queryByTestId("workflow-search-item-2")).not.toBeInTheDocument();
  });

  it("input 외부 클릭 시 dropdown 이 닫힌다", () => {
    render(
      <div>
        <WorkflowSearchBar entries={ENTRIES} onFilter={vi.fn()} />
        <div data-testid="outside">outside</div>
      </div>,
    );
    fireEvent.change(screen.getByTestId("workflow-search-input"), { target: { value: "refund" } });
    expect(screen.getByTestId("workflow-search-dropdown")).toBeInTheDocument();
    fireEvent.mouseDown(screen.getByTestId("outside"));
    expect(screen.queryByTestId("workflow-search-dropdown")).not.toBeInTheDocument();
  });

  it("testIdPrefix 가 적용된다", () => {
    render(
      <WorkflowSearchBar entries={ENTRIES} onFilter={vi.fn()} testIdPrefix="page-search" />,
    );
    expect(screen.getByTestId("page-search-input")).toBeInTheDocument();
  });
});
