import { Dot, Mono } from "@/shared/ui/ostone/atoms";
import type { MetricsViewState } from "../model/consultationPageState";

type ConsultationStatusRightProps = {
  metricsViewState: MetricsViewState;
  averageFirstResponseSeconds?: number | null;
  handledTodayCount?: number | null;
};

const formatAverageFirstResponse = (seconds?: number | null) => {
  if (seconds == null) return "--";
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return minutes > 0 ? `${minutes}분 ${remainingSeconds}초` : `${remainingSeconds}초`;
};

const formatHandledTodayCount = (count?: number | null) => {
  return count == null ? "--" : `${count}건`;
};

const formatMetricValue = (
  metricsViewState: MetricsViewState,
  value: number | null | undefined,
  formatter: (value?: number | null) => string,
) => {
  if (metricsViewState === "loading") return "로딩중";
  if (metricsViewState === "error") return "오류";
  if (metricsViewState === "empty") return "--";
  return formatter(value);
};

export const ConsultationStatusRight = ({
  metricsViewState,
  averageFirstResponseSeconds,
  handledTodayCount,
}: ConsultationStatusRightProps) => {
  const averageLabel = formatMetricValue(
    metricsViewState,
    averageFirstResponseSeconds,
    formatAverageFirstResponse,
  );
  const handledLabel = formatMetricValue(
    metricsViewState,
    handledTodayCount,
    formatHandledTodayCount,
  );

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <Dot tone="signal" />
        <span style={{ fontSize: 12 }}>응대 가능</span>
      </div>
      <div style={{ width: 1, height: 16, background: "var(--line)" }} />
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <Mono style={{ fontSize: 11, color: "var(--ink-3)" }}>평균 첫응답</Mono>
        <span style={{ fontSize: 14, fontWeight: 700 }}>{averageLabel}</span>
      </div>
      <div style={{ width: 1, height: 16, background: "var(--line)" }} />
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <Mono style={{ fontSize: 11, color: "var(--ink-3)" }}>오늘 처리</Mono>
        <span style={{ fontSize: 14, fontWeight: 700 }}>{handledLabel}</span>
      </div>
    </div>
  );
};
