import { fireEvent, render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import type { WorkflowTransitionDetail } from "@/entities/workflow";
import type { PolicySummary } from "@/entities/policy";
import { TransitionPopover } from "./TransitionPopover";

const stubTransition: WorkflowTransitionDetail = {
  id: "edge-1",
  workflowDefinitionId: 10,
  domainPackVersionId: 3,
  from: "STATE_A",
  to: "STATE_B",
  label: "조건A",
  toPolicyRef: "POL_001",
};

const stubPolicy: PolicySummary = {
  id: 1,
  domainPackVersionId: 3,
  policyCode: "POL_001",
  name: "정책 이름",
  description: "정책 설명",
  severity: null,
  status: "ACTIVE",
  createdAt: "2026-01-01T00:00:00Z",
  updatedAt: "2026-01-01T00:00:00Z",
};

describe("TransitionPopover", () => {
  it("transition 기본 정보를 표시한다", () => {
    render(<TransitionPopover transition={stubTransition} policy={null} onClose={vi.fn()} />);
    expect(screen.getByRole("dialog", { name: "transition 상세" })).toBeInTheDocument();
    expect(screen.getByText("STATE_A → STATE_B")).toBeInTheDocument();
    expect(screen.getByText("조건A")).toBeInTheDocument();
  });

  it("policy가 있으면 policy 섹션을 표시한다", () => {
    render(<TransitionPopover transition={stubTransition} policy={stubPolicy} onClose={vi.fn()} />);
    expect(screen.getByText("정책 이름")).toBeInTheDocument();
    expect(screen.getByText("정책 설명")).toBeInTheDocument();
  });

  it("policy=null이면 policy 섹션을 표시하지 않는다", () => {
    render(<TransitionPopover transition={stubTransition} policy={null} onClose={vi.fn()} />);
    expect(screen.queryByText("정책 이름")).not.toBeInTheDocument();
  });

  it("닫기 버튼 클릭 시 onClose를 호출한다", () => {
    const onClose = vi.fn();
    render(<TransitionPopover transition={stubTransition} policy={null} onClose={onClose} />);
    fireEvent.click(screen.getByRole("button", { name: "닫기" }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("Escape 키 입력 시 onClose를 호출한다", () => {
    const onClose = vi.fn();
    render(<TransitionPopover transition={stubTransition} policy={null} onClose={onClose} />);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("팝오버 외부 클릭 시 onClose를 호출한다", () => {
    const onClose = vi.fn();
    render(<TransitionPopover transition={stubTransition} policy={null} onClose={onClose} />);
    fireEvent.mouseDown(document.body);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("label=null이면 label 섹션을 표시하지 않는다", () => {
    const noLabel = { ...stubTransition, label: null };
    render(<TransitionPopover transition={noLabel} policy={null} onClose={vi.fn()} />);
    expect(screen.queryByText("Label")).not.toBeInTheDocument();
  });
});
