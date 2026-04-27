import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useGetPolicy } from "../api/useGetPolicy";
import { PolicyEditPanel } from "./PolicyEditPanel";

vi.mock("../api/useGetPolicy", () => ({
  useGetPolicy: vi.fn(),
}));

vi.mock("./PolicyEditForm", () => ({
  PolicyEditForm: () => <div data-testid="policy-edit-form">form</div>,
}));

const mockedUseGetPolicy = vi.mocked(useGetPolicy);
const refetch = vi.fn();

const stubPolicy = {
  id: 4,
  domainPackVersionId: 3,
  policyCode: "POL_REFUND",
  name: "환불 정책",
  description: null,
  severity: "HIGH",
  conditionJson: "{}",
  actionJson: "{}",
  evidenceJson: "[]",
  metaJson: "{}",
  status: "ACTIVE" as const,
  createdAt: "",
  updatedAt: "",
};

describe("PolicyEditPanel", () => {
  beforeEach(() => {
    refetch.mockReset();
    mockedUseGetPolicy.mockReset();
  });

  it("policy 조회 성공 시 수정 폼을 보여준다", () => {
    mockedUseGetPolicy.mockReturnValue({
      data: stubPolicy,
      isLoading: false,
      isError: false,
      refetch,
    } as unknown as ReturnType<typeof useGetPolicy>);

    render(
      <PolicyEditPanel workspaceId={1} packId={2} versionId={3} policyId={4} onClose={vi.fn()} />,
    );

    expect(screen.getByText("POL_REFUND · 환불 정책")).toBeInTheDocument();
    expect(screen.getByTestId("policy-edit-form")).toBeInTheDocument();
  });

  it("닫기 버튼을 누르면 onClose를 호출한다", () => {
    const onClose = vi.fn();
    mockedUseGetPolicy.mockReturnValue({
      data: stubPolicy,
      isLoading: false,
      isError: false,
      refetch,
    } as unknown as ReturnType<typeof useGetPolicy>);

    render(
      <PolicyEditPanel workspaceId={1} packId={2} versionId={3} policyId={4} onClose={onClose} />,
    );

    fireEvent.click(screen.getByRole("button", { name: "수정 닫기" }));

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("조회 실패 시 재시도 버튼을 제공한다", () => {
    mockedUseGetPolicy.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      refetch,
    } as unknown as ReturnType<typeof useGetPolicy>);

    render(
      <PolicyEditPanel workspaceId={1} packId={2} versionId={3} policyId={4} onClose={vi.fn()} />,
    );

    fireEvent.click(screen.getByRole("button", { name: "다시 시도" }));

    expect(refetch).toHaveBeenCalledTimes(1);
  });
});
