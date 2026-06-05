import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { toast } from "sonner";

import { consultationApi } from "@/features/consultation/api/consultationApi";
import { fetchWorkspaceDashboardActionRecommendations } from "@/features/workspace-dashboard-health/api/workspaceDashboardHealthApi";

import {
  DashboardStatePanel,
  WorkspaceDashboardPage,
} from "./WorkspaceDashboardPage";

const setCrumbs = vi.fn();
const mockedGetMetrics = vi.mocked(consultationApi.getMetrics);
const mockedGetWorkflowRankings = vi.mocked(
  consultationApi.getWorkflowRankings,
);
const mockedFetchActionRecommendations = vi.mocked(
  fetchWorkspaceDashboardActionRecommendations,
);
const mockedToastError = vi.mocked(toast.error);

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

const workflowRankingResponse = {
  workspaceId: 1,
  periodStart: "2026-05-28T00:00:00+09:00",
  periodEnd: "2026-06-04T00:00:00+09:00",
  totalConsultationCount: 120,
  topRankings: [
    {
      rank: 1,
      workflowDefinitionId: 100,
      domainPackId: 11,
      domainPackVersionId: 22,
      workflowCode: "refund_flow",
      workflowName: "환불 처리",
      executionCount: 48,
      shareRate: 40,
      completedCount: 42,
      failedCount: 3,
      runningCount: 3,
      completionRate: 87.5,
      failureRate: 6.3,
      averageHandlingSeconds: 180,
      humanInterventionRate: 25,
      changeRate: 33.3,
      surging: true,
      detailPath: "/workspaces/1/domain-packs/11/workflows/100?versionId=22",
    },
  ],
  rankings: [
    {
      rank: 1,
      workflowDefinitionId: 100,
      domainPackId: 11,
      domainPackVersionId: 22,
      workflowCode: "refund_flow",
      workflowName: "환불 처리",
      executionCount: 48,
      shareRate: 40,
      completedCount: 42,
      failedCount: 3,
      runningCount: 3,
      completionRate: 87.5,
      failureRate: 6.3,
      averageHandlingSeconds: 180,
      humanInterventionRate: 25,
      changeRate: 33.3,
      surging: true,
      detailPath: "/workspaces/1/domain-packs/11/workflows/100?versionId=22",
    },
    {
      rank: 2,
      workflowDefinitionId: null,
      domainPackId: null,
      domainPackVersionId: null,
      workflowCode: null,
      workflowName: "미확인 워크플로우",
      executionCount: 12,
      shareRate: 10,
      completedCount: 8,
      failedCount: 1,
      runningCount: 3,
      completionRate: 66.7,
      failureRate: 8.3,
      averageHandlingSeconds: null,
      humanInterventionRate: 50,
      changeRate: null,
      surging: false,
      detailPath: null,
    },
  ],
};

const actionRecommendationResponse = {
  workspaceId: 1,
  periodStart: "2026-05-28T00:00:00+09:00",
  periodEnd: "2026-06-04T00:00:00+09:00",
  recommendations: [
    {
      ruleCode: "HOTPATH_SURGE",
      priority: 85,
      sourceLabel: "운영 지표 기반",
      title: "환불 처리 workflow 점검",
      description: "선택 기간 실행량이 전 기간보다 크게 증가했습니다.",
      evidenceLabel: "전 기간 대비",
      evidenceValue: "+33.3%",
      targetPath: "/workspaces/1/domain-packs/11/workflows/100?versionId=22",
    },
    {
      ruleCode: "SIMULATION_OPEN_FEEDBACK",
      priority: 95,
      sourceLabel: "시뮬레이션에서 발견됨",
      title: "개선 후보 생성",
      description:
        "미처리 시뮬레이션 피드백이 있어 지식팩 개선 후보로 정리할 수 있습니다.",
      evidenceLabel: "Open feedback",
      evidenceValue: "4건",
      targetPath: "/workspaces/1/simulation?feedbackStatus=OPEN",
    },
  ],
};

function renderPage(path = "/workspaces/1/dashboard") {
  setCrumbs.mockClear();
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route
          path="/workspaces/:workspaceId/dashboard"
          element={<WorkspaceDashboardPage />}
        />
        <Route
          path="/workspaces"
          element={<div data-testid="workspace-root" />}
        />
      </Routes>
    </MemoryRouter>,
  );
}

vi.mock("react-router-dom", async () => {
  const actual =
    await vi.importActual<typeof import("react-router-dom")>(
      "react-router-dom",
    );
  return {
    ...actual,
    useOutletContext: () => ({
      setCrumbs,
      workspace: { id: 1, name: "CS Team" },
    }),
  };
});

