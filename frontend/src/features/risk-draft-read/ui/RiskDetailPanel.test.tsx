import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { toast } from "sonner";
import { useRiskDetail } from "../model/useRiskDetail";
import { RiskDetailPanel } from "./RiskDetailPanel";

vi.mock("../model/useRiskDetail", () => ({
  useRiskDetail: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: {
    error: vi.fn(),
  },
}));

const mockedUseRiskDetail = vi.mocked(useRiskDetail);

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
  createdAt: "2026-04-16T10:00:00Z",
  updatedAt: "2026-04-16T10:00:00Z",
};

function renderPanel() {
  render(<RiskDetailPanel workspaceId={1} packId={2} versionId={3} riskId={4} />);
}

describe("RiskDetailPanel", () => {
  beforeEach(() => {
    mockedUseRiskDetail.mockReset();
    vi.mocked(toast.error).mockReset();
  });

  it("idle 상태에서는 선택 안내를 보여준다", () => {
    mockedUseRiskDetail.mockReturnValue({ status: "idle" });

    renderPanel();

    expect(screen.getByText("위험요소를 선택하세요.")).toBeInTheDocument();
  });

  it("ready 상태에서는 위험요소 상세와 JSON 필드를 보여준다", () => {
    mockedUseRiskDetail.mockReturnValue({ status: "ready", data: stubRisk });

    renderPanel();

    expect(screen.getAllByText("RISK_FRAUD")).toHaveLength(2);
    expect(screen.getByText("사기 위험")).toBeInTheDocument();
    expect(screen.getByText(/MANUAL_REVIEW/)).toBeInTheDocument();
    expect(screen.getByText("Trigger Condition")).toBeInTheDocument();
    expect(screen.getByText("Handling Action")).toBeInTheDocument();
  });

  it("error 상태에서는 toast와 재시도 버튼을 보여준다", () => {
    mockedUseRiskDetail.mockReturnValue({
      status: "error",
      code: "RISK_DEFINITION_NOT_FOUND",
      message: "없음",
      httpStatus: 404,
    });

    renderPanel();

    expect(screen.getByText("상세 정보를 불러오지 못했습니다.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "다시 시도" })).toBeInTheDocument();
    expect(toast.error).toHaveBeenCalledWith(
      "위험요소를 찾을 수 없습니다.",
      expect.objectContaining({ id: expect.stringContaining("risk-detail-error") }),
    );
  });
});
