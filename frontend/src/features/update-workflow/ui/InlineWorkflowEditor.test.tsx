import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createElement, type ReactNode } from "react";
import { InlineWorkflowEditor } from "./InlineWorkflowEditor";

vi.mock("./WorkflowEditForm", () => ({
  WorkflowEditForm: vi.fn(({ workflow, onClose }) =>
    createElement(
      "div",
      { "data-testid": "edit-form" },
      `editing ${workflow.workflowCode ?? workflow.id}`,
      createElement(
        "button",
        { type: "button", "data-testid": "close-btn", onClick: onClose },
        "close",
      ),
    ),
  ),
}));

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0, staleTime: 0 } },
  });
  return createElement(QueryClientProvider, { client }, children);
}

describe("InlineWorkflowEditor", () => {
  it("workflow를 WorkflowEditForm에 그대로 전달한다", () => {
    render(
      <InlineWorkflowEditor
        workflow={{ id: 100, workflowCode: "refund.standard", name: "환불 처리" }}
        wsId={1}
        packId={2}
        versionId={3}
        onClose={() => {}}
      />,
      { wrapper },
    );
    expect(screen.getByTestId("inline-workflow-editor")).toBeInTheDocument();
    expect(screen.getByTestId("edit-form")).toHaveTextContent("editing refund.standard");
  });

  it("내부 close 버튼 클릭 시 onClose가 호출된다", () => {
    const onClose = vi.fn();
    render(
      <InlineWorkflowEditor
        workflow={{ id: 100, workflowCode: "refund.standard", name: "환불 처리" }}
        wsId={1}
        packId={2}
        versionId={3}
        onClose={onClose}
      />,
      { wrapper },
    );
    screen.getByTestId("close-btn").click();
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
