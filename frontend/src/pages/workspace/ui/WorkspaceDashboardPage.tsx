import { useEffect, useMemo, useState } from "react";
import { Link, Navigate, useOutletContext, useParams } from "react-router-dom";
import {
  ArrowRightIcon,
  FileUpIcon,
  FlaskConicalIcon,
  PackagePlusIcon,
  RefreshCwIcon,
} from "lucide-react";

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
    ["도메인팩", getOptionLabel(DOMAIN_PACK_VERSION_OPTIONS, filters.domainPackVersion)],
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
          <span>Domain Pack Version</span>
          <NativeSelect
            value={filters.domainPackVersion}
            onChange={(event) => updateFilter("domainPackVersion", event.target.value)}
            aria-label="Domain Pack Version 필터"
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
          <span className={styles.panelEyebrow}>PARTIAL DATA</span>
          <h2>일부 데이터만 연결된 상태입니다.</h2>
          <p>연결된 카드부터 표시하고, 비어 있는 영역은 동일한 그리드 안에서 유지합니다.</p>
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
        <p>상담 로그를 업로드하고 도메인팩을 준비한 뒤, 시뮬레이션으로 워크플로우 흐름을 확인하세요.</p>
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
            도메인팩 생성
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
  const dataState = useMemo<DashboardDataState>(() => "empty", []);

  useEffect(() => {
    setCrumbs(["대시보드"]);
    return () => setCrumbs([]);
  }, [setCrumbs]);

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
