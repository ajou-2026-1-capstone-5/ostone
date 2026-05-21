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
    name: "ingestion",
    description: "Read and validate raw conversation logs",
    status: "completed",
    duration: "1m 12s",
  },
  {
    id: "preprocessing",
    name: "preprocessing",
    description: "Remove boilerplate, canonical text, PII mask",
    status: "completed",
    duration: "4m 08s",
  },
  {
    id: "intent-discovery",
    name: "intent-discovery",
    description: "Semantic embedding + graph clustering",
    status: "running",
    duration: "6m 34s",
    progress: 78,
  },
  {
    id: "draft-generation",
    name: "draft-generation",
    description: "Generate slot, policy, risk, workflow drafts",
    status: "pending",
  },
  {
    id: "evaluation",
    name: "evaluation",
    description: "K@1, mapping rate, separability scoring",
    status: "pending",
  },
  {
    id: "publish-candidate",
    name: "publish-candidate",
    description: "Produce final artifact and notify backend",
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
        name: s.name,
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
