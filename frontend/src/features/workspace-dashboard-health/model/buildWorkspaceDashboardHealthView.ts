import type { WorkspaceDashboardHealth } from "../api/workspaceDashboardHealthApi";

export type HealthTone = "normal" | "warning" | "danger";
export type HealthCtaKind = "upload" | "review" | "generate";

export interface HealthMetricView {
  label: string;
  value: string;
  description: string;
  tone: HealthTone;
}

export interface HealthAlertView {
  title: string;
  description: string;
  tone: Exclude<HealthTone, "normal">;
}

export interface HealthCtaView {
  kind: HealthCtaKind;
  label: string;
  to: string;
}

export interface WorkspaceDashboardHealthView {
  statusTitle: string;
  statusDescription: string;
  metrics: HealthMetricView[];
  alerts: HealthAlertView[];
  ctas: HealthCtaView[];
}

const RUNNING_STATUSES = new Set([
  "QUEUED",
  "RUNNING",
  "WAITING_INTENT_CALLBACK",
  "WAITING_WORKFLOW_CALLBACK",
]);

const REVIEW_STATUSES = new Set(["WAITING_DOMAIN_CONFIRMATION", "WAITING_HUMAN_FEEDBACK"]);

export function buildWorkspaceDashboardHealthView(
  workspaceId: number,
  health: WorkspaceDashboardHealth,
): WorkspaceDashboardHealthView {
  const activePack = health.activeKnowledgePack ?? null;
  const lastUpload = health.lastLogUpload ?? null;
  const lastGeneration = health.lastKnowledgePackGeneration ?? null;
  const pendingReviewCount = health.pendingReviewCount ?? 0;
  const isGenerationFailed = lastGeneration?.status === "FAILED";
  const isGenerationRunning = lastGeneration ? RUNNING_STATUSES.has(lastGeneration.status) : false;
  const isReviewWaiting =
    pendingReviewCount > 0 || (lastGeneration ? REVIEW_STATUSES.has(lastGeneration.status) : false);
  const hasNewerUpload =
    activePack?.publishedAt && lastUpload?.uploadedAt
      ? new Date(lastUpload.uploadedAt).getTime() > new Date(activePack.publishedAt).getTime()
      : false;

  const alerts: HealthAlertView[] = [];
  if (!activePack) {
    alerts.push({
      title: "운영 지식팩이 아직 반영되지 않았습니다.",
      description: "상담 로그를 업로드한 뒤 지식팩을 생성하고 운영에 반영해 주세요.",
      tone: "warning",
    });
  }
  if (!lastUpload) {
    alerts.push({
      title: "상담 로그 업로드 기록이 없습니다.",
      description: "최근 상담 흐름을 반영하려면 먼저 상담 로그를 업로드해 주세요.",
      tone: "warning",
    });
  }
  if (hasNewerUpload) {
    alerts.push({
      title: "새 상담 로그가 운영 지식팩에 아직 반영되지 않았습니다.",
      description: "마지막 운영 반영 이후 업로드된 상담 로그로 지식팩을 다시 생성해 주세요.",
      tone: "warning",
    });
  }
  if (pendingReviewCount > 0) {
    alerts.push({
      title: `검토 대기 항목 ${pendingReviewCount}개가 남아 있습니다.`,
      description: "검토를 마치면 새 지식팩을 운영에 반영할 수 있습니다.",
      tone: "warning",
    });
  }
  if (isGenerationFailed) {
    alerts.push({
      title: "최근 지식팩 생성이 실패했습니다.",
      description: "상담 로그와 생성 조건을 확인한 뒤 다시 생성해 주세요.",
      tone: "danger",
    });
  }

  const ctas: HealthCtaView[] = [];
  if (!lastUpload) {
    ctas.push({
      kind: "upload",
      label: "상담 로그 업로드",
      to: `/workspaces/${workspaceId}/upload`,
    });
  }
  if (isReviewWaiting && lastGeneration?.pipelineJobId) {
    ctas.push({
      kind: "review",
      label: "검토 화면으로 이동",
      to: `/workspaces/${workspaceId}/pipeline-jobs/${lastGeneration.pipelineJobId}/review`,
    });
  }
  if (!activePack || hasNewerUpload || isGenerationFailed || (lastUpload && !lastGeneration)) {
    ctas.push({
      kind: "generate",
      label: "지식팩 생성",
      to: `/workspaces/${workspaceId}/domain-packs`,
    });
  }

  const statusTone: HealthTone =
    isGenerationFailed || !activePack ? "danger" : alerts.length > 0 ? "warning" : "normal";

  return {
    statusTitle: resolveStatusTitle(statusTone, isGenerationRunning, isReviewWaiting),
    statusDescription: resolveStatusDescription(
      statusTone,
      isGenerationRunning,
      isReviewWaiting,
      activePack?.packName,
    ),
    metrics: [
      {
        label: "운영 지식팩",
        value: activePack ? `v${activePack.versionNo}` : "미반영",
        description: activePack?.packName ?? "운영에 반영된 지식팩이 없습니다.",
        tone: activePack ? "normal" : "warning",
      },
      {
        label: "마지막 운영 반영",
        value: formatDate(activePack?.publishedAt),
        description: "고객 상담에 적용된 마지막 지식팩 반영일입니다.",
        tone: activePack?.publishedAt ? "normal" : "warning",
      },
      {
        label: "마지막 상담 로그 업로드",
        value: formatDate(lastUpload?.uploadedAt),
        description: lastUpload?.datasetName ?? "업로드된 상담 로그가 없습니다.",
        tone: lastUpload ? "normal" : "warning",
      },
      {
        label: "마지막 지식팩 생성",
        value: generationStatusLabel(lastGeneration?.status),
        description: formatDate(lastGeneration?.finishedAt ?? lastGeneration?.requestedAt),
        tone: isGenerationFailed ? "danger" : isReviewWaiting ? "warning" : "normal",
      },
      {
        label: "검토 대기",
        value: `${pendingReviewCount}개`,
        description:
          pendingReviewCount > 0
            ? "운영 반영 전에 확인해야 할 항목입니다."
            : "현재 검토 대기 항목이 없습니다.",
        tone: pendingReviewCount > 0 ? "warning" : "normal",
      },
    ],
    alerts,
    ctas,
  };
}

