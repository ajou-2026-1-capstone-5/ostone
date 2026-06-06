import { render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import { MemoryRouter, Outlet, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { usePipelineReviewCheckpoint } from "@/features/pipeline-review/api/pipelineReviewApi";
import { PipelineReviewPage } from "./PipelineReviewPage";

vi.mock("@/features/pipeline-review/api/pipelineReviewApi", () => ({
  usePipelineReviewCheckpoint: vi.fn(),
}));

vi.mock("@/features/pipeline-review/ui/PipelineReviewCheckpointCard", () => ({
  PipelineReviewCheckpointCard: ({ workspaceId, pipelineJobId }: { workspaceId?: number; pipelineJobId?: number }) => (
    <div data-testid="checkpoint-card">
      {workspaceId}:{pipelineJobId}
    </div>
  ),
}));

const mockedUseCheckpoint = vi.mocked(usePipelineReviewCheckpoint);

function WorkspaceShell() {
  const [crumbs, setCrumbs] = useState<string[]>([]);
  return (
    <div>
      <span data-testid="crumbs">{crumbs.join("/")}</span>
      <Outlet context={{ setCrumbs, workspace: { id: 1, name: "CS" } }} />
    </div>
  );
}

function renderPage(initialEntry: string) {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Routes>
        <Route path="/workspaces/:workspaceId" element={<WorkspaceShell />}>
          <Route path="pipeline-jobs/:pipelineJobId/review" element={<PipelineReviewPage />} />
        </Route>
        <Route path="/workspaces" element={<div>워크스페이스 목록</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  mockedUseCheckpoint.mockReset();
  mockedUseCheckpoint.mockReturnValue({
    data: {
      pipelineJobId: 7,
      pipelineStatus: "WAITING_HUMAN_FEEDBACK",
      reviewKind: "HUMAN_FEEDBACK",
      tasks: [],
    },
  } as never);
});

describe("PipelineReviewPage", () => {
  it("shows checkpoint context for a valid pipeline job route", async () => {
    renderPage("/workspaces/1/pipeline-jobs/7/review");

    expect(screen.getByText("초안 생성 전에 파이프라인 입력을 확정합니다.")).toBeInTheDocument();
    expect(screen.getByText("사람 피드백 대기")).toBeInTheDocument();
    expect(screen.getByText("체크포인트 완료 후 진행")).toBeInTheDocument();
    expect(screen.getByTestId("checkpoint-card")).toHaveTextContent("1:7");
    expect(mockedUseCheckpoint).toHaveBeenCalledWith(1, 7, { autoRefresh: true });
    await waitFor(() => expect(screen.getByTestId("crumbs")).toHaveTextContent("Pipeline review"));
  });

  it.each([
    [
      "WAITING_DOMAIN_CONFIRMATION",
      "DOMAIN_CONFIRMATION",
      "도메인 확정 대기",
      "결정 후 replay",
      "체크포인트 완료 후 진행",
    ],
    [
      "SUCCEEDED",
      null,
      "파이프라인 완료",
      "활성 체크포인트 없음",
      "Domain Pack 승인 화면에서 진행",
    ],
    ["FAILED", null, "파이프라인 실패", "활성 체크포인트 없음", "실패 상태에서는 승인 불가"],
    ["CANCELLED", null, "파이프라인 취소", "활성 체크포인트 없음", "취소 상태에서는 승인 불가"],
    [
      "RUNNING",
      null,
      "RUNNING",
      "활성 체크포인트 없음",
      "완료 후 Domain Pack 화면에서 진행",
    ],
    [
      undefined,
      null,
      "확인 중",
      "활성 체크포인트 없음",
      "완료 후 Domain Pack 화면에서 진행",
    ],
  ])(
    "maps checkpoint status %s and review kind %s",
    (pipelineStatus, reviewKind, expectedStatus, expectedMode, expectedApproval) => {
      mockedUseCheckpoint.mockReturnValue({
        data: {
          pipelineJobId: 7,
          pipelineStatus,
          reviewKind,
          tasks: [],
        },
      } as never);

      renderPage("/workspaces/1/pipeline-jobs/7/review");

      expect(screen.getByText(expectedStatus)).toBeInTheDocument();
      expect(screen.getByText(expectedMode)).toBeInTheDocument();
      expect(screen.getByText(expectedApproval)).toBeInTheDocument();
    },
  );

  it("shows status lookup failure in the route context without implying completion", () => {
    mockedUseCheckpoint.mockReturnValue({
      isError: true,
      data: undefined,
    } as never);

    renderPage("/workspaces/1/pipeline-jobs/7/review");

    expect(screen.getByText("상태 조회 실패")).toBeInTheDocument();
    expect(screen.getByText("현재 job 상태 확인 불가")).toBeInTheDocument();
    expect(screen.queryByText("파이프라인 완료")).not.toBeInTheDocument();
  });

  it("redirects invalid route ids back to workspace list", () => {
    renderPage("/workspaces/not-a-number/pipeline-jobs/7/review");

    expect(screen.getByText("워크스페이스 목록")).toBeInTheDocument();
  });
});
