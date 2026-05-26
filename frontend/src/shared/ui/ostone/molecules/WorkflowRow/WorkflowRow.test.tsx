import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { WorkflowRow, type WorkflowRowEntry } from "./WorkflowRow";

const ENTRY: WorkflowRowEntry = {
  packId: 9,
  packName: "Pack X",
  versionId: 4,
  workflowId: 7,
  workflowCode: "wf.x",
  name: "워크플로우 이름",
  description: "설명",
};

describe("WorkflowRow", () => {
  it("기본 상태에서 헤더만 보이고 그래프/상세는 숨김", () => {
    render(<WorkflowRow entry={ENTRY} onOpen={vi.fn()} testIdPrefix="row" />);
    expect(screen.getByText("Pack X")).toBeInTheDocument();
    expect(screen.getByText("워크플로우 이름")).toBeInTheDocument();
    expect(screen.queryByTestId("row-7-detail")).not.toBeInTheDocument();
    expect(screen.queryByTestId("row-7-graph")).not.toBeInTheDocument();
  });

  it("hover 시 graphSlot과 detail이 노출", () => {
    render(
      <WorkflowRow
        entry={ENTRY}
        onOpen={vi.fn()}
        testIdPrefix="row"
        graphSlot={<div data-testid="graph-stub" />}
      />,
    );
    fireEvent.mouseEnter(screen.getByTestId("row-7"));
    expect(screen.getByTestId("row-7-detail")).toBeInTheDocument();
    expect(screen.getByTestId("row-7-graph")).toBeInTheDocument();
    expect(screen.getByTestId("graph-stub")).toBeInTheDocument();
  });

  it("mouseLeave 시 닫힘 (focus 없는 경우)", () => {
    render(<WorkflowRow entry={ENTRY} onOpen={vi.fn()} testIdPrefix="row" />);
    fireEvent.mouseEnter(screen.getByTestId("row-7"));
    fireEvent.mouseLeave(screen.getByTestId("row-7"));
    expect(screen.queryByTestId("row-7-detail")).not.toBeInTheDocument();
  });

  it("focus 시 detail 노출", () => {
    render(<WorkflowRow entry={ENTRY} onOpen={vi.fn()} testIdPrefix="row" />);
    fireEvent.focus(screen.getByTestId("row-7-open"));
    expect(screen.getByTestId("row-7-detail")).toBeInTheDocument();
  });

  it("onOpen이 클릭 시 호출", () => {
    const onOpen = vi.fn();
    render(<WorkflowRow entry={ENTRY} onOpen={onOpen} testIdPrefix="row" />);
    fireEvent.click(screen.getByTestId("row-7-open"));
    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it("onOpen 없으면 버튼 비활성", () => {
    render(<WorkflowRow entry={ENTRY} testIdPrefix="row" />);
    expect(screen.getByTestId("row-7-open")).toBeDisabled();
  });

  it("description 없으면 description 단락 생략", () => {
    render(
      <WorkflowRow entry={{ ...ENTRY, description: null }} onOpen={vi.fn()} testIdPrefix="row" />,
    );
    fireEvent.mouseEnter(screen.getByTestId("row-7"));
    expect(screen.queryByText("설명")).not.toBeInTheDocument();
  });

  it("focus가 row 내부에 남아 있으면 mouseLeave로 preview 닫히지 않음", () => {
    render(<WorkflowRow entry={ENTRY} onOpen={vi.fn()} testIdPrefix="row" />);
    const row = screen.getByTestId("row-7");
    const button = screen.getByTestId("row-7-open");
    fireEvent.focus(button);
    button.focus();
    fireEvent.mouseLeave(row);
    expect(screen.getByTestId("row-7-detail")).toBeInTheDocument();
  });

  it("blur가 row 외부로 나가면 preview 닫힘", () => {
    render(
      <div>
        <WorkflowRow entry={ENTRY} onOpen={vi.fn()} testIdPrefix="row" />
        <button type="button">outside</button>
      </div>,
    );
    const button = screen.getByTestId("row-7-open");
    fireEvent.focus(button);
    fireEvent.blur(button);
    expect(screen.queryByTestId("row-7-detail")).not.toBeInTheDocument();
  });

  it("graphSlot 없이 hover하면 graph slot 영역 자체가 없음", () => {
    render(<WorkflowRow entry={ENTRY} onOpen={vi.fn()} testIdPrefix="row" />);
    fireEvent.mouseEnter(screen.getByTestId("row-7"));
    expect(screen.queryByTestId("row-7-graph")).not.toBeInTheDocument();
  });

  it("workflowCode 없으면 Mono 코드 출력 안 함", () => {
    render(
      <WorkflowRow
        entry={{ ...ENTRY, workflowCode: null }}
        onOpen={vi.fn()}
        testIdPrefix="row"
      />,
    );
    expect(screen.queryByText("wf.x")).not.toBeInTheDocument();
  });
});
