import { Mono } from "@/shared/ui/ostone/atoms";

interface StageInfo {
  id: string;
  name: string;
  description: string;
  status: "completed" | "running" | "pending";
  duration?: string;
  progress?: number;
}

const STAGES: StageInfo[] = [
  {
    id: "ingestion",
    name: "로그 접수",
    description: "상담 로그를 읽고 파일 형식을 확인합니다",
    status: "completed",
    duration: "1m 12s",
  },
  {
    id: "preprocessing",
    name: "개인정보 정리",
    description: "반복 문구를 정리하고 개인정보를 마스킹합니다",
    status: "completed",
    duration: "4m 08s",
  },
  {
    id: "intent-discovery",
    name: "상담 유형 묶기",
    description: "비슷한 상담을 묶어 상담 유형 후보를 찾습니다",
    status: "running",
    duration: "6m 34s",
    progress: 78,
  },
  {
    id: "draft-generation",
    name: "초안 생성",
    description: "확인 항목, 응대 기준, 주의 사항, 응대 흐름 초안을 만듭니다",
    status: "pending",
  },
  {
    id: "evaluation",
    name: "품질 점검",
    description: "유형 매칭률과 응대 흐름 구분도를 점검합니다",
    status: "pending",
  },
  {
    id: "publish-candidate",
    name: "검토본 준비",
    description: "상담사가 검토할 도메인팩 초안을 준비합니다",
    status: "pending",
  },
];

interface TimelineStage {
  name: string;
  status: "complete" | "completed" | "running" | "pending";
  duration?: string;
}

interface ActiveRunTimelineProps {
  stages?: TimelineStage[];
}

function normalizeStatus(status: TimelineStage["status"]): StageInfo["status"] {
  if (status === "complete") return "completed";
  return status;
}

export function ActiveRunTimeline({ stages }: ActiveRunTimelineProps) {
  const displayStages: StageInfo[] = stages
    ? stages.map((s, i) => ({
        id: s.name,
        name: formatStageName(s.name),
        description: STAGES[i]?.description ?? "",
        status: normalizeStatus(s.status),
        duration: s.duration,
      }))
    : STAGES;

  return (
    <div style={{ position: "relative" }}>
      <style>
        {`
          @keyframes pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.45; }
          }
        `}
      </style>
      {displayStages.map((stage, index) => {
        const isLast = index === STAGES.length - 1;
        const isRunning = stage.status === "running";
        const isCompleted = stage.status === "completed";

        return (
          <div
            key={stage.id}
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: "12px",
              padding: "8px 12px",
              borderLeft: "1px solid var(--line-2)",
              marginLeft: "6px",
            }}
          >
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                marginTop: 4,
              }}
            >
              <div
                style={{
                  width: 12,
                  height: 12,
                  borderRadius: "50%",
                  background: isCompleted
                    ? "var(--signal)"
                    : isRunning
                      ? "var(--signal)"
                      : "transparent",
                  border: isCompleted
                    ? "none"
                    : isRunning
                      ? "2px dashed var(--signal)"
                      : "2px solid var(--line)",
                  animation: isRunning ? "pulse 2s infinite" : undefined,
                  boxSizing: "border-box",
                }}
              />
              {!isLast && (
                <div
                  style={{
                    width: 1,
                    height: 24,
                    background: "var(--line)",
                    marginTop: 2,
                  }}
                />
              )}
            </div>

            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Mono
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    color: isPending(stage.status) ? "var(--ink-3)" : "var(--ink)",
                  }}
                >
                  {stage.name}
                </Mono>
                {stage.duration && (
                  <Mono style={{ fontSize: 10, color: "var(--ink-3)" }}>
                    {stage.duration}
                    {isRunning && stage.progress !== undefined ? ` \u00b7 ${stage.progress}%` : ""}
                  </Mono>
                )}
              </div>
              <div
                style={{
                  fontSize: 11,
                  color: isPending(stage.status) ? "var(--ink-4)" : "var(--ink-2)",
                  marginTop: 2,
                }}
              >
                {stage.description}
              </div>
              {isRunning && stage.progress !== undefined && (
                <div
                  style={{
                    width: "100%",
                    height: 4,
                    borderRadius: 2,
                    background: "var(--line-2)",
                    marginTop: 6,
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      width: `${stage.progress}%`,
                      height: "100%",
                      borderRadius: 2,
                      background: "var(--signal)",
                    }}
                  />
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function isPending(status: StageInfo["status"]): boolean {
  return status === "pending";
}

function formatStageName(name: string): string {
  const labels: Record<string, string> = {
    ingestion: "로그 접수",
    preprocessing: "개인정보 정리",
    "intent-discovery": "상담 유형 묶기",
    "draft-generation": "초안 생성",
    evaluation: "품질 점검",
    "publish-candidate": "검토본 준비",
  };
  return labels[name] ?? name;
}
