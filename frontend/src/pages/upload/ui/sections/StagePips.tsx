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
            title={stage.id}
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
