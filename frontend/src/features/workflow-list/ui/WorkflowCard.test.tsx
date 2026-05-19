import { describe, it, expect, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

import type { WorkspaceWorkflowEntry } from "@/entities/workflow";
import { WorkflowCard } from "./WorkflowCard";

vi.mock("./WorkflowGraphMini", () => ({
  WorkflowGraphMini: () => <div data-testid="graph-mini-stub" />,
}));

const ENTRY: WorkspaceWorkflowEntry = {
  packId: 2,
  packName: "Refund",
  versionId: 3,
  workflowId: 42,
  workflowCode: "wf.refund",
  name: "환불 워크플로우",
  description: "환불 요청 처리",
};

function setup(overrides: Partial<React.ComponentProps<typeof WorkflowCard>> = {}) {
  const defaults: React.ComponentProps<typeof WorkflowCard> = {
    entry: ENTRY,
    expanded: false,
    onToggle: vi.fn(),
    onOpen: vi.fn(),
  };
  return render(
    <MemoryRouter>
      <WorkflowCard {...defaults} {...overrides} />
    </MemoryRouter>,
  );
}

describe("WorkflowCard", () => {
  it("기본(접힘) 상태에서는 graph mini, description, 열기 버튼이 보이지 않는다", () => {
    setup();
    expect(screen.queryByTestId("workflow-list-card-42-graph")).not.toBeInTheDocument();
    expect(screen.queryByTestId("workflow-list-card-42-detail")).not.toBeInTheDocument();
    expect(screen.queryByTestId("workflow-list-card-42-open")).not.toBeInTheDocument();
  });

  it("기본 상태에서 헤더의 pack 이름과 워크플로우 코드를 표시한다", () => {
    setup();
    expect(screen.getByText("Refund")).toBeInTheDocument();
    expect(screen.getByText("wf.refund")).toBeInTheDocument();
    expect(screen.getByText("환불 워크플로우")).toBeInTheDocument();
  });

  it("카드 클릭 시 onToggle 호출", () => {
    const onToggle = vi.fn();
    setup({ onToggle });
    fireEvent.click(screen.getByTestId("workflow-list-card-42-toggle"));
    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it("expanded=true 일 때 graph mini, description, 열기 버튼이 노출된다", () => {
    setup({ expanded: true });
    expect(screen.getByTestId("workflow-list-card-42-graph")).toBeInTheDocument();
    expect(screen.getByTestId("workflow-list-card-42-detail")).toBeInTheDocument();
    expect(screen.getByText("환불 요청 처리")).toBeInTheDocument();
    expect(screen.getByTestId("workflow-list-card-42-open")).toBeInTheDocument();
  });

  it("열기 버튼 클릭 시 onOpen 호출 (onToggle 은 호출되지 않음)", () => {
    const onToggle = vi.fn();
    const onOpen = vi.fn();
    setup({ expanded: true, onToggle, onOpen });
    fireEvent.click(screen.getByTestId("workflow-list-card-42-open"));
    expect(onOpen).toHaveBeenCalledTimes(1);
    expect(onToggle).not.toHaveBeenCalled();
  });

  it("testIdPrefix 를 적용하면 모든 testId 가 그 prefix 를 사용한다", () => {
    setup({ testIdPrefix: "pack-workflows", expanded: true });
    expect(screen.getByTestId("pack-workflows-card-42")).toBeInTheDocument();
    expect(screen.getByTestId("pack-workflows-card-42-open")).toBeInTheDocument();
  });

  it("description 이 없으면 detail 영역에서 설명 단락을 건너뛴다", () => {
    setup({
      expanded: true,
      entry: { ...ENTRY, description: null },
    });
    expect(screen.queryByText("환불 요청 처리")).not.toBeInTheDocument();
  });
});
