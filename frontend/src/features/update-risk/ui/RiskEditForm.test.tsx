import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { useUpdateRisk } from "../api/useUpdateRisk";
import { useUpdateRiskStatus } from "../api/useUpdateRiskStatus";
import { RiskEditForm } from "./RiskEditForm";

vi.mock("../api/useUpdateRisk", () => ({
  useUpdateRisk: vi.fn(),
}));

vi.mock("../api/useUpdateRiskStatus", async () => {
  const actual = await vi.importActual<typeof import("../api/useUpdateRiskStatus")>(
    "../api/useUpdateRiskStatus",
  );
  return {
    ...actual,
    useUpdateRiskStatus: vi.fn(),
  };
});

const mutateRisk = vi.fn();
const mutateStatus = vi.fn();
const mockedUseUpdateRisk = vi.mocked(useUpdateRisk);
const mockedUseUpdateRiskStatus = vi.mocked(useUpdateRiskStatus);

const stubRisk = {
  id: 4,
  domainPackVersionId: 3,
  riskCode: "RISK_FRAUD",
  name: "사기 위험",
  description: "부정 거래 징후",
  riskLevel: "HIGH" as const,
  triggerConditionJson: '{"channel":"web"}',
  handlingActionJson: '{"type":"MANUAL_REVIEW"}',
  evidenceJson: "[]",
  metaJson: "{}",
  status: "ACTIVE" as const,
  createdAt: "",
  updatedAt: "",
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
    <RiskEditForm risk={stubRisk} workspaceId={1} packId={2} versionId={3} onClose={onClose} />,
    { wrapper: makeWrapper() },
  );
  return { onClose };
}

describe("RiskEditForm", () => {
  beforeAll(() => {
    globalThis.ResizeObserver = class ResizeObserver {
      observe = vi.fn();
      unobserve = vi.fn();
      disconnect = vi.fn();
    };
  });

  beforeEach(() => {
    mutateRisk.mockReset();
    mutateStatus.mockReset();
    mockedUseUpdateRisk.mockReturnValue({
      mutate: mutateRisk,
      isPending: false,
    } as unknown as ReturnType<typeof useUpdateRisk>);
    mockedUseUpdateRiskStatus.mockReturnValue({
      mutate: mutateStatus,
      isPending: false,
    } as unknown as ReturnType<typeof useUpdateRiskStatus>);
  });

  it("기존 위험요소 값을 폼에 채운다", () => {
    renderForm();

    expect(screen.getByDisplayValue("사기 위험")).toBeInTheDocument();
    expect(screen.getByDisplayValue("부정 거래 징후")).toBeInTheDocument();
    expect(screen.getByDisplayValue("RISK_FRAUD")).toBeDisabled();
    expect(screen.getByDisplayValue("3")).toBeDisabled();
  });

  it("저장 시 수정 mutation을 호출한다", async () => {
    renderForm();

    fireEvent.change(screen.getByDisplayValue("사기 위험"), {
      target: { value: "사기 위험 수정본" },
    });
    fireEvent.click(screen.getByRole("button", { name: "저장" }));

    await waitFor(() => expect(mutateRisk).toHaveBeenCalled());
    expect(mutateRisk).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId: 1,
        packId: 2,
        versionId: 3,
        riskId: 4,
        body: expect.objectContaining({ name: "사기 위험 수정본", riskLevel: "HIGH" }),
      }),
      expect.objectContaining({ onSuccess: expect.any(Function) }),
    );
  });

  it("같은 위험요소의 상태 갱신 응답으로 폼 입력값을 덮어쓰지 않는다", () => {
    const wrapper = makeWrapper();
    const { rerender } = render(
      <RiskEditForm risk={stubRisk} workspaceId={1} packId={2} versionId={3} onClose={vi.fn()} />,
      { wrapper },
    );

    fireEvent.change(screen.getByDisplayValue("사기 위험"), {
      target: { value: "저장 전 입력값" },
    });

    rerender(
      <RiskEditForm
        risk={{ ...stubRisk, status: "INACTIVE" }}
        workspaceId={1}
        packId={2}
        versionId={3}
        onClose={vi.fn()}
      />,
    );

    expect(screen.getByDisplayValue("저장 전 입력값")).toBeInTheDocument();
  });

  it("취소 시 onClose를 호출한다", () => {
    const { onClose } = renderForm();

    fireEvent.click(screen.getByRole("button", { name: "취소" }));

    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
