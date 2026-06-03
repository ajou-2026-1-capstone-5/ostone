import { useEffect, useMemo, useState } from "react";
import { Link, Navigate, useOutletContext, useParams } from "react-router-dom";
import {
  ArrowRightIcon,
  FileUpIcon,
  FlaskConicalIcon,
  PackagePlusIcon,
  RefreshCwIcon,
} from "lucide-react";
import { toast } from "sonner";

import { consultationApi } from "@/features/consultation/api/consultationApi";
import type { ConsultationMetrics } from "@/features/consultation/api/consultationApi";
import { KnowledgePackHealthPanel } from "@/features/workspace-dashboard-health";
import type { ShellContext } from "@/shared/ui/ostone/chrome";
import { buildDemoChatPath } from "@/shared/lib/demoRoutes";
import { parseRouteId } from "@/shared/lib/parseRouteId";
import { Button } from "@/shared/ui/button";
import { NativeSelect, NativeSelectOption } from "@/shared/ui/native-select";
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
  domainPackVersion: string;
  channel: string;
  workflowStatus: string;
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

const DOMAIN_PACK_VERSION_OPTIONS: FilterOption[] = [
  { value: "all", label: "전체 버전" },
  { value: "published", label: "운영 버전" },
  { value: "draft", label: "검토 중 버전" },
];

const CHANNEL_OPTIONS: FilterOption[] = [
  { value: "all", label: "전체 채널" },
  { value: "web-chat", label: "웹채팅" },
  { value: "email", label: "이메일" },
  { value: "phone", label: "전화" },
];

const WORKFLOW_STATUS_OPTIONS: FilterOption[] = [
  { value: "all", label: "전체 상태" },
  { value: "running", label: "진행 중" },
  { value: "completed", label: "완료" },
  { value: "handoff", label: "상담원 연결" },
  { value: "failed", label: "실패" },
];

const INITIAL_FILTERS: DashboardFilters = {
  period: "7d",
  customFrom: "",
  customTo: "",
  domainPackVersion: "all",
  channel: "all",
  workflowStatus: "all",
};

function toDateInputValue(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function buildMetricDateRange(filters: DashboardFilters): { from?: string; to?: string } {
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
  const summaryItems = [
    ["기간", buildPeriodSummary(filters)],
    ["운영 지식팩", getOptionLabel(DOMAIN_PACK_VERSION_OPTIONS, filters.domainPackVersion)],
    ["채널", getOptionLabel(CHANNEL_OPTIONS, filters.channel)],
    ["워크플로우", getOptionLabel(WORKFLOW_STATUS_OPTIONS, filters.workflowStatus)],
  ];

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
            아래 카드와 차트가 같은 기준을 바라보도록 필터 상태를 먼저 고정합니다.
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

      <div className={styles.selectGrid}>
        <label className={styles.field}>
          <span>운영 지식팩 버전</span>
          <NativeSelect
            value={filters.domainPackVersion}
            onChange={(event) => updateFilter("domainPackVersion", event.target.value)}
            aria-label="운영 지식팩 버전 필터"
          >
            {DOMAIN_PACK_VERSION_OPTIONS.map((option) => (
              <NativeSelectOption key={option.value} value={option.value}>
                {option.label}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </label>
        <label className={styles.field}>
          <span>Channel</span>
          <NativeSelect
            value={filters.channel}
            onChange={(event) => updateFilter("channel", event.target.value)}
            aria-label="채널 필터"
          >
            {CHANNEL_OPTIONS.map((option) => (
              <NativeSelectOption key={option.value} value={option.value}>
                {option.label}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </label>
        <label className={styles.field}>
          <span>Workflow Status</span>
          <NativeSelect
            value={filters.workflowStatus}
            onChange={(event) => updateFilter("workflowStatus", event.target.value)}
            aria-label="워크플로우 상태 필터"
          >
            {WORKFLOW_STATUS_OPTIONS.map((option) => (
              <NativeSelectOption key={option.value} value={option.value}>
                {option.label}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </label>
      </div>
    </section>
  );
}

function DashboardSlot({
  label,
  title,
  description,
}: {
  label: string;
  title: string;
  description: string;
}) {
  return (
    <article className={styles.slotCard}>
      <span className={styles.slotLabel}>{label}</span>
      <h3>{title}</h3>
      <p>{description}</p>
      <div className={styles.slotPlaceholder} aria-hidden="true">
        <span />
        <span />
        <span />
      </div>
    </article>
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
          <span className={styles.panelEyebrow}>METRICS CONNECTED</span>
          <h2>상담 처리 요약 지표가 연결되었습니다.</h2>
          <p>차트와 운영 주의 항목은 같은 필터 기준을 유지하며 후속 데이터 연결을 기다립니다.</p>
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
          상담 로그를 업로드하고 운영 지식팩을 준비한 뒤, 시뮬레이션으로 워크플로우 흐름을
          확인하세요.
        </p>
      </div>
      <div className={styles.ctaGrid}>
        <Button asChild variant="default">
          <Link to={`/workspaces/${workspaceId}/upload`} data-testid="dashboard-upload-cta">
            <FileUpIcon aria-hidden="true" />
            상담 로그 업로드
          </Link>
        </Button>
        <Button asChild variant="outline">
          <Link to={`/workspaces/${workspaceId}/domain-packs`} data-testid="dashboard-pack-cta">
            <PackagePlusIcon aria-hidden="true" />
            지식팩 생성
          </Link>
        </Button>
        <Button asChild variant="outline">
          <Link to={buildDemoChatPath(workspaceId)} data-testid="dashboard-simulation-cta">
            <FlaskConicalIcon aria-hidden="true" />
            시뮬레이션 시작
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
  const metricDateRange = useMemo(() => buildMetricDateRange(filters), [filters]);
  const dataState = useMemo<DashboardDataState>(() => {
    if (isMetricsLoading) return "loading";
    if (metricsError) return "error";
    if (hasMetricData(metrics)) return "partial";
    return "empty";
  }, [isMetricsLoading, metricsError, metrics]);

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
        toast.error("대시보드 지표를 불러오지 못했습니다.");
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
            고객 상담 운영 지표가 연결될 공통 홈입니다. 필터와 배치 구조를 먼저 고정합니다.
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
      <DashboardMetricsGrid metrics={metrics} state={dataState} />
      <KnowledgePackHealthPanel workspaceId={parsedWorkspaceId} />
      <DashboardStatePanel state={dataState} workspaceId={parsedWorkspaceId} />

      <section className={styles.slotGrid} aria-label="대시보드 카드와 차트 배치 영역">
        <DashboardSlot
          label="Metric"
          title="상담 처리 KPI"
          description="처리량, 평균 응답 시간, 완료율 카드가 연결될 자리입니다."
        />
        <DashboardSlot
          label="Chart"
          title="워크플로우 흐름 추이"
          description="기간 필터 기준으로 세션과 상태 변화 차트가 연결될 자리입니다."
        />
        <DashboardSlot
          label="Table"
          title="운영 주의 항목"
          description="부분 데이터와 오류 상태에서도 같은 폭을 유지하는 목록 슬롯입니다."
        />
      </section>
    </div>
  );
}
