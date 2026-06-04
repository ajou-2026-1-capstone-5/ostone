import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";

import { consultationApi } from "@/features/consultation/api/consultationApi";

import { DashboardStatePanel, WorkspaceDashboardPage } from "./WorkspaceDashboardPage";

const setCrumbs = vi.fn();
const mockedGetMetrics = vi.mocked(consultationApi.getMetrics);

const metricsResponse = {
  workspaceId: 1,
  periodStart: "2026-05-28T00:00:00+09:00",
  periodEnd: "2026-06-04T00:00:00+09:00",
  totalConsultationCount: 120,
  completedConsultationCount: 96,
  averageFirstResponseSeconds: 75,
  averageLlmFirstResponseSeconds: 12,
  averageHumanFirstResponseSeconds: 240,
  llmHandledCount: 70,
  humanInterventionCount: 26,
  unresolvedSessionCount: 8,
  comparison: {
    totalConsultationCountChangeRate: 20,
    completedConsultationCountChangeRate: 12.5,
    averageFirstResponseSecondsChangeRate: -10,
    averageLlmFirstResponseSecondsChangeRate: null,
    averageHumanFirstResponseSecondsChangeRate: 8,
    llmHandledCountChangeRate: 16.7,
    humanInterventionCountChangeRate: -3.5,
    unresolvedSessionCountChangeRate: null,
  },
  coverage: {
    workflowMatchedCount: 72,
    workflowMatchRate: 60,
    intentClassificationSuccessCount: 68,
    intentClassificationSuccessRate: 56.7,
    lowConfidenceCount: 9,
    lowConfidenceRate: 7.5,
    unmatchedSessionCount: 6,
    autoCompletedWorkflowCount: 54,
    humanHandoffRate: 21.7,
    llmOnlyProcessingRate: 72.9,
    measurementStatus: "READY" as const,
    measurementMessage: "커버리지 산출에 필요한 운영 로그가 확인되었습니다.",
    trend: [
      {
        date: "2026-05-28",
        totalConsultationCount: 40,
        workflowMatchedCount: 20,
        workflowMatchRate: 50,
      },
      {
        date: "2026-05-29",
        totalConsultationCount: 80,
        workflowMatchedCount: 52,
        workflowMatchRate: 65,
      },
    ],
  },
  handledTodayCount: 96,
  llmHandledTodayCount: 70,
  humanHandledTodayCount: 26,
};

function renderPage(path = "/workspaces/1/dashboard") {
  setCrumbs.mockClear();
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/workspaces/:workspaceId/dashboard" element={<WorkspaceDashboardPage />} />
        <Route path="/workspaces" element={<div data-testid="workspace-root" />} />
      </Routes>
    </MemoryRouter>,
  );
}

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return {
    ...actual,
    useOutletContext: () => ({ setCrumbs, workspace: { id: 1, name: "CS Team" } }),
  };
});

vi.mock("@/features/consultation/api/consultationApi", () => ({
  consultationApi: {
    getMetrics: vi.fn(),
  },
}));

vi.mock("sonner", () => ({
  toast: {
    error: vi.fn(),
  },
}));

vi.mock("@/features/workspace-dashboard-health", () => ({
  KnowledgePackHealthPanel: ({ workspaceId }: { workspaceId: number }) => (
    <section data-testid="knowledge-health-panel">workspace {workspaceId} health</section>
  ),
}));

