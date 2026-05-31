export interface StageState {
  id: string;
  status: "done" | "running" | "pending" | "failed";
}

export function StagePips({ stages }: { stages: StageState[] }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "3px" }}>
      {stages.map((stage) => {
        const isDone = stage.status === "done";
        const isRunning = stage.status === "running";
        const isFailed = stage.status === "failed";
        const isPending = stage.status === "pending";

        const background = isDone
          ? "var(--signal)"
          : isRunning
            ? "var(--signal)"
            : isFailed
              ? "var(--danger)"
              : "transparent";

        const border = isPending ? "1.5px solid var(--line)" : "none";

        return (
          <div
            key={stage.id}
            title={formatStageName(stage.id)}
            style={{
              width: 8,
              height: 8,
              borderRadius: "50%",
              background,
              border,
              boxSizing: "border-box",
              animation: isRunning ? "pulse 2s infinite" : undefined,
            }}
          />
        );
      })}
    </div>
  );
}

function formatStageName(id: string): string {
  const labels: Record<string, string> = {
    ingestion: "로그 접수",
    preprocessing: "개인정보 정리",
    "intent-discovery": "상담 유형 묶기",
    "draft-generation": "초안 생성",
    evaluation: "품질 점검",
    "publish-candidate": "검토본 준비",
  };
  return labels[id] ?? id;
}
