import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import { useWorkspaceDashboardHealth } from "../api/workspaceDashboardHealthApi";
import { KnowledgePackHealthPanel } from "./KnowledgePackHealthPanel";

vi.mock("../api/workspaceDashboardHealthApi", () => ({
  useWorkspaceDashboardHealth: vi.fn(),
}));

const mockedUseWorkspaceDashboardHealth = vi.mocked(useWorkspaceDashboardHealth);

describe("KnowledgePackHealthPanel", () => {
  it("loading 상태를 표시한다", () => {
    mockedUseWorkspaceDashboardHealth.mockReturnValue({
      isLoading: true,
      isError: false,
      data: undefined,
    } as ReturnType<typeof useWorkspaceDashboardHealth>);

    renderPanel();

    expect(screen.getByTestId("knowledge-health-loading")).toBeInTheDocument();
  });

  it("운영 지식팩 건강도와 상황별 CTA를 표시한다", () => {
    mockedUseWorkspaceDashboardHealth.mockReturnValue({
      isLoading: false,
      isError: false,
      data: {
        activeKnowledgePack: {
          packId: 11,
          packName: "CS Pack",
          versionId: 12,
          versionNo: 4,
          publishedAt: "2026-06-01T10:00:00Z",
          createdAt: "2026-06-01T09:00:00Z",
        },
        lastLogUpload: {
          datasetId: 8,
          datasetKey: "june-log",
          datasetName: "6월 상담 로그",
          datasetStatus: "READY",
          uploadedAt: "2026-06-03T09:00:00Z",
        },
        lastKnowledgePackGeneration: {
          pipelineJobId: 77,
          datasetId: 8,
          domainPackId: 11,
          status: "WAITING_HUMAN_FEEDBACK",
          requestedAt: "2026-06-03T09:10:00Z",
        },
        pendingReviewCount: 2,
      },
    } as ReturnType<typeof useWorkspaceDashboardHealth>);

    renderPanel();

    expect(screen.getByRole("heading", { name: "운영 지식팩 건강도" })).toBeInTheDocument();
    expect(screen.getByText("v4")).toBeInTheDocument();
    expect(screen.getByText("검토 대기 항목 2개가 남아 있습니다.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /검토 화면으로 이동/ })).toHaveAttribute(
      "href",
      "/workspaces/1/pipeline-jobs/77/review",
    );
  });

  it("error 상태에서는 stale 운영 상태 대신 재시도 가능한 오류 상태만 표시한다", () => {
    const refetch = vi.fn();
    mockedUseWorkspaceDashboardHealth.mockReturnValue({
      isLoading: false,
      isError: true,
      data: {
        activeKnowledgePack: {
          packId: 11,
          packName: "CS Pack",
          versionId: 12,
          versionNo: 4,
          publishedAt: "2026-06-01T10:00:00Z",
          createdAt: "2026-06-01T09:00:00Z",
        },
        lastLogUpload: null,
        lastKnowledgePackGeneration: null,
        pendingReviewCount: 0,
      },
      refetch,
    } as ReturnType<typeof useWorkspaceDashboardHealth>);

    renderPanel();

    expect(screen.getByTestId("knowledge-health-error")).toBeInTheDocument();
    expect(screen.getByText("운영 지식팩 상태를 불러오지 못했습니다.")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "운영 지식팩 건강도" })).not.toBeInTheDocument();
    expect(screen.queryByText("v4")).not.toBeInTheDocument();
    expect(screen.queryByText("CS Pack")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "다시 시도" }));

    expect(refetch).toHaveBeenCalledTimes(1);
  });
});

function renderPanel() {
  render(
    <MemoryRouter>
      <KnowledgePackHealthPanel workspaceId={1} />
    </MemoryRouter>,
  );
}
