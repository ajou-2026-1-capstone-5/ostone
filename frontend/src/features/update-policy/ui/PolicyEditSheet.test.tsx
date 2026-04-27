import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useGetPolicy } from "../api/useGetPolicy";
import { PolicyEditSheet } from "./PolicyEditSheet";

vi.mock("../api/useGetPolicy", () => ({
  useGetPolicy: vi.fn(),
}));

vi.mock("./PolicyEditForm", () => ({
  PolicyEditForm: () => <div data-testid="sheet-policy-edit-form">form</div>,
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

describe("PolicyEditSheet", () => {
  beforeEach(() => {
    refetch.mockReset();
    mockedUseGetPolicy.mockReset();
  });

  it("열렸을 때 정책 수정 폼을 표시한다", () => {
    mockedUseGetPolicy.mockReturnValue({
      data: stubPolicy,
      isLoading: false,
      isError: false,
      refetch,
    } as unknown as ReturnType<typeof useGetPolicy>);

    render(
      <PolicyEditSheet
        workspaceId={1}
        packId={2}
        versionId={3}
        policyId={4}
        isOpen
        onClose={vi.fn()}
      />,
    );

    expect(screen.getByText("POL_REFUND · 환불 정책")).toBeInTheDocument();
    expect(screen.getByTestId("sheet-policy-edit-form")).toBeInTheDocument();
  });

  it("조회 실패 시 재시도한다", () => {
    mockedUseGetPolicy.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      refetch,
    } as unknown as ReturnType<typeof useGetPolicy>);

    render(
      <PolicyEditSheet
        workspaceId={1}
        packId={2}
        versionId={3}
        policyId={4}
        isOpen
        onClose={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "다시 시도" }));

    expect(refetch).toHaveBeenCalledTimes(1);
  });
});
