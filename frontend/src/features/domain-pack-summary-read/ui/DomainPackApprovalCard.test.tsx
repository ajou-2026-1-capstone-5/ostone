import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { DomainPackApprovalReadiness } from "../model/buildDomainPackApprovalReadiness";
import { DomainPackApprovalCard } from "./DomainPackApprovalCard";

const navigate = vi.hoisted(() => vi.fn());

vi.mock("react-router-dom", () => ({
  useNavigate: () => navigate,
}));

function readiness(overrides: Partial<DomainPackApprovalReadiness>): DomainPackApprovalReadiness {
  return {
    ready: false,
    isLoading: false,
    isError: false,
    blockers: [],
    retry: vi.fn(),
    ...overrides,
  };
}

describe("DomainPackApprovalCard", () => {
  beforeEach(() => {
    navigate.mockReset();
  });

  it("ready 상태에서 승인 버튼이 enabled 된다", () => {
    render(
      <DomainPackApprovalCard
        readiness={readiness({ ready: true })}
        isActivating={false}
        isPublished={false}
        onApprove={vi.fn()}
        onRetryReadiness={vi.fn()}
      />,
    );

    expect(screen.getByRole("button", { name: "승인" })).toBeEnabled();
    expect(screen.getByText(/승인할 수 있습니다/)).toBeInTheDocument();
  });

  it("blocker가 있으면 승인 버튼이 disabled 된다", () => {
    render(
      <DomainPackApprovalCard
        readiness={readiness({
          blockers: [{ type: "VERSION", message: "최신 버전만 승인할 수 있습니다." }],
        })}
        isActivating={false}
        isPublished={false}
        onApprove={vi.fn()}
        onRetryReadiness={vi.fn()}
      />,
    );

    expect(screen.getByRole("button", { name: "승인" })).toBeDisabled();
    expect(screen.getByText("최신 버전만 승인할 수 있습니다.")).toBeInTheDocument();
  });

  it("Intent blocker action 클릭 시 해당 route로 이동한다", () => {
    render(
      <DomainPackApprovalCard
        readiness={readiness({
          blockers: [
            {
              type: "INTENT",
              message: "승인 또는 반려되지 않은 Intent가 1개 남아 있습니다.",
              actionPath: "/workspaces/1/domain-packs/2/intents?versionId=3",
            },
          ],
        })}
        isActivating={false}
        isPublished={false}
        onApprove={vi.fn()}
        onRetryReadiness={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /Intent 검토하기/ }));

    expect(navigate).toHaveBeenCalledWith("/workspaces/1/domain-packs/2/intents?versionId=3");
  });

  it("readiness error 상태에서 다시 시도 action을 호출한다", () => {
    const onRetryReadiness = vi.fn();
    render(
      <DomainPackApprovalCard
        readiness={readiness({
          isError: true,
          blockers: [{ type: "SERVER", message: "승인 준비 상태를 확인하지 못했습니다." }],
        })}
        isActivating={false}
        isPublished={false}
        onApprove={vi.fn()}
        onRetryReadiness={onRetryReadiness}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /다시 시도/ }));

    expect(onRetryReadiness).toHaveBeenCalled();
  });

  it("PUBLISHED 상태에서는 승인 완료를 표시하고 승인 버튼을 숨긴다", () => {
    render(
      <DomainPackApprovalCard
        readiness={readiness({ ready: false })}
        isActivating={false}
        isPublished
        onApprove={vi.fn()}
        onRetryReadiness={vi.fn()}
      />,
    );

    expect(screen.getByText("승인 완료")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "승인" })).not.toBeInTheDocument();
  });
});