vi.mock("@/features/consultation/api/consultationApi", () => ({
  consultationApi: {
    getMetrics: vi.fn(),
    getWorkflowRankings: vi.fn(),
  },
}));

vi.mock(
  "@/features/workspace-dashboard-health/api/workspaceDashboardHealthApi",
  () => ({
    fetchWorkspaceDashboardActionRecommendations: vi.fn(),
  }),
);

vi.mock("sonner", () => ({
  toast: {
    error: vi.fn(),
  },
}));

vi.mock("@/features/workspace-dashboard-health", () => ({
  KnowledgePackHealthPanel: ({ workspaceId }: { workspaceId: number }) => (
    <section data-testid="knowledge-health-panel">
      workspace {workspaceId} health
    </section>
  ),
}));

describe("WorkspaceDashboardPage", () => {
  beforeEach(() => {
    mockedToastError.mockReset();
    mockedGetMetrics.mockReset();
    mockedGetWorkflowRankings.mockReset();
    mockedFetchActionRecommendations.mockReset();
    mockedGetMetrics.mockResolvedValue(metricsResponse);
    mockedGetWorkflowRankings.mockResolvedValue(workflowRankingResponse);
    mockedFetchActionRecommendations.mockResolvedValue(
      actionRecommendationResponse,
    );
  });

  it("잘못된 workspaceId면 /workspaces로 리다이렉트한다", () => {
    renderPage("/workspaces/abc/dashboard");
    expect(screen.getByTestId("workspace-root")).toBeInTheDocument();
    expect(mockedGetMetrics).not.toHaveBeenCalled();
    expect(mockedGetWorkflowRankings).not.toHaveBeenCalled();
    expect(mockedFetchActionRecommendations).not.toHaveBeenCalled();
  });

  it("공통 필터와 상담 처리 KPI, 추천 액션, 운영 지식팩 건강도, 핫패스 랭킹을 표시한다", async () => {
    renderPage();

    expect(
      screen.getByRole("heading", { name: "대시보드" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "상담 처리 흐름, 자동화 커버리지, 운영 지식팩 상태를 한 화면에서 확인합니다.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.queryByText(/필터와 배치 구조를 먼저 고정합니다/),
    ).not.toBeInTheDocument();
    expect(screen.getByLabelText("기간 필터")).toBeInTheDocument();
    expect(screen.getByLabelText("운영 지식팩 버전 필터")).toHaveValue("all");
    expect(screen.getByLabelText("채널 필터")).toHaveValue("all");
    expect(screen.getByLabelText("워크플로우 상태 필터")).toHaveValue("all");
    expect(screen.getByText("총 상담")).toBeInTheDocument();
    expect(await screen.findByText("120")).toBeInTheDocument();
    expect(screen.getByText("1분 15초")).toBeInTheDocument();
    expect(screen.getByText("전 기간 +20.0%")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "자동화 커버리지" }),
    ).toBeInTheDocument();
    expect(screen.getByText("계측 확인")).toBeInTheDocument();
    expect(screen.getByText("60.0%")).toBeInTheDocument();
    expect(screen.getByText("21.7%")).toBeInTheDocument();
    expect(screen.getByText("72.9%")).toBeInTheDocument();
    expect(screen.getByText("2026-05-29")).toBeInTheDocument();
    expect(
      await screen.findByRole("heading", { name: "추천 액션" }),
    ).toBeInTheDocument();
    expect(screen.getByText("환불 처리 workflow 점검")).toBeInTheDocument();
    expect(screen.getByText("+33.3%")).toBeInTheDocument();
    expect(screen.getByText("시뮬레이션에서 발견됨")).toBeInTheDocument();
    expect(screen.getByText("4건")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /환불 처리 workflow 점검/ }),
    ).toHaveAttribute(
      "href",
      "/workspaces/1/domain-packs/11/workflows/100?versionId=22",
    );
    expect(
      screen.getByRole("link", { name: /개선 후보 생성/ }),
    ).toHaveAttribute("href", "/workspaces/1/simulation?feedbackStatus=OPEN");
    expect(screen.getByTestId("knowledge-health-panel")).toHaveTextContent(
      "workspace 1 health",
    );
    expect(
      await screen.findByText("핫패스 워크플로우 랭킹"),
    ).toBeInTheDocument();
    expect(screen.getByTestId("hotpath-top-1")).toHaveTextContent("환불 처리");
    expect(screen.getByTestId("hotpath-row-1")).toHaveTextContent("급증");
    expect(
      screen.getAllByRole("link", { name: /환불 처리/ })[0],
    ).toHaveAttribute(
      "href",
      "/workspaces/1/domain-packs/11/workflows/100?versionId=22",
    );
    expect(screen.getByTestId("hotpath-row-2")).toHaveTextContent(
      "상세 준비 중",
    );
    expect(
      screen.queryByLabelText("대시보드 카드와 차트 배치 영역"),
    ).not.toBeInTheDocument();
    expect(screen.queryByText(/연결될 자리입니다/)).not.toBeInTheDocument();
    expect(screen.queryByTestId("dashboard-partial")).not.toBeInTheDocument();
    await waitFor(() =>
      expect(mockedGetMetrics).toHaveBeenCalledWith(1, expect.any(Object)),
    );
    await waitFor(() =>
      expect(mockedGetWorkflowRankings).toHaveBeenCalledWith(
        1,
        expect.any(Object),
      ),
    );
    await waitFor(() =>
      expect(mockedFetchActionRecommendations).toHaveBeenCalledWith(
        1,
        expect.any(Object),
      ),
    );
  });

  it("기간과 공통 필터 변경을 요약 상태와 API 요청에 반영한다", async () => {
    renderPage();

    fireEvent.click(screen.getByRole("button", { name: "사용자 지정" }));
    fireEvent.change(screen.getByLabelText("시작일"), {
      target: { value: "2026-06-01" },
    });
    fireEvent.change(screen.getByLabelText("종료일"), {
      target: { value: "2026-06-03" },
    });
    fireEvent.change(screen.getByLabelText("운영 지식팩 버전 필터"), {
      target: { value: "published" },
    });
    fireEvent.change(screen.getByLabelText("채널 필터"), {
      target: { value: "email" },
    });
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
    await waitFor(() =>
      expect(mockedGetWorkflowRankings).toHaveBeenLastCalledWith(1, {
        from: "2026-06-01",
        to: "2026-06-03",
      }),
    );
    await waitFor(() =>
      expect(mockedFetchActionRecommendations).toHaveBeenLastCalledWith(1, {
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
    mockedGetWorkflowRankings.mockResolvedValueOnce({
      ...workflowRankingResponse,
      topRankings: [],
      rankings: [],
    });
    mockedFetchActionRecommendations.mockResolvedValueOnce({
      ...actionRecommendationResponse,
      recommendations: [],
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
    expect(
      screen.getByRole("link", { name: /지식팩 검토/ }),
    ).toBeInTheDocument();
    expect(screen.getByTestId("dashboard-simulation-cta")).toHaveAttribute(
      "href",
      "/demo/chat/1",
    );
    expect(screen.getByTestId("recommendation-empty")).toHaveTextContent(
      "현재 큰 이상 없음",
    );
  });

  it("상담 KPI가 실패해도 워크플로우 랭킹은 같은 화면에 남긴다", async () => {
    mockedGetMetrics.mockRejectedValueOnce(new Error("metrics failed"));

    renderPage();

    expect(
      await screen.findByText("핫패스 워크플로우 랭킹"),
    ).toBeInTheDocument();
    expect(screen.getByTestId("hotpath-row-1")).toHaveTextContent("환불 처리");
    expect(screen.getByTestId("dashboard-partial")).toHaveTextContent(
      "일부 운영 데이터만 확인됩니다.",
    );
    expect(screen.queryByTestId("dashboard-error")).not.toBeInTheDocument();
  });

  it("passive load 실패는 화면 상태로 표시하고 toast를 띄우지 않는다", async () => {
    mockedGetMetrics.mockRejectedValueOnce(new Error("metrics failed"));
    mockedGetWorkflowRankings.mockRejectedValueOnce(
      new Error("rankings failed"),
    );
    mockedFetchActionRecommendations.mockRejectedValueOnce(
      new Error("recommendations failed"),
    );

    renderPage();

    expect(
      await screen.findByText("대시보드 데이터를 불러오지 못했습니다."),
    ).toBeInTheDocument();
    expect(screen.getByTestId("recommendation-error")).toHaveTextContent(
      "추천 액션을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.",
    );
    expect(screen.getByTestId("hotpath-error")).toHaveTextContent(
      "워크플로우 랭킹을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.",
    );
    expect(mockedToastError).not.toHaveBeenCalled();
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
    expect(screen.getByTestId("dashboard-partial")).toHaveTextContent(
      "일부 운영 데이터만 확인됩니다.",
    );
    expect(screen.queryByText(/후속 데이터 연결/)).not.toBeInTheDocument();
  });
});
