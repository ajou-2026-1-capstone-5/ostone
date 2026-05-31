import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../api/useUpdateWorkflow", () => ({
  useUpdateWorkflow: vi.fn(),
}));

vi.mock("./InteractiveGraphEditor", () => ({
  InteractiveGraphEditor: ({
    initialEdges,
    initialNodes,
  }: {
    initialEdges: unknown[];
    initialNodes: unknown[];
  }) => (
    <div
      data-testid="graph-editor"
      data-edge-count={initialEdges.length}
      data-node-count={initialNodes.length}
    />
  ),
}));

import { useUpdateWorkflow } from "../api/useUpdateWorkflow";
import { WorkflowEditForm } from "./WorkflowEditForm";

const mutateWorkflow = vi.fn();
const mockedUseUpdateWorkflow = vi.mocked(useUpdateWorkflow);

const stubWorkflow = {
  id: 10,
  workflowCode: "WF-REFUND-01",
  name: "환불 처리 응대 흐름",
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

function renderForm({
  onClose = vi.fn(),
  onSaved,
  onDirtyChange,
  workflow = stubWorkflow,
}: {
  onClose?: () => void;
  onSaved?: () => void;
  onDirtyChange?: (isDirty: boolean) => void;
  workflow?: typeof stubWorkflow;
} = {}) {
  render(
    <WorkflowEditForm
      workflow={workflow}
      wsId={1}
      packId={2}
      versionId={3}
      onClose={onClose}
      onSaved={onSaved}
      onDirtyChange={onDirtyChange}
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
    expect(screen.getByDisplayValue("환불 처리 응대 흐름")).toBeInTheDocument();
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

  it("invalid graphJson이면 빈 그래프로 editor를 초기화한다", () => {
    renderForm({
      workflow: {
        ...stubWorkflow,
        graphJson: "{invalid json",
      },
    });

    expect(screen.getByTestId("graph-editor")).toHaveAttribute("data-node-count", "0");
    expect(screen.getByTestId("graph-editor")).toHaveAttribute("data-edge-count", "0");
  });

  it("calls onClose when cancel button is clicked", () => {
    const { onClose } = renderForm();
    fireEvent.click(screen.getByRole("button", { name: "취소" }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("calls mutate on form submit with updated values", async () => {
    renderForm();
    const nameInput = screen.getByDisplayValue("환불 처리 응대 흐름");
    fireEvent.change(nameInput, { target: { value: "수정된 응대 흐름" } });
    fireEvent.click(screen.getByRole("button", { name: "저장" }));
    await waitFor(() => expect(mutateWorkflow).toHaveBeenCalled());
    expect(mutateWorkflow).toHaveBeenCalledWith(
      expect.objectContaining({
        wsId: 1,
        packId: 2,
        versionId: 3,
        workflowId: 10,
        body: expect.objectContaining({ name: "수정된 응대 흐름" }),
      }),
      expect.objectContaining({ onSuccess: expect.any(Function) }),
    );
  });

  it("저장 성공 시 form dirty 상태를 reset하고 clean 상태를 알린다", async () => {
    const onSaved = vi.fn();
    const onDirtyChange = vi.fn();
    mutateWorkflow.mockImplementation((_, options) => {
      options?.onSuccess?.();
    });
    renderForm({ onSaved, onDirtyChange });
    const nameInput = screen.getByDisplayValue("환불 처리 응대 흐름");
    fireEvent.change(nameInput, { target: { value: "수정된 응대 흐름" } });

    await waitFor(() => expect(onDirtyChange).toHaveBeenCalledWith(true));
    fireEvent.click(screen.getByRole("button", { name: "저장" }));

    await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1));
    expect(onDirtyChange).toHaveBeenLastCalledWith(false);
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
    const nameInput = screen.getByDisplayValue("환불 처리 응대 흐름");
    fireEvent.change(nameInput, { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: "저장" }));
    await waitFor(() => {
      expect(screen.getByText("응대 흐름 이름은 필수입니다.")).toBeInTheDocument();
    });
    expect(mutateWorkflow).not.toHaveBeenCalled();
  });
});
