import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { toast } from "sonner";
import { RISK_READ_ERROR_MESSAGES } from "../model/mapApiError";
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

function renderPanel(onEdit = vi.fn()) {
  render(<RiskDetailPanel workspaceId={1} packId={2} versionId={3} riskId={4} onEdit={onEdit} />);
  return { onEdit };
}

describe("RiskDetailPanel", () => {
  beforeEach(() => {
    mockedUseRiskDetail.mockReset();
    vi.mocked(toast.error).mockReset();
  });

  it("idle 상태에서는 선택 안내를 보여준다", () => {
    mockedUseRiskDetail.mockReturnValue({ status: "idle" });

    renderPanel();

    expect(screen.getByText("주의 사항을 선택하세요.")).toBeInTheDocument();
  });

  it("ready 상태에서는 주의 사항 상세와 JSON 필드를 보여준다", () => {
    mockedUseRiskDetail.mockReturnValue({ status: "ready", data: stubRisk });

    renderPanel();

    expect(screen.getAllByText("RISK_FRAUD")).toHaveLength(2);
    expect(screen.getByText("사기 위험")).toBeInTheDocument();
    expect(screen.getByText(/MANUAL_REVIEW/)).toBeInTheDocument();
    expect(screen.getByText("감지 조건")).toBeInTheDocument();
    expect(screen.getByText("응대 방법")).toBeInTheDocument();
  });

  it("빈 JSON과 비활성 주의 사항도 상담사 용어로 표시한다", () => {
    mockedUseRiskDetail.mockReturnValue({
      status: "ready",
      data: {
        ...stubRisk,
        description: null,
        riskLevel: null,
        triggerConditionJson: null,
        handlingActionJson: null,
        evidenceJson: null,
        metaJson: null,
        status: "INACTIVE",
        updatedAt: "확인 전",
      },
    });

    renderPanel();

    expect(screen.getByText("주의 수준")).toBeInTheDocument();
    expect(screen.getAllByText("—").length).toBeGreaterThanOrEqual(5);
    expect(screen.getByText("사용 안 함")).toBeInTheDocument();
    expect(screen.getByText("수정일 · 확인 전")).toBeInTheDocument();
  });

  it("JSON 필드가 객체이거나 파싱되지 않는 문자열이어도 상세 화면을 유지한다", () => {
    mockedUseRiskDetail.mockReturnValue({
      status: "ready",
      data: {
        ...stubRisk,
        triggerConditionJson: { channel: "web" } as never,
        handlingActionJson: "{invalid-json",
      },
    });

    renderPanel();

    expect(screen.getByText(/"channel": "web"/)).toBeInTheDocument();
    expect(screen.getByText("{invalid-json")).toBeInTheDocument();
    expect(screen.getByText("사기 위험")).toBeInTheDocument();
  });

  it("수정 버튼을 누르면 onEdit에 riskId를 전달한다", () => {
    mockedUseRiskDetail.mockReturnValue({ status: "ready", data: stubRisk });
    const { onEdit } = renderPanel();

    fireEvent.click(screen.getByRole("button", { name: "RISK_FRAUD 주의 사항 수정" }));

    expect(onEdit).toHaveBeenCalledWith(4);
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
      "주의 사항을 찾을 수 없습니다.",
      expect.objectContaining({ id: expect.stringContaining("risk-detail-error") }),
    );
  });

  it("서버 오류는 찾을 수 없음과 다른 안내로 toast와 placeholder에 표시한다", () => {
    mockedUseRiskDetail.mockReturnValue({
      status: "error",
      code: "SERVER_ERROR",
      message: RISK_READ_ERROR_MESSAGES.SERVER_ERROR,
      httpStatus: 500,
    });

    renderPanel();

    expect(screen.getByText(RISK_READ_ERROR_MESSAGES.SERVER_ERROR)).toBeInTheDocument();
    expect(toast.error).toHaveBeenCalledWith(
      RISK_READ_ERROR_MESSAGES.SERVER_ERROR,
      expect.objectContaining({ id: expect.stringContaining("SERVER_ERROR") }),
    );
  });
});
