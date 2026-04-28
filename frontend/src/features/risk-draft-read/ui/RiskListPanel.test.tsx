import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useRiskList } from "../model/useRiskList";
import { RiskListPanel } from "./RiskListPanel";

vi.mock("../model/useRiskList", () => ({
  useRiskList: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: {
    error: vi.fn(),
  },
}));

const mockedUseRiskList = vi.mocked(useRiskList);

const stubRisk = {
  id: 4,
  domainPackVersionId: 3,
  riskCode: "RISK_FRAUD",
  name: "사기 위험",
  description: null,
  riskLevel: "HIGH" as const,
  status: "INACTIVE" as const,
  createdAt: "",
  updatedAt: "",
};

function renderPanel(onSelect = vi.fn()) {
  render(
    <RiskListPanel workspaceId={1} packId={2} versionId={3} selectedId={4} onSelect={onSelect} />,
  );
  return { onSelect };
}

describe("RiskListPanel", () => {
  beforeEach(() => {
    mockedUseRiskList.mockReset();
  });

  it("loading 상태에서는 skeleton 목록을 렌더링한다", () => {
    mockedUseRiskList.mockReturnValue({ status: "loading" });

    renderPanel();

    expect(screen.getByLabelText("위험요소 목록")).toBeInTheDocument();
    expect(screen.getByText("— · LIST")).toBeInTheDocument();
  });

  it("ready 상태에서는 목록을 렌더링하고 선택 이벤트를 전달한다", () => {
    mockedUseRiskList.mockReturnValue({ status: "ready", data: [stubRisk] });
    const { onSelect } = renderPanel();

    const riskButton = screen.getByRole("button", { name: /RISK_FRAUD/ });
    fireEvent.click(riskButton);

    expect(screen.getByText("1 · LIST")).toBeInTheDocument();
    expect(riskButton).toHaveAttribute("aria-current", "true");
    expect(screen.getByText("사기 위험")).toBeInTheDocument();
    expect(onSelect).toHaveBeenCalledWith(4);
  });

  it("empty 상태에서는 빈 목록 안내를 보여준다", () => {
    mockedUseRiskList.mockReturnValue({ status: "empty" });

    renderPanel();

    expect(screen.getByText("0 · LIST")).toBeInTheDocument();
    expect(screen.getByText("등록된 위험요소 초안이 없습니다.")).toBeInTheDocument();
  });

  it("error 상태에서는 재시도 버튼을 제공한다", () => {
    mockedUseRiskList.mockReturnValue({
      status: "error",
      code: "UNKNOWN_ERROR",
      message: "실패",
    });

    renderPanel();

    expect(screen.getByText("위험요소 목록을 불러오지 못했습니다.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "다시 시도" })).toBeInTheDocument();
  });
});
