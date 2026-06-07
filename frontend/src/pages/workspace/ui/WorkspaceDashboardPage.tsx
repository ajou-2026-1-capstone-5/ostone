import { useEffect, useMemo, useState } from "react";
import { Link, Navigate, useOutletContext, useParams } from "react-router-dom";
import {
  ArrowRightIcon,
  CheckCircle2Icon,
  FileUpIcon,
  FlaskConicalIcon,
  MonitorSmartphoneIcon,
  RefreshCwIcon,
} from "lucide-react";

import { consultationApi } from "@/features/consultation/api/consultationApi";
import type {
  ConsultationCoverageMetrics,
  ConsultationMetrics,
  WorkspaceWorkflowRanking,
  WorkspaceWorkflowRankingResponse,
} from "@/features/consultation/api/consultationApi";
import { KnowledgePackHealthPanel } from "@/features/workspace-dashboard-health";
import {
  fetchWorkspaceDashboardActionRecommendations,
  type WorkspaceDashboardActionRecommendation,
  type WorkspaceDashboardActionRecommendations,
} from "@/features/workspace-dashboard-health/api/workspaceDashboardHealthApi";
import type { ShellContext } from "@/shared/ui/ostone/chrome";
import { buildDemoChatPath, buildWorkspaceSimulationPath } from "@/shared/lib/demoRoutes";
import { parseRouteId } from "@/shared/lib/parseRouteId";
import { Button } from "@/shared/ui/button";
import { LoadingSpinner } from "@/shared/ui/ostone/atoms/LoadingSpinner";
import { ErrorState } from "@/shared/ui/ostone/atoms/ErrorState";

import styles from "./workspace-dashboard-page.module.css";

type DashboardPeriod = "today" | "7d" | "30d" | "custom";
type DashboardDataState = "loading" | "error" | "empty" | "partial";
type MetricValue = number | null | undefined;

interface DashboardFilters {
  period: DashboardPeriod;
  customFrom: string;
  customTo: string;
}

interface FilterOption<T extends string = string> {
  value: T;
  label: string;
}

interface DashboardStatePanelProps {
  state: DashboardDataState;
  workspaceId: number;
}

interface DashboardMetricCardProps {
  label: string;
  value: string;
  delta?: number | null;
  description: string;
  state: DashboardDataState;
}

const PERIOD_OPTIONS: Array<FilterOption<DashboardPeriod>> = [
  { value: "today", label: "오늘" },
  { value: "7d", label: "7일" },
  { value: "30d", label: "30일" },
  { value: "custom", label: "사용자 지정" },
];

const INITIAL_FILTERS: DashboardFilters = {
  period: "7d",
  customFrom: "",
  customTo: "",
};

