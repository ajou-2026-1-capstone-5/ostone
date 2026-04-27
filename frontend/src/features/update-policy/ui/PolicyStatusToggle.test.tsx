import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useUpdatePolicyStatus } from "../api/useUpdatePolicyStatus";
import { PolicyStatusToggle } from "./PolicyStatusToggle";

vi.mock("../api/useUpdatePolicyStatus", () => ({
  useUpdatePolicyStatus: vi.fn(),
}));

const mutate = vi.fn();
const mockedUseUpdatePolicyStatus = vi.mocked(useUpdatePolicyStatus);

describe("PolicyStatusToggle", () => {
  beforeEach(() => {
    mutate.mockReset();
    mockedUseUpdatePolicyStatus.mockReturnValue({
      mutate,
      isPending: false,
    } as unknown as ReturnType<typeof useUpdatePolicyStatus>);
  });

  it("ACTIVE 상태를 checked switch로 표시한다", () => {
    render(
      <PolicyStatusToggle
        workspaceId={1}
        packId={2}
        versionId={3}
        policyId={4}
        currentStatus="ACTIVE"
      />,
    );

    expect(screen.getByRole("switch", { name: "정책 상태" })).toBeChecked();
  });

  it("상태 변경 시 update mutation을 호출한다", () => {
    render(
      <PolicyStatusToggle
        workspaceId={1}
        packId={2}
        versionId={3}
        policyId={4}
        currentStatus="INACTIVE"
      />,
    );

    fireEvent.click(screen.getByRole("switch", { name: "정책 상태" }));

    expect(mutate).toHaveBeenCalledWith({
      workspaceId: 1,
      packId: 2,
      versionId: 3,
      policyId: 4,
      status: "ACTIVE",
    });
  });
});
