import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { WorkflowEditorLegend } from "./WorkflowEditorLegend";

describe("WorkflowEditorLegend", () => {
  it("노드 종류와 표시값/내부 식별자 안내를 보여준다", () => {
    render(<WorkflowEditorLegend />);

    expect(screen.getByText("편집 가이드")).toBeInTheDocument();
    expect(screen.getByText("처리")).toBeInTheDocument();
    expect(screen.getByText("분기")).toBeInTheDocument();
    expect(screen.getByText(/내부 식별자/)).toBeInTheDocument();
  });
});
