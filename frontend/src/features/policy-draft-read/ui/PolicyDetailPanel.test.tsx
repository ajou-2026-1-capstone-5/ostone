import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { toast } from "sonner";
import { usePolicyDetail } from "../model/usePolicyDetail";
import { PolicyDetailPanel } from "./PolicyDetailPanel";

vi.mock("../model/usePolicyDetail", () => ({
  usePolicyDetail: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: {
    error: vi.fn(),
  },
}));

const mockedUsePolicyDetail = vi.mocked(usePolicyDetail);

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
  createdAt: "2026-04-16T10:00:00Z",
  updatedAt: "2026-04-16T10:00:00Z",
};

function renderPanel(onEdit = vi.fn()) {
  render(
    <PolicyDetailPanel workspaceId={1} packId={2} versionId={3} policyId={4} onEdit={onEdit} />,
  );
  return { onEdit };
}

describe("PolicyDetailPanel", () => {
  beforeEach(() => {
    mockedUsePolicyDetail.mockReset();
    vi.mocked(toast.error).mockReset();
  });

  it("idle 상태에서는 선택 안내를 보여준다", () => {
    mockedUsePolicyDetail.mockReturnValue({ status: "idle" });

    renderPanel();

    expect(screen.getByText("선택된 응대 기준이 없습니다.")).toBeInTheDocument();
    expect(screen.getByText("목록에서 기준을 선택하면 상세 정보가 표시됩니다.")).toBeInTheDocument();
  });

  it("ready 상태에서는 정책 상세와 수정 액션을 보여준다", () => {
    mockedUsePolicyDetail.mockReturnValue({ status: "ready", data: stubPolicy });
    const { onEdit } = renderPanel();

    expect(screen.getAllByText("POL_REFUND")).toHaveLength(2);
    expect(screen.getByText("환불 정책")).toBeInTheDocument();
    expect(screen.getByText(/REFUND_REVIEW/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /POL_REFUND 응대 기준 수정/ }));

    expect(onEdit).toHaveBeenCalledWith(4);
  });

  it("빈 JSON과 비활성 응대 기준도 상담사 용어로 표시한다", () => {
    mockedUsePolicyDetail.mockReturnValue({
      status: "ready",
      data: {
        ...stubPolicy,
        description: null,
        severity: null,
        conditionJson: null,
        actionJson: null,
        evidenceJson: null,
        metaJson: null,
        status: "INACTIVE",
        updatedAt: "확인 전",
      },
    });

    renderPanel();

    expect(screen.getByText("중요도")).toBeInTheDocument();
    expect(screen.getAllByText("—").length).toBeGreaterThanOrEqual(5);
    expect(screen.getByText("사용 안 함")).toBeInTheDocument();
    expect(screen.getByText("수정일 · 확인 전")).toBeInTheDocument();
  });

  it("error 상태에서는 toast와 재시도 버튼을 보여준다", () => {
    mockedUsePolicyDetail.mockReturnValue({
      status: "error",
      code: "POLICY_NOT_FOUND",
      message: "없음",
      httpStatus: 404,
    });

    renderPanel();

    expect(screen.getByText("상세 정보를 불러오지 못했습니다.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "다시 시도" })).toBeInTheDocument();
    expect(toast.error).toHaveBeenCalledWith(
      "응대 기준을 찾을 수 없습니다.",
      expect.objectContaining({ id: expect.stringContaining("policy-detail-error") }),
    );
  });
});