function resolveStatusTitle(
  tone: HealthTone,
  isGenerationRunning: boolean,
  isReviewWaiting: boolean,
): string {
  if (tone === "danger") {
    return "운영 지식팩 확인이 필요합니다.";
  }
  if (isReviewWaiting) {
    return "검토 후 운영 반영을 기다리고 있습니다.";
  }
  if (isGenerationRunning) {
    return "지식팩 생성이 진행 중입니다.";
  }
  if (tone === "warning") {
    return "운영 지식팩을 최신 상태로 맞춰 주세요.";
  }
  return "운영 지식팩이 정상적으로 유지되고 있습니다.";
}

function resolveStatusDescription(
  tone: HealthTone,
  isGenerationRunning: boolean,
  isReviewWaiting: boolean,
  packName?: string,
): string {
  if (tone === "danger") {
    return "아래 경고를 확인하고 다음 행동을 진행해 주세요.";
  }
  if (isReviewWaiting) {
    return "검토 대기 항목을 처리하면 새 지식팩을 운영에 반영할 수 있습니다.";
  }
  if (isGenerationRunning) {
    return "최근 상담 로그를 기준으로 지식팩 생성이 진행 중입니다.";
  }
  if (tone === "warning") {
    return "최근 상담 로그와 운영 반영 상태를 함께 확인해 주세요.";
  }
  return packName
    ? `${packName}이 현재 상담 운영에 적용 중입니다.`
    : "현재 운영 상태가 안정적입니다.";
}

function generationStatusLabel(status?: string | null): string {
  if (!status) {
    return "생성 기록 없음";
  }
  if (status === "SUCCEEDED") {
    return "생성 완료";
  }
  if (status === "FAILED") {
    return "생성 실패";
  }
  if (REVIEW_STATUSES.has(status)) {
    return "검토 대기";
  }
  if (RUNNING_STATUSES.has(status)) {
    return "생성 중";
  }
  return status;
}

function formatDate(value?: string | null): string {
  if (!value) {
    return "기록 없음";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "기록 없음";
  }
  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}
