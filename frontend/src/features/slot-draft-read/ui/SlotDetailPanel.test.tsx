import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { toast } from "sonner";
import { useSlotDetail } from "../model/useSlotDetail";
import { SlotDetailPanel } from "./SlotDetailPanel";

vi.mock("../model/useSlotDetail", () => ({
  useSlotDetail: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: {
    error: vi.fn(),
  },
}));

const mockedUseSlotDetail = vi.mocked(useSlotDetail);

const stubDetail = {
  id: 10,
  domainPackVersionId: 10,
  slotCode: "SLOT_001",
  name: "배송 주소",
  description: undefined,
  dataType: "STRING",
  isSensitive: false,
  validationRuleJson: "{}",
  defaultValueJson: undefined,
  metaJson: "{}",
  status: "ACTIVE" as const,
  createdAt: "2026-04-16T10:00:00Z",
  updatedAt: "2026-04-16T10:00:00Z",
};

function renderPanel() {
  return render(<SlotDetailPanel wsId={1} packId={2} versionId={3} slotId={10} />);
}

describe("SlotDetailPanel", () => {
  beforeEach(() => {
    mockedUseSlotDetail.mockReset();
    vi.mocked(toast.error).mockReset();
  });

  it("idle 상태에서는 선택 안내를 보여준다", () => {
    mockedUseSlotDetail.mockReturnValue({ status: "idle" });

    renderPanel();

    expect(screen.getByText("확인 항목을 선택하세요.")).toBeInTheDocument();
  });

  it("loading 상태에서는 스켈레톤을 보여준다", () => {
    mockedUseSlotDetail.mockReturnValue({ status: "loading" });

    renderPanel();

    expect(screen.getByLabelText("확인 항목 상세")).toBeInTheDocument();
    expect(document.querySelector('[class*="skeleton"]')).toBeTruthy();
  });

  it("ready 상태에서는 슬롯 상세 정보를 보여준다", () => {
    mockedUseSlotDetail.mockReturnValue({ status: "ready", data: stubDetail });

    renderPanel();

    expect(screen.getAllByText("SLOT_001").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("배송 주소")).toBeInTheDocument();
    expect(screen.getAllByText("STRING").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("아니오")).toBeInTheDocument();
  });

  it("민감 확인 항목과 빈 JSON을 상담사 용어로 표시한다", () => {
    mockedUseSlotDetail.mockReturnValue({
      status: "ready",
      data: {
        ...stubDetail,
        description: "주문자 본인 확인",
        isSensitive: true,
        validationRuleJson: undefined,
        defaultValueJson: "",
        metaJson: undefined,
        status: "INACTIVE",
        updatedAt: "확인 전",
      },
    });

    renderPanel();

    expect(screen.getByText("주문자 본인 확인")).toBeInTheDocument();
    expect(screen.getByText("사용 안 함")).toBeInTheDocument();
    expect(screen.getByText("예")).toBeInTheDocument();
    expect(screen.getAllByText("—").length).toBeGreaterThanOrEqual(3);
    expect(screen.getByText("수정일 · 확인 전")).toBeInTheDocument();
  });

  it("error 상태에서는 toast와 재시도 버튼을 보여준다", () => {
    mockedUseSlotDetail.mockReturnValue({
      status: "error",
      code: "SLOT_NOT_FOUND",
      message: "확인 항목을 찾을 수 없습니다.",
      httpStatus: 404,
    });

    renderPanel();

    expect(screen.getByText("상세 정보를 불러오지 못했습니다.")).toBeInTheDocument();
    expect(screen.getByText("SLOT_NOT_FOUND")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "다시 시도" })).toBeInTheDocument();
    expect(toast.error).toHaveBeenCalledWith(
      "확인 항목을 찾을 수 없습니다.",
      expect.objectContaining({ id: expect.stringContaining("slot-detail-error") }),
    );
  });

  it("retry 버튼 클릭 시에도 에러 상태가 유지된다", () => {
    mockedUseSlotDetail.mockReturnValue({
      status: "error",
      code: "FETCH_FAILED",
      message: "네트워크 오류",
    });

    renderPanel();

    const retryBtn = screen.getByRole("button", { name: "다시 시도" });
    fireEvent.click(retryBtn);

    expect(screen.getByText("상세 정보를 불러오지 못했습니다.")).toBeInTheDocument();
    expect(toast.error).toHaveBeenCalled();
  });
});