function toDateInputValue(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function buildMetricDateRange(filters: DashboardFilters): {
  from?: string;
  to?: string;
} {
  if (filters.period === "custom") {
    return filters.customFrom && filters.customTo
      ? { from: filters.customFrom, to: filters.customTo }
      : {};
  }

  const today = new Date();
  const from = new Date(today);
  if (filters.period === "7d") {
    from.setDate(today.getDate() - 6);
  }
  if (filters.period === "30d") {
    from.setDate(today.getDate() - 29);
  }
  return { from: toDateInputValue(from), to: toDateInputValue(today) };
}

function getOptionLabel(options: FilterOption[], value: string): string {
  return options.find((option) => option.value === value)?.label ?? value;
}

function buildPeriodSummary(filters: DashboardFilters): string {
  if (filters.period !== "custom") {
    return getOptionLabel(PERIOD_OPTIONS, filters.period);
  }

  if (filters.customFrom && filters.customTo) {
    return `${filters.customFrom} ~ ${filters.customTo}`;
  }

  return "사용자 지정 기간";
}

function FilterSummary({ filters }: { filters: DashboardFilters }) {
  const summaryItems = [["기간", buildPeriodSummary(filters)]];

  return (
    <dl className={styles.filterSummary} aria-label="대시보드 필터 요약">
      {summaryItems.map(([label, value]) => (
        <div key={label} className={styles.summaryItem}>
          <dt>{label}</dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  );
}

function formatCount(value: MetricValue, state: DashboardDataState): string {
  if (state === "loading") return "로딩중";
  if (state === "error") return "--";
  if (typeof value !== "number" || !Number.isFinite(value)) return "--";
  return new Intl.NumberFormat("ko-KR").format(value);
}

function formatDuration(seconds: MetricValue, state: DashboardDataState): string {
  if (state === "loading") return "로딩중";
  if (state === "error") return "--";
  if (typeof seconds !== "number" || !Number.isFinite(seconds)) return "--";
  if (seconds < 60) return `${seconds}초`;
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return remainder === 0 ? `${minutes}분` : `${minutes}분 ${remainder}초`;
}

function formatDelta(delta: number | null | undefined, state: DashboardDataState): string {
  if (state === "loading") return "전 기간 계산 중";
  if (state === "error" || typeof delta !== "number" || !Number.isFinite(delta)) {
    return "전 기간 --";
  }
  const sign = delta > 0 ? "+" : "";
  return `전 기간 ${sign}${delta.toFixed(1)}%`;
}

function formatPercent(value: MetricValue, state: DashboardDataState): string {
  if (state === "loading") return "로딩중";
  if (state === "error") return "--";
  if (typeof value !== "number" || !Number.isFinite(value)) return "--";
  return `${value.toFixed(1)}%`;
}

function hasMetricData(metrics: ConsultationMetrics | null): boolean {
  if (!metrics) return false;
  return (
    metrics.totalConsultationCount > 0 ||
    metrics.completedConsultationCount > 0 ||
    metrics.llmHandledCount > 0 ||
    metrics.humanInterventionCount > 0 ||
    metrics.unresolvedSessionCount > 0
  );
}

function hasWorkflowRankingData(rankings: WorkspaceWorkflowRankingResponse | null): boolean {
  return (rankings?.rankings?.length ?? 0) > 0;
}

function hasActionRecommendationData(
  recommendations: WorkspaceDashboardActionRecommendations | null,
): boolean {
  return (recommendations?.recommendations?.length ?? 0) > 0;
}

function DashboardMetricCard({
  label,
  value,
  delta,
  description,
  state,
}: DashboardMetricCardProps) {
  return (
    <article className={styles.metricCard}>
      <div className={styles.metricHeader}>
        <span className={styles.slotLabel}>{label}</span>
        <span className={styles.metricDelta}>{formatDelta(delta, state)}</span>
      </div>
      <strong className={styles.metricValue}>{value}</strong>
      <p>{description}</p>
    </article>
  );
}

function DashboardMetricsGrid({
  metrics,
  state,
}: {
  metrics: ConsultationMetrics | null;
  state: DashboardDataState;
}) {
  const comparison = metrics?.comparison;

  return (
    <section className={styles.metricGrid} aria-label="상담 처리 요약 지표">
      <DashboardMetricCard
        label="총 상담"
        value={formatCount(metrics?.totalConsultationCount, state)}
        delta={comparison?.totalConsultationCountChangeRate}
        description="선택 기간에 시작된 운영 상담 수"
        state={state}
      />
      <DashboardMetricCard
        label="처리 완료"
        value={formatCount(metrics?.completedConsultationCount, state)}
        delta={comparison?.completedConsultationCountChangeRate}
        description="선택 기간에 완료 또는 해결 처리된 상담 수"
        state={state}
      />
      <DashboardMetricCard
        label="평균 첫 응답"
        value={formatDuration(metrics?.averageFirstResponseSeconds, state)}
        delta={comparison?.averageFirstResponseSecondsChangeRate}
        description="고객 첫 메시지 이후 첫 응답까지 걸린 평균 시간"
        state={state}
      />
      <DashboardMetricCard
        label="LLM 첫 응답"
        value={formatDuration(metrics?.averageLlmFirstResponseSeconds, state)}
        delta={comparison?.averageLlmFirstResponseSecondsChangeRate}
        description="LLM 응답만 별도로 계산한 첫 응답 평균"
        state={state}
      />
      <DashboardMetricCard
        label="상담사 첫 응답"
        value={formatDuration(metrics?.averageHumanFirstResponseSeconds, state)}
        delta={comparison?.averageHumanFirstResponseSecondsChangeRate}
        description="상담사 또는 상담원 응답 기준 첫 응답 평균"
        state={state}
      />
      <DashboardMetricCard
        label="LLM 처리"
        value={formatCount(metrics?.llmHandledCount, state)}
        delta={comparison?.llmHandledCountChangeRate}
        description="상담사 메시지 없이 LLM이 처리한 완료 상담 수"
        state={state}
      />
      <DashboardMetricCard
        label="상담사 개입"
        value={formatCount(metrics?.humanInterventionCount, state)}
        delta={comparison?.humanInterventionCountChangeRate}
        description="상담사 또는 상담원 메시지가 포함된 완료 상담 수"
        state={state}
      />
      <DashboardMetricCard
        label="미종료 세션"
        value={formatCount(metrics?.unresolvedSessionCount, state)}
        delta={comparison?.unresolvedSessionCountChangeRate}
        description="선택 기간에 시작됐고 아직 완료되지 않은 상담 수"
        state={state}
      />
    </section>
  );
}

function CoverageMetricCard({
  label,
  value,
  description,
}: {
  label: string;
  value: string;
  description: string;
}) {
  return (
    <article className={styles.coverageCard}>
      <span className={styles.slotLabel}>{label}</span>
      <strong>{value}</strong>
      <p>{description}</p>
    </article>
  );
}

function TopWorkflowCard({
  item,
  state,
}: {
  item: WorkspaceWorkflowRanking;
  state: DashboardDataState;
}) {
  const body = (
    <>
      <div className={styles.hotpathCardHeader}>
        <span className={styles.rankBadge}>#{item.rank}</span>
        {item.surging ? <span className={styles.surgeBadge}>급증</span> : null}
      </div>
      <h3>{item.workflowName}</h3>
      <dl>
        <div>
          <dt>실행</dt>
          <dd>{formatCount(item.executionCount, state)}</dd>
        </div>
        <div>
          <dt>완료율</dt>
          <dd>{formatPercent(item.completionRate, state)}</dd>
        </div>
        <div>
          <dt>개입률</dt>
          <dd>{formatPercent(item.humanInterventionRate, state)}</dd>
        </div>
      </dl>
    </>
  );

  if (item.detailPath) {
    return (
      <Link
        to={item.detailPath}
        className={styles.hotpathCard}
        data-testid={`hotpath-top-${item.rank}`}
      >
        {body}
      </Link>
    );
  }

  return (
    <article className={styles.hotpathCard} data-testid={`hotpath-top-${item.rank}`}>
      {body}
      <span className={styles.unavailableText}>상세 준비 중</span>
    </article>
  );
}

function AutomationCoveragePanel({
  coverage,
  state,
}: {
  coverage: ConsultationCoverageMetrics | null | undefined;
  state: DashboardDataState;
}) {
  const needsInstrumentation = coverage?.measurementStatus === "NEEDS_INSTRUMENTATION";
  const measurementStatus =
    state === "loading" ? "LOADING" : (coverage?.measurementStatus ?? "EMPTY");
  const measurementLabel =
    state === "loading"
      ? "계산 중"
      : needsInstrumentation
        ? "계측 필요"
        : coverage
          ? "계측 확인"
          : "--";
  const trend = coverage?.trend ?? [];
  const maxTrendTotal = Math.max(1, ...trend.map((point) => point.totalConsultationCount));

  return (
    <section className={styles.coveragePanel} aria-labelledby="automation-coverage-title">
      <div className={styles.coverageHeader}>
        <div>
          <span className={styles.panelEyebrow}>Automation Coverage</span>
          <h2 id="automation-coverage-title" className={styles.sectionTitle}>
            자동화 커버리지
          </h2>
          <p className={styles.sectionDescription}>
            운영 지식팩이 실제 상담을 workflow로 얼마나 커버했는지 확인합니다.
          </p>
        </div>
        <span className={styles.measurementBadge} data-status={measurementStatus}>
          {measurementLabel}
        </span>
      </div>

      {needsInstrumentation ? (
        <div className={styles.instrumentationNotice} role="status">
          {coverage?.measurementMessage}
        </div>
      ) : null}

      <div className={styles.coverageGrid} aria-label="자동화 커버리지 지표">
        <CoverageMetricCard
          label="Workflow Match"
          value={formatPercent(coverage?.workflowMatchRate, state)}
          description={`${formatCount(coverage?.workflowMatchedCount, state)}건이 workflow에 매칭됨`}
        />
        <CoverageMetricCard
          label="Intent Success"
          value={formatPercent(coverage?.intentClassificationSuccessRate, state)}
          description={`${formatCount(coverage?.intentClassificationSuccessCount, state)}건의 intent 분류 성공`}
        />
        <CoverageMetricCard
          label="Low Confidence"
          value={formatCount(coverage?.lowConfidenceCount, state)}
          description={`${formatPercent(coverage?.lowConfidenceRate, state)} 저신뢰 케이스`}
        />
        <CoverageMetricCard
          label="Unmatched"
          value={formatCount(coverage?.unmatchedSessionCount, state)}
          description="workflow나 intent를 찾지 못한 상담"
        />
        <CoverageMetricCard
          label="Auto Completed"
          value={formatCount(coverage?.autoCompletedWorkflowCount, state)}
          description="상담사 개입 없이 자동 완료"
        />
        <CoverageMetricCard
          label="Handoff Rate"
          value={formatPercent(coverage?.humanHandoffRate, state)}
          description="전체 운영 상담 중 상담사 개입"
        />
        <CoverageMetricCard
          label="LLM-only"
          value={formatPercent(coverage?.llmOnlyProcessingRate, state)}
          description="완료 상담 중 LLM-only 처리"
        />
      </div>

      <div className={styles.trendPanel} aria-label="기간별 커버리지 추이">
        {trend.length > 0 ? (
          trend.map((point) => {
            const width = `${Math.max(4, (point.totalConsultationCount / maxTrendTotal) * 100)}%`;
            return (
              <div key={point.date} className={styles.trendRow}>
                <span>{point.date}</span>
                <div className={styles.trendTrack} aria-hidden="true">
                  <span style={{ width }} />
                </div>
                <strong>{formatPercent(point.workflowMatchRate, state)}</strong>
              </div>
            );
          })
        ) : (
          <p className={styles.trendEmpty}>기간별 커버리지 추이가 없습니다.</p>
        )}
      </div>
    </section>
  );
}

function WorkflowRankingTable({
  rankings,
  state,
}: {
  rankings: WorkspaceWorkflowRanking[];
  state: DashboardDataState;
}) {
  return (
    <div className={styles.rankingTableWrap}>
      <table className={styles.rankingTable}>
        <thead>
          <tr>
            <th scope="col">Rank</th>
            <th scope="col">Workflow</th>
            <th scope="col">실행</th>
            <th scope="col">비중</th>
            <th scope="col">완료율</th>
            <th scope="col">실패율</th>
            <th scope="col">평균 처리</th>
            <th scope="col">상담사 개입</th>
            <th scope="col">증가율</th>
          </tr>
        </thead>
        <tbody>
          {rankings.map((item) => {
            const workflowName = (
              <span className={styles.workflowNameCell}>
                <strong>{item.workflowName}</strong>
                <span>{item.workflowCode ?? "코드 없음"}</span>
              </span>
            );
            return (
              <tr
                key={`${item.rank}-${item.workflowDefinitionId ?? item.workflowCode ?? "unknown"}`}
                className={item.surging ? styles.surgingRow : undefined}
                data-testid={`hotpath-row-${item.rank}`}
              >
                <td>#{item.rank}</td>
                <td>
                  {item.detailPath ? (
                    <Link to={item.detailPath} className={styles.workflowDetailLink}>
                      {workflowName}
                    </Link>
                  ) : (
                    <span className={styles.workflowDetailDisabled}>
                      {workflowName}
                      <em>상세 준비 중</em>
                    </span>
                  )}
                </td>
                <td>{formatCount(item.executionCount, state)}</td>
                <td>{formatPercent(item.shareRate, state)}</td>
                <td>{formatPercent(item.completionRate, state)}</td>
                <td>{formatPercent(item.failureRate, state)}</td>
                <td>{formatDuration(item.averageHandlingSeconds, state)}</td>
                <td>{formatPercent(item.humanInterventionRate, state)}</td>
                <td>
                  <span className={styles.changeCell}>
                    {formatDelta(item.changeRate, state)}
                    {item.surging ? <span className={styles.surgeBadge}>급증</span> : null}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function HotpathWorkflowRankingPanel({
  rankings,
  state,
  error,
}: {
  rankings: WorkspaceWorkflowRankingResponse | null;
  state: DashboardDataState;
  error: string | null;
}) {
  const topRankings = rankings?.topRankings ?? [];
  const allRankings = rankings?.rankings ?? [];

  return (
    <section className={styles.hotpathPanel} aria-labelledby="hotpath-ranking-title">
      <div className={styles.panelHeader}>
        <div>
          <span className={styles.panelEyebrow}>HOTPATH</span>
          <h2 id="hotpath-ranking-title" className={styles.sectionTitle}>
            핫패스 워크플로우 랭킹
          </h2>
          <p className={styles.sectionDescription}>
            선택 기간의 실행량과 전 기간 대비 증가율을 기준으로 우선 개선 대상을 확인합니다.
          </p>
        </div>
        <span className={styles.totalBadge}>
          전체 상담 {formatCount(rankings?.totalConsultationCount, state)}
        </span>
      </div>

      {error ? (
        <div className={styles.hotpathState} data-testid="hotpath-error">
          <ErrorState message={error} />
        </div>
      ) : null}

      {!error && state === "loading" ? (
        <div className={styles.hotpathState} data-testid="hotpath-loading">
          <LoadingSpinner />
          <p className={styles.stateText}>워크플로우 랭킹을 불러오는 중입니다.</p>
        </div>
      ) : null}

      {!error && state !== "loading" && allRankings.length === 0 ? (
        <div className={styles.hotpathState} data-testid="hotpath-empty">
          <p className={styles.stateText}>선택 기간에 집계할 워크플로우 실행이 없습니다.</p>
        </div>
      ) : null}

      {!error && allRankings.length > 0 ? (
        <>
          <div className={styles.hotpathTopGrid} aria-label="워크플로우 TOP 5">
            {topRankings.map((item) => (
              <TopWorkflowCard
                key={`${item.rank}-${item.workflowName}`}
                item={item}
                state={state}
              />
            ))}
          </div>
          <WorkflowRankingTable rankings={allRankings} state={state} />
        </>
      ) : null}
    </section>
  );
}

function ActionRecommendationCard({ item }: { item: WorkspaceDashboardActionRecommendation }) {
  const targetPath = buildSimulationPathFromWorkflowDetailPath(item.targetPath) ?? item.targetPath;

  return (
    <Link to={targetPath} className={styles.recommendationCard}>
      <span className={styles.recommendationMeta}>
        <span className={styles.sourceBadge}>{item.sourceLabel}</span>
        <span className={styles.ruleBadge}>{item.ruleCode.replaceAll("_", " ")}</span>
      </span>
      <h3>{item.title}</h3>
      <p>{item.description}</p>
      <dl>
        <div>
          <dt>{item.evidenceLabel}</dt>
          <dd>{item.evidenceValue}</dd>
        </div>
      </dl>
      <span className={styles.recommendationLink}>
        바로 보기
        <ArrowRightIcon aria-hidden="true" />
      </span>
    </Link>
  );
}

function buildSimulationPathFromWorkflowDetailPath(path: string): string | null {
  const [pathname, rawSearch = ""] = path.split("?");
  const match = pathname.match(
    /^\/workspaces\/([^/]+)\/domain-packs\/([^/]+)\/workflows\/([^/]+)$/,
  );
  if (!match) return null;

  const workspaceId = decodeURIComponent(match[1]);
  const packId = parseRouteId(decodeURIComponent(match[2]));
  const workflowId = parseRouteId(decodeURIComponent(match[3]));
  const versionId = parseRouteId(new URLSearchParams(rawSearch).get("versionId") ?? undefined);
  if (packId === null || versionId === null || workflowId === null) {
    return null;
  }

  return buildWorkspaceSimulationPath(workspaceId, {
    packId,
    versionId,
    workflowId,
  });
}

function ActionRecommendationsPanel({
  recommendations,
  state,
  error,
}: {
  recommendations: WorkspaceDashboardActionRecommendations | null;
  state: DashboardDataState;
  error: string | null;
}) {
  const items = recommendations?.recommendations ?? [];

  return (
    <section className={styles.recommendationPanel} aria-labelledby="action-recommendation-title">
      <div className={styles.panelHeader}>
        <div>
          <span className={styles.panelEyebrow}>Next Actions</span>
          <h2 id="action-recommendation-title" className={styles.sectionTitle}>
            추천 액션
          </h2>
          <p className={styles.sectionDescription}>
            운영 지표의 이상 신호를 기준으로 지금 확인할 화면을 제안합니다.
          </p>
        </div>
      </div>

      {error ? (
        <div className={styles.recommendationState} data-testid="recommendation-error">
          <ErrorState message={error} />
        </div>
      ) : null}

      {!error && state === "loading" ? (
        <div className={styles.recommendationState} data-testid="recommendation-loading">
          <LoadingSpinner />
          <p className={styles.stateText}>추천 액션을 계산하는 중입니다.</p>
        </div>
      ) : null}

      {!error && state !== "loading" && items.length === 0 ? (
        <div className={styles.recommendationState} data-testid="recommendation-empty">
          <CheckCircle2Icon aria-hidden="true" className={styles.panelIcon} />
          <p className={styles.stateText}>현재 큰 이상 없음</p>
        </div>
      ) : null}

      {!error && items.length > 0 ? (
        <div className={styles.recommendationGrid} aria-label="고객 액션 추천">
          {items.map((item) => (
            <ActionRecommendationCard key={item.ruleCode} item={item} />
          ))}
        </div>
      ) : null}
    </section>
  );
}

function DashboardFilters({
  filters,
  onChange,
}: {
  filters: DashboardFilters;
  onChange: (filters: DashboardFilters) => void;
}) {
  const updateFilter = <K extends keyof DashboardFilters>(key: K, value: DashboardFilters[K]) => {
    onChange({ ...filters, [key]: value });
  };

  return (
    <section className={styles.filterBar} aria-labelledby="dashboard-filter-title">
      <div className={styles.filterHeader}>
        <div>
          <h2 id="dashboard-filter-title" className={styles.sectionTitle}>
            공통 필터
          </h2>
          <p className={styles.sectionDescription}>
            대시보드 섹션이 같은 기간을 기준으로 집계되도록 설정합니다.
          </p>
        </div>
      </div>

      <div className={styles.periodControl} aria-label="기간 필터">
        {PERIOD_OPTIONS.map((option) => {
          const selected = filters.period === option.value;
          return (
            <button
              key={option.value}
              type="button"
              className={`${styles.segmentButton} ${selected ? styles.segmentButtonActive : ""}`}
              aria-pressed={selected}
              onClick={() => updateFilter("period", option.value)}
            >
              {option.label}
            </button>
          );
        })}
      </div>

      {filters.period === "custom" ? (
        <div className={styles.customDateGrid}>
          <label className={styles.field}>
            <span>시작일</span>
            <input
              type="date"
              value={filters.customFrom}
              onChange={(event) => updateFilter("customFrom", event.target.value)}
            />
          </label>
          <label className={styles.field}>
            <span>종료일</span>
            <input
              type="date"
              value={filters.customTo}
              onChange={(event) => updateFilter("customTo", event.target.value)}
            />
          </label>
        </div>
      ) : null}
    </section>
  );
}

export function DashboardStatePanel({ state, workspaceId }: DashboardStatePanelProps) {
  if (state === "loading") {
    return (
      <section className={styles.statePanel} data-testid="dashboard-loading" aria-live="polite">
        <LoadingSpinner />
        <p className={styles.stateText}>대시보드 데이터를 불러오는 중입니다.</p>
      </section>
    );
  }

  if (state === "error") {
    return (
      <section className={styles.statePanel} data-testid="dashboard-error">
        <ErrorState message="대시보드 데이터를 불러오지 못했습니다." />
      </section>
    );
  }

  if (state === "partial") {
    return (
      <section className={styles.partialPanel} data-testid="dashboard-partial">
        <div>
          <span className={styles.panelEyebrow}>PARTIAL DATA</span>
          <h2>일부 운영 데이터만 확인됩니다.</h2>
          <p>
            선택 기간에 수집된 상담 로그 기준으로 확인 가능한 지표를 먼저 표시합니다. 값이 없는
            항목은 해당 운영 기록이 쌓이면 계산됩니다.
          </p>
        </div>
        <RefreshCwIcon aria-hidden="true" className={styles.panelIcon} />
      </section>
    );
  }

  return (
    <section className={styles.emptyPanel} data-testid="dashboard-empty">
      <div className={styles.emptyCopy}>
        <span className={styles.panelEyebrow}>GET STARTED</span>
        <h2>아직 대시보드에 표시할 운영 데이터가 없습니다.</h2>
        <p>
          상담 로그를 업로드하고 운영 지식팩 검토를 마친 뒤, 시뮬레이션으로 워크플로우 흐름을
          확인하세요.
        </p>
      </div>
      <div className={styles.ctaGrid}>
        <Button asChild variant="default">
          <Link to={`/workspaces/${workspaceId}/upload`} data-testid="dashboard-upload-cta">
            <FileUpIcon aria-hidden="true" />
            상담 업로드
          </Link>
        </Button>
        <Button asChild variant="outline">
          <Link to={`/workspaces/${workspaceId}/domain-packs`} data-testid="dashboard-pack-cta">
            <CheckCircle2Icon aria-hidden="true" />
            지식팩 검토
          </Link>
        </Button>
        <Button asChild variant="outline">
          <Link
            to={buildWorkspaceSimulationPath(workspaceId)}
            data-testid="dashboard-simulation-cta"
          >
            <FlaskConicalIcon aria-hidden="true" />
            시뮬레이션 시작
          </Link>
        </Button>
        <Button asChild variant="outline">
          <Link to={buildDemoChatPath(workspaceId)} data-testid="dashboard-customer-preview-cta">
            <MonitorSmartphoneIcon aria-hidden="true" />
            고객 화면 미리보기
          </Link>
        </Button>
      </div>
    </section>
  );
}

export function WorkspaceDashboardPage() {
  const { workspaceId } = useParams();
  const { setCrumbs } = useOutletContext<ShellContext>();
  const parsedWorkspaceId = parseRouteId(workspaceId);
  const [filters, setFilters] = useState<DashboardFilters>(INITIAL_FILTERS);
  const [metrics, setMetrics] = useState<ConsultationMetrics | null>(null);
  const [isMetricsLoading, setIsMetricsLoading] = useState(false);
  const [metricsError, setMetricsError] = useState<string | null>(null);
  const [workflowRankings, setWorkflowRankings] = useState<WorkspaceWorkflowRankingResponse | null>(
    null,
  );
  const [isWorkflowRankingsLoading, setIsWorkflowRankingsLoading] = useState(false);
  const [workflowRankingsError, setWorkflowRankingsError] = useState<string | null>(null);
  const [actionRecommendations, setActionRecommendations] =
    useState<WorkspaceDashboardActionRecommendations | null>(null);
  const [isActionRecommendationsLoading, setIsActionRecommendationsLoading] = useState(false);
  const [actionRecommendationsError, setActionRecommendationsError] = useState<string | null>(null);
  const metricDateRange = useMemo(() => buildMetricDateRange(filters), [filters]);
  const metricsState = useMemo<DashboardDataState>(() => {
    if (isMetricsLoading) return "loading";
    if (metricsError) return "error";
    if (hasMetricData(metrics)) return "partial";
    return "empty";
  }, [isMetricsLoading, metricsError, metrics]);
  const workflowRankingState = useMemo<DashboardDataState>(() => {
    if (isWorkflowRankingsLoading) return "loading";
    if (workflowRankingsError) return "error";
    if (hasWorkflowRankingData(workflowRankings)) return "partial";
    return "empty";
  }, [isWorkflowRankingsLoading, workflowRankingsError, workflowRankings]);
  const actionRecommendationState = useMemo<DashboardDataState>(() => {
    if (isActionRecommendationsLoading) return "loading";
    if (actionRecommendationsError) return "error";
    if (hasActionRecommendationData(actionRecommendations)) return "partial";
    return "empty";
  }, [isActionRecommendationsLoading, actionRecommendationsError, actionRecommendations]);
  const dataState = useMemo<DashboardDataState | null>(() => {
    const hasAnyData =
      hasMetricData(metrics) ||
      hasWorkflowRankingData(workflowRankings) ||
      hasActionRecommendationData(actionRecommendations);
    if (
      (isMetricsLoading || isWorkflowRankingsLoading || isActionRecommendationsLoading) &&
      !hasAnyData
    ) {
      return "loading";
    }
    if (metricsError && workflowRankingsError && actionRecommendationsError) return "error";
    if (hasAnyData && (metricsError || workflowRankingsError || actionRecommendationsError)) {
      return "partial";
    }
    if (hasAnyData) return null;
    return "empty";
  }, [
    isMetricsLoading,
    isWorkflowRankingsLoading,
    isActionRecommendationsLoading,
    metrics,
    workflowRankings,
    actionRecommendations,
    metricsError,
    workflowRankingsError,
    actionRecommendationsError,
  ]);

  useEffect(() => {
    setCrumbs(["대시보드"]);
    return () => setCrumbs([]);
  }, [setCrumbs]);

  useEffect(() => {
    let ignore = false;

    async function loadMetrics() {
      if (parsedWorkspaceId === null) {
        setMetrics(null);
        setMetricsError(null);
        setIsMetricsLoading(false);
        return;
      }

      if (!metricDateRange.from || !metricDateRange.to) {
        setMetrics(null);
        setMetricsError(null);
        setIsMetricsLoading(false);
        return;
      }

      setIsMetricsLoading(true);
      setMetricsError(null);
      try {
        const data = await consultationApi.getMetrics(parsedWorkspaceId, metricDateRange);
        if (ignore) return;
        setMetrics(data);
      } catch (error) {
        if (ignore) return;
        console.error("Failed to load dashboard metrics:", error);
        setMetrics(null);
        setMetricsError("대시보드 지표를 불러오지 못했습니다.");
      } finally {
        if (!ignore) {
          setIsMetricsLoading(false);
        }
      }
    }

    void loadMetrics();

    return () => {
      ignore = true;
    };
  }, [parsedWorkspaceId, metricDateRange]);

  useEffect(() => {
    let ignore = false;

    async function loadActionRecommendations() {
      if (parsedWorkspaceId === null) {
        setActionRecommendations(null);
        setActionRecommendationsError(null);
        setIsActionRecommendationsLoading(false);
        return;
      }

      if (!metricDateRange.from || !metricDateRange.to) {
        setActionRecommendations(null);
        setActionRecommendationsError(null);
        setIsActionRecommendationsLoading(false);
        return;
      }

      setIsActionRecommendationsLoading(true);
      setActionRecommendationsError(null);
      try {
        const data = await fetchWorkspaceDashboardActionRecommendations(
          parsedWorkspaceId,
          metricDateRange,
        );
        if (ignore) return;
        setActionRecommendations(data);
      } catch (error) {
        if (ignore) return;
        console.error("Failed to load dashboard action recommendations:", error);
        setActionRecommendations(null);
        setActionRecommendationsError(
          "추천 액션을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.",
        );
      } finally {
        if (!ignore) {
          setIsActionRecommendationsLoading(false);
        }
      }
    }

    void loadActionRecommendations();

    return () => {
      ignore = true;
    };
  }, [parsedWorkspaceId, metricDateRange]);

  useEffect(() => {
    let ignore = false;

    async function loadWorkflowRankings() {
      if (parsedWorkspaceId === null) {
        setWorkflowRankings(null);
        setWorkflowRankingsError(null);
        setIsWorkflowRankingsLoading(false);
        return;
      }

      if (!metricDateRange.from || !metricDateRange.to) {
        setWorkflowRankings(null);
        setWorkflowRankingsError(null);
        setIsWorkflowRankingsLoading(false);
        return;
      }

      setIsWorkflowRankingsLoading(true);
      setWorkflowRankingsError(null);
      try {
        const data = await consultationApi.getWorkflowRankings(parsedWorkspaceId, metricDateRange);
        if (ignore) return;
        setWorkflowRankings(data);
      } catch (error) {
        if (ignore) return;
        console.error("Failed to load workflow rankings:", error);
        setWorkflowRankings(null);
        setWorkflowRankingsError(
          "워크플로우 랭킹을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.",
        );
      } finally {
        if (!ignore) {
          setIsWorkflowRankingsLoading(false);
        }
      }
    }

    void loadWorkflowRankings();

    return () => {
      ignore = true;
    };
  }, [parsedWorkspaceId, metricDateRange]);

  if (parsedWorkspaceId === null) {
    return <Navigate to="/workspaces" replace />;
  }

  return (
    <div className={styles.pageWrapper}>
      <header className={styles.pageHeader}>
        <div>
          <span className={styles.eyebrow}>Workspace Dashboard</span>
          <h1 className={styles.pageTitle}>대시보드</h1>
          <p className={styles.pageSubtitle}>
            상담 처리 흐름, 자동화 커버리지, 운영 지식팩 상태를 한 화면에서 확인합니다.
          </p>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link to={`/workspaces/${parsedWorkspaceId}/workflows`}>
            워크플로우 보기
            <ArrowRightIcon aria-hidden="true" />
          </Link>
        </Button>
      </header>

      <DashboardFilters filters={filters} onChange={setFilters} />
      <FilterSummary filters={filters} />
      <ActionRecommendationsPanel
        recommendations={actionRecommendations}
        state={actionRecommendationState}
        error={actionRecommendationsError}
      />
      <DashboardMetricsGrid metrics={metrics} state={metricsState} />
      <AutomationCoveragePanel coverage={metrics?.coverage} state={metricsState} />
      <KnowledgePackHealthPanel workspaceId={parsedWorkspaceId} />
      <HotpathWorkflowRankingPanel
        rankings={workflowRankings}
        state={workflowRankingState}
        error={workflowRankingsError}
      />
      {dataState ? <DashboardStatePanel state={dataState} workspaceId={parsedWorkspaceId} /> : null}
    </div>
  );
}
