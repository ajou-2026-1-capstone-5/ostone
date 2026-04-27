import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { usePolicyList } from "../model/usePolicyList";
import { PolicyListPanel } from "./PolicyListPanel";

vi.mock("../model/usePolicyList", () => ({
  usePolicyList: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: {
    error: vi.fn(),
  },
}));

const mockedUsePolicyList = vi.mocked(usePolicyList);

const stubPolicy = {
  id: 4,
  domainPackVersionId: 3,
  policyCode: "POL_REFUND",
  name: "환불 정책",
  description: null,
  severity: "HIGH",
  status: "INACTIVE" as const,
  createdAt: "",
  updatedAt: "",
};

function renderPanel(onSelect = vi.fn()) {
  render(
    <PolicyListPanel workspaceId={1} packId={2} versionId={3} selectedId={4} onSelect={onSelect} />,
  );
  return { onSelect };
}

describe("PolicyListPanel", () => {
  beforeEach(() => {
    mockedUsePolicyList.mockReset();
  });

  it("loading 상태에서는 skeleton 목록을 렌더링한다", () => {
    mockedUsePolicyList.mockReturnValue({ status: "loading" });

    renderPanel();

    expect(screen.getByLabelText("정책 목록")).toBeInTheDocument();
    expect(screen.getByText("— · LIST")).toBeInTheDocument();
  });

  it("ready 상태에서는 목록을 렌더링하고 선택 이벤트를 전달한다", () => {
    mockedUsePolicyList.mockReturnValue({ status: "ready", data: [stubPolicy] });
    const { onSelect } = renderPanel();

    fireEvent.click(screen.getByRole("button", { name: /POL_REFUND/ }));

    expect(screen.getByText("1 · LIST")).toBeInTheDocument();
    expect(screen.getByText("환불 정책")).toBeInTheDocument();
    expect(onSelect).toHaveBeenCalledWith(4);
  });

  it("error 상태에서는 재시도 버튼을 제공한다", () => {
    mockedUsePolicyList.mockReturnValue({
      status: "error",
      code: "UNKNOWN_ERROR",
      message: "실패",
    });

    renderPanel();

    expect(screen.getByText("정책 목록을 불러오지 못했습니다.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "다시 시도" })).toBeInTheDocument();
  });
});
