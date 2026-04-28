import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useGetRisk } from "../api/useGetRisk";
import { RiskEditPanel } from "./RiskEditPanel";

vi.mock("../api/useGetRisk", () => ({
  useGetRisk: vi.fn(),
}));

vi.mock("./RiskEditForm", () => ({
  RiskEditForm: () => <div data-testid="risk-edit-form">form</div>,
}));

const mockedUseGetRisk = vi.mocked(useGetRisk);
const refetch = vi.fn();

const stubRisk = {
  id: 4,
  domainPackVersionId: 3,
  riskCode: "RISK_FRAUD",
  name: "사기 위험",
  description: null,
  riskLevel: "HIGH" as const,
  triggerConditionJson: "{}",
  handlingActionJson: "{}",
  evidenceJson: "[]",
  metaJson: "{}",
  status: "ACTIVE" as const,
  createdAt: "",
  updatedAt: "",
};

describe("RiskEditPanel", () => {
  beforeEach(() => {
    refetch.mockReset();
    mockedUseGetRisk.mockReset();
  });

  it("risk 조회 성공 시 수정 폼을 보여준다", () => {
    mockedUseGetRisk.mockReturnValue({
      data: stubRisk,
      isLoading: false,
      isError: false,
      refetch,
    } as unknown as ReturnType<typeof useGetRisk>);

    render(<RiskEditPanel workspaceId={1} packId={2} versionId={3} riskId={4} onClose={vi.fn()} />);

    expect(screen.getByText("RISK_FRAUD · 사기 위험")).toBeInTheDocument();
    expect(screen.getByTestId("risk-edit-form")).toBeInTheDocument();
  });

  it("닫기 버튼을 누르면 onClose를 호출한다", () => {
    const onClose = vi.fn();
    mockedUseGetRisk.mockReturnValue({
      data: stubRisk,
      isLoading: false,
      isError: false,
      refetch,
    } as unknown as ReturnType<typeof useGetRisk>);

    render(<RiskEditPanel workspaceId={1} packId={2} versionId={3} riskId={4} onClose={onClose} />);

    fireEvent.click(screen.getByRole("button", { name: "수정 닫기" }));

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("조회 실패 시 재시도 버튼을 제공한다", () => {
    mockedUseGetRisk.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      refetch,
    } as unknown as ReturnType<typeof useGetRisk>);

    render(<RiskEditPanel workspaceId={1} packId={2} versionId={3} riskId={4} onClose={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: "다시 시도" }));

    expect(refetch).toHaveBeenCalledTimes(1);
  });
});
