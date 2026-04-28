import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useUpdateRiskStatus } from "../api/useUpdateRiskStatus";
import { RiskStatusToggle } from "./RiskStatusToggle";

vi.mock("../api/useUpdateRiskStatus", () => ({
  useUpdateRiskStatus: vi.fn(),
}));

const mutate = vi.fn();
const mockedUseUpdateRiskStatus = vi.mocked(useUpdateRiskStatus);

describe("RiskStatusToggle", () => {
  beforeEach(() => {
    mutate.mockReset();
    mockedUseUpdateRiskStatus.mockReturnValue({
      mutate,
      isPending: false,
    } as unknown as ReturnType<typeof useUpdateRiskStatus>);
  });

  it("ACTIVE 상태를 checked switch로 표시한다", () => {
    render(
      <RiskStatusToggle
        workspaceId={1}
        packId={2}
        versionId={3}
        riskId={4}
        currentStatus="ACTIVE"
      />,
    );

    expect(screen.getByRole("switch", { name: "위험요소 상태" })).toBeChecked();
  });

  it("상태 변경 시 update mutation을 호출한다", () => {
    render(
      <RiskStatusToggle
        workspaceId={1}
        packId={2}
        versionId={3}
        riskId={4}
        currentStatus="INACTIVE"
      />,
    );

    fireEvent.click(screen.getByRole("switch", { name: "위험요소 상태" }));

    expect(mutate).toHaveBeenCalledWith({
      workspaceId: 1,
      packId: 2,
      versionId: 3,
      riskId: 4,
      status: "ACTIVE",
    });
  });
});
