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

    expect(screen.getByText("정책을 선택하세요.")).toBeInTheDocument();
  });

  it("ready 상태에서는 정책 상세와 수정 액션을 보여준다", () => {
    mockedUsePolicyDetail.mockReturnValue({ status: "ready", data: stubPolicy });
    const { onEdit } = renderPanel();

    expect(screen.getAllByText("POL_REFUND")).toHaveLength(2);
    expect(screen.getByText("환불 정책")).toBeInTheDocument();
    expect(screen.getByText(/REFUND_REVIEW/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /POL_REFUND 정책 수정/ }));

    expect(onEdit).toHaveBeenCalledWith(4);
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
      "정책을 찾을 수 없습니다.",
      expect.objectContaining({ id: expect.stringContaining("policy-detail-error") }),
    );
  });
});
