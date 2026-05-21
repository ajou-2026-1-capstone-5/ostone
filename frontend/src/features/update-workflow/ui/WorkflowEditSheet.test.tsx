import React from "react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

vi.mock("../api/useGetWorkflow", () => ({
  useGetWorkflow: vi.fn(),
}));

vi.mock("./WorkflowEditForm", () => ({
  WorkflowEditForm: () => <div data-testid="workflow-edit-form" />,
}));

vi.mock("@/shared/ui/sheet", () => ({
  Sheet: ({
    open,
    onOpenChange,
    children,
  }: {
    open?: boolean;
    onOpenChange?: (open: boolean) => void;
    children: React.ReactNode;
  }) =>
    open ? (
      <div data-testid="sheet">
        <button data-testid="sheet-close-btn" onClick={() => onOpenChange?.(false)}>
          닫기
        </button>
        {children}
      </div>
    ) : null,
  SheetContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SheetHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SheetTitle: ({ children }: { children: React.ReactNode }) => <h2>{children}</h2>,
  SheetDescription: ({ children }: { children: React.ReactNode }) => <p>{children}</p>,
}));

vi.mock("@/shared/ui/spinner", () => ({
  Spinner: () => <div data-testid="spinner" />,
}));

vi.mock("@/shared/ui/button", () => ({
  Button: ({
    children,
    onClick,
  }: {
    children: React.ReactNode;
    onClick?: () => void;
  }) => <button onClick={onClick}>{children}</button>,
}));

import { useGetWorkflow } from "../api/useGetWorkflow";
import { WorkflowEditSheet } from "./WorkflowEditSheet";

const mockedUseGetWorkflow = vi.mocked(useGetWorkflow);

const stubWorkflow = {
  id: 10,
  workflowCode: "WF-001",
  name: "테스트 워크플로우",
  description: "설명",
  graphJson: "{}",
  initialState: "START",
  terminalStatesJson: "[]",
  evidenceJson: "[]",
  metaJson: "{}",
  createdAt: "",
  updatedAt: "",
};

function makeProps(overrides: object = {}) {
  return {
    wsId: 1,
    packId: 2,
    versionId: 3,
    workflowId: 10,
    isOpen: true,
    onClose: vi.fn(),
    ...overrides,
  };
}

describe("WorkflowEditSheet", () => {
  beforeEach(() => {
    mockedUseGetWorkflow.mockReset();
  });

  it("isOpen=false이면 Sheet가 렌더되지 않는다", () => {
    mockedUseGetWorkflow.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof useGetWorkflow>);
    render(<WorkflowEditSheet {...makeProps({ isOpen: false })} />);
    expect(screen.queryByTestId("sheet")).not.toBeInTheDocument();
  });

  it("isLoading=true이면 Spinner가 렌더된다", () => {
    mockedUseGetWorkflow.mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof useGetWorkflow>);
    render(<WorkflowEditSheet {...makeProps()} />);
    expect(screen.getByTestId("spinner")).toBeInTheDocument();
  });

  it("isError=true이면 에러 메시지와 다시 시도 버튼이 렌더된다", () => {
    mockedUseGetWorkflow.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof useGetWorkflow>);
    render(<WorkflowEditSheet {...makeProps()} />);
    expect(screen.getByText("워크플로우 정보를 불러오지 못했습니다.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "다시 시도" })).toBeInTheDocument();
  });

  it("다시 시도 버튼 클릭 시 refetch가 호출된다", () => {
    const refetch = vi.fn();
    mockedUseGetWorkflow.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      refetch,
    } as unknown as ReturnType<typeof useGetWorkflow>);
    render(<WorkflowEditSheet {...makeProps()} />);
    fireEvent.click(screen.getByRole("button", { name: "다시 시도" }));
    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it("workflow 로드 완료 시 WorkflowEditForm이 렌더된다", () => {
    mockedUseGetWorkflow.mockReturnValue({
      data: stubWorkflow,
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof useGetWorkflow>);
    render(<WorkflowEditSheet {...makeProps()} />);
    expect(screen.getByTestId("workflow-edit-form")).toBeInTheDocument();
  });

  it("workflow 로드 완료 시 제목에 workflowCode와 name이 표시된다", () => {
    mockedUseGetWorkflow.mockReturnValue({
      data: stubWorkflow,
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof useGetWorkflow>);
    render(<WorkflowEditSheet {...makeProps()} />);
    expect(screen.getByText("WF-001 · 테스트 워크플로우")).toBeInTheDocument();
  });

  it("workflow 로딩 중에는 제목이 기본값으로 표시된다", () => {
    mockedUseGetWorkflow.mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof useGetWorkflow>);
    render(<WorkflowEditSheet {...makeProps()} />);
    expect(screen.getByText("워크플로우 수정")).toBeInTheDocument();
  });

  it("Sheet onOpenChange(!open) 시 onClose가 호출된다", () => {
    const onClose = vi.fn();
    mockedUseGetWorkflow.mockReturnValue({
      data: stubWorkflow,
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof useGetWorkflow>);
    render(<WorkflowEditSheet {...makeProps({ onClose })} />);
    fireEvent.click(screen.getByTestId("sheet-close-btn"));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
