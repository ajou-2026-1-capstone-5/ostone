import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../api/useUpdateWorkflow", () => ({
  useUpdateWorkflow: vi.fn(),
}));

vi.mock("./InteractiveGraphEditor", () => ({
  InteractiveGraphEditor: () => <div data-testid="graph-editor" />,
}));

import { useUpdateWorkflow } from "../api/useUpdateWorkflow";
import { WorkflowEditForm } from "./WorkflowEditForm";

const mutateWorkflow = vi.fn();
const mockedUseUpdateWorkflow = vi.mocked(useUpdateWorkflow);

const stubWorkflow = {
  id: 10,
  workflowCode: "WF-REFUND-01",
  name: "환불 처리 워크플로우",
  description: "표준 환불 처리 절차",
  graphJson: JSON.stringify({ direction: "LR", nodes: [], edges: [] }),
  createdAt: "2025-01-01T00:00:00+09:00",
  updatedAt: "2025-01-02T00:00:00+09:00",
  initialState: "START",
  terminalStatesJson: '["END"]',
  evidenceJson: "[]",
  metaJson: "{}",
};

function makeWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children);
}

function renderForm(onClose = vi.fn()) {
  render(
    <WorkflowEditForm
      workflow={stubWorkflow}
      wsId={1}
      packId={2}
      versionId={3}
      onClose={onClose}
    />,
    { wrapper: makeWrapper() },
  );
  return { onClose };
}

describe("WorkflowEditForm", () => {
  beforeAll(() => {
    globalThis.ResizeObserver = class ResizeObserver {
      observe = vi.fn();
      unobserve = vi.fn();
      disconnect = vi.fn();
    };
  });

  beforeEach(() => {
    mutateWorkflow.mockReset();
    mockedUseUpdateWorkflow.mockReturnValue({
      mutate: mutateWorkflow,
      isPending: false,
    } as unknown as ReturnType<typeof useUpdateWorkflow>);
  });

  it("renders workflow name and description in form fields", () => {
    renderForm();
    expect(screen.getByDisplayValue("환불 처리 워크플로우")).toBeInTheDocument();
    expect(screen.getByDisplayValue("표준 환불 처리 절차")).toBeInTheDocument();
  });

  it("renders workflow code as disabled read-only input", () => {
    renderForm();
    const codeInput = screen.getByDisplayValue("WF-REFUND-01");
    expect(codeInput).toBeDisabled();
  });

  it("renders InteractiveGraphEditor", () => {
    renderForm();
    expect(screen.getByTestId("graph-editor")).toBeInTheDocument();
  });

  it("calls onClose when cancel button is clicked", () => {
    const { onClose } = renderForm();
    fireEvent.click(screen.getByRole("button", { name: "취소" }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("calls mutate on form submit with updated values", async () => {
    renderForm();
    const nameInput = screen.getByDisplayValue("환불 처리 워크플로우");
    fireEvent.change(nameInput, { target: { value: "수정된 워크플로우" } });
    fireEvent.click(screen.getByRole("button", { name: "저장" }));
    await waitFor(() => expect(mutateWorkflow).toHaveBeenCalled());
    expect(mutateWorkflow).toHaveBeenCalledWith(
      expect.objectContaining({
        wsId: 1,
        packId: 2,
        versionId: 3,
        workflowId: 10,
        body: expect.objectContaining({ name: "수정된 워크플로우" }),
      }),
      expect.objectContaining({ onSuccess: expect.any(Function) }),
    );
  });

  it("disables buttons while mutation is pending", () => {
    mockedUseUpdateWorkflow.mockReturnValue({
      mutate: mutateWorkflow,
      isPending: true,
    } as unknown as ReturnType<typeof useUpdateWorkflow>);
    renderForm();
    expect(screen.getByRole("button", { name: "취소" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "저장" })).toBeDisabled();
  });

  it("shows validation error when name is cleared", async () => {
    renderForm();
    const nameInput = screen.getByDisplayValue("환불 처리 워크플로우");
    fireEvent.change(nameInput, { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: "저장" }));
    await waitFor(() => {
      expect(screen.getByText("워크플로우 이름은 필수입니다.")).toBeInTheDocument();
    });
    expect(mutateWorkflow).not.toHaveBeenCalled();
  });
});
