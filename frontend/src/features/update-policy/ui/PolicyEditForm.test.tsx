import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { useUpdatePolicy } from "../api/useUpdatePolicy";
import { useUpdatePolicyStatus } from "../api/useUpdatePolicyStatus";
import { PolicyEditForm } from "./PolicyEditForm";

vi.mock("../api/useUpdatePolicy", () => ({
  useUpdatePolicy: vi.fn(),
}));

vi.mock("../api/useUpdatePolicyStatus", async () => {
  const actual = await vi.importActual<typeof import("../api/useUpdatePolicyStatus")>(
    "../api/useUpdatePolicyStatus",
  );
  return {
    ...actual,
    useUpdatePolicyStatus: vi.fn(),
  };
});

const mutatePolicy = vi.fn();
const mutateStatus = vi.fn();
const mockedUseUpdatePolicy = vi.mocked(useUpdatePolicy);
const mockedUseUpdatePolicyStatus = vi.mocked(useUpdatePolicyStatus);

const stubPolicy = {
  id: 4,
  domainPackVersionId: 3,
  policyCode: "POL_REFUND",
  name: "환불 정책",
  description: "환불 조건",
  severity: "HIGH",
  conditionJson: '{"channel":"web"}',
  actionJson: '{"type":"REFUND_REVIEW"}',
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
    <PolicyEditForm
      policy={stubPolicy}
      workspaceId={1}
      packId={2}
      versionId={3}
      onClose={onClose}
    />,
    { wrapper: makeWrapper() },
  );
  return { onClose };
}

describe("PolicyEditForm", () => {
  beforeAll(() => {
    globalThis.ResizeObserver = class ResizeObserver {
      observe = vi.fn();
      unobserve = vi.fn();
      disconnect = vi.fn();
    };
  });

  beforeEach(() => {
    mutatePolicy.mockReset();
    mutateStatus.mockReset();
    mockedUseUpdatePolicy.mockReturnValue({
      mutate: mutatePolicy,
      isPending: false,
    } as unknown as ReturnType<typeof useUpdatePolicy>);
    mockedUseUpdatePolicyStatus.mockReturnValue({
      mutate: mutateStatus,
      isPending: false,
    } as unknown as ReturnType<typeof useUpdatePolicyStatus>);
  });

  it("기존 정책 값을 폼에 채운다", () => {
    renderForm();

    expect(screen.getByDisplayValue("환불 정책")).toBeInTheDocument();
    expect(screen.getByDisplayValue("환불 조건")).toBeInTheDocument();
    expect(screen.getByDisplayValue("POL_REFUND")).toBeDisabled();
    expect(screen.getByDisplayValue("3")).toBeDisabled();
  });

  it("저장 시 수정 mutation을 호출한다", async () => {
    renderForm();

    fireEvent.change(screen.getByDisplayValue("환불 정책"), {
      target: { value: "환불 정책 수정본" },
    });
    fireEvent.click(screen.getByRole("button", { name: "저장" }));

    await waitFor(() => expect(mutatePolicy).toHaveBeenCalled());
    expect(mutatePolicy).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId: 1,
        packId: 2,
        versionId: 3,
        policyId: 4,
        body: expect.objectContaining({ name: "환불 정책 수정본" }),
      }),
      expect.objectContaining({ onSuccess: expect.any(Function) }),
    );
  });

  it("취소 시 onClose를 호출한다", () => {
    const { onClose } = renderForm();

    fireEvent.click(screen.getByRole("button", { name: "취소" }));

    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