describe("WorkspaceDashboardPage", () => {
  beforeEach(() => {
    mockedGetMetrics.mockReset();
    mockedGetMetrics.mockResolvedValue(metricsResponse);
  });

  it("잘못된 workspaceId면 /workspaces로 리다이렉트한다", () => {
    renderPage("/workspaces/abc/dashboard");
    expect(screen.getByTestId("workspace-root")).toBeInTheDocument();
    expect(mockedGetMetrics).not.toHaveBeenCalled();
  });

  it("공통 필터와 상담 처리 KPI, 운영 지식팩 건강도 영역을 표시한다", async () => {
    renderPage();

    expect(screen.getByRole("heading", { name: "대시보드" })).toBeInTheDocument();
    expect(screen.getByLabelText("기간 필터")).toBeInTheDocument();
    expect(screen.getByLabelText("운영 지식팩 버전 필터")).toHaveValue("all");
    expect(screen.getByLabelText("채널 필터")).toHaveValue("all");
    expect(screen.getByLabelText("워크플로우 상태 필터")).toHaveValue("all");
    expect(screen.getByText("총 상담")).toBeInTheDocument();
    expect(await screen.findByText("120")).toBeInTheDocument();
    expect(screen.getByText("1분 15초")).toBeInTheDocument();
    expect(screen.getByText("전 기간 +20.0%")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "자동화 커버리지" })).toBeInTheDocument();
    expect(screen.getByText("계측 확인")).toBeInTheDocument();
    expect(screen.getByText("60.0%")).toBeInTheDocument();
    expect(screen.getByText("21.7%")).toBeInTheDocument();
    expect(screen.getByText("72.9%")).toBeInTheDocument();
    expect(screen.getByText("2026-05-29")).toBeInTheDocument();
    expect(screen.getByTestId("knowledge-health-panel")).toHaveTextContent("workspace 1 health");
    await waitFor(() => expect(mockedGetMetrics).toHaveBeenCalledWith(1, expect.any(Object)));
  });

  it("기간과 공통 필터 변경을 요약 상태와 API 요청에 반영한다", async () => {
    renderPage();

    fireEvent.click(screen.getByRole("button", { name: "사용자 지정" }));
    fireEvent.change(screen.getByLabelText("시작일"), { target: { value: "2026-06-01" } });
    fireEvent.change(screen.getByLabelText("종료일"), { target: { value: "2026-06-03" } });
    fireEvent.change(screen.getByLabelText("운영 지식팩 버전 필터"), {
      target: { value: "published" },
    });
    fireEvent.change(screen.getByLabelText("채널 필터"), { target: { value: "email" } });
    fireEvent.change(screen.getByLabelText("워크플로우 상태 필터"), {
      target: { value: "handoff" },
    });

    const summary = screen.getByLabelText("대시보드 필터 요약");
    expect(summary).toHaveTextContent("2026-06-01 ~ 2026-06-03");
    expect(summary).toHaveTextContent("운영 버전");
    expect(summary).toHaveTextContent("이메일");
    expect(summary).toHaveTextContent("상담원 연결");
    await waitFor(() =>
      expect(mockedGetMetrics).toHaveBeenLastCalledWith(1, {
        from: "2026-06-01",
        to: "2026-06-03",
      }),
    );
  });

  it("평균 계산이 불가능한 지표와 전 기간 비교는 --로 표시한다", async () => {
    mockedGetMetrics.mockResolvedValueOnce({
      ...metricsResponse,
      totalConsultationCount: 0,
      completedConsultationCount: 0,
      averageFirstResponseSeconds: null,
      averageLlmFirstResponseSeconds: null,
      averageHumanFirstResponseSeconds: null,
      llmHandledCount: 0,
      humanInterventionCount: 0,
      unresolvedSessionCount: 0,
      comparison: {
        totalConsultationCountChangeRate: null,
        completedConsultationCountChangeRate: null,
        averageFirstResponseSecondsChangeRate: null,
        averageLlmFirstResponseSecondsChangeRate: null,
        averageHumanFirstResponseSecondsChangeRate: null,
        llmHandledCountChangeRate: null,
        humanInterventionCountChangeRate: null,
        unresolvedSessionCountChangeRate: null,
      },
      coverage: {
        workflowMatchedCount: 0,
        workflowMatchRate: 0,
        intentClassificationSuccessCount: 0,
        intentClassificationSuccessRate: 0,
        lowConfidenceCount: 0,
        lowConfidenceRate: 0,
        unmatchedSessionCount: 0,
        autoCompletedWorkflowCount: 0,
        humanHandoffRate: 0,
        llmOnlyProcessingRate: null,
        measurementStatus: "NEEDS_INSTRUMENTATION" as const,
        measurementMessage:
          "커버리지 산출에 필요한 decision log 또는 workflow match log 계측이 필요합니다.",
        trend: [],
      },
    });

    renderPage();

    expect(await screen.findByTestId("dashboard-empty")).toBeInTheDocument();
    expect(screen.getByText("계측 필요")).toBeInTheDocument();
    expect(screen.getAllByText("--").length).toBeGreaterThanOrEqual(3);
    expect(screen.getAllByText("전 기간 --").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByTestId("dashboard-upload-cta")).toHaveAttribute(
      "href",
      "/workspaces/1/upload",
    );
    expect(screen.getByTestId("dashboard-pack-cta")).toHaveAttribute(
      "href",
      "/workspaces/1/domain-packs",
    );
    expect(screen.getByTestId("dashboard-simulation-cta")).toHaveAttribute("href", "/demo/chat/1");
  });

  it("loading, error, partial 상태 패널이 같은 shell 영역에서 렌더링된다", () => {
    const { rerender } = render(
      <MemoryRouter>
        <DashboardStatePanel state="loading" workspaceId={1} />
      </MemoryRouter>,
    );
    expect(screen.getByTestId("dashboard-loading")).toBeInTheDocument();

    rerender(
      <MemoryRouter>
        <DashboardStatePanel state="error" workspaceId={1} />
      </MemoryRouter>,
    );
    expect(screen.getByTestId("dashboard-error")).toBeInTheDocument();

    rerender(
      <MemoryRouter>
        <DashboardStatePanel state="partial" workspaceId={1} />
      </MemoryRouter>,
    );
    expect(screen.getByTestId("dashboard-partial")).toBeInTheDocument();
  });
});
