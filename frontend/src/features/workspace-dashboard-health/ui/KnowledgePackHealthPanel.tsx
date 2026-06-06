import { Link } from "react-router-dom";
import {
  AlertTriangleIcon,
  CheckCircle2Icon,
  FileUpIcon,
  ListChecksIcon,
  PackagePlusIcon,
} from "lucide-react";

import { useWorkspaceDashboardHealth } from "../api/workspaceDashboardHealthApi";
import {
  buildWorkspaceDashboardHealthView,
  type HealthCtaKind,
  type HealthTone,
} from "../model/buildWorkspaceDashboardHealthView";
import { Button } from "@/shared/ui/button";
import { ErrorState } from "@/shared/ui/ostone/atoms/ErrorState";
import { LoadingSpinner } from "@/shared/ui/ostone/atoms/LoadingSpinner";

import styles from "./knowledge-pack-health-panel.module.css";

interface KnowledgePackHealthPanelProps {
  workspaceId: number;
}

const CTA_ICON_BY_KIND: Record<HealthCtaKind, typeof FileUpIcon> = {
  upload: FileUpIcon,
  review: ListChecksIcon,
  generate: PackagePlusIcon,
};

export function KnowledgePackHealthPanel({ workspaceId }: KnowledgePackHealthPanelProps) {
  const healthQuery = useWorkspaceDashboardHealth(workspaceId);

  if (healthQuery.isLoading) {
    return (
      <section className={styles.panel} data-testid="knowledge-health-loading" aria-live="polite">
        <LoadingSpinner />
        <p className={styles.loadingText}>운영 지식팩 상태를 불러오는 중입니다.</p>
      </section>
    );
  }

  if (healthQuery.isError || !healthQuery.data) {
    return (
      <section className={styles.panel} data-testid="knowledge-health-error">
        <ErrorState
          message="운영 지식팩 상태를 불러오지 못했습니다."
          onRetry={() => healthQuery.refetch()}
        />
      </section>
    );
  }

  const view = buildWorkspaceDashboardHealthView(workspaceId, healthQuery.data);

  return (
    <section className={styles.panel} aria-labelledby="knowledge-health-title">
      <div className={styles.header}>
        <div>
          <span className={styles.eyebrow}>Knowledge Health</span>
          <h2 id="knowledge-health-title" className={styles.title}>
            운영 지식팩 건강도
          </h2>
          <p className={styles.description}>{view.statusDescription}</p>
        </div>
        <StatusBadge
          tone={
            view.alerts.some((alert) => alert.tone === "danger")
              ? "danger"
              : view.alerts.length > 0
                ? "warning"
                : "normal"
          }
        >
          {view.statusTitle}
        </StatusBadge>
      </div>

      <div className={styles.metricGrid} aria-label="운영 지식팩 상태 요약">
        {view.metrics.map((metric) => (
          <article key={metric.label} className={styles.metric} data-tone={metric.tone}>
            <span className={styles.metricLabel}>{metric.label}</span>
            <strong>{metric.value}</strong>
            <p>{metric.description}</p>
          </article>
        ))}
      </div>

      {view.alerts.length > 0 ? (
        <div className={styles.alertList} aria-label="운영 지식팩 경고">
          {view.alerts.map((alert) => (
            <div key={alert.title} className={styles.alert} data-tone={alert.tone}>
              <AlertTriangleIcon aria-hidden="true" />
              <div>
                <strong>{alert.title}</strong>
                <p>{alert.description}</p>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className={styles.clearState}>
          <CheckCircle2Icon aria-hidden="true" />
          <span>생성 실패나 검토 대기 경고가 없습니다.</span>
        </div>
      )}

      {view.ctas.length > 0 ? (
        <div className={styles.ctaRow} aria-label="운영 지식팩 다음 행동">
          {view.ctas.map((cta, index) => {
            const Icon = CTA_ICON_BY_KIND[cta.kind];
            return (
              <Button key={cta.kind} asChild variant={index === 0 ? "default" : "outline"}>
                <Link to={cta.to}>
                  <Icon aria-hidden="true" />
                  {cta.label}
                </Link>
              </Button>
            );
          })}
        </div>
      ) : null}
    </section>
  );
}

function StatusBadge({ tone, children }: { tone: HealthTone; children: string }) {
  return (
    <span className={styles.statusBadge} data-tone={tone}>
      {children}
    </span>
  );
}
